"use client";

import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import type { MissionRiskStatus, SpaceWeatherData } from "@/lib/simulation/nasa.types";

/** Dosimeter full scale. Quiet sun in cislunar space reads ~1 mrad/h; a major SEP reaches tens. */
export const DOSIMETER_FULL_SCALE_MRAD_H = 50;

const RISK: Record<MissionRiskStatus, { status: Status; label: string }> = {
  NOMINAL_QUIET: { status: "go", label: "QUIET SUN" },
  ELEVATED_WATCH: { status: "caution", label: "SOLAR WATCH" },
  SEVERE_ALERT: { status: "fault", label: "SOLAR ALERT" },
};

/** NASA DONKI space weather: solar activity alerts and the crew radiation dose rate. */
export function SpaceWeatherWidget({ data, className }: { data: SpaceWeatherData; className?: string }) {
  const risk = RISK[data.mission_risk_status] ?? RISK.ELEVATED_WATCH;
  const dose = data.radiation_dose_rate_mrad_per_hour;
  const pct = Math.min(100, (dose / DOSIMETER_FULL_SCALE_MRAD_H) * 100);
  const alerts = [data.cme_alert && "CME", data.solar_proton_event_alert && "SEP"].filter(Boolean) as string[];

  return (
    <section
      aria-label="Space weather"
      data-risk={data.mission_risk_status}
      className={cn("font-mono text-[11px] text-foreground/85", className)}
    >
      <header className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
        <span>SPACE WEATHER · CYCLE {data.solar_cycle}</span>
        <span className="text-foreground/55">{data.source === "api" ? "LIVE NASA DONKI" : "JULY 1969"}</span>
      </header>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <StatusBadge status={risk.status}>{risk.label}</StatusBadge>
        {alerts.map((a) => (
          <StatusBadge key={a} status="fault">
            {a} ALERT
          </StatusBadge>
        ))}
      </div>

      <div className="mt-2">
        <div className="flex justify-between text-[10px] text-foreground/60">
          <span>DOSIMETER</span>
          <span>{dose.toFixed(2)} mrad/h</span>
        </div>
        <div
          role="meter"
          aria-label="Radiation dose rate"
          aria-valuemin={0}
          aria-valuemax={DOSIMETER_FULL_SCALE_MRAD_H}
          aria-valuenow={dose}
          className="mt-0.5 h-2 w-full bg-space-blue/50"
        >
          <div
            className={cn(
              "h-full",
              risk.status === "go" ? "bg-emerald-500" : risk.status === "caution" ? "bg-amber-400" : "bg-red-500",
            )}
            style={{ width: `${Math.max(1.5, pct)}%` }}
          />
        </div>
      </div>

      <dl className="mt-1.5 grid grid-cols-2 gap-x-2 text-[10px]">
        <dt className="text-foreground/60">F10.7 flux</dt>
        <dd className="text-right">{data.solar_flux_f107.toFixed(0)} sfu</dd>
        <dt className="text-foreground/60">Kp index</dt>
        <dd className="text-right">{data.geomagnetic_kp_index.toFixed(1)}</dd>
      </dl>
    </section>
  );
}
