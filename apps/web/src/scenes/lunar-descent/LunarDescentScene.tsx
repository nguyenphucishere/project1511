"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { DecisionOverlay } from "@/components/cutscene/DecisionOverlay";
import { LandingFilm } from "./film/LandingFilm";
import { SignOffDialog, SignOffDetails } from "@/components/hud/SignOffDialog";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import { BRIEFINGS } from "@/game/script";
import { useGameStore } from "@/game/gameStore";
import { inputLock, isTypingTarget } from "@/game/input";
import { useSceneViewpoints } from "@/game/sceneStore";
import { addTrauma } from "@/game/shake";
import { playSfx, startLoop } from "@/game/sfx";
import { useSimulationWasm } from "@/hooks/useSimulationWasm";
import { useNasaData } from "@/hooks/useNasaData";
import { useServerEngine } from "@/hooks/useServerEngine";
import { DsnTrackingStatus } from "@/components/hud/DsnTrackingStatus";
import { landingRadar } from "@/lib/simulation/nasa.physics";
import type { DsnTelemetryResult, LandingRadarMeasurement } from "@/lib/simulation/nasa.types";
import { DESCENT_STEPS, KEYFRAMES, installDescentProfile, sampleAt } from "@/mocks/descent";
import { DPS_CAPACITY_KG } from "./flight";
import { LunarEnvironmentPanel } from "@/components/hud/LunarEnvironmentPanel";
import {
  DescentCommand,
  DescentInstruments,
  FlightControls,
  SitePicker,
  formatVs,
  type Cue,
  type PanelSnap,
  type Phase,
  type Trace,
} from "./DescentPanel";
import {
  SITES,
  calloutFor,
  createFlight,
  cutEngine,
  fuelSecondsLeft,
  nudgeTargetVs,
  stepFlight,
  type FlightState,
  type SiteId,
  type Touchdown,
} from "./flight";
import type { StickValue } from "./Joystick";
import { LandingRadarProfile } from "./LandingRadarProfile";
import { LunarWorld } from "./LunarWorld";
import { radarInputAt, terrainOffsetAt } from "./radar";
import {
  VIEWPOINTS,
  initialView,
  missionTimeNow,
  tiltAt,
  type DescentClock,
  type FlightView,
} from "./layout";

/** Feedback per control, scaled to how big the moment is: ignition kicks, small switches nudge. */
const PRESS_TRAUMA = [0.4, 0.15, 0.12, 0.12] as const;
const TOUCHDOWN_TRAUMA = 0.55;
const CRASH_TRAUMA = 0.95;
/** Beat between touchdown and the dialog, so the dust and the thump land first. */
const DIALOG_DELAY_MS = 1600;
/** DOM readouts and charts refresh at this rate; the 3D view runs every frame. */
const PANEL_TICK_MS = 80;
/** Controls that are done once the lander is on the ground with the engine cut. */
const ALL_STEPS = DESCENT_STEPS.length;
/** The step the player starts at: the third control, the low gate (steps 0 and 1 are in the film). */
const LOW_GATE_STEP = 2;
/** Mission time of the low gate, where the player takes over (the engine profile's). */
const gateT = () => KEYFRAMES[2]!.t;

const EMPTY_TRACE: Trace = { xs: [], alt: [], vs: [] };

function makeSnap(v: FlightView, f: FlightState | null, live: boolean): PanelSnap {
  // Where it would touch down if nothing changed: time-to-ground at the current descent rate.
  const secondsToGround = Math.min(60, v.altM / Math.max(0.3, -v.vsMs));
  return {
    t: v.t,
    altM: v.altM,
    vsMs: v.vsMs,
    hsMs: v.hsMs,
    xM: v.xM,
    predictedX: v.xM + v.hsMs * secondsToGround,
    fuelPct: v.fuelPct,
    fuelSec: live && f ? fuelSecondsLeft(f) : 0,
    throttle: v.throttle,
    targetVs: live && f ? f.targetVs : v.vsMs,
    engineOn: v.engineOn,
    contact: v.contact,
    callout: live && f ? calloutFor(f) : null,
  };
}

/** The scripted part: powered descent and pitch-over follow the engine's descent profile. */
function writeScriptedView(v: FlightView, clock: DescentClock, phase: Phase, siteId: SiteId, now: number): void {
  const t = missionTimeNow(clock, now);
  const s = sampleAt(t);
  const burning = clock.stepsDone >= 1;
  v.t = t;
  v.altM = s.altM;
  v.vsMs = s.vsMs;
  v.xM = 0;
  v.hsMs = 0;
  v.engineOn = burning;
  v.throttle = burning ? s.throttle : 0;
  // Attitude jets pulse while the lander pitches over.
  v.rcs = phase === "playing" && clock.stepsDone === 2 && Math.sin(now * 0.008) > 0.45 ? 1 : 0;
  v.tilt = tiltAt(t);
  v.fuelPct = s.fuelPct;
  v.stepsDone = clock.stepsDone;
  v.contact = false;
  v.manual = false;
  v.showSites = clock.stepsDone >= 2 && phase !== "playing";
  v.siteId = v.showSites ? siteId : null;
}

/** The flown part: the 3D view mirrors the flight model. */
function writeFlightView(v: FlightView, f: FlightState): void {
  v.t = gateT() + f.elapsed;
  v.altM = f.altM;
  v.vsMs = f.vsMs;
  v.xM = f.xM;
  v.hsMs = f.hsMs;
  v.throttle = f.throttle;
  v.rcs = f.rcs;
  v.tilt = tiltAt(v.t);
  v.fuelPct = f.fuelPct;
  v.engineOn = f.engineOn;
  v.stepsDone = f.engineCut ? 4 : 3;
  v.contact = f.contact;
  v.manual = true;
  v.showSites = true;
  v.siteId = f.siteId;
}

/**
 * Scene 5 — lunar descent (astronaut POV).
 * The computer flies the first two stages (powered descent, pitch-over) on a scripted profile. At
 * the low gate the lander is the player's: choose a landing site, then fly the last 150 m on a
 * real flight model (lunar gravity, finite fuel, rate-of-descent hold and sideways thrusters),
 * cut the engine at the contact light, and be judged on speed, position and fuel.
 */
/** Stick values inside this fraction of full travel read as zero (gamepad sticks never rest at exactly 0). */
const PAD_DEAD_ZONE = 0.15;

interface PadReading {
  /** Left stick, -1 (left) .. 1 (right). */
  x: number;
  /** Left stick pushed up (slower descent) is positive. */
  y: number;
  /** A / cross held: null the drift. */
  nullDrift: boolean;
  /** B / circle held: engine stop. */
  cut: boolean;
}

const NO_PAD: PadReading = { x: 0, y: 0, nullDrift: false, cut: false };

const axis = (v: number) => {
  const a = Math.abs(v);
  return a < PAD_DEAD_ZONE ? 0 : Math.sign(v) * ((a - PAD_DEAD_ZONE) / (1 - PAD_DEAD_ZONE));
};

/** The first connected gamepad's left stick and two buttons; nothing when there is none (or no Gamepad API). */
function readGamepad(): PadReading {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return NO_PAD;
  const g = Array.from(navigator.getGamepads()).find((p): p is Gamepad => !!p && p.connected);
  if (!g) return NO_PAD;
  return {
    x: axis(g.axes[0] ?? 0),
    y: -axis(g.axes[1] ?? 0),
    nullDrift: !!g.buttons[0]?.pressed,
    cut: !!g.buttons[1]?.pressed,
  };
}

function LunarDescentPlay({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const d = t.lunarDescent;
  const localize = useLocalized();
  const recordLanding = useGameStore((s) => s.recordLanding);

  // The films have flown the powered descent and the pitch-over: the player takes over at the low gate.
  const [clock, setClock] = useState<DescentClock>(() => ({ stepsDone: LOW_GATE_STEP, segmentStart: performance.now() - 60_000 }));
  const [phase, setPhase] = useState<Phase>("hold");
  const [siteId, setSiteId] = useState<SiteId>("A");
  const [attempt, setAttempt] = useState(0);
  const [snap, setSnap] = useState<PanelSnap>(() => makeSnap(initialView(), null, false));
  const [trace, setTrace] = useState<Trace>(EMPTY_TRACE);
  const [result, setResult] = useState<Touchdown | null>(null);
  const [dialog, setDialog] = useState(false);
  const { stepDescent, lastDescentState, calculateLandingRadar, calculateDsnTelemetry, simulateDescentProfile } =
    useSimulationWasm();
  // The descent profile: the simulation engine's, on the engine's own lunar gravity.
  useEffect(() => {
    simulateDescentProfile({})
      .then((p) => installDescentProfile(p))
      .catch(() => {});
  }, [simulateDescentProfile]);
  const nasa = useNasaData();
  const serverEngine = useServerEngine({ apollo11: false });
  const [radar, setRadar] = useState<LandingRadarMeasurement>(() => landingRadar(radarInputAt(0)));
  const [dsnLink, setDsnLink] = useState<DsnTelemetryResult | null>(null);

  // Mutable state the frame loop owns. React state mirrors what the DOM needs.
  const view = useRef<FlightView>(initialView());
  const flight = useRef<FlightState | null>(null);
  const clockRef = useRef(clock);
  const phaseRef = useRef(phase);
  const siteRef = useRef(siteId);
  const held = useRef({ left: false, right: false, stop: false });
  // The on-screen joystick (-1..1 on each axis) and the last gamepad engine-stop button state.
  const stick = useRef({ x: 0, y: 0 });
  const padStop = useRef(false);
  const traceRef = useRef<Trace>({ xs: [], alt: [], vs: [] });
  const timers = useRef<number[]>([]);
  // The descent engine burns from powered descent to engine stop.
  const engine = useRef<() => void>(() => {});
  const pressRef = useRef<(index: number) => void>(() => {});

  useSceneViewpoints(VIEWPOINTS, "window");

  const updateClock = useCallback((next: DescentClock) => {
    clockRef.current = next;
    setClock(next);
  }, []);
  const goPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const chooseSite = useCallback((id: SiteId) => {
    siteRef.current = id;
    setSiteId(id);
  }, []);
  const clearHeld = useCallback(() => {
    held.current.left = held.current.right = held.current.stop = false;
    stick.current.x = stick.current.y = 0;
  }, []);
  const stopEngine = useCallback(() => {
    engine.current();
    engine.current = () => {};
  }, []);

  // The flight ends: judge it, tell the player, and (on success) log it for the end screen.
  const finishFlight = useCallback(
    (f: FlightState, now: number) => {
      const td = f.touchdown;
      if (!td) return;
      stopEngine();
      clearHeld();
      view.current.touchdownAt = now;
      view.current.crashed = !td.success;
      setResult(td);
      // Report the touchdown to the simulation engine.
      stepDescent({
        altitude_m: 0,
        vertical_velocity_mps: -td.vsMs,
        horizontal_velocity_mps: td.hsMs,
        throttle_pct: 0,
        propellant_remaining_kg: Math.max(0, (td.fuelPct / 100) * DPS_CAPACITY_KG),
        agc_cpu_duty_pct: 72.0,
        is_bingo_fuel: td.fuelPct < 5,
        is_landed: td.success,
        touchdown_status: td.success ? "SAFE_LANDING" : "CRASH",
      }).catch(() => {});
      if (td.success) {
        addTrauma(TOUCHDOWN_TRAUMA);
        playSfx("touchdown");
        recordLanding({ touchdownMs: Number(td.vsMs.toFixed(1)), fuelLeftPct: Number(td.fuelPct.toFixed(1)) });
        // An engine left running at contact leaves the last switch undone.
        updateClock({ stepsDone: td.engineOn ? ALL_STEPS - 1 : ALL_STEPS, segmentStart: null });
        goPhase("landed");
      } else {
        addTrauma(CRASH_TRAUMA);
        playSfx("bang");
        updateClock({ stepsDone: ALL_STEPS - 1, segmentStart: null });
        goPhase("crashed");
      }
      timers.current.push(window.setTimeout(() => setDialog(true), DIALOG_DELAY_MS));
    },
    [clearHeld, goPhase, recordLanding, stepDescent, stopEngine, updateClock],
  );

  // One loop drives everything: the scripted profile or the flight model, the 3D view, the panel.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let sincePanel = 0;

    const tick = () => {
      const ph = phaseRef.current;
      const live = ph === "manual";
      setSnap(makeSnap(view.current, flight.current, live));
      if (ph === "playing" || ph === "manual") {
        const tr = traceRef.current;
        const v = view.current;
        if (tr.xs.length === 0 || v.t > tr.xs[tr.xs.length - 1]) {
          tr.xs.push(v.t);
          tr.alt.push(v.altM);
          tr.vs.push(v.vsMs);
          setTrace({ xs: [...tr.xs], alt: [...tr.alt], vs: [...tr.vs] });
        }
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const v = view.current;
      const f = flight.current;
      const ph = phaseRef.current;

      if (ph === "manual" && f) {
        const h = held.current;
        const pad = readGamepad();
        // Keys, the on-screen stick and a gamepad all add up; the model clamps the sum.
        const rcs = (h.right ? 1 : 0) - (h.left ? 1 : 0) + stick.current.x + pad.x;
        const rod = stick.current.y + pad.y;
        stepFlight(f, { rcs, rod, nullDrift: h.stop || pad.nullDrift }, dt);
        if (pad.cut && !padStop.current) pressRef.current(3);
        padStop.current = pad.cut;
        writeFlightView(v, f);
        if (f.status !== "flying") finishFlight(f, now);
      } else if (ph === "hold" || ph === "playing") {
        writeScriptedView(v, clockRef.current, ph, siteRef.current, now);
      }

      sincePanel += dt * 1000;
      if (sincePanel >= PANEL_TICK_MS) {
        sincePanel = 0;
        tick();
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finishFlight]);

  // The descent engine has been burning since the film: keep its roar going until engine stop.
  useEffect(() => {
    engine.current = startLoop("engine");
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      engine.current();
      inputLock.keys = false;
    },
    [],
  );

  // While flying, WASD and the arrows belong to the lander, not the camera.
  useEffect(() => {
    inputLock.keys = phase === "manual";
    return () => {
      inputLock.keys = false;
    };
  }, [phase]);

  const onStick = useCallback((v: StickValue) => {
    stick.current.x = v.x;
    stick.current.y = v.y;
  }, []);

  const nudge = useCallback((dir: 1 | -1) => {
    const f = flight.current;
    if (f && phaseRef.current === "manual") nudgeTargetVs(f, dir);
  }, []);

  const hold = useCallback((_control: "null", on: boolean) => {
    held.current.stop = on;
  }, []);

  const press = useCallback(
    (index: number) => {
      const ph = phaseRef.current;

      // Engine stop is judged on the live flight, not the panel snapshot.
      if (index === 3) {
        const f = flight.current;
        if (ph !== "manual" || !f || f.status !== "flying" || !f.contact || !f.engineOn) return;
        cutEngine(f);
        stopEngine();
        addTrauma(PRESS_TRAUMA[3]);
        playSfx("switch");
        updateClock({ stepsDone: ALL_STEPS, segmentStart: null });
        return;
      }

      if (ph !== "hold" || clockRef.current.stepsDone !== index || index > 2) return;
      addTrauma(PRESS_TRAUMA[index]);
      playSfx("switch");
      // The state the engine's profile is in at this switch (PDI, high gate, low gate).
      const at = sampleAt(KEYFRAMES[index]!.t);
      stepDescent({
        altitude_m: at.altM,
        vertical_velocity_mps: at.vsMs,
        horizontal_velocity_mps: at.hsMs,
        throttle_pct: at.throttle * 100,
        propellant_remaining_kg: (at.fuelPct / 100) * DPS_CAPACITY_KG,
        agc_cpu_duty_pct: index === 1 ? 85.0 : 72.0,
        is_bingo_fuel: false,
        is_landed: false,
        touchdown_status: "IN_FLIGHT",
      }).catch(() => {});

      if (index === 2) {
        // Low gate: the lander is the player's from here.
        flight.current = createFlight(siteRef.current, attempt);
        clearHeld();
        traceRef.current = { xs: [], alt: [], vs: [] };
        updateClock({ stepsDone: 3, segmentStart: null });
        goPhase("manual");
        return;
      }

      const playSec = DESCENT_STEPS[index].playSec ?? 0;
      if (index === 0) engine.current = startLoop("engine");
      updateClock({ stepsDone: index + 1, segmentStart: performance.now() });
      goPhase("playing");
      timers.current.push(
        window.setTimeout(() => {
          goPhase("hold");
          if (index === 1) playSfx("chime");
        }, playSec * 1000),
      );
    },
    [attempt, clearHeld, goPhase, stepDescent, stopEngine, updateClock],
  );
  pressRef.current = press;
  const onPress = useCallback((index: number) => pressRef.current(index), []);

  // After a crash: back to the low gate, same site, a slightly different leftover drift.
  const retry = useCallback(() => {
    const next = attempt + 1;
    setDialog(false);
    setResult(null);
    setAttempt(next);
    flight.current = createFlight(siteRef.current, next);
    clearHeld();
    view.current.touchdownAt = null;
    view.current.crashed = false;
    traceRef.current = { xs: [], alt: [], vs: [] };
    setTrace(EMPTY_TRACE);
    stopEngine();
    engine.current = startLoop("engine");
    updateClock({ stepsDone: 3, segmentStart: null });
    goPhase("manual");
  }, [attempt, clearHeld, goPhase, stopEngine, updateClock]);

  // Keyboard: digits choose a site at the low gate; during the flight the arrows/WASD fly the lander.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      const ph = phaseRef.current;

      if (ph === "hold" && clockRef.current.stepsDone === 2) {
        const n = Number(e.code.replace(/^(Digit|Numpad)/, ""));
        if (n >= 1 && n <= SITES.length) {
          e.preventDefault();
          chooseSite(SITES[n - 1].id);
          playSfx("click");
        }
        return;
      }
      if (ph !== "manual") return;

      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          e.preventDefault();
          if (!e.repeat) nudge(1);
          break;
        case "ArrowDown":
        case "KeyS":
          e.preventDefault();
          if (!e.repeat) nudge(-1);
          break;
        case "ArrowLeft":
        case "KeyA":
          e.preventDefault();
          held.current.left = true;
          break;
        case "ArrowRight":
        case "KeyD":
          e.preventDefault();
          held.current.right = true;
          break;
        case "KeyX":
          e.preventDefault();
          held.current.stop = true;
          break;
        case "KeyE":
          e.preventDefault();
          pressRef.current(3);
          break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") held.current.left = false;
      else if (e.code === "ArrowRight" || e.code === "KeyD") held.current.right = false;
      else if (e.code === "KeyX") held.current.stop = false;
    };
    const onBlur = () => clearHeld();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [chooseSite, clearHeld, nudge]);

  const manual = phase === "manual";

  // Landing radar reads the live flight: the scripted profile until the low gate, then the
  // player's own altitude and rates (sideways speed is what the radar's beams see by then).
  const radarIn = radarInputAt(snap.t);
  const radarAlt = snap.altM;
  const radarVs = snap.vsMs;
  const radarHs = manual ? Math.abs(snap.hsMs) : radarIn.horizontal_vel_mps;
  const radarPitch = radarIn.pitch_angle_deg;
  useEffect(() => {
    let alive = true;
    calculateLandingRadar({
      inertial_alt_m: radarAlt,
      vertical_vel_mps: radarVs,
      horizontal_vel_mps: radarHs,
      terrain_elevation_offset_m: terrainOffsetAt(radarAlt),
      pitch_angle_deg: radarPitch,
    })
      .then((m) => alive && setRadar(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [radarAlt, radarVs, radarHs, radarPitch, calculateLandingRadar]);

  // S-band link to Earth for the current Earth–Moon distance (Eagle is on the near side).
  useEffect(() => {
    let alive = true;
    calculateDsnTelemetry({ distance_km: nasa.ephemeris.distance_km, true_anomaly_deg: 0 })
      .then((l) => alive && setDsnLink(l))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [nasa.ephemeris.distance_km, calculateDsnTelemetry]);
  const choosingSite = phase === "hold" && clock.stepsDone === 2;
  // The switch that may be thrown now (panel, console lamp and 3D hotspot agree on this).
  const armed: number | null =
    phase === "hold" && clock.stepsDone < 3 ? clock.stepsDone : manual && snap.contact && snap.engineOn ? 3 : null;
  const flightMode = clock.stepsDone >= 2 && phase !== "playing";

  // Sound for the crew's urgent calls, once each time the call changes.
  const calloutId = manual ? (snap.callout?.id ?? null) : null;
  const calloutTone = manual ? (snap.callout?.tone ?? null) : null;
  useEffect(() => {
    if (!calloutId) return;
    if (calloutTone === "alert") playSfx("noGo");
    else if (calloutTone === "caution") playSfx("caution");
    else if (calloutId === "contact") playSfx("contact");
  }, [calloutId, calloutTone]);

  const callText = (id: keyof typeof d.call) =>
    format(d.call[id], { v: Math.abs(snap.hsMs).toFixed(1), s: Math.round(snap.fuelSec) });

  const cue: Cue =
    phase === "landed"
      ? { text: d.touchdownBody, tone: "info" }
      : phase === "crashed" && result?.reason
        ? { text: d.crash[result.reason], tone: "alert" }
        : manual && snap.callout
          ? { text: callText(snap.callout.id), tone: snap.callout.tone }
          : { text: localize(DESCENT_STEPS[Math.min(armed ?? clock.stepsDone, ALL_STEPS - 1)].cue), tone: "info" };

  // Armstrong says what is on the cue. A call that carries a live number on screen has a recording without
  // the number (callVoice). The touchdown / crash line is read by the result card, so not twice. A short delay
  // lets a flickering call settle before anything is said.
  const voiceId = manual && snap.callout ? snap.callout.id : null;
  const voiceAs = voiceId && voiceId in d.callVoice ? d.callVoice[voiceId as keyof typeof d.callVoice] : undefined;
  useVoiceLine(phase === "landed" || phase === "crashed" ? null : cue.text, { as: voiceAs, delayMs: 350 });

  const buttonLabel = choosingSite
    ? format(d.confirmSite, { id: siteId })
    : localize(DESCENT_STEPS[manual ? 3 : Math.min(clock.stepsDone, ALL_STEPS - 1)].label);

  const briefing = BRIEFINGS["lunar-descent"];
  const showBanner = manual && snap.callout && (snap.callout.tone !== "info" || snap.callout.id === "contact");
  const stars = result?.stars ?? 0;

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={d.sceneLabel}>
      <WorldCanvas label={d.sceneLabel}>
        <LunarWorld view={view} stepsDone={clock.stepsDone} armed={armed} onPress={onPress} />
      </WorldCanvas>

      <div className="pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20">
        <ObjectivePanel
          className="pointer-events-auto"
          items={[
            { id: "site", label: localize(briefing.objectives[0]), done: clock.stepsDone >= 3 },
            { id: "land", label: localize(briefing.objectives[1]), done: phase === "landed" },
            { id: "stop", label: localize(briefing.objectives[2]), done: phase === "landed" && clock.stepsDone >= ALL_STEPS },
          ]}
        />
        {manual && attempt > 0 && (
          <p className="mt-1.5 bg-space-deep/80 px-2.5 py-1 font-mono text-xs text-foreground/70 backdrop-blur-sm">
            {format(d.attempt, { n: attempt + 1 })}
          </p>
        )}
      </div>

      {/* The crew's urgent calls, where the pilot is already looking. */}
      {showBanner && snap.callout && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-3 sm:top-20">
          <p
            key={snap.callout.id}
            className={
              "animate-fade-in bezel bezel-sm px-5 py-2 text-center text-base font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md sm:text-lg " +
              (snap.callout.tone === "alert"
                ? "bg-nasa-red/90 text-white"
                : snap.callout.tone === "caution"
                  ? "bg-space-gold/95 text-space-deep"
                  : "bg-space-cyan/90 text-space-deep")
            }
          >
            {callText(snap.callout.id)}
          </p>
        </div>
      )}

      {phase === "crashed" && (
        <div key={attempt} aria-hidden className="pointer-events-none absolute inset-0 animate-alarm-flash bg-nasa-red/45" />
      )}

      {/*
        Compact console, anchored top-right over the sky so the lunar surface and the switches on
        the 3D console stay in view. On phones it docks to the bottom edge as a short sheet.
      */}
      <aside
        aria-label={d.panelLabel}
        className="absolute inset-x-3 bottom-3 flex max-h-[46dvh] flex-col gap-2 overflow-y-auto sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-20 sm:max-h-[calc(100dvh-6.5rem)] sm:w-[19rem]"
      >
        <h2 className="sr-only">{d.panelLabel}</h2>
        <div className="bezel bezel-sm shrink-0 bg-space-deep/85 p-3 backdrop-blur-sm">
          <DescentCommand
            stepsDone={clock.stepsDone}
            armed={armed}
            phase={phase}
            cue={cue}
            buttonLabel={buttonLabel}
            onPress={onPress}
          >
            {choosingSite && <SitePicker siteId={siteId} onSelect={chooseSite} />}
            {manual && <FlightControls targetVs={snap.targetVs} disabled={!snap.engineOn} onStick={onStick} onHold={hold} />}
          </DescentCommand>
        </div>
        <div className="bezel bezel-sm shrink-0 bg-space-deep/85 px-3 py-2.5 backdrop-blur-sm">
          <DescentInstruments snap={snap} siteId={flightMode ? siteId : null} trace={trace} flightMode={flightMode} />
          {lastDescentState && (
            <div className="mt-2 border-t border-space-blue/60 pt-1.5 font-mono text-[10px] text-foreground/75">
              <div className="flex justify-between">
                <span>LMDE THROTTLE: {lastDescentState.throttle_pct.toFixed(1)}%</span>
                <span>AGC CPU: {lastDescentState.agc_cpu_duty_pct.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span>DPS PROP: {Math.round(lastDescentState.propellant_remaining_kg)} kg</span>
                <span>STATUS: {lastDescentState.touchdown_status}</span>
              </div>
            </div>
          )}
        </div>
        <div className="bezel bezel-sm flex shrink-0 flex-col gap-2.5 bg-space-deep/85 px-3 py-2.5 backdrop-blur-sm">
          <LandingRadarProfile measurement={radar} />
          <DsnTrackingStatus status={nasa.dsn} link={serverEngine.dsnLink ?? dsnLink} compact className="border-t border-space-blue/60 pt-2" />
          <LunarEnvironmentPanel data={nasa.lunarEnvironment} className="border-t border-space-blue/60 pt-2" />
        </div>
      </aside>

      <SignOffDialog
        open={dialog}
        character="astronaut"
        status={result && !result.success ? "fault" : "go"}
        badge={result && !result.success ? d.crashBadge : d.soft}
        title={result && !result.success ? d.crashTitle : d.touchdownTitle}
        description={result && !result.success && result.reason ? d.crash[result.reason] : d.touchdownBody}
        continueLabel={result && !result.success ? d.retry : d.continue}
        onContinue={result && !result.success ? retry : onComplete}
      >
        {result && (
          <SignOffDetails>
            <dt className="text-foreground/80">{d.touchdownSpeed}</dt>
            <dd className="text-right font-mono">{formatVs(result.vsMs)}</dd>
            <dt className="text-foreground/80">{d.sideSpeed}</dt>
            <dd className="text-right font-mono">{formatVs(result.hsMs)}</dd>
            <dt className="text-foreground/80">{d.fuelLeft}</dt>
            <dd className="text-right font-mono">{result.fuelPct.toFixed(1)}%</dd>
            <dt className="text-foreground/80">{format(d.offsetFromSite, { id: siteId })}</dt>
            <dd className="text-right font-mono">{result.offsetM.toFixed(1)} m</dd>
            {result.success && (
              <>
                <dt className="text-foreground/80">{d.rating}</dt>
                <dd className="text-right text-lg leading-none text-primary" aria-label={format(d.stars, { n: stars })}>
                  {"★".repeat(stars)}
                  <span className="text-foreground/30">{"★".repeat(3 - stars)}</span>
                </dd>
              </>
            )}
          </SignOffDetails>
        )}
      </SignOffDialog>
    </section>
  );
}

/**
 * The landing chapter: the approach film (undocking, powered descent, the program alarm, the
 * pitch-over), then the player's own descent. The touchdown film is its own step after a safe landing.
 */
/** The film pauses here, a moment after the computer's alarm and the commander's question, to ask the player. */
const ALARM_CUT = 43;

/** A call that ends the mission: the abort at the 1202 alarm, landing in the boulders, or the wave-off. */
const missionEnded = () => useGameStore.getState().narrative.ending !== null;

/**
 * The landing chapter, straight after the ship reaches lunar orbit, in the order it happened: the
 * first part of the approach film (undocking, powered descent, the 1202 alarm), your call on the
 * alarm, the rest of the film (pitch-over, the boulders ahead), your call on where to land, and then
 * your own final descent from the low gate. The touchdown film is its own step after a safe landing.
 */
export function LunarDescentScene({ onComplete }: { onComplete: () => void }) {
  const stepId = useGameStore((s) => s.stepId);
  const [stage, setStage] = useState<"film-a" | "alarm" | "film-b" | "landing" | "play">("film-a");
  if (stepId === "touchdown-film") return <LandingFilm part="touchdown" onComplete={onComplete} />;
  switch (stage) {
    case "film-a":
      return <LandingFilm part="approach" to={ALARM_CUT} onComplete={() => setStage("alarm")} />;
    case "alarm":
      return (
        <DecisionOverlay
          decisionId="agc-alarm-decision"
          chapter="lunar-descent"
          onDone={() => (missionEnded() ? onComplete() : setStage("film-b"))}
        />
      );
    case "film-b":
      return <LandingFilm part="approach" from={ALARM_CUT} onComplete={() => setStage("landing")} />;
    case "landing":
      return (
        <DecisionOverlay
          decisionId="landing-decision"
          chapter="lunar-descent"
          onDone={() => (missionEnded() ? onComplete() : setStage("play"))}
        />
      );
    case "play":
      return <LunarDescentPlay onComplete={onComplete} />;
  }
}
