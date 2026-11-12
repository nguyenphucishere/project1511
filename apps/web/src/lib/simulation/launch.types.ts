import type { FailureTraceStep } from "@space-sim/shared-schema";

/**
 * PROVISIONAL launch contract for the lunar demo. shared-schema has no lunar mission model yet
 * (no TLI orbit type, MissionDesign is satellite-shaped), so these types live in the frontend.
 * Field names follow SimulationResult/FailureTraceStep where they fit, so swapping in the
 * engine's result later is a mapping, not a rewrite. Ask the engine owner before extending.
 */
export type VehicleId = "kestrel" | "saros" | "orison";
export type PayloadId = "standard" | "science" | "rover";
export type ParkingOrbitKm = 160 | 185 | 250;
export type LaunchWindowId = "w1" | "w2" | "w3";

export interface LaunchConfig {
  vehicle: VehicleId;
  payload: PayloadId;
  /** Percent of a full propellant load, 70–100. */
  fuelPct: number;
  orbitKm: ParkingOrbitKm;
  window: LaunchWindowId;
}

/** Live readouts the console shows while the player edits the config (DEMO rules). */
export interface LaunchAssessment {
  payloadT: number;
  capacityT: number;
  /** Percent of a full load needed to reach orbit; above 100 means no fuel load can do it. */
  requiredFuelPct: number;
  costM: number;
  budgetM: number;
  overCapacity: boolean;
  fuelShort: boolean;
  overBudget: boolean;
  weatherGo: boolean;
}

/** Why a flight failed; the UI localises the trace and the advice from this code. */
export type TraceCode = "slow-climb" | "fuel-depleted";

export interface LaunchTraceStep extends FailureTraceStep {
  code: TraceCode;
}

/** Subset of shared-schema SimulationResult, plus the trace codes the UI needs. */
export interface LaunchResult {
  isSuccess: boolean;
  budgetCostMillions: number;
  failureTrace: LaunchTraceStep[];
  /** Mission time (s) at which the flight ends: orbit insertion or the final anomaly. */
  endSec: number;
}

export interface LaunchSimulator {
  assess(config: LaunchConfig): LaunchAssessment;
  simulate(config: LaunchConfig): Promise<LaunchResult>;
}
