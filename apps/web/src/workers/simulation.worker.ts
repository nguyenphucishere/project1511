/// <reference lib="webworker" />

import { dsnTelemetry, landingRadar, missionDesignBudget } from "@/lib/simulation/nasa.physics";
import { simulateAscent, simulatePoweredDescent } from "@/lib/simulation/trajectory.physics";

export interface WorkerRequestMessage {
  id: string;
  type:
    | "INIT"
    | "PING"
    | "VALIDATE_LAUNCH"
    | "STEP_DESCENT"
    | "CALCULATE_SCORE"
    | "LANDING_RADAR"
    | "MISSION_DESIGN_BUDGET"
    | "DSN_TELEMETRY"
    | "ASCENT_PROFILE"
    | "DESCENT_PROFILE";
  payload?: unknown;
}

export interface WorkerResponseMessage {
  id: string;
  type: "READY" | "RESULT" | "ERROR";
  result?: unknown;
  error?: string;
}

interface SimWasmExports {
  default?: (input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module) => Promise<unknown>;
  init_simulation_panic_hook?: () => void;
  ping: () => string;
  validate_launch: (jsonStr: string) => string;
  run_descent_step: (jsonStr: string) => string;
  calculate_score: (jsonStr: string) => string;
  // NASA realism exports (crates/sim-wasm). Optional: an older binary may not ship them.
  calculate_landing_radar?: (jsonStr: string) => string;
  evaluate_mission_design_budget?: (jsonStr: string) => string;
  calculate_dsn_telemetry?: (jsonStr: string) => string;
  simulate_ascent?: (jsonStr: string) => string;
  simulate_powered_descent?: (jsonStr: string) => string;
}

/** Calls a WASM export, or the TypeScript mirror when the export is missing or rejects the input. */
function callNasa<T extends { error_message?: string }>(
  wasmFn: ((json: string) => string) | undefined,
  fallback: (input: never) => T,
  payload: unknown,
): T {
  if (typeof wasmFn === "function") {
    try {
      const parsed = JSON.parse(wasmFn(JSON.stringify(payload ?? {}))) as T;
      if (!parsed.error_message) return parsed;
    } catch {
      // fall through to the mirror
    }
  }
  return fallback(payload as never);
}

let wasmModule: SimWasmExports | null = null;
let initPromise: Promise<SimWasmExports> | null = null;

// Deterministic fallback mirroring crates/sim-core when WASM binary fetch is unavailable
const fallbackEngine: SimWasmExports = {
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
      const maxQKpa = Number((34.3 * (1 + Math.max(0, windSpeed - 18.5) / 120)).toFixed(2));
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
          vx <= 1.22 && vz <= 2.13 ? "SAFE_LANDING" : vz <= 3.05 ? "ROUGH_LANDING" : "STRUCTURALGEARCOLLAPSE";
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
      const chain = Array.isArray(req.active_anomalies)
        ? req.active_anomalies.map((code: string) => `${code}: Apollo 11 historical telemetry event`)
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

export async function loadWorkerWasm(): Promise<SimWasmExports> {
  if (wasmModule) return wasmModule;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Dynamic runtime import of public WASM glue script in browser worker context
      const wasmJsUrl = "/wasm/sim_wasm.js";
      const wasmBgUrl = "/wasm/sim_wasm_bg.wasm";
      const dynamicImport = new Function("url", "return import(url)");
      const mod = (await dynamicImport(wasmJsUrl)) as SimWasmExports;
      if (typeof mod.default === "function") {
        await mod.default(wasmBgUrl);
      }
      if (typeof mod.init_simulation_panic_hook === "function") {
        mod.init_simulation_panic_hook();
      }
      wasmModule = mod;
      return mod;
    } catch {
      wasmModule = fallbackEngine;
      return fallbackEngine;
    }
  })();

  return initPromise;
}

export async function handleWorkerMessage(msg: WorkerRequestMessage): Promise<WorkerResponseMessage> {
  try {
    const engine = await loadWorkerWasm();
    switch (msg.type) {
      case "INIT":
        return { id: msg.id, type: "READY", result: { version: engine.ping() } };
      case "PING":
        return { id: msg.id, type: "RESULT", result: engine.ping() };
      case "VALIDATE_LAUNCH": {
        const raw = engine.validate_launch(JSON.stringify(msg.payload ?? {}));
        return { id: msg.id, type: "RESULT", result: JSON.parse(raw) };
      }
      case "STEP_DESCENT": {
        const raw = engine.run_descent_step(JSON.stringify(msg.payload ?? {}));
        return { id: msg.id, type: "RESULT", result: JSON.parse(raw) };
      }
      case "CALCULATE_SCORE": {
        const raw = engine.calculate_score(JSON.stringify(msg.payload ?? {}));
        return { id: msg.id, type: "RESULT", result: JSON.parse(raw) };
      }
      case "LANDING_RADAR":
        return {
          id: msg.id,
          type: "RESULT",
          result: callNasa(engine.calculate_landing_radar, landingRadar, msg.payload),
        };
      case "MISSION_DESIGN_BUDGET":
        return {
          id: msg.id,
          type: "RESULT",
          result: callNasa(engine.evaluate_mission_design_budget, missionDesignBudget, msg.payload),
        };
      case "DSN_TELEMETRY":
        return {
          id: msg.id,
          type: "RESULT",
          result: callNasa(engine.calculate_dsn_telemetry, dsnTelemetry, msg.payload),
        };
      case "ASCENT_PROFILE":
        return { id: msg.id, type: "RESULT", result: callNasa(engine.simulate_ascent, simulateAscent, msg.payload) };
      case "DESCENT_PROFILE":
        return { id: msg.id, type: "RESULT", result: callNasa(engine.simulate_powered_descent, simulatePoweredDescent, msg.payload) };
      default:
        return { id: msg.id, type: "ERROR", error: `Unknown message type: ${String((msg as any).type)}` };
    }
  } catch (err) {
    return {
      id: msg.id,
      type: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.onmessage = async (e: MessageEvent<WorkerRequestMessage>) => {
    if (!e?.data?.id || !e?.data?.type) return;
    const response = await handleWorkerMessage(e.data);
    self.postMessage(response);
  };
}
