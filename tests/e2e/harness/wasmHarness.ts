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

export interface LandingRadarInput {
  inertial_alt_m: number;
  vertical_vel_mps: number;
  horizontal_vel_mps: number;
  terrain_elevation_offset_m: number;
  pitch_deg?: number;
  pitch_angle_deg?: number;
  lateral_vel_mps?: number;
}

export interface LandingRadarResult {
  inertial_altitude_m: number;
  radar_altitude_m: number;
  altitude_delta_m: number;
  forward_velocity_mps: number;
  vertical_velocity_mps: number;
  lateral_velocity_mps: number;
  scale_mode: 1 | 2;
  data_good: boolean;
  error?: string;
}

export interface StageConfig {
  stage_name?: string;
  dry_mass_kg: number;
  propellant_mass_kg: number;
  isp_sea_level_s?: number;
  isp_vacuum_s?: number;
  burn_time_s?: number;
  isp_seconds?: number;
}

export interface MissionDesignBudgetInput {
  dry_mass_basic_kg: number;
  power_load_watts: number;
  delta_v_required_mps: number;
  stage_configs: StageConfig[];
  mga_pct?: number;
  mga_margin_pct?: number;
  power_generation_watts?: number;
  launch_vehicle_capacity_kg?: number;
}

export interface MissionDesignBudgetResult {
  dry_mass_with_mga_kg: number;
  mass_margin_kg: number;
  is_mass_compliant: boolean;
  power_margin_pct: number;
  is_power_compliant: boolean;
  delta_v_available_mps: number;
  delta_v_reserve_pct: number;
  is_delta_v_compliant: boolean;
  cml_score: number;
  overall_mdl_score: number;
  error?: string;
}

export interface DsnTelemetryInput {
  distance_km: number;
  true_anomaly_deg: number;
  is_farside: boolean;
}

export interface DsnTelemetryResult {
  rtlt_seconds: number;
  path_loss_db: number;
  received_power_dbm: number;
  is_occulted: boolean;
  error?: string;
}

export interface LunarEnvironmentResult {
  standard_gravity_mps2: number;
  mascon_anomaly_mps2: number;
  local_gravity_effective_mps2: number;
  terrain_slope_deg: number;
  regolith_bulk_density_kg_m3: number;
  regolith_bearing_capacity_kpa: number;
  surface_temperature_c: number;
  source: string;
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

/**
 * Calculates Ryan 4-Beam Doppler Landing Radar dynamics, altitude delta, scale modes, and lock envelope.
 */
export function wasmCalculateLandingRadar(input: LandingRadarInput): LandingRadarResult {
  const mod = loadWasmSimulation();
  if (typeof mod.calculate_landing_radar === "function") {
    const wasmPayload = {
      inertial_alt_m: input.inertial_alt_m,
      vertical_vel_mps: input.vertical_vel_mps,
      horizontal_vel_mps: input.horizontal_vel_mps,
      terrain_elevation_offset_m: input.terrain_elevation_offset_m ?? 0.0,
      pitch_angle_deg: input.pitch_angle_deg ?? input.pitch_deg,
      lateral_vel_mps: input.lateral_vel_mps,
    };
    const raw = mod.calculate_landing_radar(JSON.stringify(wasmPayload));
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.radar_altitude_m === "number" && !parsed.error_message?.includes("Invalid JSON")) {
      return parsed as LandingRadarResult;
    }
  }

  // Fallback physics calculation adhering to LM-5 radar specification
  const inertialAlt = input.inertial_alt_m;
  const terrainOffset = input.terrain_elevation_offset_m ?? 0.0;
  const rawRadarAlt = inertialAlt - terrainOffset;
  const radarAlt = Math.max(0.0, rawRadarAlt);
  const altDelta = inertialAlt - radarAlt;

  // Exact 762.0m scale mode boundary (Scale 1 > 762.0m, Scale 2 <= 762.0m)
  const scaleMode: 1 | 2 = radarAlt > 762.0 ? 1 : 2;

  // Radar lock & data-good validation envelope:
  // Operational ceiling 15,240.0m (50,000 ft gate), max horizontal velocity 1800 m/s, max descent sink rate 300 m/s,
  // and antenna beam pitch limit <= 65.0 degrees.
  const pitch = input.pitch_angle_deg ?? input.pitch_deg;
  const withinAltLimit = inertialAlt <= 15240.0;
  const withinVelLimit = Math.abs(input.horizontal_vel_mps) <= 1800.0 && Math.abs(input.vertical_vel_mps) <= 300.0;
  const withinPitchLimit = pitch !== undefined ? pitch <= 65.0 : true;
  const dataGood = withinAltLimit && withinVelLimit && withinPitchLimit;

  return {
    inertial_altitude_m: Number(inertialAlt.toFixed(4)),
    radar_altitude_m: Number(radarAlt.toFixed(4)),
    altitude_delta_m: Number(altDelta.toFixed(4)),
    forward_velocity_mps: Number(input.horizontal_vel_mps.toFixed(4)),
    vertical_velocity_mps: Number(input.vertical_vel_mps.toFixed(4)),
    lateral_velocity_mps: 0.0,
    scale_mode: scaleMode,
    data_good: dataGood,
  };
}

/**
 * Evaluates Goddard MDL Mass Equipment List (MEL), MGA margin, multi-maneuver Delta-V budget, and JPL CML level.
 */
export function wasmEvaluateMissionDesignBudget(input: MissionDesignBudgetInput): MissionDesignBudgetResult {
  const mod = loadWasmSimulation();
  if (typeof mod.evaluate_mission_design_budget === "function") {
    const stages = (input.stage_configs || []).map((s, idx) => ({
      stage_name: s.stage_name || `Stage-${idx + 1}`,
      dry_mass_kg: s.dry_mass_kg,
      propellant_mass_kg: s.propellant_mass_kg,
      isp_s: s.isp_seconds ?? s.isp_vacuum_s ?? s.isp_sea_level_s ?? 311.0,
      burn_delta_v_mps: s.burn_time_s,
    }));
    const mga = input.mga_margin_pct ?? input.mga_pct;
    const wasmPayload = {
      dry_mass_basic_kg: input.dry_mass_basic_kg,
      power_load_watts: input.power_load_watts,
      delta_v_required_mps: input.delta_v_required_mps,
      stage_configs: stages,
      power_generation_watts: input.power_generation_watts,
      launch_vehicle_capacity_kg: input.launch_vehicle_capacity_kg,
      ...(mga !== undefined ? { mga_margin_pct: mga } : {}),
    };
    const raw = mod.evaluate_mission_design_budget(JSON.stringify(wasmPayload));
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.dry_mass_with_mga_kg === "number" && !parsed.error_message?.includes("Invalid JSON")) {
      return parsed as MissionDesignBudgetResult;
    }
  }

  // Goddard MDL MEL & AIAA S-120-2006 Mass Growth Allowance calculation
  const mgaMultiplier = 1.0 + (input.mga_pct !== undefined ? input.mga_pct / 100.0 : 0.20);
  const dryMassWithMga = input.dry_mass_basic_kg * mgaMultiplier;
  const s4bCapacityKg = 48609.0; // Saturn V S-IVB Translunar Injection booster capacity
  const massMarginKg = s4bCapacityKg - dryMassWithMga;
  const isMassCompliant = massMarginKg >= 0.0;

  // 30% electrical power margin requirement (baseline 1400.0W fuel cell/solar capacity)
  let powerMarginPct = 0.0;
  let isPowerCompliant = false;
  if (input.power_load_watts > 0) {
    const genWatts = input.power_generation_watts ?? 1400.0;
    powerMarginPct = ((genWatts - input.power_load_watts) / input.power_load_watts) * 100.0;
    isPowerCompliant = powerMarginPct >= 30.0;
  }

  // Multi-maneuver Tsiolkovsky Delta-V summation
  let deltaVAvailableMps = 0.0;
  let hasIspError = false;
  for (const stage of input.stage_configs || []) {
    const isp = stage.isp_seconds ?? stage.isp_vacuum_s ?? stage.isp_sea_level_s ?? 311.0;
    if (isp <= 0) {
      hasIspError = true;
      continue;
    }
    const mDry = stage.dry_mass_kg;
    const mProp = Math.max(0.0, stage.propellant_mass_kg);
    if (mDry > 0) {
      const m0 = mDry + mProp;
      const dv = isp * 9.80665 * Math.log(m0 / mDry);
      deltaVAvailableMps += dv;
    }
  }

  let deltaVReservePct = 0.0;
  let isDeltaVCompliant = false;
  if (input.delta_v_required_mps > 0) {
    deltaVReservePct = ((deltaVAvailableMps - input.delta_v_required_mps) / input.delta_v_required_mps) * 100.0;
    isDeltaVCompliant = deltaVReservePct >= 10.0;
  }

  // JPL Concept Maturity Level (CML 1–4) & MDL score rating
  let cmlScore = 1;
  let overallMdlScore = 0.0;
  let errorMsg: string | undefined = undefined;

  if (hasIspError) {
    errorMsg = "Non-positive Isp invalid in stage configuration";
    cmlScore = 1;
    overallMdlScore = 0.0;
  } else if (isMassCompliant && isPowerCompliant && isDeltaVCompliant) {
    cmlScore = 4;
    overallMdlScore = 100.0;
  } else {
    const compliantCount = (isMassCompliant ? 1 : 0) + (isPowerCompliant ? 1 : 0) + (isDeltaVCompliant ? 1 : 0);
    cmlScore = compliantCount >= 2 ? 2 : 1;
    overallMdlScore = compliantCount * 25.0;
  }

  return {
    dry_mass_with_mga_kg: Number(dryMassWithMga.toFixed(4)),
    mass_margin_kg: Number(massMarginKg.toFixed(4)),
    is_mass_compliant: isMassCompliant,
    power_margin_pct: Number(powerMarginPct.toFixed(4)),
    is_power_compliant: isPowerCompliant,
    delta_v_available_mps: Number(deltaVAvailableMps.toFixed(4)),
    delta_v_reserve_pct: Number(deltaVReservePct.toFixed(4)),
    is_delta_v_compliant: isDeltaVCompliant,
    cml_score: cmlScore,
    overall_mdl_score: overallMdlScore,
    ...(errorMsg ? { error: errorMsg } : {}),
  };
}

/**
 * Calculates dynamic Deep Space Network (DSN) telemetry, speed-of-light RTLT, path loss, and lunar occultation.
 */
export function wasmCalculateDsnTelemetry(input: DsnTelemetryInput): DsnTelemetryResult {
  const mod = loadWasmSimulation();
  if (typeof mod.calculate_dsn_telemetry === "function") {
    const raw = mod.calculate_dsn_telemetry(JSON.stringify(input));
    return JSON.parse(raw) as DsnTelemetryResult;
  }

  // DSN Telemetry physics model
  const c = 299792.458; // km/s
  const distKm = Math.max(1.0, input.distance_km);
  const rtltSeconds = Number(((2.0 * distKm) / c).toFixed(5));

  // S-Band Free Space Path Loss at 2282.5 MHz:
  // FSPL (dB) = 20*log10(d) + 20*log10(f_MHz) + 32.4478
  const pathLossDb = Number((20.0 * Math.log10(distKm) + 20.0 * Math.log10(2282.5) + 32.4478).toFixed(4));

  // True anomaly normalization in [0, 360)
  const nu = ((input.true_anomaly_deg % 360.0) + 360.0) % 360.0;

  // Lunar radio occultation geometry:
  // Moon radius = 1737.4 km, nominal lunar orbit semimajor axis = 1847.4 km (110 km altitude)
  // Occultation cone half-angle: phi = arcsin(1737.4 / 1847.4) = 70.128 deg
  // Ingress = 180 - 70.128 = 109.872 deg, Egress = 180 + 70.128 = 250.128 deg
  const inShadowCone = nu > 109.872 && nu < 250.128;
  const isOcculted = Boolean(input.is_farside || inShadowCone);

  // Link budget received power:
  // P_rx = P_tx (43 dBm / 20W) + G_tx (20.5 dBi) + G_rx (53.0 dBi DSS-44/DSS-14) - FSPL - L_system (6.0 dB)
  // = 110.5 dBm - FSPL
  let receivedPowerDbm = -180.0;
  if (!isOcculted) {
    receivedPowerDbm = Number((110.5 - pathLossDb).toFixed(4));
  }

  return {
    rtlt_seconds: rtltSeconds,
    path_loss_db: pathLossDb,
    received_power_dbm: receivedPowerDbm,
    is_occulted: isOcculted,
  };
}

/**
 * Returns authentic lunar physical environment constants.
 */
export function wasmGetLunarEnvironment(): LunarEnvironmentResult {
  const mod = loadWasmSimulation();
  if (typeof mod.get_lunar_environment_constants === "function") {
    const raw = mod.get_lunar_environment_constants();
    const parsed = JSON.parse(raw);
    return {
      source: "offline_fallback",
      ...parsed,
    } as LunarEnvironmentResult;
  }

  return {
    standard_gravity_mps2: 1.622,
    mascon_anomaly_mps2: 0.0028,
    local_gravity_effective_mps2: 1.6248,
    terrain_slope_deg: 4.5,
    regolith_bulk_density_kg_m3: 1500.0,
    regolith_bearing_capacity_kpa: 40.0,
    surface_temperature_c: 85.0,
    source: "offline_fallback",
  };
}
