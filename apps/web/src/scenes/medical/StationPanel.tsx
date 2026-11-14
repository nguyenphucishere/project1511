"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CHARACTERS } from "@/game/characters";
import { playSfx } from "@/game/sfx";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import type { VitalStation } from "@/mocks/vitals";

const MEASURE_MS = 2200;

interface StationPanelProps {
  station: VitalStation;
  alreadyChecked: boolean;
  onMeasured: () => void;
  onClose: () => void;
}

/**
 * Side panel for one medical station: the flight surgeon explains why it matters, the player
 * starts the measurement, a readout counts up to the DEMO value and reports it against the
 * normal range (in words, not colour alone).
 */
export function StationPanel({ station, alreadyChecked, onMeasured, onClose }: StationPanelProps) {
  const t = useT();
  const localize = useLocalized();
  const reduced = useReducedMotion();
  const doctor = CHARACTERS.doctor;
  // The doctor explains why this check matters.
  useVoiceLine(localize(station.why));
  const [phase, setPhase] = useState<"idle" | "measuring" | "result">(alreadyChecked ? "result" : "idle");
  // Set only when this panel took the measurement, so reopening a finished station does not praise it again.
  const [measuredHere, setMeasuredHere] = useState(false);
  // Once the reading is in she comments on it.
  useVoiceLine(measuredHere ? localize(station.verdict) : null);
  const [progress, setProgress] = useState(alreadyChecked ? 1 : 0);
  const primary = useRef<HTMLButtonElement>(null);
  const measuredRef = useRef(onMeasured);
  measuredRef.current = onMeasured;

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (phase !== "measuring") return;
    playSfx("scan");
    const duration = reduced ? 300 : MEASURE_MS;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // The first rAF timestamp can precede `start`; clamp so progress never goes negative.
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setPhase("result");
        setMeasuredHere(true);
        playSfx("go");
        measuredRef.current();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced]);

  const reading =
    phase === "idle"
      ? "--"
      : station.countTo && phase === "measuring"
        ? station.countTo.map((n) => Math.round(n * easeOut(progress))).join("/")
        : phase === "measuring"
          ? "…"
          : station.value;

  return (
    <section
      aria-labelledby={`station-${station.id}`}
      className="bezel bezel-gold pointer-events-auto relative w-full max-w-md animate-fade-in bg-space-deep/95 p-5"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="h-12 w-10 shrink-0">
          <CharacterPortrait character="doctor" />
        </div>
        <div>
          <h2 id={`station-${station.id}`} className="text-lg font-semibold">
            {localize(station.name)}
          </h2>
          <p className="text-xs text-foreground/65">{format(t.medical.doctorSays, { name: localize(doctor.name) })}</p>
        </div>
      </div>

      <p className="mt-3 max-w-prose text-sm text-foreground/85">{localize(station.why)}</p>

      <div className="mt-4 flex items-end justify-between gap-4 bg-space-blue/35 px-4 py-3">
        <p className="font-mono text-3xl text-foreground" aria-live="polite" aria-atomic>
          {reading}
          {station.unit && <span className="ml-2 text-base text-foreground/70">{station.unit}</span>}
        </p>
        <StatusBadge status="demo" className="shrink-0">
          {t.common.demoData}
        </StatusBadge>
      </div>
      {phase === "measuring" && (
        <Progress value={progress * 100} aria-label={t.medical.measuring} className="mt-2 h-2" />
      )}

      {phase === "result" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge status="go">{t.medical.withinRange}</StatusBadge>
          <span className="text-xs text-foreground/70">
            {format(t.medical.normal, { range: localize(station.normalRange) })}
          </span>
        </div>
      )}

      {measuredHere && phase === "result" && <p className="mt-3 border-l-2 border-primary pl-3 text-sm italic text-foreground/90">{localize(station.verdict)}</p>}

      <div className="mt-5 flex justify-end">
        {phase === "result" ? (
          <Button ref={primary} onClick={onClose}>
            {t.medical.finish}
          </Button>
        ) : (
          <Button ref={primary} onClick={() => setPhase("measuring")} disabled={phase === "measuring"}>
            {phase === "measuring" ? `${t.medical.measuring}…` : t.medical.start}
          </Button>
        )}
      </div>
    </section>
  );
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}
