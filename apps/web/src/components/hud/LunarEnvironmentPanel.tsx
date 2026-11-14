"use client";

import { cn } from "@/lib/utils";
import type { LunarEnvironmentData } from "@/lib/simulation/nasa.types";

const SOURCE_LABEL: Record<string, string> = {
  engine: "SIM ENGINE",
  api: "LIVE API",
  offline_fallback: "APOLLO 11 ARCHIVE",
};

/** Tranquility Base surface constants (GET /api/nasa/lunar-environment, computed by sim-core). */
export function LunarEnvironmentPanel({ data, className }: { data: LunarEnvironmentData; className?: string }) {
  const mgal = data.mascon_anomaly_mgal ?? data.mascon_anomaly_mps2 * 1e5;
  const rows: [string, string][] = [
    ["Gravity (standard)", `${data.standard_gravity_mps2.toFixed(3)} m/s²`],
    ["Mascon anomaly", `+${mgal.toFixed(0)} mGal`],
    ["Gravity (local)", `${data.local_gravity_effective_mps2.toFixed(4)} m/s²`],
    ["Terrain slope", `${data.terrain_slope_deg.toFixed(1)}°`],
    ["Regolith density", `${data.regolith_bulk_density_kg_m3.toFixed(0)} kg/m³`],
    ["Bearing capacity", `${data.regolith_bearing_capacity_kpa.toFixed(0)} kPa`],
    [
      "Surface temp",
      data.surface_temperature_day_c !== undefined && data.surface_temperature_night_c !== undefined
        ? `${data.surface_temperature_night_c.toFixed(0)} … ${data.surface_temperature_day_c.toFixed(0)} °C`
        : `${data.surface_temperature_c.toFixed(0)} °C`,
    ],
  ];
  if (data.moon_radius_km !== undefined) rows.push(["Moon radius", `${data.moon_radius_km.toFixed(1)} km`]);

  return (
    <section
      aria-label="Lunar surface environment"
      data-source={data.source}
      className={cn("font-mono text-[11px] text-foreground/85", className)}
    >
      <header className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
        <span>LUNAR SURFACE · MARE TRANQUILLITATIS</span>
        <span className="text-foreground/55">{SOURCE_LABEL[data.source] ?? data.source.toUpperCase()}</span>
      </header>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-foreground/60">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
