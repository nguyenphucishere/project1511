import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Server-side handle on the Rust simulation engine (crates/sim-wasm), loaded from the same
 * wasm-pack build the web app serves (apps/web/public/wasm). Override the directory with
 * SIM_WASM_DIR. Loading is lazy and memoised; when the binary is missing every call returns
 * null and callers fall back to their own data.
 */

/** JSON-in / JSON-out engine calculations exposed over the API. */
export const ENGINE_CALCULATIONS = [
  "validate_launch",
  "run_descent_step",
  "calculate_score",
  "calculate_landing_radar",
  "evaluate_mission_design_budget",
  "calculate_dsn_telemetry",
] as const;
export type EngineCalculation = (typeof ENGINE_CALCULATIONS)[number];

type SimWasmModule = {
  initSync: (m: { module: BufferSource }) => unknown;
  ping?: () => string;
  get_lunar_environment_constants?: () => string;
} & Partial<Record<EngineCalculation, (json: string) => string>>;

export interface EngineLunarConstants {
  standard_gravity_mps2: number;
  mascon_anomaly_mps2: number;
  mascon_anomaly_mgal?: number;
  local_gravity_effective_mps2: number;
  terrain_slope_deg: number;
  regolith_bulk_density_kg_m3: number;
  regolith_bearing_capacity_kpa: number;
  surface_temperature_c: number;
  surface_temperature_day_c?: number;
  surface_temperature_night_c?: number;
  moon_radius_km?: number;
  error_message?: string;
}

function wasmDir(): string {
  if (process.env.SIM_WASM_DIR) return path.resolve(process.env.SIM_WASM_DIR);
  // src/services (or dist/services) -> apps/server -> apps/web/public/wasm
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../web/public/wasm");
}

let loading: Promise<SimWasmModule | null> | null = null;

export function loadSimEngine(): Promise<SimWasmModule | null> {
  loading ??= (async () => {
    try {
      const dir = wasmDir();
      const mod = (await import(pathToFileURL(path.join(dir, "sim_wasm.js")).href)) as SimWasmModule;
      mod.initSync({ module: await readFile(path.join(dir, "sim_wasm_bg.wasm")) });
      return mod;
    } catch {
      return null;
    }
  })();
  return loading;
}

export interface EngineStatus {
  loaded: boolean;
  version: string | null;
  calculations: string[];
}

export async function engineStatus(): Promise<EngineStatus> {
  const mod = await loadSimEngine();
  if (!mod) return { loaded: false, version: null, calculations: [] };
  const calculations = [
    ...ENGINE_CALCULATIONS.filter((n) => typeof mod[n] === "function"),
    ...(typeof mod.get_lunar_environment_constants === "function" ? ["get_lunar_environment_constants"] : []),
  ];
  return { loaded: true, version: typeof mod.ping === "function" ? mod.ping() : null, calculations };
}

export class EngineUnavailableError extends Error {
  readonly status = 503;
  constructor(name: string) {
    super(`Simulation engine unavailable (${name})`);
  }
}

/**
 * Runs one engine calculation on a JSON input. Throws EngineUnavailableError when the binary
 * or export is missing; the engine itself reports bad input via `error_message`.
 */
export async function runEngine<T = Record<string, unknown>>(name: EngineCalculation, input: unknown): Promise<T> {
  const mod = await loadSimEngine();
  const fn = mod?.[name];
  if (typeof fn !== "function") throw new EngineUnavailableError(name);
  const raw = fn(JSON.stringify(input ?? {}));
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Some engine error paths embed unescaped serde messages; surface them as bad input.
    throw new EngineInputError(name, raw);
  }
}

export class EngineInputError extends Error {
  readonly status = 400;
  constructor(name: string, detail: string) {
    const clean = detail.replace(/\\"/g, "'");
    super(`${name}: ${clean.match(/Invalid JSON:[^"}]*/)?.[0]?.trim() ?? "rejected input"}`);
  }
}

/** True when the engine answered with its own error object (bad input it could not use). */
export function engineRejected(result: unknown): string | null {
  if (!result || typeof result !== "object") return "empty engine response";
  const r = result as { error_message?: unknown; error?: unknown };
  const msg = r.error_message ?? r.error;
  return typeof msg === "string" && msg ? msg : null;
}

/** sim-core `get_lunar_environment_constants`, or null when the engine is unavailable. */
export async function engineLunarConstants(): Promise<EngineLunarConstants | null> {
  const mod = await loadSimEngine();
  if (typeof mod?.get_lunar_environment_constants !== "function") return null;
  try {
    const parsed = JSON.parse(mod.get_lunar_environment_constants()) as EngineLunarConstants;
    return parsed.error_message ? null : parsed;
  } catch {
    return null;
  }
}

/** Apollo 11 baselines the UI uses to show the engine's answer for the flown mission. */
export const APOLLO_11_ENGINE_INPUTS = {
  validate_launch: {
    vehicle_mass: 185_846.0,
    propellant_mass: 2_706_767.0,
    payload_mass: 45_702.0,
    stage_count: 3,
    target_orbit_km: 185.0,
    wind_speed_kmh: 15.0,
  },
  run_descent_step: {
    altitude_m: 15_240.0,
    vertical_velocity_mps: 0.0,
    horizontal_velocity_mps: 1_695.0,
    throttle_pct: 100.0,
    propellant_remaining_kg: 8_200.0,
    agc_cpu_duty_pct: 72.0,
    is_bingo_fuel: false,
    is_landed: false,
    touchdown_status: "IN_FLIGHT",
  },
  calculate_score: {
    science_score: 500,
    cost_score: 94,
    risk_penalty: 2,
    active_anomalies: ["1202_PROGRAM_ALARM"],
  },
  calculate_landing_radar: {
    inertial_alt_m: 152.4,
    horizontal_vel_mps: 18.3,
    vertical_vel_mps: -2.7,
    lateral_vel_mps: 0.0,
    pitch_angle_deg: 12.0,
    terrain_elevation_offset_m: 0.0,
  },
  evaluate_mission_design_budget: {
    dry_mass_basic_kg: 38_500,
    power_load_watts: 1_400,
    delta_v_required_mps: 4_950,
    power_generation_watts: 2_100,
    mga_margin_pct: 20,
    stage_configs: [
      { stage_name: "CSM SPS", dry_mass_kg: 11_900, propellant_mass_kg: 18_410, isp_s: 314 },
      { stage_name: "LM DPS", dry_mass_kg: 6_682, propellant_mass_kg: 8_200, isp_s: 311 },
      { stage_name: "LM APS", dry_mass_kg: 2_445, propellant_mass_kg: 2_353, isp_s: 311 },
    ],
  },
  calculate_dsn_telemetry: { distance_km: 389_472.8, true_anomaly_deg: 0 },
} satisfies Record<EngineCalculation, unknown>;
