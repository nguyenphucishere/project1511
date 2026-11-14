import type { FailureTraceStep } from "@space-sim/shared-schema";
import type { LaunchPlan } from "./launch.physics";

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
  /** Launch site id (GET /api/launch/sites); saves from before sites existed mean Kennedy LC-39A. */
  site?: string;
}

/* ------------------------------------------------ launch sites and windows (GET /api/launch/...) */

export interface LaunchSite {
  id: string;
  name: string;
  pad: string;
  operator: string;
  country: string;
  latitude_deg: number;
  longitude_deg: number;
  elevation_m: number;
  time_zone: string;
  /** "historical" = Apollo 11's July 1969 windows; "live" = upcoming forecast windows. */
  windows: "historical" | "live";
}

/** Measured / forecast ground weather at a window. No verdict: judging it is the player's job. */
export interface WindowWeather {
  temperature_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  wind_gust_kmh: number;
  wind_direction_deg: number;
  precipitation_mm: number;
  cloud_cover_pct: number;
  /** WMO weather code (95–99 = thunderstorm). */
  weather_code: number;
  thunderstorm: boolean;
}

export interface LaunchWindow {
  id: LaunchWindowId;
  /** UTC instant the window opens. */
  opens_at: string;
  label: string;
  delay_cost_m: number;
  weather: WindowWeather;
}

export interface LaunchWindowsData {
  site: LaunchSite;
  kind: "historical" | "live";
  provider: string;
  windows: LaunchWindow[];
  source: "api" | "offline_fallback";
}

/** Readouts the console shows while the player edits the config, computed by the engine. */
export interface LaunchAssessment {
  payloadT: number;
  /** Heaviest payload the chosen vehicle delivers to the chosen orbit at a full load (t). */
  capacityT: number;
  /** Smallest propellant load (%) that delivers this payload; null when no load can. */
  minFuelPct: number | null;
  costM: number;
  budgetM: number;
  overBudget: boolean;
  /** The engine's full answer for this configuration and the chosen window's weather. */
  plan: LaunchPlan;
  weather: WindowWeather;
}

/** Why a flight failed; the UI localises the trace and the advice from this code. */
export type TraceCode = "slow-climb" | "fuel-depleted" | "wind-shear" | "lightning" | "structural";

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
  /** Lost to the weather (wind shear or lightning): the mission ends, there is no second vehicle. */
  weatherLoss?: boolean;
  /** The engine's reason, for the anomaly report. */
  reason?: string;
  /** Who decided the outcome. */
  source?: "server-engine" | "browser-engine";
}

export interface LaunchSimulator {
  assess(config: LaunchConfig, window: LaunchWindow): LaunchAssessment;
  simulate(config: LaunchConfig, window: LaunchWindow): Promise<LaunchResult>;
}
