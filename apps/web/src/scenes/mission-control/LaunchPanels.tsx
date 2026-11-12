"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadoutGrid } from "@/components/hud/ReadoutGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CHARACTERS } from "@/game/characters";
import { cn } from "@/lib/utils";
import { TRACE_TEXT } from "@/lib/simulation/launch.mock";
import { WIND_LIMIT_KMH } from "@/mocks/launch-options";
import type { LaunchAssessment, LaunchConfig, LaunchResult } from "@/lib/simulation/launch.types";
import { formatMissionTime } from "@/lib/format";
import { NOMINAL_EVENTS, altitudeKm, missionSecondsAt, speedKms } from "./flight";

/* ---------------------------------------------------------------- GO / NO-GO poll */

const POLL_STEP_MS = 650;

export function PollPanel({
  assessment,
  onLaunch,
  onBack,
}: {
  assessment: LaunchAssessment;
  onLaunch: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const m = t.missionControl;
  const localize = useLocalized();
  const reduced = useReducedMotion();
  // Fueling and systems are always GO in the demo; weather depends on the chosen window.
  const items = [
    { id: "fueling", label: m.pollFueling, go: true },
    { id: "systems", label: m.pollSystems, go: true },
    { id: "weather", label: m.pollWeather, go: assessment.weatherGo },
  ];
  const [answered, setAnswered] = useState(0);
  const launchRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (answered >= items.length) return;
    const id = window.setTimeout(() => setAnswered((a) => a + 1), reduced ? 120 : POLL_STEP_MS);
    return () => window.clearTimeout(id);
  }, [answered, items.length, reduced]);

  const done = answered >= items.length;
  const allGo = items.every((i) => i.go);

  useEffect(() => {
    if (!done) return;
    (allGo ? launchRef : backRef).current?.focus({ preventScroll: true });
  }, [done, allGo]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/80">
        {format(m.pollIntro, { name: localize(CHARACTERS["flight-director"].name) })}
      </p>
      <ol className="flex flex-col gap-1.5" aria-live="polite">
        {items.map((item, i) => {
          const state = i < answered ? (item.go ? "go" : "nogo") : i === answered ? "polling" : "waiting";
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 bg-space-blue/30 px-3 py-2.5">
              <span className={cn("text-sm", state === "waiting" && "text-foreground/50")}>{item.label}</span>
              {state === "go" && <StatusBadge status="go">{m.go}</StatusBadge>}
              {state === "nogo" && <StatusBadge status="fault">{m.noGo}</StatusBadge>}
              {state === "polling" && (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                  {m.polling}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {done && !allGo && (
        <p role="alert" className="bezel bezel-sm bg-warning/15 p-3 text-sm">
          {format(m.scrub, { limit: WIND_LIMIT_KMH })}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {done && allGo && (
          <>
            <Button ref={launchRef} size="lg" onClick={onLaunch} aria-describedby="launch-hint" className="h-14 text-lg">
              {m.launch}
            </Button>
            <p id="launch-hint" className="text-center text-xs text-foreground/65">
              {m.launchHint}
            </p>
          </>
        )}
        <Button ref={backRef} variant={done && !allGo ? "primary" : "ghost"} onClick={onBack}>
          {m.back}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- countdown */

export const COUNTDOWN_FROM = 10;

export function CountdownPanel({ onIgnition, onHold }: { onIgnition: () => void; onHold: () => void }) {
  const m = useT().missionControl;
  const [left, setLeft] = useState(COUNTDOWN_FROM);
  const ignitionRef = useRef(onIgnition);
  ignitionRef.current = onIgnition;
  const holdRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    holdRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (left <= 0) {
      ignitionRef.current();
      return;
    }
    const id = window.setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-sm text-foreground/75">{left <= 3 ? m.ignition : m.countdownTitle}</p>
      {/* Keyed so each new number replays the pop; the global reduced-motion rule stills it. */}
      <p key={left} className="animate-count-pop font-mono text-7xl tabular-nums text-primary" role="timer" aria-live="off">
        {formatMissionTime(-left)}
      </p>
      <span className="sr-only" aria-live="polite">
        {left <= 3 || left === COUNTDOWN_FROM ? String(left) : ""}
      </span>
      <Button ref={holdRef} variant="secondary" size="lg" onClick={onHold} className="w-full">
        {m.hold}
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------- flight */

export function FlightPanel({
  config,
  result,
  ignitionAt,
  onEnd,
}: {
  config: LaunchConfig;
  result: LaunchResult;
  ignitionAt: number;
  onEnd: () => void;
}) {
  const t = useT();
  const m = t.missionControl;
  const localize = useLocalized();
  const [sec, setSec] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    let raf = 0;
    let ended = false;
    let endTimer = 0;
    const tick = () => {
      const now = Math.min(missionSecondsAt((performance.now() - ignitionAt) / 1000), result.endSec);
      setSec(now);
      if (now >= result.endSec && !ended) {
        ended = true;
        // Hold the final readout for a beat before the dialog takes over.
        endTimer = window.setTimeout(() => endRef.current(), 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(endTimer);
    };
  }, [ignitionAt, result.endSec]);

  const rows = [
    // Every nominal event is listed (an aborted flight leaves the rest greyed out); trace
    // steps only appear once reached, so the list never spoils the outcome.
    ...NOMINAL_EVENTS.map((e) => ({
      key: e.label,
      t: e.t,
      text: m[e.label],
      fault: false,
    })),
    ...result.failureTrace.filter((s) => sec >= s.timestampSec).map((s) => ({
      key: `${s.code}-${s.timestampSec}`,
      t: s.timestampSec,
      text: `${localize(TRACE_TEXT[s.code].subsystem)}: ${localize(TRACE_TEXT[s.code].anomaly)}`,
      fault: true,
    })),
  ].sort((a, b) => a.t - b.t);

  return (
    <div className="flex flex-col gap-4">
      <ReadoutGrid
        className="grid-cols-3"
        items={[
          [m.clock, formatMissionTime(sec)],
          [m.altitude, `${altitudeKm(sec, config.orbitKm).toFixed(0)} km`],
          [m.speed, `${speedKms(sec).toFixed(1)} km/s`],
        ]}
      />
      <ol className="flex flex-col gap-1" aria-live="polite" aria-relevant="additions">
        {rows.map((r) => {
          const reached = sec >= r.t;
          return (
            <li
              key={r.key}
              className={cn(
                "flex items-center gap-3 px-3 py-1.5 text-sm",
                r.fault && reached ? "bg-warning/20" : "bg-space-blue/25",
                !reached && "text-foreground/45",
              )}
            >
              <span className="w-16 shrink-0 font-mono text-xs">{formatMissionTime(r.t)}</span>
              <span className="flex-1">{r.text}</span>
              {reached &&
                (r.fault ? (
                  <StatusBadge status="fault">{m.noGo}</StatusBadge>
                ) : (
                  <Check className="h-4 w-4 text-primary" aria-hidden />
                ))}
            </li>
          );
        })}
      </ol>
      <StatusBadge status="demo" className="w-fit">
        {t.common.demoData}
      </StatusBadge>
    </div>
  );
}
