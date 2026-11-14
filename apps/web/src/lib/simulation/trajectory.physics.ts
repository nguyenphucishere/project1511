/**
 * TypeScript port of the engine's flight profiles (crates/sim-core/src/trajectory.rs,
 * `simulate_ascent` / `simulate_powered_descent` in sim-wasm). The scenes need the profile on
 * their first frame, so they start from this port and then install the engine's own result
 * (the parity test runs both on the same inputs). Keep every constant and step in step with Rust.
 *
 * Source data and formulas: apollo_program_technical_research_simulation_telemetry_catalog.md
 *  §1.1 stage data, §1.2 a = (F_vac − P_amb·A_e − D)/m − g, q = ½ρv², §2.1 LES jettison,
 *  §2.4 LM descent engine, §4.2/§4.3 PDI, high gate and low gate.
 */

const G0 = 9.80665;
const MU_EARTH = 3.986004418e14;
const EARTH_RADIUS_M = 6_378_137.0;
const EARTH_EQUATORIAL_SPEED_MPS = 465.1;
const SEA_LEVEL_DENSITY = 1.225;
const SCALE_HEIGHT_M = 9_150.0;
const SEA_LEVEL_PRESSURE_PA = 101_325.0;
const SPEED_OF_SOUND_MPS = 340.0;
const S_IC_REFERENCE_AREA_M2 = 79.48;
const TOWER_HEIGHT_M = 136.0;

const APOLLO_11_GLOM_KG = 2_938_315.0;
const S_IC_DRY_KG = 130_860.0;
const S_IC_PROP_KG = 2_077_000.0;
const S_IC_THRUST_SL_N = 33_850_000.0;
const S_IC_THRUST_VAC_N = 38_700_000.0;
const S_IC_ISP_VAC_S = 304.0;
const S_IC_CECO_S = 135.2;
const S_IC_OECO_S = 161.1;
const S_II_DRY_KG = 36_200.0;
const S_II_INTERSTAGE_KG = 3_670.0;
const S_II_PROP_KG = 443_200.0;
const S_II_THRUST_VAC_N = 5_115_000.0;
const S_II_ISP_S = 421.0;
const S_II_CECO_MET_S = 460.0;
const S_II_BURN_S = 388.2;
const S_IVB_DRY_KG = 11_300.0;
const S_IVB_PROP_KG = 106_900.0;
const S_IVB_THRUST_VAC_N = 1_001_000.0;
const S_IVB_ISP_S = 421.0;
const IU_SLA_KG = 1_980.0 + 1_836.0;
const LES_KG = 4_173.0;
const LES_JETTISON_S = 197.9;
export const APOLLO_11_SPACECRAFT_KG = 43_904.0;
const S_IC_S_II_COAST_S = 1.4;
const S_II_S_IVB_COAST_S = 1.0;
const INTERSTAGE_DROP_AFTER_S = 30.0;

const sIcPitchDeg = (t: number) => (t <= 12 ? 90 : 90 - 58 * Math.pow((t - 12) / 149.1, 1.1));
const dragCoefficient = (mach: number) => (mach < 0.8 ? 0.15 : mach <= 1.2 ? 0.2 : 0.16);

export interface AscentProfileRequest {
  parking_orbit_km?: number;
  payload_mass_kg?: number;
  launch_latitude_deg?: number;
  launch_azimuth_deg?: number;
}

export interface AscentSample {
  met_s: number;
  altitude_km: number;
  inertial_velocity_mps: number;
  relative_velocity_mps: number;
  vertical_velocity_mps: number;
  sensed_accel_g: number;
  dynamic_pressure_kpa: number;
  mach: number;
  mass_kg: number;
  pitch_deg: number;
  /** 1 = S-IC, 2 = S-II, 3 = S-IVB, 0 = staging coast. */
  stage: number;
}

export interface AscentEvents {
  tower_clear_s: number | null;
  mach1_s: number | null;
  max_q_s: number;
  max_q_kpa: number;
  s_ic_ceco_s: number | null;
  s_ic_oeco_s: number | null;
  s_ii_ignition_s: number | null;
  interstage_jettison_s: number | null;
  les_jettison_s: number | null;
  space_100km_s: number | null;
  s_ii_ceco_s: number | null;
  s_ii_cutoff_s: number | null;
  s_ivb_ignition_s: number | null;
  insertion_s: number | null;
}

export interface AscentProfile {
  glom_kg: number;
  liftoff_twr: number;
  reached_orbit: boolean;
  insertion_altitude_km: number;
  insertion_velocity_mps: number;
  s_ivb_propellant_remaining_kg: number;
  events: AscentEvents;
  samples: AscentSample[];
  error_message?: string;
}

function ascentTimeToGo(stage: number, t: number, sIiIgnition: number, m: number, sIiProp: number, vNeeded: number): number {
  let dv = Math.max(0, vNeeded);
  let tt = 0;
  let mm = m;
  if (stage === 2) {
    const md = S_II_THRUST_VAC_N / (S_II_ISP_S * G0);
    const tLeft = Math.max(0, sIiIgnition + S_II_BURN_S - t);
    const p = Math.min(sIiProp, md * tLeft);
    const dv2 = S_II_ISP_S * G0 * Math.log(mm / (mm - p));
    if (dv2 >= dv) return tt + (mm - mm / Math.exp(dv / (S_II_ISP_S * G0))) / md;
    dv -= dv2;
    tt += p / md;
    mm -= p + S_II_DRY_KG;
  }
  const md3 = S_IVB_THRUST_VAC_N / (S_IVB_ISP_S * G0);
  return tt + (mm - mm / Math.exp(dv / (S_IVB_ISP_S * G0))) / md3;
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function simulateAscent(req: AscentProfileRequest = {}): AscentProfile {
  const dt = 0.02;
  const sampleEvery = 50;
  const hTarget = (req.parking_orbit_km ?? 185) * 1000;
  const payload = Math.max(0, req.payload_mass_kg ?? APOLLO_11_SPACECRAFT_KG);
  const itemised =
    S_IC_DRY_KG + S_IC_PROP_KG + S_II_DRY_KG + S_II_INTERSTAGE_KG + S_II_PROP_KG + S_IVB_DRY_KG + S_IVB_PROP_KG + IU_SLA_KG + APOLLO_11_SPACECRAFT_KG + LES_KG;
  const nonUsable = APOLLO_11_GLOM_KG - itemised;
  let m = itemised - APOLLO_11_SPACECRAFT_KG + payload + nonUsable;
  const glom = m;

  const lat = toRad(req.launch_latitude_deg ?? 28.6084);
  const az = toRad(req.launch_azimuth_deg ?? 72.058);
  let r = EARTH_RADIUS_M;
  let vr = 0;
  let vt = EARTH_EQUATORIAL_SPEED_MPS * Math.cos(lat) * Math.sin(az);
  const omega = vt / EARTH_RADIUS_M;
  const exitArea = (S_IC_THRUST_VAC_N - S_IC_THRUST_SL_N) / SEA_LEVEL_PRESSURE_PA;

  let stage = 1;
  let coastUntil = 0;
  let nextStage = 2;
  let p1 = S_IC_PROP_KG;
  let p2 = S_II_PROP_KG;
  let p3 = S_IVB_PROP_KG;
  let lesOn = true;
  let interstageOn = true;
  let lastPitch = 90;
  const ev: AscentEvents = {
    tower_clear_s: null,
    mach1_s: null,
    max_q_s: 0,
    max_q_kpa: 0,
    s_ic_ceco_s: null,
    s_ic_oeco_s: null,
    s_ii_ignition_s: null,
    interstage_jettison_s: null,
    les_jettison_s: null,
    space_100km_s: null,
    s_ii_ceco_s: null,
    s_ii_cutoff_s: null,
    s_ivb_ignition_s: null,
    insertion_s: null,
  };
  const samples: AscentSample[] = [];
  let reached = false;

  for (let step = 0; ; step++) {
    const t = step * dt;
    if (t > 1000) break;
    const h = r - EARTH_RADIUS_M;
    const rho = SEA_LEVEL_DENSITY * Math.exp(-Math.max(0, h) / SCALE_HEIGHT_M);
    const pAmb = SEA_LEVEL_PRESSURE_PA * Math.exp(-Math.max(0, h) / SCALE_HEIGHT_M);
    const vrelT = vt - omega * r;
    const vRel = Math.hypot(vr, vrelT);
    const q = 0.5 * rho * vRel * vRel;
    const mach = vRel / SPEED_OF_SOUND_MPS;
    const drag = q * dragCoefficient(mach) * S_IC_REFERENCE_AREA_M2;
    if (q > ev.max_q_kpa * 1000) {
      ev.max_q_kpa = q / 1000;
      ev.max_q_s = t;
    }
    if (ev.mach1_s === null && mach >= 1) ev.mach1_s = t;
    if (ev.space_100km_s === null && h >= 100_000) ev.space_100km_s = t;
    if (ev.tower_clear_s === null && h >= TOWER_HEIGHT_M) ev.tower_clear_s = t;
    const g = MU_EARTH / (r * r);

    let thrust = 0;
    let mdot = 0;
    let pitch = lastPitch;
    if (stage === 1) {
      const f = t < S_IC_CECO_S ? 1 : 0.8;
      if (ev.s_ic_ceco_s === null && t >= S_IC_CECO_S) ev.s_ic_ceco_s = t;
      if (t >= S_IC_OECO_S || p1 <= 0) {
        ev.s_ic_oeco_s = t;
        m -= S_IC_DRY_KG + nonUsable + Math.max(0, p1);
        p1 = 0;
        stage = 0;
        nextStage = 2;
        coastUntil = t + S_IC_S_II_COAST_S;
      } else {
        thrust = (S_IC_THRUST_VAC_N - pAmb * exitArea) * f;
        mdot = (S_IC_THRUST_VAC_N * f) / (S_IC_ISP_VAC_S * G0);
        pitch = sIcPitchDeg(t);
      }
    } else if (stage === 0 && t >= coastUntil - 1e-9) {
      stage = nextStage;
      if (stage === 2) ev.s_ii_ignition_s = t;
      else ev.s_ivb_ignition_s = t;
    }
    if (stage === 2 || stage === 3) {
      let f: number;
      let isp: number;
      if (stage === 2) {
        if (ev.s_ii_ceco_s === null && t >= S_II_CECO_MET_S) ev.s_ii_ceco_s = t;
        f = S_II_THRUST_VAC_N * (t >= S_II_CECO_MET_S ? 0.8 : 1);
        isp = S_II_ISP_S;
      } else {
        f = S_IVB_THRUST_VAC_N;
        isp = S_IVB_ISP_S;
      }
      thrust = f;
      mdot = f / (isp * G0);
      const a = thrust / m;
      const vCirc = Math.sqrt(MU_EARTH / r);
      const tgo = Math.max(2, ascentTimeToGo(stage, t, ev.s_ii_ignition_s ?? t, m, p2, vCirc - vt));
      const aCmd = (6 * (hTarget - h)) / (tgo * tgo) - (4 * vr) / tgo;
      const s = Math.min(0.9, Math.max(-0.6, (aCmd + g - (vt * vt) / r) / a));
      pitch = (Math.asin(s) * 180) / Math.PI;
    }
    if (stage === 2 && interstageOn && t >= (ev.s_ii_ignition_s ?? Infinity) + INTERSTAGE_DROP_AFTER_S) {
      m -= S_II_INTERSTAGE_KG;
      interstageOn = false;
      ev.interstage_jettison_s = t;
    }
    if (lesOn && t >= LES_JETTISON_S) {
      m -= LES_KG;
      lesOn = false;
      ev.les_jettison_s = t;
    }
    lastPitch = pitch;
    const pr = toRad(pitch);
    const dr = vRel > 0 ? (-drag * vr) / vRel : 0;
    const dtn = vRel > 0 ? (-drag * vrelT) / vRel : 0;
    const fr = thrust * Math.sin(pr) + dr;
    const ft = thrust * Math.cos(pr) + dtn;
    const ar = fr / m - g + (vt * vt) / r;
    const at = ft / m - (vr * vt) / r;
    if (step % sampleEvery === 0) {
      samples.push({
        met_s: t,
        altitude_km: h / 1000,
        inertial_velocity_mps: Math.hypot(vr, vt),
        relative_velocity_mps: vRel,
        vertical_velocity_mps: vr,
        sensed_accel_g: Math.hypot(fr, ft) / m / G0,
        dynamic_pressure_kpa: q / 1000,
        mach,
        mass_kg: m,
        pitch_deg: pitch,
        stage,
      });
    }
    vr += ar * dt;
    vt += at * dt;
    r += vr * dt;
    m -= mdot * dt;
    if (stage === 1) {
      p1 -= mdot * dt;
    } else if (stage === 2) {
      p2 -= mdot * dt;
      const ign = ev.s_ii_ignition_s ?? t;
      if (p2 <= 0 || t + dt >= ign + S_II_BURN_S) {
        ev.s_ii_cutoff_s = t + dt;
        m -= S_II_DRY_KG + Math.max(0, p2);
        p2 = 0;
        stage = 0;
        nextStage = 3;
        coastUntil = t + dt + S_II_S_IVB_COAST_S;
      }
    } else if (stage === 3) {
      p3 -= mdot * dt;
      if (vt >= Math.sqrt(MU_EARTH / r)) {
        const met = t + dt;
        ev.insertion_s = met;
        reached = true;
        samples.push({
          met_s: met,
          altitude_km: (r - EARTH_RADIUS_M) / 1000,
          inertial_velocity_mps: Math.hypot(vr, vt),
          relative_velocity_mps: Math.hypot(vr, vt - omega * r),
          vertical_velocity_mps: vr,
          sensed_accel_g: 0,
          dynamic_pressure_kpa: 0,
          mach: 0,
          mass_kg: m,
          pitch_deg: 0,
          stage: 3,
        });
        break;
      }
      if (p3 <= 0) break;
    }
  }

  const last = samples[samples.length - 1];
  return {
    glom_kg: glom,
    liftoff_twr: S_IC_THRUST_SL_N / (glom * G0),
    reached_orbit: reached,
    insertion_altitude_km: last?.altitude_km ?? 0,
    insertion_velocity_mps: last?.inertial_velocity_mps ?? 0,
    s_ivb_propellant_remaining_kg: Math.max(0, p3),
    events: ev,
    samples,
    ...(reached ? {} : { error_message: "Parking orbit not reached" }),
  };
}

/* ------------------------------------------------------------------ powered descent */

const MOON_RADIUS_M = 1_737_400.0;
export const DPS_MAX_THRUST_N = 45_040.0;
export const DPS_ISP_S = 311.0;
export const DPS_THROTTLE_MIN = 0.1;
export const DPS_THROTTLE_MAX_VARIABLE = 0.6;
const DPS_FTP_MIN = 0.925;
const DPS_ULLAGE_S = 26.0;
const LM_5_MASS_KG = 15_103.0;
export const DPS_PROPELLANT_KG = 8_200.0;
const DOI_DELTA_V_MPS = 21.8;
const PDI_ALTITUDE_M = 15_240.0;
const PDI_HORIZONTAL_MPS = 1_695.0;
const HIGH_GATE_ALT_M = 2_255.5;
const HIGH_GATE_VX_MPS = 152.4;
const HIGH_GATE_VZ_MPS = -38.1;
const LOW_GATE_ALT_M = 152.4;
const LOW_GATE_VX_MPS = 18.3;
const LOW_GATE_VZ_MPS = -5.2;
const BRAKING_PHASE_S = 510.0;
const LANDING_RADAR_LOCK_M = 12_200.0;
/** sim-core lunar constants: 1.622 m/s² standard + 0.0028 m/s² mascon (+280 mGal). */
export const ENGINE_LOCAL_LUNAR_GRAVITY = 1.622 + 0.0028;

export interface DescentProfileRequest {
  local_gravity_mps2?: number;
  lm_mass_kg?: number;
  dps_propellant_kg?: number;
}

export interface DescentSample {
  t_s: number;
  altitude_m: number;
  horizontal_velocity_mps: number;
  vertical_velocity_mps: number;
  throttle: number;
  propellant_kg: number;
  mass_kg: number;
  /** LM attitude: thrust axis tilt from local vertical, degrees. */
  attitude_from_vertical_deg: number;
}

export interface DescentGateState {
  t_s: number;
  altitude_m: number;
  horizontal_velocity_mps: number;
  vertical_velocity_mps: number;
  mass_kg: number;
  propellant_kg: number;
}

export interface DescentProfile {
  local_gravity_mps2: number;
  dps_max_thrust_n: number;
  dps_isp_s: number;
  dps_propellant_capacity_kg: number;
  doi_propellant_kg: number;
  throttle_down_s: number | null;
  radar_lock_s: number | null;
  high_gate: DescentGateState;
  low_gate: DescentGateState;
  hover_throttle_at_low_gate: number;
  samples: DescentSample[];
  error_message?: string;
}

export function simulatePoweredDescent(req: DescentProfileRequest = {}): DescentProfile {
  const dt = 0.02;
  const sampleEvery = 50;
  const gLocal = req.local_gravity_mps2 ?? ENGINE_LOCAL_LUNAR_GRAVITY;
  const lm = req.lm_mass_kg ?? LM_5_MASS_KG;
  const capacity = req.dps_propellant_kg ?? DPS_PROPELLANT_KG;
  const mu = gLocal * MOON_RADIUS_M * MOON_RADIUS_M;
  const doiProp = lm * (1 - Math.exp(-DOI_DELTA_V_MPS / (DPS_ISP_S * G0)));
  let m = lm - doiProp;
  let prop = capacity - doiProp;
  let r = MOON_RADIUS_M + PDI_ALTITUDE_M;
  let vr = 0;
  let vt = PDI_HORIZONTAL_MPS;
  const tLow = BRAKING_PHASE_S + (2 * (HIGH_GATE_ALT_M - LOW_GATE_ALT_M)) / (Math.abs(HIGH_GATE_VZ_MPS) + Math.abs(LOW_GATE_VZ_MPS));
  const samples: DescentSample[] = [];
  let throttleDown: number | null = null;
  let radarLock: number | null = null;
  let highGate: DescentGateState | null = null;
  let step = 0;
  for (; ; step++) {
    const t = step * dt;
    if (t >= tLow - 1e-9) break;
    const h = r - MOON_RADIUS_M;
    const g = mu / (r * r);
    const braking = t < BRAKING_PHASE_S;
    const [hT, vxT, vzT, tEnd] = braking
      ? [HIGH_GATE_ALT_M, HIGH_GATE_VX_MPS, HIGH_GATE_VZ_MPS, BRAKING_PHASE_S]
      : [LOW_GATE_ALT_M, LOW_GATE_VX_MPS, LOW_GATE_VZ_MPS, tLow];
    const tgo = Math.max(dt * 5, tEnd - t);
    const aR = (6 * (hT - h)) / (tgo * tgo) - (4 * vr + 2 * vzT) / tgo;
    // Braking: null the forward-speed error over the phase. Approach: a linearly falling
    // deceleration (a = 2Δv/t_go) that reaches zero at the low gate, so the LM arrives upright.
    const aT = braking ? (vxT - vt) / tgo : (2 * (vxT - vt)) / tgo;
    let tr = m * (aR + g - (vt * vt) / r);
    let tt = m * (aT + (vr * vt) / r);
    const demandN = Math.hypot(tr, tt);
    const demand = demandN / DPS_MAX_THRUST_N;
    let throttle: number;
    if (t < DPS_ULLAGE_S) throttle = DPS_THROTTLE_MIN;
    else if (demand > DPS_THROTTLE_MAX_VARIABLE) throttle = Math.min(1, Math.max(DPS_FTP_MIN, demand));
    else {
      if (throttleDown === null && t > 60) throttleDown = t;
      throttle = Math.max(DPS_THROTTLE_MIN, demand);
    }
    const scale = demandN > 0 ? (throttle * DPS_MAX_THRUST_N) / demandN : 0;
    tr *= scale;
    tt *= scale;
    if (radarLock === null && h <= LANDING_RADAR_LOCK_M) radarLock = t;
    if (highGate === null && !braking) {
      highGate = { t_s: t, altitude_m: h, horizontal_velocity_mps: vt, vertical_velocity_mps: vr, mass_kg: m, propellant_kg: prop };
    }
    if (step % sampleEvery === 0) {
      samples.push({
        t_s: t,
        altitude_m: h,
        horizontal_velocity_mps: vt,
        vertical_velocity_mps: vr,
        throttle,
        propellant_kg: prop,
        mass_kg: m,
        attitude_from_vertical_deg: (Math.atan2(-tt, tr) * 180) / Math.PI,
      });
    }
    const mdot = (throttle * DPS_MAX_THRUST_N) / (DPS_ISP_S * G0);
    const ar = tr / m - g + (vt * vt) / r;
    const at = tt / m - (vr * vt) / r;
    vr += ar * dt;
    vt += at * dt;
    r += vr * dt;
    m -= mdot * dt;
    prop -= mdot * dt;
  }
  const lowGate: DescentGateState = {
    t_s: step * dt,
    altitude_m: r - MOON_RADIUS_M,
    horizontal_velocity_mps: vt,
    vertical_velocity_mps: vr,
    mass_kg: m,
    propellant_kg: prop,
  };
  samples.push({
    t_s: lowGate.t_s,
    altitude_m: lowGate.altitude_m,
    horizontal_velocity_mps: vt,
    vertical_velocity_mps: vr,
    throttle: (gLocal * m) / DPS_MAX_THRUST_N,
    propellant_kg: prop,
    mass_kg: m,
    attitude_from_vertical_deg: 0,
  });
  return {
    local_gravity_mps2: gLocal,
    dps_max_thrust_n: DPS_MAX_THRUST_N,
    dps_isp_s: DPS_ISP_S,
    dps_propellant_capacity_kg: capacity,
    doi_propellant_kg: doiProp,
    throttle_down_s: throttleDown,
    radar_lock_s: radarLock,
    high_gate: highGate ?? { ...lowGate },
    hover_throttle_at_low_gate: (gLocal * lowGate.mass_kg) / DPS_MAX_THRUST_N,
    low_gate: lowGate,
    samples,
  };
}
