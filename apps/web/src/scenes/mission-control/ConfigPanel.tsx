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

  return (
    <div className="flex flex-col gap-5">
      <Choice legend={m.vehicle}>
        {VEHICLES.map((v) => (
          <Option
            key={v.id}
            name="vehicle"
            checked={config.vehicle === v.id}
            onSelect={() => set("vehicle", v.id)}
            title={v.name}
            meta={`${format(m.carries, { value: v.capacityT })} · ${format(m.money, { value: n.format(v.costM) })}`}
            note={`${localize(v.kind)}. ${localize(v.note)}`}
          />
        ))}
      </Choice>

      <Choice legend={m.payload}>
        {PAYLOADS.map((p) => (
          <Option
            key={p.id}
            name="payload"
            checked={config.payload === p.id}
            onSelect={() => set("payload", p.id)}
            title={localize(p.name)}
            meta={`${format(m.tonnes, { value: p.massT })} · ${format(m.money, { value: n.format(p.costM) })}`}
            note={localize(p.note)}
          />
        ))}
      </Choice>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={fuelId} className="text-sm font-medium">
            {m.fuel}
          </label>
          <span className="font-mono text-lg">{config.fuelPct}%</span>
        </div>
        <input
          id={fuelId}
          type="range"
          min={FUEL_MIN}
          max={FUEL_MAX}
          step={FUEL_STEP}
          value={config.fuelPct}
          onChange={(e) => set("fuelPct", Number(e.target.value))}
          className="mt-2 w-full accent-[rgb(var(--primary))]"
        />
      </div>

      <Choice legend={m.orbit} columns={3}>
        {ORBITS.map((o) => (
          <Option
            key={o.km}
            name="orbit"
            checked={config.orbitKm === o.km}
            onSelect={() => set("orbitKm", o.km)}
            title={format(m.km, { value: o.km })}
            note={localize(o.note)}
          />
        ))}
      </Choice>

      <Choice legend={m.window} columns={3}>
        {WINDOWS.map((w) => (
          <Option
            key={w.id}
            name="window"
            checked={config.window === w.id}
            onSelect={() => set("window", w.id)}
            title={localize(w.time)}
            meta={format(m.wind, { value: w.windKmh })}
            note={
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

      <section aria-labelledby="readouts" className="flex flex-col gap-3 bg-space-blue/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="readouts" className="text-sm font-medium">
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
        <p className="text-xs text-foreground/65">{m.rulesNote}</p>
      </section>

      <div className="flex flex-col items-stretch gap-2">
        <Button size="lg" onClick={onProceed} disabled={a.overBudget} aria-describedby={a.overBudget ? "blocked" : undefined}>
          {m.proceed}
        </Button>
        {a.overBudget && (
          <p id="blocked" className="text-sm text-foreground/80">
            {m.blockedBudget}
          </p>
        )}
      </div>
    </div>
  );
}

function Choice({ legend, columns = 1, children }: { legend: string; columns?: 1 | 3; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn("grid gap-1.5", columns === 3 ? "grid-cols-3" : "grid-cols-1")}>{children}</div>
    </fieldset>
  );
}

interface OptionProps {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  meta?: string;
  note?: string;
  warn?: boolean;
}

/** A native radio (keyboard arrows, screen readers) dressed as a console selector. */
function Option({ name, checked, onSelect, title, meta, note, warn }: OptionProps) {
  return (
    <label className="relative block cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="peer sr-only" />
      <span
        className={cn(
          "flex h-full flex-col gap-0.5 bg-space-blue/25 px-3 py-2 text-sm transition-colors hover:bg-surface/40",
          "peer-checked:bg-surface/60 peer-checked:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--primary))]",
        )}
      >
        <span className="font-medium">{title}</span>
        {meta && <span className="font-mono text-xs text-foreground/80">{meta}</span>}
        {note && <span className={cn("text-xs", warn ? "text-warning" : "text-foreground/65")}>{note}</span>}
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

function Readout({ label, value, fill, max, marker, status }: ReadoutProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="text-foreground/85">{label}</span>
        <span className="font-mono text-xs">{value}</span>
      </div>
      <div className="relative mt-1.5">
        <Progress value={fill} max={max} tone={status.status === "fault" ? "warning" : "default"} aria-label={label} />
        {marker !== undefined && (
          <span
            aria-hidden
            className="absolute -bottom-1 -top-1 w-0.5 bg-foreground"
            style={{ left: `calc(${(marker / max) * 100}% - 1px)` }}
          />
        )}
      </div>
      <StatusBadge status={status.status} className="mt-1.5">
        {status.text}
      </StatusBadge>
    </div>
  );
}
