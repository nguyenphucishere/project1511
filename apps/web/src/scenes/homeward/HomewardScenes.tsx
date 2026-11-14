"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import { playSfx, startRumble } from "@/game/sfx";
import { useLocalized } from "@/i18n/useT";
import {
  ASCENT_BURN_S,
  BURN_TIME_SCALE,
  LIFTOFF_MET,
  burnState,
  formatClock,
} from "./logic";
import { HOMEWARD } from "./script";

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 53.7) % 100,
  y: (i * 31.3 + (i % 7) * 9) % 100,
  r: 0.5 + ((i * 7) % 5) * 0.2,
}));

function Stars() {
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.18} fill="white" opacity={0.35 + (i % 4) * 0.15} />
      ))}
    </svg>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/15 bg-black/50 px-3 py-1.5 font-mono">
      <div className="text-[10px] uppercase tracking-widest text-white/60">{label}</div>
      <div className="text-sm text-white">{value}</div>
    </div>
  );
}

type LiftPhase = "idle" | "armed" | "burning" | "orbit";

/** Beat 0: the ascent engine. Arm it, fire it, ride the burn. There is no second try and no backup. */
export function LiftoffScene({ onComplete }: { onComplete: () => void }) {
  const text = HOMEWARD.liftoff;
  const tr = useLocalized();
  const [phase, setPhase] = useState<LiftPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const rumble = useRef<ReturnType<typeof startRumble> | null>(null);

  useEffect(() => {
    if (phase !== "burning") return;
    rumble.current = startRumble();
    rumble.current.setLevel(0.7);
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // Capped step so a throttled tab does not skip the whole burn in one tick.
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      setElapsed((e) => Math.min(ASCENT_BURN_S, e + dt * BURN_TIME_SCALE));
    }, 50);
    return () => {
      window.clearInterval(id);
      rumble.current?.stop();
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "burning" && elapsed >= ASCENT_BURN_S) setPhase("orbit");
  }, [phase, elapsed]);

  const b = burnState(elapsed);
  // The beats worth hearing: the briefing, the stage separation and the arrival. The flag line stays a caption.
  const caption = phase === "idle" || phase === "armed" ? text.intro : phase === "burning" ? (b.fraction < 0.12 ? text.stageSep : b.fraction < 0.3 ? text.flag : text.burning) : text.orbit;
  const spoken = caption === text.intro || caption === text.stageSep || caption === text.orbit ? tr(caption) : null;
  useVoiceLine(spoken, { queue: true });
  const met = { ...LIFTOFF_MET, s: Math.floor(elapsed) % 60, m: LIFTOFF_MET.m + Math.floor(elapsed / 60) };
  const lift = phase === "idle" || phase === "armed" ? 0 : b.fraction;

  return (
    <section aria-label={tr(text.label)} data-testid="liftoff-scene" className="relative h-full w-full overflow-hidden bg-black text-white [animation:fade-in_1200ms_ease-out]">
      <Stars />
      {/* The surface falls away as the stage climbs. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 transition-transform duration-100" style={{ background: "linear-gradient(#8a8a8a, #3a3a3a)", transform: `translateY(${lift * 140}%)` }} />
      {/* Descent stage stays on the pad; ascent stage rises. */}
      <div className="absolute bottom-[26%] left-1/2 -translate-x-1/2" style={{ transform: `translate(-50%, ${-lift * 60}vh)` }}>
        <svg viewBox="0 0 80 90" className="w-24 sm:w-32" aria-hidden>
          <polygon points="18,40 62,40 66,62 14,62" fill="#c9b27a" stroke="#6b5a2e" />
          <rect x="30" y="22" width="20" height="18" rx="4" fill="#d6d6d6" stroke="#777" />
          <rect x="34" y="27" width="12" height="7" rx="2" fill="#223" />
          {phase === "burning" && (
            <polygon points="34,62 46,62 40,88" fill="#ffb347" opacity="0.9" className="animate-pulse" />
          )}
        </svg>
      </div>
      {phase !== "idle" && phase !== "armed" && lift < 0.2 && (
        <div className="absolute bottom-[22%] left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-amber-200/20 blur-2xl" />
      )}

      <div className="absolute left-4 right-4 top-16 flex flex-wrap gap-2 sm:left-10">
        <Readout label={tr(text.met)} value={formatClock(met)} />
        <Readout label={tr(text.alt)} value={`${b.altKm.toFixed(1)} km`} />
        <Readout label={tr(text.speed)} value={`${Math.round(b.speed)} m/s`} />
      </div>

      <div className="absolute inset-x-4 bottom-4 z-10 mx-auto flex max-w-xl flex-col items-center gap-3 text-center sm:bottom-10">
        <p key={tr(caption)} className="rounded bg-black/60 px-4 py-2 text-sm text-white/90 [animation:fade-in_700ms_ease-out]">
          {tr(caption)}
        </p>
        {phase === "burning" && (
          <div className="h-2 w-64 overflow-hidden rounded bg-white/15" role="progressbar" aria-valuenow={Math.round(b.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-amber-300" style={{ width: `${b.fraction * 100}%` }} />
          </div>
        )}
        {phase === "idle" && (
          <Button
            onClick={() => {
              playSfx("click");
              setPhase("armed");
            }}
          >
            {tr(text.arm)}
          </Button>
        )}
        {phase === "armed" && (
          <Button
            className="bg-red-600 hover:bg-red-500"
            onClick={() => {
              playSfx("go");
              setPhase("burning");
            }}
          >
            {tr(text.armed)} · {tr(text.fire)}
          </Button>
        )}
        {phase === "orbit" && <Button onClick={onComplete}>{tr(text.done)}</Button>}
      </div>
    </section>
  );
}
