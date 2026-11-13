"use client";

import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { TelemetryChart } from "@/components/dashboard/TelemetryChart";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { DESCENT_STEPS, KEYFRAMES, SAFE_TOUCHDOWN_MS, TOUCHDOWN, sampleAt } from "@/mocks/descent";
import { formatMissionTime } from "@/lib/format";

const formatAltitude = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
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

interface DescentCommandProps {
  stepsDone: number;
  /** Index of the switch the player may throw now, or null while a segment plays. */
  armed: number | null;
  landed: boolean;
  onPress: (index: number) => void;
}

/**
 * The player's half of the console, kept small so the window stays clear: the crew cue, the
 * one control that matters now, and the four-step checklist as a compact list.
 */
export function DescentCommand({ stepsDone, armed, landed, onPress }: DescentCommandProps) {
  const d = useT().lunarDescent;
  const localize = useLocalized();
  const current = DESCENT_STEPS[Math.min(stepsDone, DESCENT_STEPS.length - 1)];
  const cueStep = armed !== null ? DESCENT_STEPS[armed] : null;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Crew cue for the next control. */}
      <div className="flex items-start gap-2.5">
        <div className="h-10 w-8 shrink-0">
          <CharacterPortrait character="astronaut" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm leading-snug" aria-live="polite">
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
        <div className="flex flex-col gap-1">
          <Button
            data-descent-action
            // aria-disabled, not disabled: a disabled button drops keyboard focus to the page while
            // the segment plays; this one keeps it, so Enter works again at the next hold.
            className="h-11 text-base"
            aria-disabled={armed === null}
            onClick={() => onPress(stepsDone)}
            aria-describedby="press-hint"
          >
            {localize(current.label)}
          </Button>
          {/* Taught once: after the first switch the player knows either control works. */}
          <p
            id="press-hint"
            className={cn("text-center text-[11px] leading-tight text-foreground/60", stepsDone > 0 && "sr-only")}
          >
            {d.pressHint}
          </p>
        </div>
      )}

      <section aria-labelledby="checklist-title">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 id="checklist-title" className="text-xs font-medium">
            {d.checklistTitle}
          </h3>
          <span className="font-mono text-[11px] text-foreground/70">
            {format(d.stepOf, { n: Math.min(stepsDone + 1, DESCENT_STEPS.length), total: DESCENT_STEPS.length })}
          </span>
        </div>
        {/* Phones keep the "Step n of 4" line above; the full list needs the screen space. */}
        <ol className="hidden flex-col gap-0.5 sm:flex">
          {DESCENT_STEPS.map((s, i) => {
            const done = i < stepsDone;
            const next = i === stepsDone && !landed;
            return (
              <li
                key={s.id}
                aria-current={next ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-xs",
                  next && "bg-surface/50 shadow-[inset_2px_0_0_rgb(var(--primary))]",
                  !done && !next && "text-foreground/50",
                )}
              >
                <span className="w-3 font-mono text-[11px]">{i + 1}</span>
                <span className="flex-1">{localize(s.label)}</span>
                {done ? (
                  <Check className="h-3.5 w-3.5 text-primary" aria-label={d.stepDone} />
                ) : (
                  <span className="text-[11px]">{next ? d.stepNext : d.stepLater}</span>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/**
 * Live numbers in a 2×2 strip with the contact light, and the full charts and table folded
 * away underneath for anyone who wants the curves.
 */
export function DescentTelemetry({ t, contactLight }: { t: number; contactLight: boolean }) {
  const tr = useT();
  const d = tr.lunarDescent;
  const now = sampleAt(t);

  // The traces grow with the clock: samples so far (SERIES is on a 2 s grid), plus the live point.
  const pts = [...SERIES.slice(0, Math.ceil(t / 2)), now];
  const xs = pts.map((p) => p.t);
  const alt = pts.map((p) => p.altM);
  const vs = pts.map((p) => p.vsMs);
  // Keyframes passed so far, then the live reading.
  const rows = t > 0 ? [...KEYFRAMES.filter((k) => k.t < t - 0.01), now] : [KEYFRAMES[0]];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xl tabular-nums text-primary" role="timer" aria-label={d.clock}>
          {formatMissionTime(t)}
        </p>
        <span
          role="status"
          className={cn(
            "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            contactLight ? "bg-primary text-primary-foreground" : "bg-space-blue/40 text-foreground/45",
          )}
        >
          {d.contactLight}
          <span className="sr-only">{contactLight ? ": ON" : ": OFF"}</span>
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-px bg-space-blue/60 text-xs">
        {(
          [
            [d.altitude, formatAltitude(now.altM)],
            [d.verticalSpeed, formatVs(now.vsMs)],
            [d.fuel, `${Math.round(now.fuelPct)}%`],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-space-deep/85 px-2 py-1">
            <dt className="text-[10px] leading-tight text-foreground/65">{label}</dt>
            <dd className="font-mono tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <details className="group text-xs">
        <summary className="flex cursor-pointer items-center justify-between text-foreground/75">
          {d.chartsToggle}
          <StatusBadge status="demo">{tr.common.demoData}</StatusBadge>
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <TelemetryChart
            title={d.altitude}
            xs={xs}
            ys={alt}
            xMax={TOUCHDOWN.t}
            yMin={0}
            yMax={16000}
            height={90}
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
            height={90}
            formatValue={formatVs}
            formatTick={formatVsTick}
            formatX={formatMissionTime}
            reference={{ value: -SAFE_TOUCHDOWN_MS, label: format(d.safeLimit, { value: SAFE_TOUCHDOWN_MS }) }}
          />
          {/* Same numbers without the charts: keyboard, screen readers, and anyone who wants exact values. */}
          <table className="w-full text-left font-mono text-[11px] tabular-nums">
            <caption className="sr-only">{d.tableToggle}</caption>
            <thead className="text-foreground/65">
              <tr>
                <th className="py-0.5 font-normal">{d.time}</th>
                <th className="py-0.5 font-normal">{d.altitude}</th>
                <th className="py-0.5 font-normal">{d.verticalSpeed}</th>
                <th className="py-0.5 font-normal">{d.fuel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.t} className="border-t border-space-blue/60">
                  <td className="py-0.5">{formatMissionTime(k.t)}</td>
                  <td className="py-0.5">{formatAltitude(k.altM)}</td>
                  <td className="py-0.5">{formatVs(k.vsMs)}</td>
                  <td className="py-0.5">{Math.round(k.fuelPct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
