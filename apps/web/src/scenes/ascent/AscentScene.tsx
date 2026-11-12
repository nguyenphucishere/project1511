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
} from "@/game/ascentFlight";
import { useGameStore } from "@/game/gameStore";
import { BRIEFINGS } from "@/game/script";
import { useSettingsStore } from "@/game/settingsStore";
import { addTrauma } from "@/game/shake";
import { playSfx, speak, startRumble, stopSpeaking, type Rumble } from "@/game/sfx";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { AscentWorld, createFlight, type AscentFlight } from "./AscentWorld";

type Phase = "ride" | "orbit" | "float" | "done";

interface Hud {
  met: number;
  alt: number;
  speed: number;
  g: number;
}

const DEFAULT_ORBIT_KM = 185;

/**
 * Scene 5 — ascent (astronaut POV). Strapped into the capsule seat: the rocket shakes through
 * Max Q and stage separation while the computer calls out events, the sky turns black, and the
 * engines cut. Then weightlessness: release the harness, float to the window, look at Earth.
 */
export function AscentScene({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const a = t.ascent;
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const orbitKm = useGameStore((s) => s.log.launchConfig?.orbitKm) ?? DEFAULT_ORBIT_KM;

  const flight = useRef<AscentFlight>(createFlight());
  // Dev-only handle for jumping around the timeline from the console (window.__ascent.current.met = 300).
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as { __ascent?: unknown }).__ascent = flight;
  }
  const rumble = useRef<Rumble | null>(null);
  const [phase, setPhase] = useState<Phase>("ride");
  const [hud, setHud] = useState<Hud>({ met: 0, alt: 0, speed: 0, g: 1 });
  const [callout, setCallout] = useState<{ id: AscentEventId; n: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const phaseRef = useRef<Phase>("ride");
  phaseRef.current = phase;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const aRef = useRef(a);
  aRef.current = a;

  const briefing = BRIEFINGS.ascent;

  // The roar of the engines, from the moment the scene starts until main engine cutoff.
  useEffect(() => {
    rumble.current = startRumble();
    return () => {
      rumble.current?.stop();
      stopSpeaking();
    };
  }, []);

  // Poll the shared flight state ~10 times a second for the HUD, and steer the roar's loudness.
  useEffect(() => {
    const id = window.setInterval(() => {
      const f = flight.current;
      setHud({ met: f.met, alt: altitudeKm(f.met, orbitKm), speed: speedKms(f.met), g: gForce(f.met) });
      rumble.current?.setLevel(f.mode === "ride" ? 0.25 + vibration(f.met) * 0.75 : 0);
      if (f.mode === "orbit" && phaseRef.current === "ride") setPhase("orbit");
    }, 100);
    return () => window.clearInterval(id);
  }, [orbitKm]);

  const announce = useCallback((id: AscentEventId, caution: boolean) => {
    setCallout((c) => ({ id, n: (c?.n ?? 0) + 1 }));
    playSfx(caution ? "caution" : "chime");
    speak(aRef.current.callouts[id], localeRef.current);
  }, []);

  const onEvent = useCallback(
    (e: AscentEvent) => {
      if (e.kick) addTrauma(e.kick);
      if (e.bang) playSfx("bang");
      if (e.id === "stageSep") {
        flight.current.flash = 1;
        setFlash((n) => n + 1);
      }
      if (e.id === "meco") {
        rumble.current?.setLevel(0);
        playSfx("whoosh");
      }
      announce(e.id, !!e.caution);
    },
    [announce],
  );

  const skip = useCallback(() => {
    const f = flight.current;
    if (f.mode !== "ride") return;
    f.met = INSERTION_MET;
    f.mode = "orbit";
    rumble.current?.setLevel(0);
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

  const heavy = Math.min(1, Math.max(0, (hud.g - 1.8) / 2.4));
  const hint = phase === "ride" ? a.hintRide : phase === "orbit" ? a.hintOrbit : a.hintFloat;

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={a.sceneLabel}>
      <WorldCanvas label={a.sceneLabel}>
        <AscentWorld flight={flight} orbitKm={orbitKm} onEvent={onEvent} onEarthSeen={earthSeen} />
      </WorldCanvas>

      {/* Heavy acceleration squeezes the view in from the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: phase === "ride" ? heavy : 0,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)",
          transition: "opacity 400ms",
        }}
      />
      {flash > 0 && (
        <div key={flash} aria-hidden className="pointer-events-none absolute inset-0 animate-alarm-flash bg-white/55" />
      )}

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

      {/* Flight data strip */}
      <div className="bezel pointer-events-none absolute inset-x-0 top-16 mx-auto flex w-fit gap-5 bg-space-deep/80 px-4 py-2 font-mono text-xs backdrop-blur-sm sm:top-20 sm:text-sm">
        <Readout label={a.met} value={formatMet(hud.met)} />
        <Readout label={a.altitude} value={`${hud.alt.toFixed(hud.alt < 100 ? 1 : 0)} km`} />
        <Readout label={a.speed} value={`${hud.speed.toFixed(2)} km/s`} />
        <Readout label={a.load} value={`${hud.g.toFixed(1)} g`} />
      </div>

      {phase === "ride" && (
        <div className="absolute right-3 top-16 sm:right-8 sm:top-20">
          <Button variant="secondary" size="sm" onClick={skip}>
            {a.skip}
          </Button>
        </div>
      )}

      {/* Ship's computer / CAPCOM call-out */}
      {callout && (
        <div
          key={callout.n}
          role="status"
          className="bezel pointer-events-none absolute bottom-24 left-1/2 w-[min(92vw,34rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 bg-space-deep/90 px-5 py-3 text-center text-sm text-white backdrop-blur-sm sm:bottom-28 sm:text-base"
        >
          {a.callouts[callout.id]}
        </div>
      )}

      {phase === "orbit" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Button size="lg" onClick={release}>
            {a.releaseHarness}
          </Button>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-3 left-3 max-w-md text-xs text-foreground/75 sm:left-8">{hint}</p>

      <SignOffDialog
        open={phase === "done"}
        character="astronaut"
        badge={a.doneTitle}
        title={a.doneTitle}
        description={format(a.doneBody, { km: orbitKm })}
        continueLabel={a.continue}
        onContinue={onComplete}
      />
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
