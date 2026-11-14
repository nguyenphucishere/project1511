"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import type { LandingRadarMeasurement } from "@/lib/simulation/nasa.types";
import { RADAR_SCALE_SHIFT_ALTITUDE_M } from "@/lib/simulation/nasa.physics";

function fmtAlt(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;
}

/**
 * The AGC's inertial altitude next to the landing radar's measured altitude over the terrain.
 * Their difference is the crater / terrain delta the radar update corrects; the radar switches
 * from high scale (1) to low scale (2) below 762 m and drops "data good" outside its envelope.
 */
export function LandingRadarProfile({
  measurement,
  fullScaleM = 15_240,
  className,
}: {
  measurement: LandingRadarMeasurement;
  fullScaleM?: number;
  className?: string;
}) {
  const m = measurement;
  const bar = (v: number) => `${Math.max(0, Math.min(1, v / fullScaleM)) * 100}%`;
  const delta = m.altitude_delta_m;

  return (
    <section
      aria-label="Landing radar"
      data-scale-mode={m.scale_mode}
      data-radar-good={m.data_good}
      className={cn("font-mono text-[11px] text-foreground/85", className)}
    >
      <header className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
        <span>LANDING RADAR · AGC</span>
        <span
          className={cn(
            "px-1.5 py-px text-[10px]",
            m.scale_mode === 2 ? "bg-primary text-primary-foreground" : "bg-space-blue/50 text-foreground/70",
          )}
          title={`High scale above ${RADAR_SCALE_SHIFT_ALTITUDE_M} m, low scale below`}
        >
          SCALE {m.scale_mode} · {m.scale_mode === 1 ? "HIGH" : "LOW"}
        </span>
      </header>

      <div className="mt-1.5 grid grid-cols-[4.5rem_1fr_4rem] items-center gap-x-2 gap-y-1">
        <span className="text-[10px] text-foreground/60">AGC INERTIAL</span>
        <div className="h-2 bg-space-blue/50">
          <div className="h-full bg-sky-400" style={{ width: bar(m.inertial_altitude_m) }} />
        </div>
        <span className="text-right">{fmtAlt(m.inertial_altitude_m)}</span>

        <span className="text-[10px] text-foreground/60">RADAR</span>
        <div className="h-2 bg-space-blue/50">
          <div className={cn("h-full", m.data_good ? "bg-emerald-400" : "bg-foreground/25")} style={{ width: bar(m.radar_altitude_m) }} />
        </div>
        <span className="text-right">{m.data_good ? fmtAlt(m.radar_altitude_m) : "—"}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <StatusBadge status={m.data_good ? "go" : "caution"}>{m.data_good ? "DATA GOOD" : "NO RADAR LOCK"}</StatusBadge>
        <span className={cn("text-[10px]", Math.abs(delta) > 30 ? "text-amber-300" : "text-foreground/60")}>
          Δh {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)} m
        </span>
      </div>
    </section>
  );
}
