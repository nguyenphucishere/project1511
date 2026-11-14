"use client";

import { cn } from "@/lib/utils";
import type { MissionDesignBudgetResult } from "@/lib/simulation/nasa.types";
import { MIN_DELTA_V_RESERVE_PCT, MIN_POWER_MARGIN_PCT } from "@/lib/simulation/nasa.physics";

const CML_NAMES = ["", "Cocktail napkin", "Initial feasibility", "Trade space", "Point design"] as const;

interface GaugeProps {
  label: string;
  value: string;
  /** Fill fraction, 0..1. */
  fill: number;
  /** Requirement line position, 0..1. */
  threshold?: number;
  ok: boolean;
  note: string;
}

function Gauge({ label, value, fill, threshold, ok, note }: GaugeProps) {
  return (
    <div data-gauge={label} data-ok={ok}>
      <div className="flex justify-between text-[10px]">
        <span className="text-foreground/65">{label}</span>
        <span className={ok ? "text-emerald-300" : "text-red-300"}>
          {value} {ok ? "✓" : "✗"}
        </span>
      </div>
      <div className="relative mt-0.5 h-2 w-full bg-space-blue/50">
        <div
          className={cn("h-full", ok ? "bg-emerald-500" : "bg-red-500")}
          style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }}
        />
        {threshold !== undefined && (
          <div aria-hidden className="absolute inset-y-[-2px] w-px bg-foreground/80" style={{ left: `${threshold * 100}%` }} />
        )}
      </div>
      <p className="mt-0.5 text-[10px] text-foreground/50">{note}</p>
    </div>
  );
}

/**
 * Goddard MDL budget readout: mass with growth allowance against the launch capacity, power margin
 * (≥ 30 %), Δv reserve (≥ 10 %) and the JPL Concept Maturity Level.
 */
export function MdlBudgetGauges({
  result,
  capacityKg,
  className,
}: {
  result: MissionDesignBudgetResult;
  capacityKg: number;
  className?: string;
}) {
  const cml = Math.max(1, Math.min(4, Math.round(result.cml_score)));
  // Gauges show 0..2× the requirement so the requirement line sits mid-bar.
  return (
    <section aria-label="Mission design budget" data-cml={cml} className={cn("flex flex-col gap-2 font-mono", className)}>
      <Gauge
        label="MASS + MGA"
        value={`${Math.round(result.dry_mass_with_mga_kg).toLocaleString("en-US")} kg`}
        fill={result.dry_mass_with_mga_kg / capacityKg}
        threshold={1}
        ok={result.is_mass_compliant}
        note={`Margin ${Math.round(result.mass_margin_kg).toLocaleString("en-US")} kg of ${capacityKg.toLocaleString("en-US")} kg TLI`}
      />
      <Gauge
        label="POWER MARGIN"
        value={`${result.power_margin_pct.toFixed(1)}%`}
        fill={result.power_margin_pct / (MIN_POWER_MARGIN_PCT * 2)}
        threshold={0.5}
        ok={result.is_power_compliant}
        note={`Requirement ≥ ${MIN_POWER_MARGIN_PCT}%`}
      />
      <Gauge
        label="ΔV RESERVE"
        value={`${result.delta_v_reserve_pct.toFixed(1)}%`}
        fill={result.delta_v_reserve_pct / (MIN_DELTA_V_RESERVE_PCT * 2)}
        threshold={0.5}
        ok={result.is_delta_v_compliant}
        note={`${Math.round(result.delta_v_available_mps).toLocaleString("en-US")} m/s available · requirement ≥ ${MIN_DELTA_V_RESERVE_PCT}%`}
      />

      <div>
        <div className="flex justify-between text-[10px]">
          <span className="text-foreground/65">JPL CML</span>
          <span className="text-primary">
            CML {cml} · {CML_NAMES[cml]}
          </span>
        </div>
        <ol className="mt-0.5 grid grid-cols-4 gap-0.5" aria-label={`Concept maturity level ${cml} of 4`}>
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className={cn("h-2", n <= cml ? "bg-primary" : "bg-space-blue/50")} />
          ))}
        </ol>
      </div>

      <p className="text-right text-[11px]">
        MDL SCORE <span className="text-primary">{result.overall_mdl_score.toFixed(1)}</span>/100
      </p>
    </section>
  );
}
