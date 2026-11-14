"use client";

import { Check, LoaderCircle, OctagonX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { TelemetryChart } from "@/components/dashboard/TelemetryChart";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { DESCENT_STEPS, KEYFRAMES, SAFE_TOUCHDOWN_MS, TOUCHDOWN } from "@/mocks/descent";
import { formatMissionTime } from "@/lib/format";
import { Joystick, type StickValue } from "./Joystick";
import { LandingStrip } from "./LandingStrip";
import {
  ROD_MAX,
  SITES,
  recommendedVs,
  siteById,
  type Callout,
  type SiteId,
  type Terrain,
} from "./flight";

export type Phase = "hold" | "playing" | "manual" | "landed" | "crashed";

const formatAltitude = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : m >= 100 ? `${Math.round(m)} m` : `${m.toFixed(1)} m`);
const formatAltitudeTick = (m: number) => (m >= 1000 ? `${Math.round(m / 1000)} km` : `${Math.round(m)} m`);
export const formatVs = (v: number) => `${v.toFixed(1)} m/s`;
const formatVsTick = (v: number) => `${Math.round(v)}`;

/** What the DOM panel shows; refreshed ~12 times a second from the flight (the 3D view reads the flight directly). */
export interface PanelSnap {
  t: number;
  altM: number;
  vsMs: number;
  hsMs: number;
  xM: number;
  predictedX: number;
  fuelPct: number;
  fuelSec: number;
  throttle: number;
  /** Commanded rate of descent, m/s. */
  targetVs: number;
  engineOn: boolean;
  contact: boolean;
  callout: Callout | null;
}

/** Altitude and vertical speed against mission time, appended as the descent plays. */
export interface Trace {
  xs: number[];
  alt: number[];
  vs: number[];
}

export interface Cue {
  text: string;
  tone: "info" | "caution" | "alert";
}

interface DescentCommandProps {
  stepsDone: number;
  /** Index of the switch the player may throw now, or null. */
  armed: number | null;
  phase: Phase;
  cue: Cue;
  buttonLabel: string;
  onPress: (index: number) => void;
  /** Site picker or flight controls, shown between the crew cue and the main button. */
  children?: ReactNode;
}

/**
 * The player's half of the console: the crew cue, the controls for the current stage, the one
 * switch that matters now, and the checklist as a compact list.
 */
export function DescentCommand({ stepsDone, armed, phase, cue, buttonLabel, onPress, children }: DescentCommandProps) {
  const d = useT().lunarDescent;
  const localize = useLocalized();
  const landedOrCrashed = phase === "landed" || phase === "crashed";
  const flying = phase === "manual";

  return (
    <div className="flex flex-col gap-2.5">
      {/* Crew cue. */}
      <div className="flex items-start gap-2.5">
        <div className="h-10 w-8 shrink-0">
          <CharacterPortrait character="astronaut" avatar />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p
            className={cn(
              "text-sm leading-snug",
              cue.tone === "alert" && "font-semibold text-nasa-red",
              cue.tone === "caution" && "font-medium text-space-gold",
            )}
            aria-live="polite"
          >
            {cue.text}
          </p>
          {phase === "hold" && armed !== null && (
            <StatusBadge status="caution" className="w-fit">
              {d.holding}
            </StatusBadge>
          )}
          {phase === "playing" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
              {d.descending}
            </span>
          )}
          {flying && (
            <StatusBadge status="go" className="w-fit">
              {d.flying}
            </StatusBadge>
          )}
        </div>
      </div>

      {children}

      {!landedOrCrashed && (
        <div className="flex flex-col gap-1">
          <Button
            data-descent-action
            // aria-disabled, not disabled: a disabled button drops keyboard focus to the page while
            // the segment plays; this one keeps it, so Enter works again at the next hold.
            className="h-11 text-base"
            variant={armed === 3 ? "danger" : "primary"}
            aria-disabled={armed === null}
            onClick={() => onPress(armed ?? stepsDone)}
            aria-describedby="press-hint"
          >
            {armed === 3 && <OctagonX className="h-4 w-4" aria-hidden />}
            {buttonLabel}
          </Button>
          <p
            id="press-hint"
            className={cn(
              "text-center text-[11px] leading-tight text-foreground/60",
              !flying && stepsDone > 0 && "sr-only",
              flying && armed !== null && "sr-only",
            )}
          >
            {flying ? d.engineStopWait : d.pressHint}
          </p>
        </div>
      )}

      {!flying && !landedOrCrashed && (
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
              const next = i === stepsDone;
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
      )}
    </div>
  );
}

const TERRAIN_TAG: Record<Terrain, "tagClear" | "tagBoulders" | "tagCrater"> = {
  clear: "tagClear",
  boulders: "tagBoulders",
  crater: "tagCrater",
};

/** Three candidate sites as a radio group: click, or press 1-3. */
export function SitePicker({ siteId, onSelect }: { siteId: SiteId; onSelect: (id: SiteId) => void }) {
  const d = useT().lunarDescent;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-medium">{d.sitesTitle}</legend>
      <div role="radiogroup" aria-label={d.sitesTitle} className="flex flex-col gap-1">
        {SITES.map((site, i) => {
          const selected = site.id === siteId;
          // Per-site hazard tag: the boulder field is the hazard; C's danger is the crater beyond it.
          const tag = site.id === "C" ? "tagCrater" : TERRAIN_TAG[site.terrain];
          const dir = site.x > 0 ? d.dirRight : d.dirLeft;
          const note = format(d.siteNote[site.id], { m: Math.abs(site.x), dir });
          return (
            <button
              key={site.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(site.id)}
              className={cn(
                "bezel bezel-sm flex items-start gap-2 px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
                selected ? "bg-surface/70 shadow-[inset_0_0_0_1.5px_rgb(var(--primary))]" : "bg-surface/25 hover:bg-surface/45",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center font-mono text-[11px] font-bold",
                  site.id === "A" && "bg-space-cyan text-space-deep",
                  site.id === "B" && "bg-nasa-red text-white",
                  site.id === "C" && "bg-space-gold text-space-deep",
                )}
                aria-hidden
              >
                {site.id}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2 font-medium">
                  {d.siteName[site.id]}
                  <span className="font-mono text-[10px] text-foreground/60">
                    {i + 1} · {d[tag]}
                  </span>
                </span>
                <span className="text-[11px] leading-snug text-foreground/70">{note}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-tight text-foreground/60">{d.siteHint}</p>
    </fieldset>
  );
}

interface FlightControlsProps {
  targetVs: number;
  disabled: boolean;
  onStick: (value: StickValue) => void;
  onHold: (control: "null", held: boolean) => void;
}

/**
 * On-screen flight controls for the mouse and touch: a joystick (left/right fires the drift
 * thrusters in proportion, up/down slides the commanded rate of descent) and a hold button that
 * kills the drift. The keyboard and a gamepad drive the same inputs.
 */
export function FlightControls({ targetVs, disabled, onStick, onHold }: FlightControlsProps) {
  const d = useT().lunarDescent;
  const hold = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      onHold("null", true);
    },
    onPointerUp: () => onHold("null", false),
    onPointerCancel: () => onHold("null", false),
    onLostPointerCapture: () => onHold("null", false),
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[11px] text-foreground/65">{d.rateTitle}</p>
        <p className="font-mono text-sm tabular-nums" aria-live="off">
          {d.rateTarget}: <span className="text-primary">{formatVs(targetVs)}</span>
        </p>
      </div>

      <Joystick
        label={d.stick}
        disabled={disabled}
        onChange={onStick}
        hints={{ up: d.stickUp, down: d.stickDown, left: d.stickLeft, right: d.stickRight }}
      />

      <Button variant="secondary" size="sm" className="touch-none px-1 text-xs" title={`${d.nullDrift} (X)`} {...hold}>
        {d.nullDrift}
      </Button>
      <p className="hidden text-[10px] leading-snug text-foreground/55 md:block">{d.keysHint}</p>
    </div>
  );
}

/** Horizontal rate-of-descent gauge: the crew's safe band for this height, the current rate, and the commanded one. */
function RateGauge({ altM, vsMs, targetVs, show }: { altM: number; vsMs: number; targetVs: number; show: boolean }) {
  const d = useT().lunarDescent;
  const lo = -6;
  const hi = ROD_MAX + 0.5;
  const pct = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  const rec = recommendedVs(altM);
  const tooFast = vsMs < rec - 1.2;
  return (
    <div aria-hidden className="relative h-7 w-full">
      <div className="absolute inset-x-0 top-3 h-2 bg-space-blue/50" />
      <div className="absolute top-3 h-2 bg-nasa-red/70" style={{ left: 0, width: pct(rec - 1.2) }} />
      <div className="absolute top-3 h-2 bg-space-gold/80" style={{ left: pct(rec - 1.2), width: `calc(${pct(rec)} - ${pct(rec - 1.2)})` }} />
      <div className="absolute top-3 h-2 bg-space-emerald/80" style={{ left: pct(rec), right: 0 }} />
      {show && (
        <>
          <span className="absolute top-0 -translate-x-1/2 text-[10px] leading-none text-primary" style={{ left: pct(targetVs) }}>
            ▼
          </span>
          <span
            className={cn("absolute top-2.5 h-3.5 w-[3px] -translate-x-1/2", tooFast ? "bg-white shadow-[0_0_6px_rgb(var(--nasa-red))]" : "bg-white")}
            style={{ left: pct(vsMs) }}
          />
        </>
      )}
      <span className="absolute -bottom-0.5 left-0 font-mono text-[9px] text-foreground/50">{lo}</span>
      <span className="absolute -bottom-0.5 right-0 font-mono text-[9px] text-foreground/50">0</span>
      <span className="sr-only">{d.safeRate}</span>
    </div>
  );
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div aria-hidden className="h-1.5 w-full bg-space-blue/50">
      <div className={cn("h-full transition-[width] duration-100", className)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

interface DescentInstrumentsProps {
  snap: PanelSnap;
  siteId: SiteId | null;
  trace: Trace;
  /** Show the manual-flight instruments (rate gauge, strip, throttle). */
  flightMode: boolean;
}

/**
 * Live numbers, the rate gauge and the landing strip while flying, and the full charts and table
 * folded away underneath for anyone who wants the curves.
 */
export function DescentInstruments({ snap, siteId, trace, flightMode }: DescentInstrumentsProps) {
  const tr = useT();
  const d = tr.lunarDescent;
  const rec = recommendedVs(snap.altM);
  const tooFast = flightMode && snap.vsMs < rec - 1.2;
  const lowFuel = snap.fuelPct < 5;

  const xs = trace.xs;
  const rows = snap.t > 0 ? [...KEYFRAMES.filter((k) => k.t < snap.t - 0.01 && k.t <= KEYFRAMES[2].t), { t: snap.t, altM: snap.altM, vsMs: snap.vsMs, fuelPct: snap.fuelPct }] : [KEYFRAMES[0]];
  const xMax = Math.max(TOUCHDOWN.t, snap.t + 10);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xl tabular-nums text-primary" role="timer" aria-label={d.clock}>
          {formatMissionTime(snap.t)}
        </p>
        <span
          role="status"
          className={cn(
            "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            snap.contact ? "bg-primary text-primary-foreground" : "bg-space-blue/40 text-foreground/45",
          )}
        >
          {d.contactLight}
          <span className="sr-only">{snap.contact ? ": ON" : ": OFF"}</span>
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-px bg-space-blue/60 text-xs">
        <Readout label={d.altitude} value={formatAltitude(snap.altM)} />
        <Readout label={d.verticalSpeed} value={formatVs(snap.vsMs)} tone={tooFast ? "alert" : undefined} />
        <Readout label={d.hSpeed} value={`${snap.hsMs > 0.05 ? "→ " : snap.hsMs < -0.05 ? "← " : ""}${Math.abs(snap.hsMs).toFixed(1)} m/s`} tone={Math.abs(snap.hsMs) > 1 ? "caution" : undefined} />
        <Readout label={d.fuel} value={`${snap.fuelPct.toFixed(1)}%`} tone={lowFuel ? "alert" : undefined} />
        <Readout label={d.throttle} value={`${Math.round(snap.throttle * 100)}%`} />
        <Readout
          label={d.fuelClock}
          value={snap.fuelPct <= 0 ? "0 s" : snap.fuelSec > 0 ? `${Math.round(snap.fuelSec)} s` : "—"}
          tone={snap.fuelPct <= 0 || (snap.fuelSec > 0 && snap.fuelSec < 30) ? "caution" : undefined}
        />
      </dl>

      {flightMode && (
        <>
          <div>
            <div className="flex items-baseline justify-between text-[11px] text-foreground/65">
              <span>{d.rateTitle}</span>
              <span className="font-mono">
                {d.safeRate} ≥ {formatVs(Math.abs(rec))}
              </span>
            </div>
            <RateGauge altM={snap.altM} vsMs={snap.vsMs} targetVs={snap.targetVs} show />
          </div>
          <Bar value={snap.fuelPct * (100 / 18)} className={lowFuel ? "bg-nasa-red" : "bg-space-emerald"} />
          <div>
            <p className="mb-0.5 text-[11px] text-foreground/65">{d.stripTitle}</p>
            <LandingStrip
              xM={snap.xM}
              hsMs={snap.hsMs}
              predictedX={snap.predictedX}
              siteId={siteId}
              label={`${d.stripTitle}: ${d.you} ${snap.xM.toFixed(1)} m, ${d.hSpeed} ${snap.hsMs.toFixed(1)} m/s${siteId ? `, ${d.target} ${siteId} ${siteById(siteId).x} m` : ""}`}
              youLabel={d.you}
            />
          </div>
        </>
      )}

      <details className="group text-xs">
        <summary className="flex cursor-pointer items-center justify-between text-foreground/75">
          {d.chartsToggle}
          <StatusBadge status="demo">{tr.common.demoData}</StatusBadge>
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <TelemetryChart
            title={d.altitude}
            xs={xs}
            ys={trace.alt}
            xMax={xMax}
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
            ys={trace.vs}
            xMax={xMax}
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

function Readout({ label, value, tone }: { label: string; value: string; tone?: "caution" | "alert" }) {
  return (
    <div className="bg-space-deep/85 px-2 py-1">
      <dt className="text-[10px] leading-tight text-foreground/65">{label}</dt>
      <dd className={cn("font-mono tabular-nums", tone === "caution" && "text-space-gold", tone === "alert" && "text-nasa-red")}>{value}</dd>
    </div>
  );
}
