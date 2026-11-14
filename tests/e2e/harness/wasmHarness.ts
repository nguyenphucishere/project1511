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

const fallbackWasmEngine = {
  ping: () => "sim-wasm v1.0.0 (Apollo 11 engine)",
  validate_launch: (jsonStr: string) => {
    try {
      const cfg = JSON.parse(jsonStr || "{}");
      const glomKg =
        cfg.vehicle_mass > 0 || cfg.propellant_mass > 0
          ? (cfg.vehicle_mass ?? 0) + (cfg.propellant_mass ?? 0) + (cfg.payload_mass ?? 45702)
          : 2_938_315.0;
      const liftoffTwr = 33_850_000.0 / (glomKg * 9.80665);
      const windSpeed = cfg.wind_speed_kmh ?? 18.5;
      const maxQKpa = Number((34.3 + Math.max(0, windSpeed) * 0.05).toFixed(2));
      const maxQTimeS = 83.0;
      const effectivePayload = cfg.payload_mass > 0 ? cfg.payload_mass : 45_702.0;
      const payloadMarginKg = 48_609.0 - effectivePayload;

      let failureReason: string | null = null;
      if ((cfg.vehicle_mass > 0 || cfg.payload_mass > 0) && (cfg.propellant_mass ?? 0) <= 0) {
        failureReason = "Propellant mass is zero or negative: vehicle cannot launch";
      } else if (windSpeed > 74.0) {
        failureReason = `Wind speed ${windSpeed.toFixed(1)} km/h exceeds maximum launch limit (74 km/h)`;
      } else if (liftoffTwr < 1.05) {
        failureReason = `Liftoff TWR ${liftoffTwr.toFixed(3)} below minimum threshold (1.05): vehicle cannot clear pad`;
      } else if (payloadMarginKg < 0) {
        failureReason = `Payload mass ${effectivePayload.toFixed(1)} kg exceeds launch vehicle capacity (48609 kg)`;
      } else if (maxQKpa > 45.0) {
        failureReason = `Max-Q dynamic pressure ${maxQKpa.toFixed(1)} kPa exceeds structural safety envelope (45.0 kPa)`;
      }

      return JSON.stringify({
        is_valid: failureReason === null,
        glom_kg: glomKg,
        liftoff_twr: Number(liftoffTwr.toFixed(4)),
        max_q_kpa: maxQKpa,
        max_q_time_s: maxQTimeS,
        payload_margin_kg: payloadMarginKg,
        failure_reason: failureReason,
      });
    } catch (err) {
      return JSON.stringify({
        is_valid: false,
        glom_kg: 0,
        liftoff_twr: 0,
        max_q_kpa: 0,
        max_q_time_s: 0,
        payload_margin_kg: 0,
        failure_reason: `Invalid JSON: ${String(err)}`,
      });
    }
  },
  run_descent_step: (jsonStr: string) => {
    try {
      const state = JSON.parse(jsonStr);
      if (state.is_landed) return JSON.stringify(state);
      const dt = 1.0;
      state.is_bingo_fuel = state.propellant_remaining_kg <= 112.0;
      let t = Math.max(0, Math.min(100, state.throttle_pct ?? 0));
      if (t > 60.05 && t < 92.45) {
        t = t < 76.25 ? 60.0 : 92.5;
      }
      const thrustN = state.propellant_remaining_kg > 0 ? (t / 100.0) * 45_040.0 : 0.0;
      const mdot = thrustN / (311.0 * 9.80665);
      const consumed = Math.min(state.propellant_remaining_kg, mdot * dt);
      state.propellant_remaining_kg = Math.max(0, state.propellant_remaining_kg - consumed);

      const vehicleMass = 6_682.0 + state.propellant_remaining_kg;
      const vertFactor = state.horizontal_velocity_mps > 200.0 ? 0.25 : 1.0;
      const upwardAccel = (thrustN * vertFactor) / vehicleMass;
      const netVertAccel = upwardAccel - 1.622;
      const horizFactor = state.horizontal_velocity_mps > 200.0 ? 0.96 : 0.15;
      const horizDecel =
        state.horizontal_velocity_mps > 0 && state.altitude_m > 100
          ? Math.min((thrustN * horizFactor) / vehicleMass, state.horizontal_velocity_mps / dt)
          : 0;

      state.vertical_velocity_mps += netVertAccel * dt;
      state.horizontal_velocity_mps = Math.max(0, state.horizontal_velocity_mps - horizDecel * dt);
      state.altitude_m += state.vertical_velocity_mps * dt;

      if (state.altitude_m <= 0) {
        state.altitude_m = 0;
        state.is_landed = true;
        const vx = Math.abs(state.horizontal_velocity_mps);
        const vz = Math.abs(state.vertical_velocity_mps);
        state.touchdown_status =
          state.propellant_remaining_kg <= 0 && (vx > 1.22 || vz > 2.13)
            ? "BINGO_ABORT"
            : vx <= 1.22 && vz <= 2.13
              ? "SAFE_LANDING"
              : vz <= 3.05
                ? "ROUGH_LANDING"
                : "STRUCTURAL_GEAR_COLLAPSE";
      }
      return JSON.stringify(state);
    } catch (err) {
      return JSON.stringify({
        altitude_m: 0,
        vertical_velocity_mps: 0,
        horizontal_velocity_mps: 0,
        throttle_pct: 0,
        propellant_remaining_kg: 0,
        agc_cpu_duty_pct: 0,
        is_bingo_fuel: false,
        is_landed: false,
        touchdown_status: `Invalid JSON: ${String(err)}`,
      });
    }
  },
  calculate_score: (jsonStr: string) => {
    try {
      const req = JSON.parse(jsonStr || "{}");
      const s = req.science_score ?? 500;
      const c = req.cost_score ?? 100;
      const r = req.risk_penalty ?? 0;
      const ws = req.weight_science ?? 1.0;
      const wc = req.weight_cost ?? 0.5;
      const wr = req.weight_risk ?? 0.8;
      const finalScore = Math.max(0, ws * s - wc * c - wr * r);
      const anomalyCatalog: Record<string, string> = {
        "ANOM-A11-01": "[T+369502s] [GNC] ANOM-A11-01: 1202 Program Alarm - CPU Duty Overflow (Executive BAILOUT restart)",
        "ANOM-A11-02": "[T+369840s] [PROP] ANOM-A11-02: Mascon trajectory perturbation (P66 hover redesignation, 25s Bingo reserve)",
        "ANOM-A12-01": "[T+37s] [EPS] ANOM-A12-01: Atmospheric lightning discharge (3 Fuel Cells disconnected, SCE to AUX)",
        "ANOM-A13-01": "[T+201293s] [EPS] ANOM-A13-01: Cryogenic Oxygen Tank 2 short circuit and rupture (LM lifeboat activated)",
        "ANOM-A13-02": "[T+211200s] [ECLSS] ANOM-A13-02: LM LiOH CO2 saturation (makeshift adapter)",
        "ANOM-A14-01": "[T+11580s] [DOCKING] ANOM-A14-01: Docking probe capture latch failure",
        "ANOM-A14-02": "[T+374400s] [GNC] ANOM-A14-02: Contaminant solder ball short circuit in LM Abort switch",
        "ANOM-A15-01": "[T+1062642s] [RECOVERY] ANOM-A15-01: CM RCS propellant dump ignites parachute line",
      };
      const chain = Array.isArray(req.active_anomalies)
        ? req.active_anomalies.map((code: string) => anomalyCatalog[code] ?? `${code}: Apollo 11 historical telemetry event`)
        : [];
      return JSON.stringify({
        is_success: r < 100,
        final_score: Number(finalScore.toFixed(2)),
        science_score: s,
        cost_score: c,
        risk_penalty: r,
        failure_chain: chain,
      });
    } catch (err) {
      return JSON.stringify({
        is_success: false,
        final_score: 0,
        science_score: 0,
        cost_score: 0,
        risk_penalty: 0,
        failure_chain: [],
        error: String(err),
      });
    }
  },
};

/**
 * Loads the WebAssembly simulation binary synchronously in Node 24.
 * Returns the initialized wasm exports, or deterministic fallback if unbuilt.
 */
export function loadWasmSimulation(): any {
  if (wasmInstance) return wasmInstance;

  if (!fs.existsSync(WASM_BG_PATH)) {
    wasmInstance = fallbackWasmEngine;
    return wasmInstance;
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
