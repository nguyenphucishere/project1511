"use client";

import { useId, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useSettingsStore } from "@/game/settingsStore";
import { cn } from "@/lib/utils";
import {
  CONSOLE_VEHICLES,
  DEFAULT_SITE_ID,
  FUEL_MAX,
  FUEL_MIN,
  FUEL_STEP,
  ORBITS,
  PAYLOADS,
} from "@/mocks/launch-options";
import { planRequestFor } from "@/lib/simulation/launch.engine";
import { planLaunch } from "@/lib/simulation/launch.physics";
import type {
  LaunchAssessment,
  LaunchConfig,
  LaunchSite,
  LaunchWindow,
  LaunchWindowsData,
} from "@/lib/simulation/launch.types";

interface ConfigPanelProps {
  config: LaunchConfig;
  onChange: (config: LaunchConfig) => void;
  assessment: LaunchAssessment;
  onProceed: () => void;
  sites: LaunchSite[];
  windows: LaunchWindowsData;
  /** The chosen site's windows are still on their way from the server. */
  windowsLoading?: boolean;
  /** Who computed the readouts: the server's engine, or the same engine code in the browser. */
  engineSource?: "server" | "browser";
}

/**
 * The flight director's planning console. Every number is measured or computed: the weather is
 * the real weather at the pad for each window, and vehicle performance is the engine's. Nothing
 * here judges the choice: the criteria card states the limits and the player makes the call.
 * Only the budget blocks, as it would in real mission planning.
 */
export function ConfigPanel({
  config,
  onChange,
  assessment: a,
  onProceed,
  sites,
  windows,
  windowsLoading = false,
  engineSource = "browser",
}: ConfigPanelProps) {
  const t = useT();
  const m = t.missionControl;
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const n = new Intl.NumberFormat(locale);
  const n1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const fuelId = useId();
  const set = <K extends keyof LaunchConfig>(key: K, value: LaunchConfig[K]) => onChange({ ...config, [key]: value });

  const siteId = config.site ?? DEFAULT_SITE_ID;
  const site = sites.find((s) => s.id === siteId) ?? windows.site;
  const vehicle = CONSOLE_VEHICLES.find((v) => v.id === config.vehicle);
  const payload = PAYLOADS.find((p) => p.id === config.payload);
  const orbit = ORBITS.find((o) => o.km === config.orbitKm);
  const selectedWindow = windows.windows.find((w) => w.id === config.window) ?? windows.windows[0]!;

  // The engine's answer for every vehicle (capacity) and every payload (minimum load) at this
  // orbit and window, so the criteria card can state the safe envelope without judging the pick.
  const envelope = useMemo(() => {
    const capacity = new Map(
      CONSOLE_VEHICLES.map((v) => [
        v.id,
        planLaunch(planRequestFor({ ...config, vehicle: v.id, fuelPct: 100 }, selectedWindow)).payload_capacity_kg / 1000,
      ]),
    );
    const minFuel = PAYLOADS.map((p) => ({
      id: p.id,
      name: localize(p.name),
      massT: p.massT,
      pct: planLaunch(planRequestFor({ ...config, payload: p.id, fuelPct: 100 }, selectedWindow)).min_propellant_load_pct,
    }));
    return { capacity, minFuel };
  }, [config, selectedWindow, localize]);

  const criteria = a.plan.criteria;

  return (
    <div className="flex flex-col gap-3.5">
      <PadTelemetry
        site={site}
        windows={windows}
        window={selectedWindow}
        loading={windowsLoading}
        assessment={a}
        engineSource={engineSource}
      />

      <SitePicker sites={sites} value={siteId} onSelect={(id) => onChange({ ...config, site: id, window: "w1" })} />

      <Choice legend={m.vehicle} note={vehicle && `${localize(vehicle.kind)}. ${localize(vehicle.note)}`}>
        {CONSOLE_VEHICLES.map((v) => (
          <Option
            key={v.id}
            name="vehicle"
            checked={config.vehicle === v.id}
            onSelect={() => set("vehicle", v.id)}
            title={v.name}
            meta={`≤ ${format(m.tonnes, { value: n1.format(envelope.capacity.get(v.id) ?? 0) })}`}
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
            meta={format(m.tonnes, { value: n1.format(p.massT) })}
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

      <Choice legend={m.window} note={selectedWindow.label}>
        {windows.windows.map((w) => (
          <Option
            key={w.id}
            name="window"
            checked={config.window === w.id}
            onSelect={() => set("window", w.id)}
            title={windowTime(w, site, locale)}
            meta={`${format(m.wind, { value: n.format(Math.round(w.weather.wind_speed_kmh)) })} · ${format(m.gusts, { value: n.format(Math.round(w.weather.wind_gust_kmh)) })}`}
            meta2={[
              w.weather.thunderstorm ? m.thunderstorm : format(m.cloud, { value: w.weather.cloud_cover_pct }),
              w.delay_cost_m ? `+${format(m.money, { value: n.format(w.delay_cost_m) })}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </Choice>

      <section aria-labelledby="criteria" className="flex flex-col gap-2 bg-space-blue/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 id="criteria" className="text-xs font-medium">
            {m.criteriaTitle}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            SIM ENGINE · {engineSource === "server" ? "SERVER" : "BROWSER"}
          </span>
        </div>

        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px]" aria-label={m.criteriaWeather}>
          <dt className="col-span-2 text-[10px] uppercase tracking-wider text-foreground/60">{m.criteriaWeather}</dt>
          <dt className="text-foreground/80">{m.criteriaIdealWind}</dt>
          <dd className="font-mono">{format(m.criteriaAtMost, { value: criteria.ideal_wind_kmh })}</dd>
          <dt className="text-foreground/80">{m.criteriaMaxWind}</dt>
          <dd className="font-mono">{format(m.criteriaAtMost, { value: criteria.max_sustained_wind_kmh })}</dd>
          <dt className="text-foreground/80">{m.criteriaMaxGust}</dt>
          <dd className="font-mono">{format(m.criteriaAtMost, { value: criteria.max_peak_gust_kmh })}</dd>
          <dt className="text-foreground/80">{m.criteriaStorms}</dt>
          <dd className="font-mono">{m.criteriaNoLaunch}</dd>
        </dl>

        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
          <dt className="col-span-2 text-[10px] uppercase tracking-wider text-foreground/60">
            {format(m.criteriaVehicle, { vehicle: vehicle?.name ?? "", km: config.orbitKm })}
          </dt>
          <dt className="text-foreground/80">{m.criteriaCapacity}</dt>
          <dd className="font-mono">{format(m.tonnes, { value: n1.format(a.capacityT) })}</dd>
          <dt className="col-span-2 pt-0.5 text-foreground/80">{m.criteriaMinFuel}</dt>
          {envelope.minFuel.map((p) => (
            <div key={p.id} className="contents">
              <dt className="truncate pl-2 text-foreground/70" title={p.name}>
                {format(m.tonnes, { value: n1.format(p.massT) })} · {p.name}
              </dt>
              <dd className="font-mono">{p.pct === null ? m.criteriaCannot : `${n1.format(p.pct)}%`}</dd>
            </div>
          ))}
        </dl>

        <Readout
          label={m.budget}
          value={format(m.ofMax, {
            value: format(m.money, { value: n.format(a.costM) }),
            max: format(m.money, { value: n.format(a.budgetM) }),
          })}
          fill={a.costM}
          max={a.budgetM}
          status={{ status: "go", text: m.ok }}
        />
        <p className="text-[11px] text-foreground/60">{m.criteriaNote}</p>
      </section>

      <div className="flex flex-col items-stretch gap-1.5">
        <Button
          onClick={onProceed}
          disabled={windowsLoading}
        >
          {m.proceed}
        </Button>
      </div>
    </div>
  );
}

/** Window opening time in the pad's local time zone. */
export function windowTime(w: LaunchWindow, site: LaunchSite, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: site.time_zone,
      year: w.opens_at.startsWith("19") ? "numeric" : undefined,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(w.opens_at));
  } catch {
    return w.opens_at.slice(0, 16).replace("T", " ");
  }
}

const latLabel = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "N" : "S"}`;
const lonLabel = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "E" : "W"}`;

/** Header strip: the pad, its coordinates, the chosen window's ground weather and the engine's numbers. */
function PadTelemetry({
  site,
  windows,
  window: w,
  loading,
  assessment: a,
  engineSource,
}: {
  site: LaunchSite;
  windows: LaunchWindowsData;
  window: LaunchWindow;
  loading: boolean;
  assessment: LaunchAssessment;
  engineSource: "server" | "browser";
}) {
  const m = useT().missionControl;
  const locale = useSettingsStore((s) => s.locale);
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const source = loading
    ? m.sourceLoading
    : windows.source === "offline_fallback"
      ? m.sourceOffline
      : windows.kind === "historical"
        ? m.sourceHistorical
        : m.sourceLive;
  const wx = w.weather;
  return (
    <div
      className="rounded border border-space-blue/60 bg-space-blue/25 px-3 py-2 font-mono text-[11px] text-foreground/85"
      data-site={site.id}
      data-weather-source={windows.source}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-primary">
        <span className="truncate">{format(m.padTelemetry, { pad: site.pad, site: site.name })}</span>
        <span className="shrink-0">{source}</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
        <span>
          {latLabel(site.latitude_deg)}, {lonLabel(site.longitude_deg)}
        </span>
        <span className="text-right">{format(m.localTime, { time: windowTime(w, site, locale) })}</span>
        <span className="col-span-2">
          {m.weatherNow}: {wx.temperature_c.toFixed(1)}°C · {n.format(wx.wind_speed_kmh)} km/h{" "}
          {format(m.windFrom, { deg: wx.wind_direction_deg })} · {format(m.gusts, { value: `${n.format(wx.wind_gust_kmh)} km/h` })}
          {" · "}
          {wx.thunderstorm ? m.thunderstorm : format(m.cloud, { value: wx.cloud_cover_pct })}
          {wx.precipitation_mm > 0 && ` · ${format(m.rain, { value: wx.precipitation_mm })}`}
        </span>
        <span className="col-span-2 text-foreground/70" data-engine={engineSource}>
          {format(m.engineReadout, {
            glom: n.format(a.plan.glom_kg / 1000),
            twr: a.plan.liftoff_twr.toFixed(3),
            q: a.plan.max_q_kpa.toFixed(1),
          })}
        </span>
      </div>
    </div>
  );
}

/** Equirectangular world map (lon −180…180, lat 90…−90) with one marker per pad, plus a radio list. */
function SitePicker({ sites, value, onSelect }: { sites: LaunchSite[]; value: string; onSelect: (id: string) => void }) {
  const m = useT().missionControl;
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium">{m.site}</legend>
      <div className="relative aspect-[2/1] w-full overflow-hidden rounded border border-space-blue/60 bg-space-deep">
        {/* eslint-disable-next-line @next/next/no-img-element -- static texture, no optimisation needed */}
        <img
          src="/assets/textures/earth_map_1k.jpg"
          alt={m.siteMap}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
          draggable={false}
        />
        {sites.map((s) => {
          const selected = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              tabIndex={-1}
              aria-hidden
              title={`${s.name} (${s.pad})`}
              onClick={() => onSelect(s.id)}
              className={cn(
                "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform",
                selected
                  ? "z-10 scale-125 border-white bg-[rgb(var(--primary))] shadow-[0_0_0_3px_rgb(var(--primary)/0.4)]"
                  : "border-white/80 bg-space-deep/80 hover:scale-125",
              )}
              style={{ left: `${((s.longitude_deg + 180) / 360) * 100}%`, top: `${((90 - s.latitude_deg) / 180) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {sites.map((s) => (
          <label key={s.id} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              checked={s.id === value}
              onChange={() => onSelect(s.id)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-full flex-col bg-space-blue/25 px-2 py-1 text-[11px] transition-colors hover:bg-surface/40",
                "peer-checked:bg-surface/60 peer-checked:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--primary))]",
              )}
            >
              <span className="font-medium leading-tight">{s.name}</span>
              <span className="font-mono text-[10px] text-foreground/65">
                {s.pad} · {s.windows === "historical" ? m.siteHistorical : m.siteLive}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
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
}

/** A native radio (keyboard arrows, screen readers) dressed as a console selector. */
function Option({ name, checked, onSelect, title, meta, meta2 }: OptionProps) {
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
        {meta2 && <span className="font-mono text-[11px] text-foreground/65">{meta2}</span>}
      </span>
    </label>
  );
}

interface ReadoutProps {
  label: string;
  value: string;
  fill: number;
  max: number;
  status: { status: Status; text: string };
}

/** One line of label + value, a thin bar, and the verdict only when something is wrong. */
function Readout({ label, value, fill, max, status }: ReadoutProps) {
  const fault = status.status === "fault";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="text-foreground/85">{label}</span>
        <span className="font-mono text-[11px]">{value}</span>
      </div>
      <Progress className="mt-1 h-2" value={fill} max={max} tone={fault ? "warning" : "default"} aria-label={`${label}: ${status.text}`} />
      {fault && (
        <StatusBadge status="fault" className="mt-1">
          {status.text}
        </StatusBadge>
      )}
    </div>
  );
}
