"use client";

import { cn } from "@/lib/utils";
import type { EasepData } from "@/lib/simulation/nasa.types";

const formatLifetime = (days: number) =>
  days >= 365 ? `${Math.round(days / 365)} yr` : days >= 1 ? `${days.toFixed(0)} d` : `${(days * 24).toFixed(0)} h`;

/** Early Apollo Surface Experiments Package (GET /api/nasa/mission-design/easep). */
export function EasepPanel({ data, className }: { data: EasepData; className?: string }) {
  const site = data.deployment_site;
  return (
    <section
      aria-label="EASEP science package"
      data-source={data.source}
      className={cn("font-mono text-[11px] text-foreground/85", className)}
    >
      <header className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
        <span>EASEP · {data.total_mass_kg.toFixed(0)} KG</span>
        <span className="text-foreground/55">{data.source === "reference" ? "1969 FLIGHT SPEC" : data.source.toUpperCase()}</span>
      </header>
      <table className="mt-1.5 w-full text-[10px]">
        <thead className="text-foreground/60">
          <tr>
            <th className="text-left font-normal">Experiment</th>
            <th className="text-right font-normal">Mass</th>
            <th className="text-right font-normal">Power</th>
            <th className="text-right font-normal">Life</th>
          </tr>
        </thead>
        <tbody>
          {data.experiments.map((e) => (
            <tr key={e.id} title={e.description}>
              <td>
                <span className="text-primary">{e.id}</span> <span className="text-foreground/60">{e.name}</span>
              </td>
              <td className="text-right">{e.mass_kg.toFixed(e.mass_kg < 1 ? 2 : 0)} kg</td>
              <td className="text-right">{e.power_draw_watts.toFixed(0)} W</td>
              <td className="text-right">{formatLifetime(e.operating_lifetime_days)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-foreground/60">
        {site.name} · {site.latitude_deg.toFixed(4)}°N {site.longitude_deg.toFixed(4)}°E · {site.distance_from_lm_m.toFixed(1)} m from LM
      </p>
    </section>
  );
}
