"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import type { DsnStatusData, DsnTelemetryResult } from "@/lib/simulation/nasa.types";

export interface DsnTrackingStatusProps {
  status: DsnStatusData;
  /** Link budget from the engine (calculate_dsn_telemetry); overrides RTLT / power when present. */
  link?: DsnTelemetryResult | null;
  /** Hide the per-dish list (descent console). */
  compact?: boolean;
  className?: string;
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE_PRIMARY: "text-emerald-300",
  TRACKING: "text-sky-300",
  STANDBY_BACKUP: "text-foreground/55",
};

/**
 * Deep Space Network / MSFN link: which ground station has Eagle, carrier and telemetry lock,
 * received signal strength and the Earth–Moon round-trip light time (≈ 2.56 s).
 */
export function DsnTrackingStatus({ status, link, compact = false, className }: DsnTrackingStatusProps) {
  const occulted = link?.is_occulted ?? status.is_lunar_occultation;
  const rtlt = link?.rtlt_seconds ?? status.rtlt_seconds;
  const dbm = occulted ? null : (link?.received_power_dbm ?? status.signal_strength_dbm);
  const carrier = status.carrier_lock && !occulted;
  const telemetry = status.telemetry_lock && !occulted;

  return (
    <section
      aria-label="Deep Space Network tracking"
      data-dsn-status={occulted ? "los" : "aos"}
      className={cn("font-mono text-[11px] text-foreground/85", className)}
    >
      <header className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
        <span>DSN / MSFN LINK</span>
        <span className="text-foreground/55">{status.source === "api" ? "LIVE NASA DSN" : "APOLLO 11 ARCHIVE"}</span>
      </header>

      <p className="mt-1 truncate" title={status.active_station}>
        {status.active_station}
      </p>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {occulted ? (
          <StatusBadge status="fault">LOS · lunar occultation</StatusBadge>
        ) : (
          <>
            <StatusBadge status={carrier ? "go" : "caution"}>CARRIER {carrier ? "LOCK" : "SEARCH"}</StatusBadge>
            <StatusBadge status={telemetry ? "go" : "caution"}>TLM {telemetry ? "LOCK" : "NO LOCK"}</StatusBadge>
          </>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-px bg-space-blue/60">
        <div className="bg-space-deep/85 px-1.5 py-1">
          <dt className="text-[10px] text-foreground/60">RTLT</dt>
          <dd data-rtlt>{rtlt.toFixed(2)} s</dd>
        </div>
        <div className="bg-space-deep/85 px-1.5 py-1">
          <dt className="text-[10px] text-foreground/60">SIGNAL</dt>
          <dd>{dbm === null ? "—" : `${dbm.toFixed(1)} dBm`}</dd>
        </div>
        <div className="bg-space-deep/85 px-1.5 py-1">
          <dt className="text-[10px] text-foreground/60">DATA</dt>
          <dd>{occulted ? "0" : status.bitrate_kbps} kbps</dd>
        </div>
      </dl>

      {link && !occulted && (
        <p className="mt-1 text-[10px] text-foreground/55">
          S-band {status.downlink_frequency_mhz} MHz · path loss {link.path_loss_db.toFixed(1)} dB
        </p>
      )}

      {!compact && (
        <ul className="mt-2 flex flex-col gap-0.5 text-[10px]">
          {status.complexes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="truncate" title={c.name}>
                {c.dish}
              </span>
              <span className="text-foreground/55">
                AZ {c.azimuth_deg.toFixed(0)}° EL {c.elevation_deg.toFixed(0)}°
              </span>
              <span className={STATUS_TONE[c.status] ?? "text-foreground/70"}>{c.status.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
