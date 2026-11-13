"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { SignOffDialog } from "@/components/hud/SignOffDialog";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import {
  INSERTION_MET,
  altitudeKm,
  formatMet,
  gForce,
  speedKms,
  vibration,
  type AscentEvent,
  type AscentEventId,
  type AscentFailure,
} from "@/game/ascentFlight";
import { useGameStore } from "@/game/gameStore";
import { BRIEFINGS } from "@/game/script";
import { useSettingsStore } from "@/game/settingsStore";
import { addTrauma } from "@/game/shake";
import {
  playSfx,
  speak,
  startAlarm,
  startRumble,
  startScore,
  stopSpeaking,
  type Rumble,
  type Score,
} from "@/game/sfx";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { AscentWorld, createFlight, type AscentFlight, type SunScreen } from "./AscentWorld";

type Phase = "ride" | "orbit" | "float" | "done";

interface Hud {
  met: number;
  alt: number;
  speed: number;
  g: number;
  alarm: boolean;
}

const DEFAULT_ORBIT_KM = 185;

interface AscentSceneProps {
  /** Called when the scene is over: after the sign-off (success) or when the screen cuts away (failure). */
  onComplete: () => void;
  /**
   * Play the doomed flight instead: warnings, engine failure, tumble, explosion, then cut away.
   * `failure.met` is the mission time at which the engines quit.
   */
  failure?: AscentFailure;
  /** Override the orbit altitude (km); otherwise the player's chosen launch configuration. */
  orbitKm?: number;
}

/**
 * Ascent (astronaut POV). Strapped into the capsule seat: the rocket shakes through Max Q and
 * stage separation while the computer calls out events, the sky turns black, and the engines cut.
 * Then weightlessness: release the harness, float to the window, look at Earth.
 * With `failure`, the same ride goes wrong instead.
 */
export function AscentScene({ onComplete, failure, orbitKm: orbitOverride }: AscentSceneProps) {
  const t = useT();
  const a = t.ascent;
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const configuredKm = useGameStore((s) => s.log.launchConfig?.orbitKm);
  const orbitKm = orbitOverride ?? configuredKm ?? DEFAULT_ORBIT_KM;

  const flight = useRef<AscentFlight>(createFlight());
  // Dev-only handle for jumping around the timeline from the console (window.__ascent.current.met = 300).
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as { __ascent?: unknown }).__ascent = flight;
  }
  const rumble = useRef<Rumble | null>(null);
  const score = useRef<Score | null>(null);
  const stopAlarm = useRef<() => void>(() => {});
  const timers = useRef<number[]>([]);
  const section = useRef<HTMLElement>(null);
  const flareRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [phase, setPhase] = useState<Phase>("ride");
  const [hud, setHud] = useState<Hud>({ met: 0, alt: 0, speed: 0, g: 1, alarm: false });
  const [callout, setCallout] = useState<{ id: AscentEventId; n: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [boom, setBoom] = useState(false);
  const [black, setBlack] = useState(false);
  const phaseRef = useRef<Phase>("ride");
  phaseRef.current = phase;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const aRef = useRef(a);
  aRef.current = a;

  const briefing = BRIEFINGS.ascent;

  // Engine roar and the film score, from the moment the scene starts.
  useEffect(() => {
    rumble.current = startRumble();
    score.current = startScore(failure ? "ride" : "ride");
    const pending = timers.current;
    return () => {
      rumble.current?.stop();
      score.current?.stop();
      stopAlarm.current();
      stopSpeaking();
      for (const id of pending) window.clearTimeout(id);
    };
  }, [failure]);

  // Poll the shared flight state ~10 times a second for the HUD, and steer the roar's loudness.
  useEffect(() => {
    const id = window.setInterval(() => {
      const f = flight.current;
      setHud({
        met: f.met,
        alt: altitudeKm(f.met, orbitKm),
        speed: speedKms(f.met),
        g: f.mode === "failing" ? 0.2 : gForce(f.met),
        alarm: f.alarm,
      });
      let level = 0;
      if (f.mode === "ride") level = 0.25 + vibration(f.met) * 0.75;
      else if (f.mode === "trouble") level = 0.55 + Math.random() * 0.3;
      else if (f.mode === "failing" && !f.boom) {
        // Engines quit, a moment of eerie quiet, then the roar of the air as it tumbles.
        level = f.failT < 0.5 ? 0.9 : f.failT < 2.0 ? 0.08 : 0.45 + Math.random() * 0.4;
      }
      rumble.current?.setLevel(level);
      if (f.mode === "orbit" && phaseRef.current === "ride") setPhase("orbit");
    }, 100);
    return () => window.clearInterval(id);
  }, [orbitKm]);

  const textFor = useCallback(
    (id: AscentEventId) => {
      if (id === "warn" && failure) return aRef.current.warnDetail[failure.code];
      return aRef.current.callouts[id];
    },
    [failure],
  );

  const announce = useCallback(
    (id: AscentEventId, caution: boolean) => {
      setCallout((c) => ({ id, n: (c?.n ?? 0) + 1 }));
      playSfx(caution ? "caution" : "chime");
      speak(textFor(id), localeRef.current);
    },
    [textFor],
  );

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const onEvent = useCallback(
    (e: AscentEvent) => {
      if (e.kick) addTrauma(e.kick);
      if (e.bang && e.id !== "boom") playSfx("bang");
      switch (e.id) {
        case "stageSep":
          flight.current.flash = 1;
          setFlash((n) => n + 1);
          break;
        case "meco":
          rumble.current?.setLevel(0);
          playSfx("whoosh");
          score.current?.setMood("awe");
          break;
        case "warn":
          score.current?.setMood("dread");
          break;
        case "warnCritical":
          stopAlarm.current();
          stopAlarm.current = startAlarm();
          break;
        case "engineFail":
          playSfx("sputter");
          break;
        case "boom":
          stopAlarm.current();
          rumble.current?.setLevel(0);
          playSfx("boom");
          score.current?.setMood("hush");
          stopSpeaking();
          setBoom(true);
          later(500, () => setBlack(true));
          return;
        default:
          break;
      }
      announce(e.id, !!e.caution);
    },
    [announce, later],
  );

  const skip = useCallback(() => {
    const f = flight.current;
    if (f.mode !== "ride") return;
    f.met = INSERTION_MET;
    f.mode = "orbit";
    rumble.current?.setLevel(0);
    score.current?.setMood("awe");
    announce("meco", false);
    setPhase("orbit");
  }, [announce]);

  const release = useCallback(() => {
    const f = flight.current;
    if (f.mode !== "orbit") return;
    playSfx("unlatch");
    f.released = true;
    f.mode = "float";
    setPhase("float");
  }, []);

  // Space releases the harness, like pressing the button.
  useEffect(() => {
    if (phase !== "orbit") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        release();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, release]);

  const earthSeen = useCallback(() => setPhase("done"), []);

  /** Lens flare: positioned along the line from the sun through the middle of the screen. */
  const onSun = useCallback((s: SunScreen) => {
    const box = section.current?.getBoundingClientRect();
    const els = flareRefs.current;
    if (!box) return;
    for (const el of els) if (el) el.style.opacity = s.visible ? "" : "0";
    if (!s.visible) return;
    const sx = ((s.x + 1) / 2) * box.width;
    const sy = ((1 - s.y) / 2) * box.height;
    const cx = box.width / 2;
    const cy = box.height / 2;
    // [position along the axis (0 = sun, 1 = screen centre, 2 = mirror point), size in px, opacity]
    const spec: [number, number, number][] = [[0, 520, 0.9], [0, 900, 0.35], [0.55, 90, 0.35], [1.25, 160, 0.22], [1.7, 60, 0.3]];
    spec.forEach(([k, size, op], i) => {
      const el = els[i];
      if (!el) return;
      const x = sx + (cx - sx) * k;
      const y = sy + (cy - sy) * k;
      el.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`;
      el.style.width = el.style.height = `${size}px`;
      el.style.opacity = String(op);
    });
  }, []);

  const heavy = Math.min(1, Math.max(0, (hud.g - 1.8) / 2.4));
  const hint = failure ? "" : phase === "ride" ? a.hintRide : phase === "orbit" ? a.hintOrbit : a.hintFloat;
  const bars = failure ? !black : phase === "ride";

  return (
    <section ref={section} className="relative h-dvh w-full overflow-hidden bg-black" aria-label={a.sceneLabel}>
      <WorldCanvas label={a.sceneLabel}>
        <AscentWorld
          flight={flight}
          orbitKm={orbitKm}
          failure={failure}
          onEvent={onEvent}
          onEarthSeen={earthSeen}
          onFailureEnd={failure ? onComplete : undefined}
          onSun={onSun}
        />
      </WorldCanvas>

      {/* Lens flare from the sun, only while it shines through the window. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            ref={(el) => void (flareRefs.current[i] = el)}
            className="absolute left-0 top-0 rounded-full opacity-0"
            style={{
              background:
                i === 1
                  ? "radial-gradient(ellipse at center, rgba(255,230,190,0.45) 0%, rgba(255,200,120,0.12) 40%, rgba(255,160,60,0) 70%)"
                  : i === 0
                    ? "radial-gradient(circle at center, rgba(255,255,255,0.95) 0%, rgba(255,235,190,0.55) 14%, rgba(255,190,100,0.18) 40%, rgba(255,150,50,0) 70%)"
                    : i === 2
                      ? "radial-gradient(circle at center, rgba(120,200,255,0.55), rgba(120,200,255,0) 70%)"
                      : "radial-gradient(circle at center, rgba(255,170,90,0.4), rgba(255,170,90,0) 70%)",
            }}
          />
        ))}
      </div>

      {/* Heavy acceleration squeezes the view in from the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: phase === "ride" && !failure ? heavy : failure ? 0.35 + heavy * 0.4 : 0,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)",
          transition: "opacity 400ms",
        }}
      />
      {hud.alarm && !boom && (
        <div aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-red-600/25 mix-blend-multiply" />
      )}
      {flash > 0 && (
        <div key={flash} aria-hidden className="pointer-events-none absolute inset-0 animate-alarm-flash bg-white/55" />
      )}
      {boom && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white"
          style={{ animation: "ascent-boom 2.6s ease-out forwards" }}
        />
      )}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-black transition-opacity duration-300", black ? "opacity-100" : "opacity-0")}
      />
      <style>{`@keyframes ascent-boom { 0% { opacity: 1; } 25% { opacity: 0.95; background: #ffb066; } 100% { opacity: 0; } }`}</style>

      {/* Cinematic letterbox bars during the ride. */}
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bg-black transition-all duration-1000",
            i === 0 ? "top-0" : "bottom-0",
            bars ? "h-[7dvh]" : "h-0",
          )}
        />
      ))}

      {!failure && (
        <div className="pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20">
          <ObjectivePanel
            className="pointer-events-auto"
            items={[
              { id: "ride", label: localize(briefing.objectives[0]), done: phase !== "ride" },
              { id: "harness", label: localize(briefing.objectives[1]), done: phase === "float" || phase === "done" },
              { id: "earth", label: localize(briefing.objectives[2]), done: phase === "done" },
            ]}
          />
        </div>
      )}

      {/* Flight data strip */}
      <div
        className={cn(
          "bezel pointer-events-none absolute inset-x-0 top-16 mx-auto flex w-fit gap-5 bg-space-deep/80 px-4 py-2 font-mono text-xs backdrop-blur-sm sm:top-20 sm:text-sm",
          hud.alarm && "border-red-500/80",
        )}
      >
        <Readout label={a.met} value={formatMet(hud.met)} />
        <Readout label={a.altitude} value={`${hud.alt.toFixed(hud.alt < 100 ? 1 : 0)} km`} />
        <Readout label={a.speed} value={`${hud.speed.toFixed(2)} km/s`} />
        <Readout label={a.load} value={`${hud.g.toFixed(1)} g`} />
      </div>

      {phase === "ride" && !failure && (
        <div className="absolute right-3 top-16 sm:right-8 sm:top-20">
          <Button variant="secondary" size="sm" onClick={skip}>
            {a.skip}
          </Button>
        </div>
      )}

      {/* Ship's computer / CAPCOM call-out */}
      {callout && !black && (
        <div
          key={callout.n}
          role="status"
          className={cn(
            "bezel pointer-events-none absolute bottom-24 left-1/2 w-[min(92vw,34rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 bg-space-deep/90 px-5 py-3 text-center text-sm text-white backdrop-blur-sm sm:bottom-28 sm:text-base",
            (callout.id === "warn" || callout.id === "warnCritical" || callout.id === "engineFail" || callout.id === "abort") &&
              "border-red-500/80 text-red-100",
          )}
        >
          {textFor(callout.id)}
        </div>
      )}

      {phase === "orbit" && !failure && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Button size="lg" onClick={release}>
            {a.releaseHarness}
          </Button>
        </div>
      )}

      {hint && <p className="pointer-events-none absolute bottom-3 left-3 max-w-md text-xs text-foreground/75 sm:left-8">{hint}</p>}

      {!failure && (
        <SignOffDialog
          open={phase === "done"}
          character="astronaut"
          badge={a.doneTitle}
          title={a.doneTitle}
          description={format(a.doneBody, { km: orbitKm })}
          continueLabel={a.continue}
          onContinue={onComplete}
        />
      )}
    </section>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-[10px] uppercase tracking-wider text-space-cyan">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
