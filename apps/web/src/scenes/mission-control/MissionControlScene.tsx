"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { AscentScene } from "@/scenes/ascent/AscentScene";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { SignOffDialog } from "@/components/hud/SignOffDialog";
import { format } from "@/i18n";
import { cn } from "@/lib/utils";
import type { AscentFailure } from "@/game/ascentFlight";
import { useLocalized, useT } from "@/i18n/useT";
import { BRIEFINGS } from "@/game/script";
import { useGameStore } from "@/game/gameStore";
import { useSceneViewpoints } from "@/game/sceneStore";
import { addTrauma } from "@/game/shake";
import { playExplosion, playSfx, setMasterVolume, speak, startRumble, stopSpeaking, type Rumble } from "@/game/sfx";
import { ROOM_SPEAKER, roomScript, type RoomBeat } from "./controlRoomScript";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import { preloadCrowd, startCrowdBed, type CrowdBed } from "@/game/crowdAudio";
import {
  fetchLaunchPlan,
  fetchLaunchSites,
  fetchLaunchWindows,
  launchSimulator,
} from "@/lib/simulation/launch.adapter";
import { assessLaunch, planRequestFor, TRACE_TEXT } from "@/lib/simulation/launch.engine";
import type { LaunchPlan } from "@/lib/simulation/launch.physics";
import type { LaunchConfig, LaunchResult, LaunchSite, LaunchWindowsData } from "@/lib/simulation/launch.types";
import { DEFAULT_SITE_ID, LAUNCH_SITES, OFFLINE_KSC_WINDOWS } from "@/mocks/launch-options";
import { useSimulationWasm } from "@/hooks/useSimulationWasm";
import { useNasaData } from "@/hooks/useNasaData";
import { useServerEngine } from "@/hooks/useServerEngine";
import { serverFirstBudget } from "@/lib/simulation/engine.adapter";
import { LunarEnvironmentPanel } from "@/components/hud/LunarEnvironmentPanel";
import { EasepPanel } from "@/components/dashboard/EasepPanel";
import { ServerEnginePanel } from "@/components/dashboard/ServerEnginePanel";
import { DsnTrackingStatus } from "@/components/hud/DsnTrackingStatus";
import { SpaceWeatherWidget } from "@/components/hud/SpaceWeatherWidget";
import { BuildItYourselfPanel } from "@/components/dashboard/BuildItYourselfPanel";
import type { DsnTelemetryResult } from "@/lib/simulation/nasa.types";
import { useRouter } from "next/navigation";
import { ConfigPanel } from "./ConfigPanel";
import { LaunchEndingScreen } from "./LaunchEndingScreen";
import { LAUNCH_ENDINGS, endingForFailure } from "./launchEndings";
import { mood } from "./mood";
import { EXPLOSION_SECONDS, FLY_SECONDS } from "./SkyExplosion";
import { ControlRoomWorld } from "./ControlRoomWorld";
import { CountdownPanel, FlightPanel, PollPanel } from "./LaunchPanels";
import { formatMissionTime } from "@/lib/format";
import { VIEWPOINTS } from "./layout";
import { realSecondsAt } from "./flight";
import {
  ADAPTER_T,
  CUTOFF_T,
  DOCK_T,
  EPILOGUE,
  FILM_END,
  HOLD_DOWN,
  LES_T,
  SEP2_T,
  SEPARATION_T,
  STAGE2_T,
  STAGE3_T,
} from "./ascent";
import { shotAt } from "./launchShots";
import { KEYWORD_SECONDS, calloutsDue } from "./callouts";
import { radioCall, stopRadio } from "@/game/radio";
import { useSettingsStore } from "@/game/settingsStore";
import {
  startCalmScore,
  startRockScore,
  type RockScore,
} from "@/game/rockScore";
import {
  consoleSeed,
  engineOption,
  tankOption,
} from "@/scenes/workshop/loadout";

/** Master volume while this scene is up (the default is 0.5). */
const MC_VOLUME = 0.9;

/**
 * How loud the engines are at film time `t`: full while a stage burns, a low ring-down in the
 * coast between stages, and a fade once the last engine cuts off.
 */
function thrustLevel(t: number): number {
  const burns: [number, number][] = [
    [0, SEPARATION_T - 1.4],
    [STAGE2_T, SEP2_T - 1.4],
    [STAGE3_T, CUTOFF_T],
  ];
  for (const [a, b] of burns) {
    if (t >= a && t <= b)
      return (
        Math.min(1, 0.7 + (t - a) * 0.3) *
        (t > b - 0.6 ? Math.max(0, (b - t) / 0.6) : 1)
      );
  }
  const coast = t < STAGE3_T ? 0.1 : Math.max(0, 0.1 - (t - CUTOFF_T) * 0.03);
  return t < 0 ? 0 : coast;
}

type Phase =
  | "config"
  | "poll"
  | "countdown"
  | "flight"
  | "failure-pov"
  | "explosion"
  | "anomaly"
  | "budget-cut"
  | "orbit";

/**
 * First attempt as the player finds it: the heavy rocket, the right payload, but 90 % fuel at
 * Kennedy's first 1969 window. Whether that is enough is for the player to work out.
 */
const INITIAL_CONFIG: LaunchConfig = {
  vehicle: "saros",
  payload: "standard",
  fuelPct: 90,
  orbitKm: 185,
  window: "w1",
  site: DEFAULT_SITE_ID,
};

/**
 * Scene 3 — mission control (flight director POV).
 * Loop: configure → GO/NO-GO poll → countdown → liftoff and flight playback → on failure the
 * ANOMALY report and back to configure; on success orbit, then the launch video.
 */
export function MissionControlScene({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const t = useT();
  const m = t.missionControl;
  const localize = useLocalized();
  const router = useRouter();
  const recordLaunch = useGameStore((s) => s.recordLaunch);
  const makeDecision = useGameStore((s) => s.makeDecision);

  // The engines and tanks chosen in the assembly hall decide the vehicle and the first fuel load.
  const loadout = useGameStore((s) => s.log.loadout);
  const [config, setConfig] = useState<LaunchConfig>(() =>
    loadout ? { ...INITIAL_CONFIG, ...consoleSeed(loadout) } : INITIAL_CONFIG,
  );
  const [phase, setPhase] = useState<Phase>("config");
  const [attempt, setAttempt] = useState(1);
  // Sticky: once a configuration has gone to countdown, that objective stays ticked after a hold or a failure.
  const [configured, setConfigured] = useState(false);
  const [ignitionAt, setIgnitionAt] = useState<number | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [alarm, setAlarm] = useState(0);
  const [explodeAt, setExplodeAt] = useState<number | null>(null);
  const [boomFlash, setBoomFlash] = useState(false);
  const { evaluateMissionDesignBudget, calculateDsnTelemetry } = useSimulationWasm();
  const nasa = useNasaData();
  const serverEngine = useServerEngine();
  const evaluateBudget = useMemo(() => serverFirstBudget(evaluateMissionDesignBudget), [evaluateMissionDesignBudget]);
  const [dsnLink, setDsnLink] = useState<DsnTelemetryResult | null>(null);
  useEffect(() => {
    let alive = true;
    calculateDsnTelemetry({ distance_km: nasa.ephemeris.distance_km })
      .then((l) => alive && setDsnLink(l))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [nasa.ephemeris.distance_km, calculateDsnTelemetry]);
  const cinematicTimers = useRef<number[]>([]);
  const pending = useRef<Promise<LaunchResult> | null>(null);

  // Launch sites and, for the chosen one, its three windows with the real weather at the pad.
  const [sites, setSites] = useState<LaunchSite[]>(LAUNCH_SITES);
  useEffect(() => {
    let active = true;
    fetchLaunchSites().then((s) => active && setSites(s));
    return () => {
      active = false;
    };
  }, []);
  const siteId = config.site ?? DEFAULT_SITE_ID;
  const [windows, setWindows] = useState<LaunchWindowsData>(OFFLINE_KSC_WINDOWS);
  const [windowsLoading, setWindowsLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setWindowsLoading(true);
    fetchLaunchWindows(siteId).then((w) => {
      if (!active) return;
      setWindows(w);
      setWindowsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [siteId]);
  const launchWindow = windows.windows.find((w) => w.id === config.window) ?? windows.windows[0]!;

  // Readouts: instant from the engine mirror, then replaced by the server engine's own answer.
  const planKey = JSON.stringify(planRequestFor(config, launchWindow));
  const [serverPlan, setServerPlan] = useState<{ key: string; plan: LaunchPlan } | null>(null);
  useEffect(() => {
    let active = true;
    const id = window.setTimeout(() => {
      fetchLaunchPlan(config, launchWindow).then((plan) => {
        if (active && plan) setServerPlan({ key: planKey, plan });
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [planKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const engineSource = serverPlan?.key === planKey ? "server" : "browser";
  // The liftoff roar is heard while the rocket is low; stopped early on adjust or leaving.
  const roar = useRef<() => void>(() => {});
  const rumbleRef = useRef<Rumble | null>(null);
  useEffect(() => () => roar.current(), []);
  // The launch is the loudest scene (roar, crowd, band, radio at once): everything runs louder here.
  useEffect(() => {
    setMasterVolume(MC_VOLUME);
    return () => setMasterVolume();
  }, []);
  useEffect(() => {
    const timers = cinematicTimers.current;
    return () => {
      for (const id of timers) window.clearTimeout(id);
      mood.dismay = 0;
    };
  }, []);
  const consoleRef = useRef<HTMLElement>(null);
  // The planning console can fold down to its title bar, to look at the pad and the room.
  const [collapsed, setCollapsed] = useState(false);

  useSceneViewpoints(VIEWPOINTS, "console");

  // The console scrolls on small screens; each phase starts at its top.
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: 0 });
    setCollapsed(false);
  }, [phase]);

  const assessment = useMemo(
    () => assessLaunch(config, launchWindow, serverPlan?.key === planKey ? serverPlan.plan : undefined),
    [config, launchWindow, serverPlan, planKey],
  );

  const startCountdown = useCallback(() => {
    // Ask the engine during the countdown, so the result is ready at T-0.
    pending.current = launchSimulator.simulate(config, launchWindow);
    setConfigured(true);
    setPhase("countdown");
  }, [config, launchWindow]);

  /** Lost to the weather: no replacement vehicle, the inquiry (ENDING-5) follows. */
  const weatherLoss = Boolean(result?.weatherLoss);
  const endInWeatherLoss = useCallback(() => {
    makeDecision("weather", "severe_wind");
    onComplete();
  }, [makeDecision, onComplete]);

  const ignite = useCallback(async () => {
    const r = await pending.current;
    if (!r) return;
    setResult(r);
    setIgnitionAt(performance.now());
    addTrauma(0.45);
    playSfx("ignition");
    // The roar lasts the whole burn: the interval below sets its level from the film clock.
    const rumble = startRumble();
    rumbleRef.current = rumble;
    roar.current = rumble.stop;
    setPhase("flight");
  }, []);

  const endFlight = useCallback(() => {
    // Only the live flight ends the flight: a FlightPanel shown again on the anomaly report
    // would otherwise fire onEnd a second time and replay the failure cutscene.
    if (!result || phase !== "flight") return;
    recordLaunch(config, result.isSuccess);
    if (result.isSuccess) {
      setPhase("orbit");
    } else {
      // The flight went wrong: ride it from inside the capsule, then watch it from the control room.
      roar.current();
      setPhase("failure-pov");
    }
  }, [config, result, recordLaunch, phase]);

  /** Back from the capsule: the vehicle comes apart in the sky and the room reacts. */
  const [roomBeat, setRoomBeat] = useState<RoomBeat | null>(null);
  const localeNow = useSettingsStore((s) => s.locale);
  const startExplosion = useCallback(() => {
    const at = performance.now();
    setExplodeAt(at);
    setPhase("explosion");
    const later = (ms: number, fn: () => void) =>
      cinematicTimers.current.push(window.setTimeout(fn, ms));
    // Light arrives first, then the shockwave, then the room goes quiet.
    later(FLY_SECONDS * 1000, () => {
      setBoomFlash(true);
      // The first pop reaches the room almost at once.
      playExplosion("far", 0.5);
    });
    later(FLY_SECONDS * 1000 + 90, () => setBoomFlash(false));
    later(FLY_SECONDS * 1000 + 2300, () => {
      addTrauma(0.85);
      playExplosion("far", 1.15);
    });
    later(FLY_SECONDS * 1000 + 1500, () => {
      mood.dismay = 1;
    });
    later(FLY_SECONDS * 1000 + 3800, () => playSfx("groan"));
    // The room, beat by beat: what the consoles report, the silence, the calls into a dead channel.
    const cause = result && !result.isSuccess ? endingForFailure(result.failureTrace).id : "structural";
    for (const beat of roomScript(cause)) {
      later(beat.at * 1000, () => {
        setRoomBeat(beat);
        speak(localize(beat.line), localeNow, { queue: true, rate: beat.rate && beat.rate < 1 ? beat.rate : undefined, panic: (beat.panic ?? 0) * 0.4 });
        if (beat.voice === "capcom") playSfx("hiss", 0.8);
      });
      later(beat.at * 1000 + 3600, () => setRoomBeat((b) => (b === beat ? null : b)));
    }
    later(EXPLOSION_SECONDS * 1000, () => finishExplosion());
  }, [result, localeNow]); // eslint-disable-line react-hooks/exhaustive-deps

  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    // Dev-only: window.__mc.explode() plays the failure cutscene from anywhere.
    (window as unknown as { __mc?: unknown }).__mc = {
      explode: () => startExplosion(),
      // Jumps the launch film to `t` seconds after ignition (use with a frozen performance.now).
      seek: (t: number) => setIgnitionAt(performance.now() - t * 1000),
    };
  }

  const finishExplosion = useCallback(() => {
    for (const id of cinematicTimers.current) window.clearTimeout(id);
    cinematicTimers.current = [];
    stopSpeaking();
    setRoomBeat(null);
    mood.dismay = 0;
    setExplodeAt(null);
    addTrauma(0.2);
    playSfx("alarm");
    setAlarm((x) => x + 1);
    setPhase("anomaly");
  }, []);

  const adjust = useCallback(() => {
    roar.current();
    mood.dismay = 0;
    setExplodeAt(null);
    setIgnitionAt(null); // the replacement vehicle is back on the pad
    setResult(null);
    setAttempt((a) => a + 1);
    setPhase("config");
  }, []);

  // The launch score: a held organ at the countdown, building to full band and orchestra at
  // staging, then fading as the capsule reaches orbit. Cut off quickly if the flight fails.
  const score = useRef<RockScore | null>(null);
  const calmStop = useRef<((s?: number) => void) | null>(null);
  useEffect(() => {
    if (phase === "countdown") {
      if (!score.current) score.current = startRockScore(0.15);
      return;
    }
    if (phase === "flight" && ignitionAt !== null) {
      const pastBand =
        (performance.now() - ignitionAt) / 1000 >= FILM_END + 0.6;
      if (!pastBand) {
        score.current ??= startRockScore(0.3);
        score.current.hit();
      }
      // The score follows the film: it builds with the climb, drops to a held organ for half a beat
      // before every separation and whenever the film cuts to the people waiting, then hits hard as
      // the bolts fire. The room goes quiet from release and erupts a moment before orbit.
      const beats = [
        SEPARATION_T,
        STAGE2_T,
        LES_T,
        SEP2_T,
        STAGE3_T,
        ADAPTER_T,
      ];
      const hits = new Set<number>();
      const risers = new Set<number>();
      let calm: { stop: (s?: number) => void } | null = calmStop.current
        ? { stop: calmStop.current }
        : null;
      const id = window.setInterval(() => {
        const t = (performance.now() - ignitionAt) / 1000;
        const climb = Math.min(1, t / SEPARATION_T);
        const late = Math.min(
          1,
          Math.max(0, (t - SEPARATION_T) / (ADAPTER_T - SEPARATION_T)),
        );
        let level = 0.45 + 0.4 * climb + 0.15 * late;
        const cut = shotAt(t).id;
        const people = cut.startsWith("room-") || cut.startsWith("crowd-");
        if (people) level = cut.endsWith("cheer") ? 1 : Math.min(level, 0.24);
        for (const b of beats) {
          // The stage separations are twenty operations long: the tension climbs through all of them.
          const long = b === SEPARATION_T || b === SEP2_T;
          const lead = long ? 6.6 : 2;
          if (t >= b - lead && t < b - lead + 0.1 && !risers.has(b)) {
            risers.add(b);
            score.current?.riser(lead - 0.3); // tremolo strings, noise sweep and a timpani roll building to the cut
          }
          if (t >= b - 0.35 && t < b - 0.1) level = 0; // total drop-out, then the hit
          if (t >= b - 0.1 && !hits.has(b) && t < b + 1) {
            hits.add(b);
            score.current?.hit();
          }
        }
        if (t > ADAPTER_T + 3 && !people && t < DOCK_T - 3)
          level = Math.max(level, 0.85); // the long chase out of the atmosphere
        // After the last step the band falls away and a quiet pad takes over for the epilogue.
        if (t >= FILM_END + 0.6 && !calm) {
          score.current?.stop(2.5);
          score.current = null;
          calm = startCalmScore();
          calmStop.current = calm.stop;
        }
        if (!calm) score.current?.setIntensity(level);
        rumbleRef.current?.setLevel(thrustLevel(t) * (people ? 0.7 : 1));
        const cheer = t >= DOCK_T && t < FILM_END + 0.6;
        mood.hush = t > HOLD_DOWN - 1 && !cheer ? 1 : 0;
        mood.joy = cheer ? 1 : 0;
      }, 100);
      return () => window.clearInterval(id);
    }
    if (phase === "orbit") {
      roar.current();
      calmStop.current?.(4);
      calmStop.current = null;
      mood.hush = 0;
      mood.joy = 1;
      score.current?.setIntensity(0.35);
      score.current?.stop(5);
      score.current = null;
      return;
    }
    mood.hush = 0;
    mood.joy = 0;
    score.current?.stop(phase === "failure-pov" ? 0.6 : 1.2);
    score.current = null;
    calmStop.current?.(1);
    calmStop.current = null;
  }, [phase, ignitionAt]);
  useEffect(
    () => () => {
      score.current?.stop(0.3);
      score.current = null;
      calmStop.current?.(0.3);
      calmStop.current = null;
    },
    [],
  );

  // The onlookers' murmur lives from the countdown to the end of the flight. Up close (the film
  // cuts to the crowd) it comes forward and brightens; from the pad or the sky it is a distant hum.
  // It gasps as the capsule climbs past them and cheers when it reaches orbit.
  const crowd = useRef<CrowdBed | null>(null);
  useEffect(() => {
    if (phase === "countdown") preloadCrowd();
    if (phase === "countdown" || phase === "flight") {
      crowd.current ??= startCrowdBed();
      return;
    }
    crowd.current?.stop(phase === "failure-pov" ? 0.4 : 2);
    crowd.current = null;
  }, [phase]);
  useEffect(() => {
    const bed = crowd.current;
    if (!bed) return;
    if (phase === "countdown") {
      bed.setLevel(0.3);
      return;
    }
    if (phase !== "flight" || ignitionAt === null) return;
    let lastShot = "";
    const id = window.setInterval(() => {
      const shot = shotAt((performance.now() - ignitionAt) / 1000).id;
      if (shot === lastShot) return;
      lastShot = shot;
      const close = shot.startsWith("crowd-");
      bed.setLevel(shot === "crowd-cheer" ? 1 : close ? 0.85 : 0.2);
      if (shot === "crowd-cheer") bed.react("cheer");
      // The first cut to the crowd comes right after liftoff: they cheer as the rocket clears the pad.
      else if (shot === "crowd-field") bed.react("cheer", 0.7);
      else if (/^crowd-(field|beach)-[23]$/.test(shot)) bed.react("awe", 0.8);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, ignitionAt]);
  useEffect(
    () => () => {
      crowd.current?.stop(0.3);
      crowd.current = null;
    },
    [],
  );

  // Launch control on the radio: each stage event is called out in a radio-style voice and its name
  // (one keyword) is shown on screen. A call is only made while its moment is fresh, so skipping the
  // film does not replay the chatter, and none is made past the end of a failed flight.
  const locale = useSettingsStore((s) => s.locale);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const [keyword, setKeyword] = useState<{ id: number; text: string } | null>(null);
  const keywordId = useRef(0);
  const burnEnd = result ? realSecondsAt(result.endSec) : Infinity;
  useEffect(() => {
    if (phase !== "flight" || ignitionAt === null) return;
    let last = (performance.now() - ignitionAt) / 1000;
    let hide = 0;
    const id = window.setInterval(() => {
      const now = (performance.now() - ignitionAt) / 1000;
      for (const call of calloutsDue(last, Math.min(now, burnEnd))) {
        const lang = localeRef.current;
        radioCall(call.line, lang, call.voice);
        setKeyword({ id: ++keywordId.current, text: call.keyword[lang] });
        window.clearTimeout(hide);
        hide = window.setTimeout(() => setKeyword(null), KEYWORD_SECONDS * 1000);
      }
      last = now;
    }, 100);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(hide);
      stopRadio();
      setKeyword(null);
    };
  }, [phase, ignitionAt, burnEnd]);

  const briefing = BRIEFINGS["mission-control"];
  const titles: Record<Phase, string> = {
    config: m.configTitle,
    poll: m.pollTitle,
    countdown: m.countdownTitle,
    flight: m.flightTitle,
    "failure-pov": m.flightTitle,
    explosion: m.flightTitle,
    anomaly: m.flightTitle,
    "budget-cut": m.flightTitle,
    orbit: m.flightTitle,
  };
  const worldIgnition = useMemo(
    () => (explodeAt !== null ? explodeAt - 60000 : ignitionAt),
    [explodeAt, ignitionAt],
  );
  const cinematic = phase === "failure-pov" || phase === "explosion";
  // What the capsule POV plays: the engines quit at the end of the recorded flight.
  const failure = useMemo<AscentFailure | undefined>(() => {
    if (!result || result.isSuccess) return undefined;
    return {
      met: Math.max(60, result.endSec),
      code: result.failureTrace[0]?.code ?? "fuel-depleted",
    };
  }, [result]);
  // From the launch command until orbit, the camera is outside watching the rocket. The failure
  // cutscene and the anomaly report are seen from the control room again.
  const launchView =
    phase === "countdown" || phase === "flight" || phase === "orbit";
  // While the vehicle flies (and on the report after), the console shrinks to a corner HUD.
  const flightHud =
    phase === "countdown" ||
    phase === "flight" ||
    phase === "orbit" ||
    phase === "anomaly";
  // When the last engine stops in the 3D view: orbit insertion, or stage 2 running dry.
  const burnEndT = result ? realSecondsAt(result.endSec) : Infinity;
  const overweight =
    result?.failureTrace.some((s) => s.code === "slow-climb") ?? false;



  return (
    <section
      className="relative h-dvh w-full overflow-hidden"
      aria-label={m.sceneLabel}
    >
      {phase !== "failure-pov" && (
        <WorldCanvas label={m.sceneLabel}>
          {/* After a failure the rocket is long gone from the pad: start the explosion with it out of sight. */}
          <ControlRoomWorld
            ignitionAt={worldIgnition}
            launchView={launchView}
            burnEndT={burnEndT}
            explodeAt={explodeAt}
            explodeCause={result && !result.isSuccess ? endingForFailure(result.failureTrace).id : undefined}
          />
        </WorldCanvas>
      )}
      {phase === "failure-pov" && failure && (
        <div className="absolute inset-0 z-30">
          <AscentScene
            failure={failure}
            orbitKm={config.orbitKm}
            onComplete={startExplosion}
          />
        </div>
      )}
      {phase === "explosion" && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 bg-white"
            style={{
              opacity: boomFlash ? 0.7 : 0,
              transition: boomFlash ? "none" : "opacity 1400ms ease-out",
            }}
          />
          <div
            role="status"
            className="bezel absolute left-1/2 top-20 z-20 -translate-x-1/2 bg-space-deep/85 px-6 py-2 text-lg font-semibold tracking-wide text-red-200"
          >
            {m.vehicleLost}
          </div>
          {roomBeat && (
            <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex flex-col items-center gap-1 px-6 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">{localize(ROOM_SPEAKER[roomBeat.voice])}</p>
              <p key={roomBeat.at} className="max-w-3xl animate-in fade-in text-xl font-semibold text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.9)] sm:text-3xl">
                “{localize(roomBeat.line)}”
              </p>
            </div>
          )}
          <div className="absolute bottom-6 right-6 z-20">
            <Button variant="secondary" size="sm" onClick={finishExplosion}>
              {m.skipCinematic}
            </Button>
          </div>
        </>
      )}

      {phase === "flight" && result && ignitionAt !== null && (
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setIgnitionAt(
                performance.now() -
                  (realSecondsAt(result.endSec) +
                    (result.isSuccess ? EPILOGUE : 0) +
                    0.3) *
                    1000,
              )
            }
          >
            {m.skipCinematic}
          </Button>
        </div>
      )}

      {keyword && (
        <div
          key={keyword.id}
          aria-live="polite"
          className="pointer-events-none absolute left-1/2 top-[15%] z-20 -translate-x-1/2 [animation:fade-in_400ms_ease-out]"
        >
          <div className="flex items-center gap-3 border-y border-primary/60 bg-space-deep/55 px-6 py-2 backdrop-blur-sm">
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="font-mono text-lg font-semibold uppercase tracking-[0.25em] text-foreground sm:text-2xl">
              {keyword.text}
            </span>
          </div>
        </div>
      )}

      {alarm > 0 && (
        <div
          key={alarm}
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-alarm-flash bg-warning/35"
        />
      )}

      {/* Hidden in the failure cutscene; on phones also while the corner flight HUD needs the space. */}
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20",
          cinematic && "hidden",
          flightHud && "hidden sm:block",
        )}
      >
        <ObjectivePanel
          className="pointer-events-auto"
          items={[
            {
              id: "configure",
              label: localize(briefing.objectives[0]),
              done: configured,
            },
            {
              id: "launch",
              label: localize(briefing.objectives[1]),
              done: phase === "orbit",
            },
          ]}
        />
      </div>

      {cinematic ? null : flightHud ? (
        // Launch: only a small clock and the stage list in the top-right corner, so the
        // rocket (seen from outside) owns the screen.
        <aside
          aria-label={m.consoleLabel}
          className="absolute right-3 top-16 flex w-[15.5rem] flex-col gap-2 sm:right-8 sm:top-20"
        >
          {phase === "countdown" && (
            <CountdownPanel
              onIgnition={ignite}
              onHold={() => setPhase("poll")}
            />
          )}
          {phase !== "countdown" && result && ignitionAt !== null && (
            <FlightPanel
              config={config}
              result={result}
              ignitionAt={ignitionAt}
              onEnd={endFlight}
            />
          )}
        </aside>
      ) : (
        <aside
          ref={consoleRef}
          aria-label={m.consoleLabel}
          className={cn(
            "bezel absolute inset-x-3 bottom-3 overflow-y-auto bg-space-deep/95 p-3.5",
            "sm:inset-x-auto sm:bottom-auto sm:right-8 sm:top-20 sm:w-[21rem] sm:max-h-[calc(100dvh-6.5rem)]",
            collapsed ? "max-h-none" : "max-h-[50dvh]",
          )}
        >
          <header
            className={cn(
              "flex items-center justify-between gap-2",
              !collapsed && "mb-3",
            )}
          >
            <h2 className="text-base font-semibold">{titles[phase]}</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-foreground/70">
                {format(m.attempt, { n: attempt })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 px-0"
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? m.expand : m.collapse}
                title={collapsed ? m.expand : m.collapse}
              >
                {collapsed ? (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
          </header>

          {!collapsed && phase === "config" && loadout && (
            <p className="mb-3 border-l-2 border-primary bg-space-blue/35 px-3 py-2 text-xs text-foreground/85">
              {format(m.fromWorkshop, {
                engines: localize(engineOption(loadout.engine).name),
                tanks: localize(tankOption(loadout.tank).name),
              })}
            </p>
          )}
          {!collapsed && phase === "config" && (
            <>
              <details className="group mb-3 rounded border border-space-blue/60 bg-space-blue/15 px-3 py-2">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-primary">
                  NASA mission data &amp; design study
                </summary>
                <div className="mt-2 flex flex-col gap-3">
                  <DsnTrackingStatus status={nasa.dsn} link={serverEngine.dsnLink ?? dsnLink} />
                  <SpaceWeatherWidget data={nasa.spaceWeather} className="border-t border-space-blue/60 pt-2" />
                  <LunarEnvironmentPanel data={nasa.lunarEnvironment} className="border-t border-space-blue/60 pt-2" />
                  <EasepPanel data={nasa.easep} className="border-t border-space-blue/60 pt-2" />
                  <ServerEnginePanel
                    status={serverEngine.status}
                    apollo11={serverEngine.apollo11}
                    className="border-t border-space-blue/60 pt-2"
                  />
                  <div className="border-t border-space-blue/60 pt-2">
                    <BuildItYourselfPanel evaluate={evaluateBudget} />
                  </div>
                </div>
              </details>
              <ConfigPanel
                config={config}
                onChange={setConfig}
                assessment={assessment}
                onProceed={() => setPhase("poll")}
                sites={sites}
                windows={windows}
                windowsLoading={windowsLoading}
                engineSource={engineSource}
              />
            </>
          )}
          {!collapsed && phase === "poll" && (
            <PollPanel
              assessment={assessment}
              onLaunch={startCountdown}
              onBack={() => setPhase("config")}
            />
          )}
        </aside>
      )}

      {phase === "anomaly" && result && (
        <LaunchEndingScreen
          ending={endingForFailure(result.failureTrace)}
          trace={result.failureTrace.map((s) => ({
            key: `${s.code}-${s.timestampSec}`,
            time: formatMissionTime(s.timestampSec),
            text: `${localize(TRACE_TEXT[s.code].subsystem)}: ${localize(TRACE_TEXT[s.code].anomaly)}`,
          }))}
          traceLabel={m.traceTitle}
          primaryLabel={weatherLoss ? m.weatherLossContinue : m.adjust}
          onPrimary={weatherLoss ? endInWeatherLoss : adjust}
        />
      )}
      {phase === "budget-cut" && (
        <LaunchEndingScreen
          ending={LAUNCH_ENDINGS["budget-cut"]}
          traceLabel={m.traceTitle}
          primaryLabel={t.play.exitToTitle}
          onPrimary={() => router.push("/")}
        />
      )}

      <SignOffDialog
        open={phase === "orbit"}
        character="flight-director"
        badge={m.go}
        title={m.orbitTitle}
        description={format(m.orbitBody, { km: config.orbitKm })}
        continueLabel={m.continue}
        onContinue={assessment.overBudget ? () => setPhase("budget-cut") : onComplete}
      />
    </section>
  );
}
