"use client";

import { useMemo } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { TelemetryChart } from "@/components/dashboard/TelemetryChart";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { DESCENT_STEPS, KEYFRAMES, SAFE_TOUCHDOWN_MS, TOUCHDOWN, sampleAt } from "@/mocks/descent";
import { formatMissionTime } from "../mission-control/flight";

export const formatAltitude = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const formatAltitudeTick = (m: number) => (m >= 1000 ? `${Math.round(m / 1000)} km` : `${Math.round(m)} m`);
export const formatVs = (v: number) => `${v.toFixed(1)} m/s`;
const formatVsTick = (v: number) => `${Math.round(v)}`;

/** Every 2 s of the profile, plus the exact touchdown, sampled once. */
const SERIES = (() => {
  const xs: number[] = [];
  for (let t = 0; t < TOUCHDOWN.t; t += 2) xs.push(t);
  xs.push(TOUCHDOWN.t);
  return xs.map(sampleAt);
})();

interface DescentPanelProps {
  /** Mission seconds since powered descent started. */
  t: number;
  stepsDone: number;
  /** Index of the switch the player may throw now, or null while a segment plays. */
  armed: number | null;
  landed: boolean;
  contactLight: boolean;
  onPress: (index: number) => void;
}

/** The DOM half of the console: crew cue, the next control, readouts, and the two telemetry traces. */
export function DescentPanel({ t, stepsDone, armed, landed, contactLight, onPress }: DescentPanelProps) {
  const tr = useT();
  const d = tr.lunarDescent;
  const localize = useLocalized();
  const now = sampleAt(t);

  // The traces grow with the clock: samples so far, plus the live point.
  const { xs, alt, vs } = useMemo(() => {
    const past = SERIES.filter((s) => s.t < t);
    const pts = t > 0 ? [...past, sampleAt(t)] : [sampleAt(0)];
    return { xs: pts.map((p) => p.t), alt: pts.map((p) => p.altM), vs: pts.map((p) => p.vsMs) };
  }, [t]);

  const current = DESCENT_STEPS[Math.min(stepsDone, DESCENT_STEPS.length - 1)];
  const cueStep = armed !== null ? DESCENT_STEPS[armed] : null;
  // Keyframes passed so far, then the live reading.
  const rows = t > 0 ? [...KEYFRAMES.filter((k) => k.t < t - 0.01), now] : [KEYFRAMES[0]];

  return (
    <div className="flex flex-col gap-4">
      {/* Crew cue for the next control. */}
      <div className="flex items-start gap-3 bg-space-blue/30 p-3">
        <div className="h-14 w-11 shrink-0">
          <CharacterPortrait character="astronaut" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm" aria-live="polite">
            {landed ? d.touchdownBody : cueStep ? localize(cueStep.cue) : localize(current.cue)}
          </p>
          {!landed &&
            (armed !== null ? (
              <StatusBadge status="caution" className="w-fit">
                {d.holding}
              </StatusBadge>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                {d.descending}
              </span>
            ))}
        </div>
      </div>

      {!landed && (
        <div className="flex flex-col gap-1.5">
          <Button
            size="lg"
            className="h-14 text-lg"
            disabled={armed === null}
            onClick={() => armed !== null && onPress(armed)}
            aria-describedby="press-hint"
          >
            {localize(current.label)}
          </Button>
          <p id="press-hint" className="text-center text-xs text-foreground/65">
            {d.pressHint}
          </p>
        </div>
      )}

      <section aria-labelledby="checklist-title">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 id="checklist-title" className="text-sm font-medium">
            {d.checklistTitle}
          </h3>
          <span className="font-mono text-xs text-foreground/70">
            {format(d.stepOf, { n: Math.min(stepsDone + 1, DESCENT_STEPS.length), total: DESCENT_STEPS.length })}
          </span>
        </div>
        <ol className="flex flex-col gap-1">
          {DESCENT_STEPS.map((s, i) => {
            const done = i < stepsDone;
            const next = i === stepsDone;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 text-sm",
                  next ? "bg-surface/50 shadow-[inset_2px_0_0_rgb(var(--primary))]" : "bg-space-blue/25",
                  !done && !next && "text-foreground/50",
                )}
              >
                <span className="w-4 font-mono text-xs">{i + 1}</span>
                <span className="flex-1">{localize(s.label)}</span>
                {done ? (
                  <Check className="h-4 w-4 text-primary" aria-label={d.stepDone} />
                ) : (
                  <span className="text-xs">{next ? d.stepNext : d.stepLater}</span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <dl className="grid grid-cols-2 gap-px bg-space-blue/60">
        {[
          [d.clock, formatMissionTime(t)],
          [d.altitude, formatAltitude(now.altM)],
          [d.verticalSpeed, formatVs(now.vsMs)],
          [d.fuel, `${Math.round(now.fuelPct)}%`],
        ].map(([label, value]) => (
          <div key={label} className="bg-space-deep/85 px-3 py-2">
            <dt className="text-xs text-foreground/65">{label}</dt>
            <dd className="font-mono text-lg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div
        className={cn(
          "flex items-center justify-center gap-2 py-1.5 text-sm font-medium uppercase tracking-wider",
          contactLight ? "bg-primary text-primary-foreground" : "bg-space-blue/25 text-foreground/45",
        )}
        role="status"
      >
        {d.contactLight}
        <span className="sr-only">{contactLight ? ": ON" : ": OFF"}</span>
      </div>

      <TelemetryChart
        title={d.altitude}
        xs={xs}
        ys={alt}
        xMax={TOUCHDOWN.t}
        yMin={0}
        yMax={16000}
        formatValue={formatAltitude}
        formatTick={formatAltitudeTick}
        formatX={formatMissionTime}
      />
      <TelemetryChart
        title={d.verticalSpeed}
        xs={xs}
        ys={vs}
        xMax={TOUCHDOWN.t}
        yMin={-40}
        yMax={5}
        formatValue={formatVs}
        formatTick={formatVsTick}
        formatX={formatMissionTime}
        reference={{ value: -SAFE_TOUCHDOWN_MS, label: format(d.safeLimit, { value: SAFE_TOUCHDOWN_MS }) }}
      />
      {/* Same numbers without the charts: keyboard, screen readers, and anyone who wants exact values. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-foreground/80">{d.tableToggle}</summary>
        <table className="mt-2 w-full text-left font-mono text-xs tabular-nums">
          <thead className="text-foreground/65">
            <tr>
              <th className="py-1 font-normal">{d.time}</th>
              <th className="py-1 font-normal">{d.altitude}</th>
              <th className="py-1 font-normal">{d.verticalSpeed}</th>
              <th className="py-1 font-normal">{d.fuel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.t} className="border-t border-space-blue/60">
                <td className="py-1">{formatMissionTime(k.t)}</td>
                <td className="py-1">{formatAltitude(k.altM)}</td>
                <td className="py-1">{formatVs(k.vsMs)}</td>
                <td className="py-1">{Math.round(k.fuelPct)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <StatusBadge status="demo" className="w-fit">
        {tr.common.demoData}
      </StatusBadge>
    </div>
  );
}
