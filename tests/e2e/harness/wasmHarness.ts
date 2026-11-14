import fs from "node:fs";
import { WASM_BG_PATH, WASM_JS_PATH } from "./env.ts";

export interface LaunchConfiguration {
  vehicle_mass: number;
  propellant_mass: number;
  payload_mass: number;
  stage_count: number;
  target_orbit_km: number;
  wind_speed_kmh: number;
}

export interface LaunchValidation {
  is_valid: boolean;
  glom_kg: number;
  liftoff_twr: number;
  max_q_kpa: number;
  max_q_time_s: number;
  payload_margin_kg: number;
  failure_reason: string | null;
  error_message?: string;
}

export interface DescentState {
  altitude_m: number;
  vertical_velocity_mps: number;
  horizontal_velocity_mps: number;
  throttle_pct: number;
  propellant_remaining_kg: number;
  agc_cpu_duty_pct: number;
  is_bingo_fuel: boolean;
  is_landed: boolean;
  touchdown_status: string;
}

export interface ScoreInputRequest {
  science_score?: number;
  cost_score?: number;
  risk_penalty?: number;
  weight_science?: number;
  weight_cost?: number;
  weight_risk?: number;
  active_anomalies?: string[];
}

export interface MissionEvaluationResult {
  is_success: boolean;
  final_score: number;
  science_score: number;
  cost_score: number;
  risk_penalty: number;
  failure_chain: string[];
  error?: string;
}

export const APOLLO_11_LAUNCH_CONFIG: Readonly<LaunchConfiguration> = Object.freeze({
  vehicle_mass: 130_000.0, // Dry mass (Saturn V stages + CSM + LM)
  propellant_mass: 2_800_000.0, // S-IC, S-II, S-IVB total propellant
  payload_mass: 45_000.0, // CSM + LM translunar payload
  vehicle_mass: 185_846.0, // Dry mass (Saturn V stages: S-IC 130,860 + S-II 39,870 + S-IVB 15,116 kg)
  propellant_mass: 2_706_767.0, // S-IC, S-II, S-IVB total propellant + ullage/interstage
  payload_mass: 45_702.0, // CSM-107 + LM-5 translunar payload
  stage_count: 3,
  target_orbit_km: 185.0, // 100 nmi Earth parking orbit
  wind_speed_kmh: 15.0, // Pad 39A nominal morning breeze
});

export const APOLLO_11_DESCENT_INITIAL_STATE: Readonly<DescentState> = Object.freeze({
  altitude_m: 15_240.0, // 50,000 ft Powered Descent Initiation (PDI)
  vertical_velocity_mps: 0.0,
  horizontal_velocity_mps: 1_695.0, // Orbital velocity ~5,560 ft/s
  throttle_pct: 100.0, // FTP ignition
  propellant_remaining_kg: 8_200.0, // Full DPS propellant load
  agc_cpu_duty_pct: 72.0, // Nominal radar + P63 G&N load
  is_bingo_fuel: false,
  is_landed: false,
  touchdown_status: "IN_FLIGHT",
});

let wasmInstance: any = null;

/**
 * Loads the WebAssembly simulation binary synchronously in Node 24.
 * Returns the initialized wasm exports.
 */
export function loadWasmSimulation(): any {
  if (wasmInstance) return wasmInstance;

  if (!fs.existsSync(WASM_BG_PATH)) {
    throw new Error(`WASM binary not found at ${WASM_BG_PATH}. Run 'wasm-pack build' first.`);
  }

  // Use createRequire or direct require to load the wasm-bindgen JS shim
  const wasmShim = require(WASM_JS_PATH);
  const wasmBytes = fs.readFileSync(WASM_BG_PATH);

  try {
    wasmShim.initSync({ module: wasmBytes });
  } catch {
    // Some wasm-bindgen versions accept raw Buffer directly
    wasmShim.initSync(wasmBytes);
  }

  if (typeof wasmShim.init_simulation_panic_hook === "function") {
    try {
      wasmShim.init_simulation_panic_hook();
    } catch {
      // Panic hook setup warning ignored if already set
    }
  }

  wasmInstance = wasmShim;
  return wasmInstance;
}

/**
 * Returns raw exports of sim-wasm.
 */
export function getWasmModule(): any {
  return loadWasmSimulation();
}

/**
 * Executes sim-wasm ping.
 */
export function wasmPing(): string {
  const mod = loadWasmSimulation();
  return mod.ping();
}

/**
 * Validates a launch configuration against the Saturn V physics envelope.
 */
export function wasmValidateLaunch(config: LaunchConfiguration): LaunchValidation {
  const mod = loadWasmSimulation();
  const raw = mod.validate_launch(JSON.stringify(config));
  return JSON.parse(raw) as LaunchValidation;
}

/**
 * Steps the lunar powered descent simulation by 1.0 second.
 */
export function wasmRunDescentStep(state: DescentState): DescentState {
  const mod = loadWasmSimulation();
  const raw = mod.run_descent_step(JSON.stringify(state));
  return JSON.parse(raw) as DescentState;
}

/**
 * Calculates multi-criteria composite mission score and failure diagnostic chain.
 */
export function wasmCalculateScore(req: ScoreInputRequest): MissionEvaluationResult {
  const mod = loadWasmSimulation();
  const raw = mod.calculate_score(JSON.stringify(req));
  return JSON.parse(raw) as MissionEvaluationResult;
}
