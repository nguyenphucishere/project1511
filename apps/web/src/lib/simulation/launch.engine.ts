import { BUDGET_M, PAYLOADS, VEHICLES } from "@/mocks/launch-options";
import type { LocalizedText } from "@/i18n";
import {
  NOMINAL_ORBIT_INSERTION_S,
  planLaunch,
  type LaunchFailureMode,
  type LaunchPlan,
  type LaunchPlanRequest,
} from "./launch.physics";
import type {
  LaunchAssessment,
  LaunchConfig,
  LaunchResult,
  LaunchTraceStep,
  LaunchWindow,
  TraceCode,
} from "./launch.types";

/**
 * The console's launch rules are the engine's (sim-core `plan_launch`): the stage-by-stage
 * rocket equation decides capacity and the propellant needed, the launch commit criteria decide
 * the weather. This module turns a console configuration and a launch window into the engine's
 * request, and the engine's answer into the flight the scene plays.
 */

/** Mission time (s) of orbit insertion on a nominal flight (sim-core NOMINAL_ORBIT_INSERTION_S). */
export const ORBIT_INSERTION_SEC = NOMINAL_ORBIT_INSERTION_S;
/** A successful flight's film keeps rolling in orbit for the docking (Scene 3 FILM_END_SEC). */
export const NOMINAL_FLIGHT_END_SEC = ORBIT_INSERTION_SEC + 40;

export function planRequestFor(config: LaunchConfig, window: LaunchWindow): LaunchPlanRequest {
  const vehicle = VEHICLES.find((v) => v.id === config.vehicle);
  const payload = PAYLOADS.find((p) => p.id === config.payload);
  return {
    vehicle_id: vehicle?.engineId ?? "saturn-v",
    payload_mass_kg: Math.round((payload?.massT ?? 43.904) * 1000),
    propellant_load_pct: config.fuelPct,
    parking_orbit_km: config.orbitKm,
    destination: "TLI",
    wind_speed_kmh: window.weather.wind_speed_kmh,
    wind_gust_kmh: window.weather.wind_gust_kmh,
    thunderstorm: window.weather.thunderstorm,
  };
}

export function costOf(config: LaunchConfig, window: LaunchWindow): number {
  const vehicle = VEHICLES.find((v) => v.id === config.vehicle);
  const payload = PAYLOADS.find((p) => p.id === config.payload);
  return (vehicle?.costM ?? 0) + (payload?.costM ?? 0) + window.delay_cost_m;
}

/** Instant readouts from the engine mirror; `plan` may be replaced by the engine's own answer. */
export function assessLaunch(config: LaunchConfig, window: LaunchWindow, plan?: LaunchPlan): LaunchAssessment {
  const p = plan ?? planLaunch(planRequestFor(config, window));
  const costM = costOf(config, window);
  const payload = PAYLOADS.find((x) => x.id === config.payload);
  return {
    payloadT: payload?.massT ?? 0,
    capacityT: p.payload_capacity_kg / 1000,
    minFuelPct: p.min_propellant_load_pct,
    costM,
    budgetM: BUDGET_M,
    overBudget: costM > BUDGET_M,
    plan: p,
    weather: window.weather,
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
  "wind-shear": {
    subsystem: { en: "Structure", vi: "Kết cấu" },
    anomaly: { en: "Wind shear at Max-Q", vi: "Gió cắt tại Max-Q" },
    consequence: { en: "Bending loads beyond the airframe limit: vehicle broke up", vi: "Tải uốn vượt giới hạn thân: tên lửa vỡ" },
  },
  lightning: {
    subsystem: { en: "Electrical", vi: "Hệ điện" },
    anomaly: { en: "Lightning strike", vi: "Sét đánh" },
    consequence: { en: "Launched into a thunderstorm: guidance and power lost", vi: "Phóng vào giông bão: mất dẫn đường và nguồn điện" },
  },
  structural: {
    subsystem: { en: "Structure", vi: "Kết cấu" },
    anomaly: { en: "Max-Q over the structural limit", vi: "Max-Q vượt giới hạn kết cấu" },
    consequence: { en: "Aerodynamic load broke the vehicle up", vi: "Tải khí động học làm tên lửa vỡ" },
  },
};

function step(code: TraceCode, timestampSec: number): LaunchTraceStep {
  const t = TRACE_TEXT[code];
  return { code, timestampSec: Math.round(timestampSec), subsystem: t.subsystem.en, anomaly: t.anomaly.en, consequence: t.consequence.en };
}

const WEATHER_MODES: LaunchFailureMode[] = ["wind_shear", "lightning_strike"];

/** The engine's verdict as the flight the scene plays (trace steps, end time, weather loss). */
export function resultFromPlan(plan: LaunchPlan, costM: number, source: LaunchResult["source"]): LaunchResult {
  if (plan.is_go || !plan.failure_mode) {
    return { isSuccess: true, budgetCostMillions: costM, failureTrace: [], endSec: NOMINAL_FLIGHT_END_SEC, source };
  }
  const at = plan.failure_time_s ?? ORBIT_INSERTION_SEC;
  const trace: LaunchTraceStep[] = (() => {
    switch (plan.failure_mode) {
      case "over_capacity":
        return [step("slow-climb", 38), step("fuel-depleted", at)];
      case "no_liftoff":
        return [step("slow-climb", at)];
      case "propellant_depletion":
        return [step("fuel-depleted", at)];
      case "wind_shear":
        return [step("wind-shear", at)];
      case "lightning_strike":
        return [step("lightning", at)];
      case "max_q_breakup":
        return [step("structural", at)];
    }
  })();
  return {
    isSuccess: false,
    budgetCostMillions: costM,
    failureTrace: trace,
    endSec: Math.round(trace[trace.length - 1]!.timestampSec),
    weatherLoss: WEATHER_MODES.includes(plan.failure_mode),
    reason: plan.failure_reason ?? undefined,
    source,
  };
}
