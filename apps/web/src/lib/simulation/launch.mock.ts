import {
  BUDGET_M,
  ORBITS,
  PAYLOADS,
  VEHICLES,
  WINDOWS,
  WIND_LIMIT_KMH,
} from "@/mocks/launch-options";
import type { LocalizedText } from "@/i18n";
import type {
  LaunchAssessment,
  LaunchConfig,
  LaunchResult,
  LaunchSimulator,
  LaunchTraceStep,
  TraceCode,
} from "./launch.types";

/**
 * DEMO launch rules: lookup tables and one linear rule, no physics.
 *   needed fuel % = 55 + 45 × (payload / capacity) + orbit adjustment
 * Overweight → the stack climbs slowly and stage 2 runs dry; short on fuel → stage 2 runs dry.
 * The point is cause and effect the player can read, not accuracy.
 */

/** Mission time (s) of orbit insertion on a nominal flight. */
export const ORBIT_INSERTION_SEC = 540;

export function assessLaunch(config: LaunchConfig): LaunchAssessment {
  const vehicle = VEHICLES.find((v) => v.id === config.vehicle)!;
  const payload = PAYLOADS.find((p) => p.id === config.payload)!;
  const orbit = ORBITS.find((o) => o.km === config.orbitKm)!;
  const window = WINDOWS.find((w) => w.id === config.window)!;

  const requiredFuelPct = Math.round(55 + 45 * (payload.massT / vehicle.capacityT)) + orbit.fuelDelta;
  const costM = vehicle.costM + payload.costM + window.delayCostM;

  return {
    payloadT: payload.massT,
    capacityT: vehicle.capacityT,
    requiredFuelPct,
    costM,
    budgetM: BUDGET_M,
    overCapacity: payload.massT > vehicle.capacityT,
    fuelShort: config.fuelPct < requiredFuelPct,
    overBudget: costM > BUDGET_M,
    weatherGo: window.windKmh <= WIND_LIMIT_KMH,
  };
}

/** English text for the shared-schema string fields; the UI shows TRACE_TEXT in the player's language. */
export const TRACE_TEXT: Record<TraceCode, { subsystem: LocalizedText; anomaly: LocalizedText; consequence: LocalizedText }> = {
  "slow-climb": {
    subsystem: { en: "Stage 1", vi: "Tầng 1" },
    anomaly: { en: "Climbing slower than planned", vi: "Lên cao chậm hơn kế hoạch" },
    consequence: { en: "Too heavy: thrust barely beats weight", vi: "Quá nặng: lực đẩy chỉ nhỉnh hơn trọng lượng" },
  },
  "fuel-depleted": {
    subsystem: { en: "Stage 2", vi: "Tầng 2" },
    anomaly: { en: "Propellant depleted", vi: "Cạn nhiên liệu" },
    consequence: { en: "Orbit not reached", vi: "Không vào được quỹ đạo" },
  },
};

function step(code: TraceCode, timestampSec: number): LaunchTraceStep {
  const t = TRACE_TEXT[code];
  return { code, timestampSec, subsystem: t.subsystem.en, anomaly: t.anomaly.en, consequence: t.consequence.en };
}

export function runLaunch(config: LaunchConfig): LaunchResult {
  const a = assessLaunch(config);
  const trace: LaunchTraceStep[] = [];

  if (a.overCapacity) {
    trace.push(step("slow-climb", 38));
    trace.push(step("fuel-depleted", 470));
  } else if (a.fuelShort) {
    // The shorter the load, the earlier stage 2 runs dry.
    const reached = Math.max(0.6, config.fuelPct / a.requiredFuelPct);
    trace.push(step("fuel-depleted", Math.round(ORBIT_INSERTION_SEC * reached) - 10));
  }

  const isSuccess = trace.length === 0;
  return {
    isSuccess,
    budgetCostMillions: a.costM,
    failureTrace: trace,
    endSec: isSuccess ? ORBIT_INSERTION_SEC : trace[trace.length - 1]!.timestampSec,
  };
}

export const mockLaunchSimulator: LaunchSimulator = {
  assess: assessLaunch,
  // Async like the real engine call will be (WASM worker or server), so the UI already waits.
  simulate: (config) => new Promise((resolve) => setTimeout(() => resolve(runLaunch(config)), 150)),
};
