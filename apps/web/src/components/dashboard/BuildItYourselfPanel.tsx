"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MissionDesignBudgetInput, MissionDesignBudgetResult } from "@/lib/simulation/nasa.types";
import {
  APOLLO_11_DESIGN_BASELINE,
  MAX_TLI_PAYLOAD_CAPACITY_KG,
  missionDesignBudget,
} from "@/lib/simulation/nasa.physics";
import { MdlBudgetGauges } from "./MdlBudgetGauges";

type SliderKey = "dry_mass_basic_kg" | "mga_margin_pct" | "power_load_watts" | "power_generation_watts" | "delta_v_required_mps";

const SLIDERS: { key: SliderKey; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "dry_mass_basic_kg", label: "Spacecraft dry mass", min: 20_000, max: 60_000, step: 500, unit: "kg" },
  { key: "mga_margin_pct", label: "Mass growth allowance", min: 0, max: 30, step: 1, unit: "%" },
  { key: "power_load_watts", label: "Power load", min: 500, max: 3_000, step: 50, unit: "W" },
  { key: "power_generation_watts", label: "Fuel cell output", min: 500, max: 4_000, step: 50, unit: "W" },
  { key: "delta_v_required_mps", label: "Δv required (TLI→TEI)", min: 3_000, max: 8_000, step: 50, unit: "m/s" },
];

export interface BuildItYourselfPanelProps {
  /** Engine call (useSimulationWasm().evaluateMissionDesignBudget). Defaults to the TypeScript mirror. */
  evaluate?: (input: MissionDesignBudgetInput) => Promise<MissionDesignBudgetResult>;
  initial?: MissionDesignBudgetInput;
  /** Reports each evaluated design (e.g. to log the player's trade study). */
  onResult?: (input: MissionDesignBudgetInput, result: MissionDesignBudgetResult) => void;
}

/**
 * "Build it yourself" trade study: move the design knobs and watch the Goddard MDL budget and the
 * JPL concept maturity level react. Starts from the Apollo 11 CSM + LM baseline (CML 4).
 */
export function BuildItYourselfPanel({ evaluate, initial = APOLLO_11_DESIGN_BASELINE, onResult }: BuildItYourselfPanelProps) {
  const [design, setDesign] = useState<MissionDesignBudgetInput>(initial);
  // First paint uses the synchronous mirror so the gauges never render empty.
  const [result, setResult] = useState<MissionDesignBudgetResult>(() => missionDesignBudget(initial));
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const run = evaluate ?? ((d: MissionDesignBudgetInput) => Promise.resolve(missionDesignBudget(d)));
    run(design)
      .then((r) => {
        if (n !== seq.current) return; // a newer slider value is already in flight
        setResult(r);
        onResult?.(design, r);
      })
      .catch(() => {
        if (n === seq.current) setResult(missionDesignBudget(design));
      });
  }, [design, evaluate, onResult]);

  const capacity = design.launch_vehicle_capacity_kg ?? MAX_TLI_PAYLOAD_CAPACITY_KG;

  return (
    <section aria-labelledby="biy-title" className="flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between">
        <h3 id="biy-title" className="font-mono text-[10px] uppercase tracking-wider text-primary">
          Build it yourself · trade study
        </h3>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setDesign(initial)}>
          Apollo 11 baseline
        </Button>
      </header>

      <div className="flex flex-col gap-2">
        {SLIDERS.map((s) => {
          const value = (design[s.key] ?? 0) as number;
          const id = `biy-${s.key}`;
          return (
            <label key={s.key} htmlFor={id} className="flex flex-col gap-0.5">
              <span className="flex justify-between">
                <span className="text-foreground/75">{s.label}</span>
                <span className="font-mono">
                  {value.toLocaleString("en-US")} {s.unit}
                </span>
              </span>
              <input
                id={id}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={value}
                onChange={(e) => setDesign((d) => ({ ...d, [s.key]: Number(e.target.value) }))}
                className="w-full accent-[rgb(var(--primary))]"
              />
            </label>
          );
        })}
      </div>

      <MdlBudgetGauges result={result} capacityKg={capacity} />
    </section>
  );
}
