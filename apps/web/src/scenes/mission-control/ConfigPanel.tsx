"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useSettingsStore } from "@/game/settingsStore";
import { cn } from "@/lib/utils";
import {
  FUEL_MAX,
  FUEL_MIN,
  FUEL_STEP,
  ORBITS,
  PAYLOADS,
  VEHICLES,
  WINDOWS,
  WIND_LIMIT_KMH,
} from "@/mocks/launch-options";
import type { LaunchAssessment, LaunchConfig } from "@/lib/simulation/launch.types";

interface ConfigPanelProps {
  config: LaunchConfig;
  onChange: (config: LaunchConfig) => void;
  assessment: LaunchAssessment;
  onProceed: () => void;
}

/**
 * The Commander UI: five choices on the left of each row, live DEMO readouts underneath.
 * Overweight or short-fuel configs are allowed on purpose: the briefing promised the player
 * would "find out in flight". Only the budget blocks, as it would in real mission planning.
 */
export function ConfigPanel({ config, onChange, assessment: a, onProceed }: ConfigPanelProps) {
  const t = useT();
  const m = t.missionControl;
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const n = new Intl.NumberFormat(locale);
  const fuelId = useId();
  const set = <K extends keyof LaunchConfig>(key: K, value: LaunchConfig[K]) => onChange({ ...config, [key]: value });

  const fuelStatus: { status: Status; text: string } =
    a.requiredFuelPct > 100
      ? { status: "fault", text: m.fuelImpossible }
      : a.fuelShort
        ? { status: "fault", text: m.fuelShort }
        : { status: "go", text: m.ok };

  const vehicle = VEHICLES.find((v) => v.id === config.vehicle);
  const payload = PAYLOADS.find((p) => p.id === config.payload);
  const orbit = ORBITS.find((o) => o.km === config.orbitKm);

  return (
    <div className="flex flex-col gap-3.5">
      <Choice legend={m.vehicle} note={vehicle && `${localize(vehicle.kind)}. ${localize(vehicle.note)}`}>
        {VEHICLES.map((v) => (
          <Option
            key={v.id}
            name="vehicle"
            checked={config.vehicle === v.id}
            onSelect={() => set("vehicle", v.id)}
            title={v.name}
            meta={format(m.tonnes, { value: v.capacityT })}
            meta2={format(m.money, { value: n.format(v.costM) })}
          />
        ))}
      </Choice>

      <Choice legend={m.payload} note={payload && localize(payload.note)}>
        {PAYLOADS.map((p) => (
          <Option
            key={p.id}
            name="payload"
            checked={config.payload === p.id}
            onSelect={() => set("payload", p.id)}
            title={localize(p.name)}
            meta={format(m.tonnes, { value: p.massT })}
            meta2={format(m.money, { value: n.format(p.costM) })}
          />
        ))}
      </Choice>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={fuelId} className="text-xs font-medium">
            {m.fuel}
          </label>
          <span className="font-mono text-sm">{config.fuelPct}%</span>
        </div>
        <input
          id={fuelId}
          type="range"
          min={FUEL_MIN}
          max={FUEL_MAX}
          step={FUEL_STEP}
          value={config.fuelPct}
          onChange={(e) => set("fuelPct", Number(e.target.value))}
          className="mt-1 w-full accent-[rgb(var(--primary))]"
        />
      </div>

      <Choice legend={m.orbit} note={orbit && localize(orbit.note)}>
        {ORBITS.map((o) => (
          <Option
            key={o.km}
            name="orbit"
            checked={config.orbitKm === o.km}
            onSelect={() => set("orbitKm", o.km)}
            title={format(m.km, { value: o.km })}
          />
        ))}
      </Choice>

      <Choice legend={m.window}>
        {WINDOWS.map((w) => (
          <Option
            key={w.id}
            name="window"
            checked={config.window === w.id}
            onSelect={() => set("window", w.id)}
            title={localize(w.time)}
            meta={format(m.wind, { value: w.windKmh })}
            meta2={
              w.windKmh > WIND_LIMIT_KMH
                ? `> ${WIND_LIMIT_KMH} km/h`
                : w.delayCostM
                  ? `+${format(m.money, { value: w.delayCostM })}`
                  : undefined
            }
            warn={w.windKmh > WIND_LIMIT_KMH}
          />
        ))}
      </Choice>

      <section aria-labelledby="readouts" className="flex flex-col gap-2 bg-space-blue/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 id="readouts" className="text-xs font-medium">
            {m.readouts}
          </h3>
          <StatusBadge status="demo">{t.common.demoData}</StatusBadge>
        </div>
        <Readout
          label={m.payloadVsCapacity}
          value={format(m.ofMax, { value: format(m.tonnes, { value: a.payloadT }), max: format(m.tonnes, { value: a.capacityT }) })}
          fill={a.payloadT}
          max={a.capacityT}
          status={a.overCapacity ? { status: "fault", text: m.overCapacity } : { status: "go", text: m.ok }}
        />
        <Readout
          label={m.fuelVsNeeded}
          value={format(m.ofMax, { value: `${config.fuelPct}%`, max: `${a.requiredFuelPct}%` })}
          fill={config.fuelPct}
          max={100}
          marker={Math.min(a.requiredFuelPct, 100)}
          status={fuelStatus}
        />
        <Readout
          label={m.budget}
          value={format(m.ofMax, {
            value: format(m.money, { value: n.format(a.costM) }),
            max: format(m.money, { value: n.format(a.budgetM) }),
          })}
          fill={a.costM}
          max={a.budgetM}
          status={a.overBudget ? { status: "fault", text: m.overBudget } : { status: "go", text: m.ok }}
        />
        <p className="text-[11px] text-foreground/60">{m.rulesNote}</p>
      </section>

      <div className="flex flex-col items-stretch gap-1.5">
        <Button onClick={onProceed} disabled={a.overBudget} aria-describedby={a.overBudget ? "blocked" : undefined}>
          {m.proceed}
        </Button>
        {a.overBudget && (
          <p id="blocked" className="text-xs text-foreground/80">
            {m.blockedBudget}
          </p>
        )}
      </div>
    </div>
  );
}

/** Three options side by side; only the selected one's description is shown, underneath. */
function Choice({ legend, note, children }: { legend: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium">{legend}</legend>
      <div className="grid grid-cols-3 gap-1">{children}</div>
      {note && <p className="mt-1 text-[11px] leading-snug text-foreground/65">{note}</p>}
    </fieldset>
  );
}

interface OptionProps {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  meta?: string;
  meta2?: string;
  warn?: boolean;
}

/** A native radio (keyboard arrows, screen readers) dressed as a console selector. */
function Option({ name, checked, onSelect, title, meta, meta2, warn }: OptionProps) {
  return (
    <label className="relative block cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="peer sr-only" />
      <span
        className={cn(
          "flex h-full flex-col gap-0.5 bg-space-blue/25 px-2 py-1.5 text-xs transition-colors hover:bg-surface/40",
          "peer-checked:bg-surface/60 peer-checked:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--primary))]",
        )}
      >
        <span className="font-medium leading-tight">{title}</span>
        {meta && <span className="font-mono text-[11px] text-foreground/80">{meta}</span>}
        {meta2 && <span className={cn("font-mono text-[11px]", warn ? "text-warning" : "text-foreground/65")}>{meta2}</span>}
      </span>
    </label>
  );
}

interface ReadoutProps {
  label: string;
  value: string;
  fill: number;
  max: number;
  /** Optional tick on the bar, in the same units (e.g. fuel needed). */
  marker?: number;
  status: { status: Status; text: string };
}

/** One line of label + value, a thin bar, and the verdict only when something is wrong. */
function Readout({ label, value, fill, max, marker, status }: ReadoutProps) {
  const fault = status.status === "fault";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="text-foreground/85">{label}</span>
        <span className="font-mono text-[11px]">{value}</span>
      </div>
      <div className="relative mt-1">
        <Progress className="h-2" value={fill} max={max} tone={fault ? "warning" : "default"} aria-label={`${label}: ${status.text}`} />
        {marker !== undefined && (
          <span
            aria-hidden
            className="absolute -bottom-1 -top-1 w-0.5 bg-foreground"
            style={{ left: `calc(${(marker / max) * 100}% - 1px)` }}
          />
        )}
      </div>
      {fault && (
        <StatusBadge status="fault" className="mt-1">
          {status.text}
        </StatusBadge>
      )}
    </div>
  );
}
