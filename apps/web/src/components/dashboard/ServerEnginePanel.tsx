"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import type { EngineApollo11Data, EngineCalculationName, EngineStatusData } from "@/lib/simulation/nasa.types";

type Result = Record<string, unknown>;
const num = (r: Result, k: string, digits = 0) =>
  typeof r[k] === "number" ? (r[k] as number).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "—";
const flag = (r: Result, k: string) => r[k] === true;

/** One row per engine calculation: label, the headline numbers, and a pass/fail flag. */
const ROWS: { key: EngineCalculationName; label: string; summary: (r: Result) => string; ok?: (r: Result) => boolean }[] = [
  {
    key: "validate_launch",
    label: "Launch envelope",
    summary: (r) => `GLOM ${num(r, "glom_kg")} kg · TWR ${num(r, "liftoff_twr", 3)} · max-Q ${num(r, "max_q_kpa", 1)} kPa · margin ${num(r, "payload_margin_kg")} kg`,
    ok: (r) => flag(r, "is_valid"),
  },
  {
    key: "run_descent_step",
    label: "Descent step (PDI +1 s)",
    summary: (r) => `alt ${num(r, "altitude_m", 1)} m · v/s ${num(r, "vertical_velocity_mps", 2)} m/s · prop ${num(r, "propellant_remaining_kg", 1)} kg`,
    ok: (r) => !flag(r, "is_bingo_fuel"),
  },
  {
    key: "calculate_score",
    label: "Mission score",
    summary: (r) => `${num(r, "final_score", 1)} pts (science ${num(r, "science_score")} · cost ${num(r, "cost_score")} · risk ${num(r, "risk_penalty")})`,
    ok: (r) => flag(r, "is_success"),
  },
  {
    key: "calculate_landing_radar",
    label: "Landing radar (500 ft)",
    summary: (r) => `radar alt ${num(r, "radar_altitude_m", 1)} m · scale ${num(r, "scale_mode")} · fwd ${num(r, "forward_velocity_mps", 1)} m/s`,
    ok: (r) => flag(r, "data_good"),
  },
  {
    key: "evaluate_mission_design_budget",
    label: "MDL design budget",
    summary: (r) => `CML ${num(r, "cml_score")} · score ${num(r, "overall_mdl_score", 1)} · Δv reserve ${num(r, "delta_v_reserve_pct", 1)}%`,
    ok: (r) => flag(r, "is_mass_compliant") && flag(r, "is_power_compliant") && flag(r, "is_delta_v_compliant"),
  },
  {
    key: "simulate_ascent",
    label: "Saturn V ascent",
    summary: (r) => {
      const e = (r.events ?? {}) as Result;
      return `orbit at T+${num(e, "insertion_s")} s · ${num(r, "insertion_altitude_km", 1)} km · ${num(r, "insertion_velocity_mps")} m/s · Max-Q ${num(e, "max_q_kpa", 1)} kPa`;
    },
    ok: (r) => flag(r, "reached_orbit"),
  },
  {
    key: "simulate_powered_descent",
    label: "LM powered descent",
    summary: (r) => {
      const lg = (r.low_gate ?? {}) as Result;
      return `low gate T+${num(lg, "t_s")} s · ${num(lg, "altitude_m")} m · ${num(lg, "propellant_kg")} kg DPS left · g ${num(r, "local_gravity_mps2", 4)}`;
    },
    ok: (r) => typeof r.low_gate === "object",
  },
  {
    key: "calculate_dsn_telemetry",
    label: "DSN link (July 1969)",
    summary: (r) => `RTLT ${num(r, "rtlt_seconds", 3)} s · loss ${num(r, "path_loss_db", 1)} dB · ${num(r, "received_power_dbm", 1)} dBm`,
    ok: (r) => !flag(r, "is_occulted"),
  },
];

/**
 * The Rust engine running on the server (GET /api/engine/status + /api/engine/apollo11):
 * every calculation it exposes, evaluated on the flown Apollo 11 baseline.
 */
export function ServerEnginePanel({
  status,
  apollo11,
  className,
}: {
  status: EngineStatusData | null;
  apollo11: EngineApollo11Data | null;
  className?: string;
}) {
  const online = Boolean(status?.loaded);
  return (
    <section
      aria-label="Server simulation engine"
      data-engine={online ? "online" : "offline"}
      className={cn("font-mono text-[11px] text-foreground/85", className)}
    >
      <header className="flex items-center justify-between text-[10px] uppercase tracking-wider text-primary">
        <span>SIM ENGINE · SERVER</span>
        <span className="text-foreground/55">{online ? status?.version ?? "ONLINE" : "OFFLINE · USING BROWSER ENGINE"}</span>
      </header>

      {online && apollo11 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {ROWS.map(({ key, label, summary, ok }) => {
            const r = apollo11[key]?.result;
            if (!r) return null;
            const good = ok ? ok(r) : true;
            return (
              <li key={key} data-calc={key} className="border-l-2 border-space-blue/60 pl-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-foreground/60">{label}</span>
                  <StatusBadge status={good ? "go" : "caution"}>{good ? "GO" : "CHECK"}</StatusBadge>
                </div>
                <p className="text-[10px]">{summary(r)}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1.5 text-[10px] text-foreground/60">
          {online ? "Running Apollo 11 baseline…" : "Server engine unreachable; calculations run in the browser instead."}
        </p>
      )}
    </section>
  );
}
