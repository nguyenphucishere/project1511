/**
 * TypeScript mirror of the engine's launch planning (crates/sim-core/src/launch_plan.rs,
 * `plan_launch` / `get_launch_catalog` in sim-wasm). The console uses it for instant readouts
 * while the authoritative answer comes from the engine (server, then the browser WASM); the
 * parity test runs both on the same inputs. Keep the constants and the integrator in step.
 */

export interface StageSpec {
  stage_name?: string;
  dry_mass_kg: number;
  propellant_mass_kg: number;
  isp_s: number;
}

export interface VehicleSpec {
  id: string;
  name: string;
  thrust_sl_n: number;
  stages: StageSpec[];
}

export interface LaunchCommitCriteria {
  ideal_wind_kmh: number;
  max_sustained_wind_kmh: number;
  max_peak_gust_kmh: number;
  thunderstorms_allowed: boolean;
  min_liftoff_twr: number;
  max_q_limit_kpa: number;
}

export type LaunchFailureMode =
  | "lightning_strike"
  | "wind_shear"
  | "no_liftoff"
  | "max_q_breakup"
  | "over_capacity"
  | "propellant_depletion";

export interface LaunchPlanRequest {
  vehicle_id?: string;
  vehicle?: VehicleSpec;
  payload_mass_kg?: number;
  propellant_load_pct?: number;
  parking_orbit_km?: number;
  destination?: "TLI" | "LEO";
  wind_speed_kmh?: number;
  wind_gust_kmh?: number;
  thunderstorm?: boolean;
}

export interface LaunchPlan {
  vehicle_id: string;
  glom_kg: number;
  liftoff_twr: number;
  max_q_kpa: number;
  max_q_time_s: number;
  delta_v_available_mps: number;
  delta_v_required_mps: number;
  delta_v_margin_mps: number;
  payload_capacity_kg: number;
  min_propellant_load_pct: number | null;
  is_go: boolean;
  failure_mode: LaunchFailureMode | null;
  failure_time_s: number | null;
  failure_reason: string | null;
  criteria: LaunchCommitCriteria;
  error_message?: string;
}

const G0 = 9.80665;
const EARTH_RADIUS_M = 6_378_137.0;
const S_IC_THRUST_SL_N = 33_850_000.0;
const S_IC_THRUST_VAC_N = 38_700_000.0;
const S_IC_PROPELLANT_MASS_KG = 2_077_000.0;
const S_IC_BURN_DURATION_S = 161.1;
const SEA_LEVEL_AIR_DENSITY = 1.225;
const ATMOSPHERIC_SCALE_HEIGHT_M = 9_150.0;
const SEA_LEVEL_PRESSURE_PA = 101_325.0;
const S_IC_AERODYNAMIC_AREA_M2 = 79.48;

export const DELTA_V_LEO_185_MPS = 9_200.0;
export const DELTA_V_TLI_MPS = 3_051.0;
const DELTA_V_PER_ORBIT_KM = 1.0;
const TLI_SAVING_PER_ORBIT_KM = 0.35;
/** sim-core NOMINAL_ORBIT_INSERTION_S: the engine ascent's S-IVB first cutoff to 185 km. */
export const NOMINAL_ORBIT_INSERTION_S = 713.66;
export const APOLLO_11_STACK_KG = 43_904.0;

export const LAUNCH_COMMIT_CRITERIA: LaunchCommitCriteria = {
  ideal_wind_kmh: 20.0,
  max_sustained_wind_kmh: 40.0,
  max_peak_gust_kmh: 55.0,
  thunderstorms_allowed: false,
  min_liftoff_twr: 1.05,
  max_q_limit_kpa: 45.0,
};
export const LIGHTNING_STRIKE_TIME_S = 36.5;

const stage = (stage_name: string, dry_mass_kg: number, propellant_mass_kg: number, isp_s: number): StageSpec => ({
  stage_name,
  dry_mass_kg,
  propellant_mass_kg,
  isp_s,
});

/** Saturn IB and Saturn V use flown stage masses; the uprated Saturn V is the MLV-V-4(S) study (approximate). */
export const LAUNCH_VEHICLE_PRESETS: VehicleSpec[] = [
  {
    id: "saturn-ib",
    name: "Saturn IB",
    thrust_sl_n: 7_100_000.0,
    stages: [stage("S-IB", 42_000.0, 407_000.0, 272.0), stage("S-IVB-200", 13_500.0, 105_000.0, 421.0)],
  },
  {
    id: "saturn-v",
    name: "Saturn V AS-506",
    thrust_sl_n: S_IC_THRUST_SL_N,
    stages: [
      stage("S-IC", 130_860.0, 2_077_000.0, 280.0),
      stage("S-II", 39_870.0, 443_200.0, 421.0),
      stage("S-IVB", 15_116.0, 106_900.0, 421.0),
    ],
  },
  {
    id: "saturn-v-uprated",
    name: "Saturn V MLV-V-4(S)",
    thrust_sl_n: 40_000_000.0,
    stages: [
      stage("S-IC (F-1A, stretched)", 150_000.0, 2_450_000.0, 285.0),
      stage("S-II (J-2S)", 42_000.0, 500_000.0, 436.0),
      stage("S-IVB (J-2S)", 16_000.0, 125_000.0, 436.0),
    ],
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function stackDeltaV(vehicle: VehicleSpec, payloadKg: number, loadPct: number): number {
  const load = clamp(loadPct / 100, 0, 1);
  let above = Math.max(0, payloadKg);
  let total = 0;
  for (let i = vehicle.stages.length - 1; i >= 0; i--) {
    const s = vehicle.stages[i]!;
    const mf = above + Math.max(0, s.dry_mass_kg);
    const m0 = mf + Math.max(0, s.propellant_mass_kg) * load;
    if (mf > 0 && s.isp_s > 0) total += s.isp_s * G0 * Math.log(m0 / mf);
    above = m0;
  }
  return total;
}

export function deltaVRequired(orbitKm: number, tli = true): number {
  const dh = orbitKm - 185;
  const leo = DELTA_V_LEO_185_MPS + DELTA_V_PER_ORBIT_KM * dh;
  return tli ? leo + DELTA_V_TLI_MPS - TLI_SAVING_PER_ORBIT_KM * dh : leo;
}

export function stackGlom(vehicle: VehicleSpec, payloadKg: number, loadPct: number): number {
  const load = clamp(loadPct / 100, 0, 1);
  return vehicle.stages.reduce((m, s) => m + s.dry_mass_kg + s.propellant_mass_kg * load, 0) + Math.max(0, payloadKg);
}

export function payloadCapacity(vehicle: VehicleSpec, required: number): number {
  if (stackDeltaV(vehicle, 0, 100) < required) return 0;
  let lo = 0;
  let hi = 500_000;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    if (stackDeltaV(vehicle, mid, 100) >= required) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function minPropellantLoad(vehicle: VehicleSpec, payloadKg: number, required: number): number | null {
  if (stackDeltaV(vehicle, payloadKg, 100) < required) return null;
  let lo = 0;
  let hi = 100;
  for (let k = 0; k < 60; k++) {
    const mid = 0.5 * (lo + hi);
    if (stackDeltaV(vehicle, payloadKg, mid) >= required) hi = mid;
    else lo = mid;
  }
  return Math.min(100, Math.ceil(hi * 10) / 10);
}

/** Port of sim-core `simulate_ascent_max_q` (Saturn V S-IC calibration). */
export function simulateAscentMaxQ(glomKg: number, windKmh: number): [number, number] {
  const mdot = S_IC_PROPELLANT_MASS_KG / S_IC_BURN_DURATION_S;
  const wind = windKmh / 3.6;
  const dt = 0.1;
  const steps = Math.trunc(S_IC_BURN_DURATION_S / dt);
  let alt = 0;
  let v = 0;
  let mass = glomKg;
  let maxQ = 0;
  let maxQT = 0;
  for (let k = 0; k < steps; k++) {
    const t = k * dt;
    if (t > S_IC_BURN_DURATION_S) break;
    const pAmb = alt < 0 ? SEA_LEVEL_PRESSURE_PA : SEA_LEVEL_PRESSURE_PA * Math.exp(-alt / ATMOSPHERIC_SCALE_HEIGHT_M);
    const rho = alt < 0 ? SEA_LEVEL_AIR_DENSITY : SEA_LEVEL_AIR_DENSITY * Math.exp(-alt / ATMOSPHERIC_SCALE_HEIGHT_M);
    const gHead = 1 + 0.085 * Math.min(1, t / 83);
    const thrust = (S_IC_THRUST_VAC_N - (S_IC_THRUST_VAC_N - S_IC_THRUST_SL_N) * (pAmb / SEA_LEVEL_PRESSURE_PA)) * gHead;
    const vRel = v + wind;
    const q = 0.5 * rho * vRel * vRel;
    if (q > maxQ) {
      maxQ = q;
      maxQT = t;
    }
    const mach = v / 340;
    const cd = mach < 0.8 ? 0.15 : mach <= 1.2 ? 0.2 : 0.16;
    const drag = q * cd * S_IC_AERODYNAMIC_AREA_M2;
    const gammaDeg = t <= 12 ? 90 : 90 - 58 * Math.pow((t - 12) / 149.1, 1.1);
    const gamma = (gammaDeg * Math.PI) / 180;
    const g = G0 * Math.pow(EARTH_RADIUS_M / (EARTH_RADIUS_M + alt), 2);
    const acc = (thrust - drag) / mass - g * Math.sin(gamma);
    v += acc * dt;
    alt += v * Math.sin(gamma) * dt;
    mass = Math.max(mass - mdot * dt, glomKg - S_IC_PROPELLANT_MASS_KG);
  }
  return [maxQ / 1000, maxQT];
}

export function planLaunch(req: LaunchPlanRequest): LaunchPlan {
  const criteria = { ...LAUNCH_COMMIT_CRITERIA };
  const vehicle = req.vehicle ?? LAUNCH_VEHICLE_PRESETS.find((v) => v.id === (req.vehicle_id ?? "saturn-v"));
  if (!vehicle) {
    const msg = `Unknown vehicle_id ${JSON.stringify(req.vehicle_id)}`;
    return {
      vehicle_id: req.vehicle_id ?? "",
      glom_kg: 0,
      liftoff_twr: 0,
      max_q_kpa: 0,
      max_q_time_s: 0,
      delta_v_available_mps: 0,
      delta_v_required_mps: 0,
      delta_v_margin_mps: 0,
      payload_capacity_kg: 0,
      min_propellant_load_pct: null,
      is_go: false,
      failure_mode: null,
      failure_time_s: null,
      failure_reason: msg,
      criteria,
      error_message: msg,
    };
  }

  const tli = (req.destination ?? "TLI").toUpperCase() !== "LEO";
  const payload = Math.max(0, req.payload_mass_kg ?? APOLLO_11_STACK_KG);
  const load = clamp(req.propellant_load_pct ?? 100, 0, 100);
  const wind = req.wind_speed_kmh ?? 0;
  const required = deltaVRequired(req.parking_orbit_km ?? 185, tli);
  const available = stackDeltaV(vehicle, payload, load);
  const glom = stackGlom(vehicle, payload, load);
  const twr = glom > 0 ? vehicle.thrust_sl_n / (glom * G0) : 0;
  const [maxQ, maxQT] = simulateAscentMaxQ(glom * (S_IC_THRUST_SL_N / Math.max(1, vehicle.thrust_sl_n)), Math.max(0, wind));
  const capacity = payloadCapacity(vehicle, required);
  const minLoad = minPropellantLoad(vehicle, payload, required);
  const gust = Math.max(req.wind_gust_kmh ?? wind, wind);
  const shortfallTime = NOMINAL_ORBIT_INSERTION_S * clamp(available / required, 0.6, 1) - 10;

  let mode: LaunchFailureMode | null = null;
  let time: number | null = null;
  let reason: string | null = null;
  if (req.thunderstorm) {
    mode = "lightning_strike";
    time = LIGHTNING_STRIKE_TIME_S;
    reason = "Launched into a thunderstorm: the exhaust plume triggered a lightning strike";
  } else if (wind > criteria.max_sustained_wind_kmh || gust > criteria.max_peak_gust_kmh) {
    mode = "wind_shear";
    time = maxQT;
    reason = `Wind ${wind.toFixed(0)} km/h (gusts ${gust.toFixed(0)} km/h) beyond the launch limit (${criteria.max_sustained_wind_kmh.toFixed(0)} / ${criteria.max_peak_gust_kmh.toFixed(0)} km/h): structural shear at Max-Q`;
  } else if (twr < criteria.min_liftoff_twr) {
    mode = "no_liftoff";
    time = 8;
    reason = `Liftoff TWR ${twr.toFixed(3)} below ${criteria.min_liftoff_twr.toFixed(2)}: the vehicle barely clears the tower`;
  } else if (maxQ > criteria.max_q_limit_kpa) {
    mode = "max_q_breakup";
    time = maxQT;
    reason = `Max-Q ${maxQ.toFixed(1)} kPa exceeds the ${criteria.max_q_limit_kpa.toFixed(0)} kPa structural limit`;
  } else if (payload > capacity) {
    mode = "over_capacity";
    time = shortfallTime;
    reason = `Payload ${payload.toFixed(0)} kg exceeds the ${capacity.toFixed(0)} kg this vehicle can deliver`;
  } else if (available < required) {
    mode = "propellant_depletion";
    time = shortfallTime;
    reason = `Propellant depleted: ${available.toFixed(0)} m/s available of ${required.toFixed(0)} m/s required`;
  }

  return {
    vehicle_id: vehicle.id,
    glom_kg: glom,
    liftoff_twr: twr,
    max_q_kpa: maxQ,
    max_q_time_s: maxQT,
    delta_v_available_mps: available,
    delta_v_required_mps: required,
    delta_v_margin_mps: available - required,
    payload_capacity_kg: capacity,
    min_propellant_load_pct: minLoad,
    is_go: mode === null,
    failure_mode: mode,
    failure_time_s: time,
    failure_reason: reason,
    criteria,
  };
}
