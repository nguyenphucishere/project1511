import type {
  DsnTelemetryInput,
  DsnTelemetryResult,
  LandingRadarInput,
  LandingRadarMeasurement,
  MissionDesignBudgetInput,
  MissionDesignBudgetResult,
  StageConfig,
} from "./nasa.types";

/**
 * TypeScript mirror of the NASA-realism functions in crates/sim-core, used by the simulation
 * worker when the WASM binary is unavailable. Keep in step with:
 *  - descent.rs        calculate_landing_radar_full
 *  - mission_design.rs evaluate_mission_design_budget
 *  - kepler.rs         calculate_dsn_telemetry
 */

export const RADAR_SCALE_SHIFT_ALTITUDE_M = 762.0;
export const RADAR_MAX_OPERATIONAL_ALTITUDE_M = 15_240.0;
export const RADAR_MAX_PITCH_LIMIT_DEG = 65.0;
export const RADAR_MAX_HORIZONTAL_VEL_MPS = 1_800.0;
export const RADAR_MAX_VERTICAL_VEL_MPS = 300.0;

export const DEFAULT_MGA_MARGIN_PCT = 20.0;
export const MIN_POWER_MARGIN_PCT = 30.0;
export const MIN_DELTA_V_RESERVE_PCT = 10.0;
export const APOLLO_11_NOMINAL_POWER_GEN_WATTS = 2_100.0;
export const MAX_TLI_PAYLOAD_CAPACITY_KG = 48_609.0;
const STANDARD_GRAVITY = 9.80665;

const SPEED_OF_LIGHT_KM_S = 299_792.458;
const DSN_S_BAND_FREQ_MHZ = 2_282.5;
const DSN_LINK_POWER_BUDGET_CONSTANT_DBM = 110.5;
export const EARTH_MOON_NOMINAL_DISTANCE_KM = 384_400.0;

const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Ryan 4-beam landing radar: radar altitude over local terrain, scale shift and data-good gate. */
export function landingRadar(input: LandingRadarInput): LandingRadarMeasurement {
  const offset = input.terrain_elevation_offset_m ?? 0;
  const radar = Math.max(0, input.inertial_alt_m - offset);
  const pitchOk = input.pitch_angle_deg === undefined || Math.abs(input.pitch_angle_deg) <= RADAR_MAX_PITCH_LIMIT_DEG;
  const altOk =
    input.inertial_alt_m >= 0 &&
    input.inertial_alt_m <= RADAR_MAX_OPERATIONAL_ALTITUDE_M &&
    radar <= RADAR_MAX_OPERATIONAL_ALTITUDE_M;
  const velOk =
    Math.abs(input.horizontal_vel_mps) <= RADAR_MAX_HORIZONTAL_VEL_MPS &&
    Math.abs(input.vertical_vel_mps) <= RADAR_MAX_VERTICAL_VEL_MPS;
  return {
    inertial_altitude_m: input.inertial_alt_m,
    radar_altitude_m: radar,
    altitude_delta_m: input.inertial_alt_m - radar,
    forward_velocity_mps: input.horizontal_vel_mps,
    vertical_velocity_mps: input.vertical_vel_mps,
    lateral_velocity_mps: input.lateral_vel_mps ?? 0,
    scale_mode: radar > RADAR_SCALE_SHIFT_ALTITUDE_M ? 1 : 2,
    data_good: pitchOk && altOk && velOk,
  };
}

export function stageDeltaV(dryKg: number, propKg: number, ispS: number): number {
  if (dryKg <= 0 || propKg <= 0 || ispS <= 0) return 0;
  return ispS * STANDARD_GRAVITY * Math.log((dryKg + propKg) / dryKg);
}

export function multiStageDeltaV(stages: StageConfig[]): number {
  return stages.reduce(
    (sum, s) => sum + (s.burn_delta_v_mps ?? stageDeltaV(s.dry_mass_kg, s.propellant_mass_kg, s.isp_s)),
    0,
  );
}

/** JPL Concept Maturity Level (1 cocktail napkin … 4 point design). */
export function cmlScore(args: {
  isMassCompliant: boolean;
  basicMassUnderCapacity: boolean;
  powerMarginPct: number;
  deltaVReservePct: number;
  deltaVAvailableMps: number;
  basicDryMass: number;
  deltaVRequiredMps: number;
}): 1 | 2 | 3 | 4 {
  const a = args;
  if (a.basicDryMass <= 0 || a.deltaVRequiredMps <= 0) return 1;
  if (
    a.isMassCompliant &&
    a.powerMarginPct >= MIN_POWER_MARGIN_PCT &&
    a.deltaVReservePct >= MIN_DELTA_V_RESERVE_PCT &&
    a.deltaVAvailableMps > 0
  )
    return 4;
  if (a.isMassCompliant && a.powerMarginPct >= 15 && a.deltaVReservePct >= 5) return 3;
  if (a.basicMassUnderCapacity && a.powerMarginPct >= 0 && a.deltaVReservePct >= -20) return 2;
  return 1;
}

/** Goddard MDL budget audit: MGA dry mass, power margin, multi-stage Δv reserve, CML and score. */
export function missionDesignBudget(req: MissionDesignBudgetInput): MissionDesignBudgetResult {
  const capacity = req.launch_vehicle_capacity_kg ?? MAX_TLI_PAYLOAD_CAPACITY_KG;
  const mgaPct = req.mga_margin_pct ?? DEFAULT_MGA_MARGIN_PCT;
  const basic = Math.max(0, req.dry_mass_basic_kg);
  const dryWithMga = basic > 0 ? basic * (1 + Math.max(0, mgaPct) / 100) : 0;
  const massMargin = capacity - dryWithMga;
  const isMassCompliant = basic > 0 && massMargin >= 0;
  const basicUnderCapacity = basic > 0 && capacity - basic >= 0;

  let powerMarginPct = 0;
  let isPowerCompliant = false;
  if (req.power_load_watts > 0) {
    const load = req.power_load_watts;
    const gen =
      req.power_generation_watts ??
      (load <= 1000 ? 1_400 : load <= 1500 ? APOLLO_11_NOMINAL_POWER_GEN_WATTS : load * 1.35);
    powerMarginPct = ((gen - load) / load) * 100;
    isPowerCompliant = powerMarginPct >= MIN_POWER_MARGIN_PCT;
  }

  const dvAvailable = multiStageDeltaV(req.stage_configs ?? []);
  let dvReservePct = 0;
  let isDvCompliant = false;
  if (req.delta_v_required_mps > 0) {
    dvReservePct = ((dvAvailable - req.delta_v_required_mps) / req.delta_v_required_mps) * 100;
    isDvCompliant = dvReservePct >= MIN_DELTA_V_RESERVE_PCT;
  }

  const cml = cmlScore({
    isMassCompliant,
    basicMassUnderCapacity: basicUnderCapacity,
    powerMarginPct,
    deltaVReservePct: dvReservePct,
    deltaVAvailableMps: dvAvailable,
    basicDryMass: basic,
    deltaVRequiredMps: req.delta_v_required_mps,
  });

  const massMarginPct = (massMargin / capacity) * 100;
  const massScore = isMassCompliant
    ? clamp(50 + massMarginPct * 2.5, 0, 100)
    : basic > 0
      ? clamp(50 + massMarginPct * 3.4, 0, 50)
      : 0;
  const powerScore = clamp((powerMarginPct / MIN_POWER_MARGIN_PCT) * 100, 0, 100);
  const dvScore = clamp((dvReservePct / MIN_DELTA_V_RESERVE_PCT) * 100, 0, 100);
  const overall =
    basic <= 0 || req.delta_v_required_mps <= 0
      ? 0
      : round(clamp(0.35 * massScore + 0.35 * dvScore + 0.3 * powerScore, 0, 100), 2);

  return {
    dry_mass_with_mga_kg: dryWithMga,
    mass_margin_kg: massMargin,
    is_mass_compliant: isMassCompliant,
    power_margin_pct: powerMarginPct,
    is_power_compliant: isPowerCompliant,
    delta_v_available_mps: dvAvailable,
    delta_v_reserve_pct: dvReservePct,
    is_delta_v_compliant: isDvCompliant,
    cml_score: cml,
    overall_mdl_score: overall,
  };
}

/** S-band DSN link: round-trip light time, free-space path loss, received power, lunar occultation. */
export function dsnTelemetry(input: DsnTelemetryInput): DsnTelemetryResult {
  const d = Math.max(1, input.distance_km);
  const rtlt = (2 * d) / SPEED_OF_LIGHT_KM_S;
  const fspl = 20 * Math.log10(d) + 20 * Math.log10(DSN_S_BAND_FREQ_MHZ) + 32.4478;
  const nu = (((input.true_anomaly_deg ?? 0) % 360) + 360) % 360;
  const isOcculted = Boolean(input.is_farside) || (nu >= 109.872 && nu <= 250.128);
  const received = isOcculted ? -180 : DSN_LINK_POWER_BUDGET_CONSTANT_DBM - fspl;
  return {
    rtlt_seconds: round(rtlt, 5),
    path_loss_db: round(fspl, 4),
    received_power_dbm: round(received, 4),
    is_occulted: isOcculted,
  };
}

/** Apollo 11 baseline for the "Build it yourself" trade study (CSM + LM against the S-IVB TLI capacity). */
export const APOLLO_11_DESIGN_BASELINE: MissionDesignBudgetInput = {
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
};
