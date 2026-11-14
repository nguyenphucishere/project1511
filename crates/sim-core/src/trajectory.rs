//! Flight profiles for the ride to orbit (Scene 4) and the powered lunar descent (Scene 6).
//!
//! Both are integrated from first principles with Apollo 11 data from the project's telemetry
//! catalogue (`apollo_program_technical_research_simulation_telemetry_catalog.md`):
//!
//! * Ascent (§1.1, §1.2): `a = (F_vac − P_amb(h)·A_e − D)/m − g(h)` in 2-D polar coordinates
//!   around a rotating Earth, `q = ½ρ(h)v_rel²`, S-IC / S-II / S-IVB thrust, Isp and cutoff times,
//!   LES jettison at T+197.9 s (§2.1). The S-IC flies the engine's open-loop pitch program; the
//!   upper stages fly energy-optimal terminal guidance (`a = 6Δh/t² − 4v_r/t`) to the parking
//!   orbit, and the S-IVB cuts off at circular velocity.
//! * Powered descent (§2.4, §4.2, §4.3): LM descent engine 45.04 kN at Isp 311 s with the 10 %
//!   ullage start, 10–60 % throttleable band and 92.5–100 % fixed-throttle position; PDI at
//!   15,240 m and 1,695 m/s after the 21.8 m/s DOI burn; guidance through the high gate and low
//!   gate states; gravity from the engine's lunar constants (mascon included).

use crate::kepler::get_lunar_environment_constants;
use crate::STANDARD_GRAVITY;
use serde::{Deserialize, Serialize};

const G0: f64 = STANDARD_GRAVITY;
const MU_EARTH: f64 = 3.986_004_418e14;
const EARTH_RADIUS_M: f64 = 6_378_137.0;
/// Equatorial surface speed of the rotating Earth (m/s).
const EARTH_EQUATORIAL_SPEED_MPS: f64 = 465.1;
const SEA_LEVEL_DENSITY: f64 = 1.225;
const SCALE_HEIGHT_M: f64 = 9_150.0;
const SEA_LEVEL_PRESSURE_PA: f64 = 101_325.0;
const SPEED_OF_SOUND_MPS: f64 = 340.0;
const S_IC_REFERENCE_AREA_M2: f64 = 79.48;
/// Height of the Launch Umbilical Tower, m (tower clear).
const TOWER_HEIGHT_M: f64 = 136.0;

// §1.1 Apollo 11 (AS-506)
const APOLLO_11_GLOM_KG: f64 = 2_938_315.0;
const S_IC_DRY_KG: f64 = 130_860.0;
const S_IC_PROP_KG: f64 = 2_077_000.0;
const S_IC_THRUST_SL_N: f64 = 33_850_000.0;
const S_IC_THRUST_VAC_N: f64 = 38_700_000.0;
const S_IC_ISP_VAC_S: f64 = 304.0;
const S_IC_CECO_S: f64 = 135.2;
const S_IC_OECO_S: f64 = 161.1;
const S_II_DRY_KG: f64 = 36_200.0;
const S_II_INTERSTAGE_KG: f64 = 3_670.0;
const S_II_PROP_KG: f64 = 443_200.0;
const S_II_THRUST_VAC_N: f64 = 5_115_000.0;
const S_II_ISP_S: f64 = 421.0;
const S_II_CECO_MET_S: f64 = 460.0;
const S_II_BURN_S: f64 = 388.2;
const S_IVB_DRY_KG: f64 = 11_300.0;
const S_IVB_PROP_KG: f64 = 106_900.0;
const S_IVB_THRUST_VAC_N: f64 = 1_001_000.0;
const S_IVB_ISP_S: f64 = 421.0;
const IU_SLA_KG: f64 = 1_980.0 + 1_836.0;
const LES_KG: f64 = 4_173.0;
const LES_JETTISON_S: f64 = 197.9;
const APOLLO_11_SPACECRAFT_KG: f64 = 43_904.0;
/// Staging coasts (separation to next ignition) and the interstage drop after S-II ignition, s.
const S_IC_S_II_COAST_S: f64 = 1.4;
const S_II_S_IVB_COAST_S: f64 = 1.0;
const INTERSTAGE_DROP_AFTER_S: f64 = 30.0;

/// S-IC pitch program (the engine's calibrated open-loop program): vertical for 12 s, then
/// pitch from vertical as 58° · ((t − 12)/149.1)^1.1.
fn s_ic_pitch_deg(t: f64) -> f64 {
    if t <= 12.0 {
        90.0
    } else {
        90.0 - 58.0 * ((t - 12.0) / 149.1).powf(1.10)
    }
}

fn drag_coefficient(mach: f64) -> f64 {
    if mach < 0.8 {
        0.15
    } else if mach <= 1.2 {
        0.20
    } else {
        0.16
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AscentProfileRequest {
    #[serde(default = "default_orbit_km")]
    pub parking_orbit_km: f64,
    #[serde(default = "default_spacecraft_kg")]
    pub payload_mass_kg: f64,
    #[serde(default = "default_latitude")]
    pub launch_latitude_deg: f64,
    #[serde(default = "default_azimuth")]
    pub launch_azimuth_deg: f64,
}

fn default_orbit_km() -> f64 {
    185.0
}
fn default_spacecraft_kg() -> f64 {
    APOLLO_11_SPACECRAFT_KG
}
fn default_latitude() -> f64 {
    28.6084
}
fn default_azimuth() -> f64 {
    72.058
}

impl Default for AscentProfileRequest {
    fn default() -> Self {
        Self {
            parking_orbit_km: default_orbit_km(),
            payload_mass_kg: default_spacecraft_kg(),
            launch_latitude_deg: default_latitude(),
            launch_azimuth_deg: default_azimuth(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AscentSample {
    pub met_s: f64,
    pub altitude_km: f64,
    pub inertial_velocity_mps: f64,
    pub relative_velocity_mps: f64,
    pub vertical_velocity_mps: f64,
    /// Non-gravitational acceleration the crew feels, in g.
    pub sensed_accel_g: f64,
    pub dynamic_pressure_kpa: f64,
    pub mach: f64,
    pub mass_kg: f64,
    pub pitch_deg: f64,
    /// 1 = S-IC, 2 = S-II, 3 = S-IVB, 0 = staging coast.
    pub stage: u8,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct AscentEvents {
    pub tower_clear_s: Option<f64>,
    pub mach1_s: Option<f64>,
    pub max_q_s: f64,
    pub max_q_kpa: f64,
    pub s_ic_ceco_s: Option<f64>,
    pub s_ic_oeco_s: Option<f64>,
    pub s_ii_ignition_s: Option<f64>,
    pub interstage_jettison_s: Option<f64>,
    pub les_jettison_s: Option<f64>,
    pub space_100km_s: Option<f64>,
    pub s_ii_ceco_s: Option<f64>,
    pub s_ii_cutoff_s: Option<f64>,
    pub s_ivb_ignition_s: Option<f64>,
    pub insertion_s: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AscentProfile {
    pub glom_kg: f64,
    pub liftoff_twr: f64,
    pub reached_orbit: bool,
    pub insertion_altitude_km: f64,
    pub insertion_velocity_mps: f64,
    pub s_ivb_propellant_remaining_kg: f64,
    pub events: AscentEvents,
    /// One sample per mission second, plus the insertion instant.
    pub samples: Vec<AscentSample>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// Burn time for the remaining upper stages to reach circular velocity (rocket equation).
fn ascent_time_to_go(
    stage: u8,
    t: f64,
    s_ii_ignition: f64,
    m: f64,
    s_ii_prop: f64,
    v_needed: f64,
) -> f64 {
    let mut dv = v_needed.max(0.0);
    let mut tt = 0.0;
    let mut mm = m;
    if stage == 2 {
        let md = S_II_THRUST_VAC_N / (S_II_ISP_S * G0);
        let t_left = (s_ii_ignition + S_II_BURN_S - t).max(0.0);
        let p = s_ii_prop.min(md * t_left);
        let dv2 = S_II_ISP_S * G0 * (mm / (mm - p)).ln();
        if dv2 >= dv {
            return tt + (mm - mm / (dv / (S_II_ISP_S * G0)).exp()) / md;
        }
        dv -= dv2;
        tt += p / md;
        mm -= p + S_II_DRY_KG;
    }
    let md3 = S_IVB_THRUST_VAC_N / (S_IVB_ISP_S * G0);
    tt + (mm - mm / (dv / (S_IVB_ISP_S * G0)).exp()) / md3
}

pub fn simulate_ascent(req: &AscentProfileRequest) -> AscentProfile {
    let dt = 0.02;
    let sample_every = 50_usize; // one sample per second
    let h_target = req.parking_orbit_km * 1000.0;
    // The catalogue's GLOM includes propellant and hardware the stage list does not itemise
    // (unusable residuals, ullage, hold-down burn): carried by the S-IC and dropped with it.
    let itemised = S_IC_DRY_KG
        + S_IC_PROP_KG
        + S_II_DRY_KG
        + S_II_INTERSTAGE_KG
        + S_II_PROP_KG
        + S_IVB_DRY_KG
        + S_IVB_PROP_KG
        + IU_SLA_KG
        + APOLLO_11_SPACECRAFT_KG
        + LES_KG;
    let non_usable = APOLLO_11_GLOM_KG - itemised;
    let mut m = itemised - APOLLO_11_SPACECRAFT_KG + req.payload_mass_kg.max(0.0) + non_usable;
    let glom = m;

    let lat = req.launch_latitude_deg.to_radians();
    let az = req.launch_azimuth_deg.to_radians();
    let mut r = EARTH_RADIUS_M;
    let mut vr = 0.0_f64;
    let mut vt = EARTH_EQUATORIAL_SPEED_MPS * lat.cos() * az.sin();
    let omega = vt / EARTH_RADIUS_M;
    let exit_area = (S_IC_THRUST_VAC_N - S_IC_THRUST_SL_N) / SEA_LEVEL_PRESSURE_PA;

    let mut stage: u8 = 1;
    let mut coast_until = 0.0;
    let mut next_stage: u8 = 2;
    let (mut p1, mut p2, mut p3) = (S_IC_PROP_KG, S_II_PROP_KG, S_IVB_PROP_KG);
    let (mut les_on, mut interstage_on) = (true, true);
    let mut last_pitch = 90.0;
    let mut ev = AscentEvents::default();
    let mut samples = Vec::with_capacity(800);
    let mut reached = false;

    let mut step: usize = 0;
    loop {
        let t = step as f64 * dt;
        if t > 1_000.0 {
            break;
        }
        let h = r - EARTH_RADIUS_M;
        let rho = SEA_LEVEL_DENSITY * (-h.max(0.0) / SCALE_HEIGHT_M).exp();
        let p_amb = SEA_LEVEL_PRESSURE_PA * (-h.max(0.0) / SCALE_HEIGHT_M).exp();
        let vrel_t = vt - omega * r;
        let v_rel = vr.hypot(vrel_t);
        let q = 0.5 * rho * v_rel * v_rel;
        let mach = v_rel / SPEED_OF_SOUND_MPS;
        let drag = q * drag_coefficient(mach) * S_IC_REFERENCE_AREA_M2;
        if q > ev.max_q_kpa * 1000.0 {
            ev.max_q_kpa = q / 1000.0;
            ev.max_q_s = t;
        }
        if ev.mach1_s.is_none() && mach >= 1.0 {
            ev.mach1_s = Some(t);
        }
        if ev.space_100km_s.is_none() && h >= 100_000.0 {
            ev.space_100km_s = Some(t);
        }
        if ev.tower_clear_s.is_none() && h >= TOWER_HEIGHT_M {
            ev.tower_clear_s = Some(t);
        }
        let g = MU_EARTH / (r * r);

        let mut thrust = 0.0;
        let mut mdot = 0.0;
        let mut pitch = last_pitch;
        if stage == 1 {
            let f = if t < S_IC_CECO_S { 1.0 } else { 0.8 };
            if ev.s_ic_ceco_s.is_none() && t >= S_IC_CECO_S {
                ev.s_ic_ceco_s = Some(t);
            }
            if t >= S_IC_OECO_S || p1 <= 0.0 {
                ev.s_ic_oeco_s = Some(t);
                m -= S_IC_DRY_KG + non_usable + p1.max(0.0);
                p1 = 0.0;
                stage = 0;
                next_stage = 2;
                coast_until = t + S_IC_S_II_COAST_S;
            } else {
                thrust = (S_IC_THRUST_VAC_N - p_amb * exit_area) * f;
                mdot = S_IC_THRUST_VAC_N * f / (S_IC_ISP_VAC_S * G0);
                pitch = s_ic_pitch_deg(t);
            }
        } else if stage == 0 && t >= coast_until - 1e-9 {
            stage = next_stage;
            if stage == 2 {
                ev.s_ii_ignition_s = Some(t);
            } else {
                ev.s_ivb_ignition_s = Some(t);
            }
        }
        if stage == 2 || stage == 3 {
            let (f, isp) = if stage == 2 {
                if ev.s_ii_ceco_s.is_none() && t >= S_II_CECO_MET_S {
                    ev.s_ii_ceco_s = Some(t);
                }
                (S_II_THRUST_VAC_N * if t >= S_II_CECO_MET_S { 0.8 } else { 1.0 }, S_II_ISP_S)
            } else {
                (S_IVB_THRUST_VAC_N, S_IVB_ISP_S)
            };
            thrust = f;
            mdot = f / (isp * G0);
            let a = thrust / m;
            let v_circ = (MU_EARTH / r).sqrt();
            let tgo = ascent_time_to_go(stage, t, ev.s_ii_ignition_s.unwrap_or(t), m, p2, v_circ - vt).max(2.0);
            let a_cmd = 6.0 * (h_target - h) / (tgo * tgo) - 4.0 * vr / tgo;
            let s = ((a_cmd + g - vt * vt / r) / a).clamp(-0.6, 0.9);
            pitch = s.asin().to_degrees();
        }
        if stage == 2 && interstage_on && t >= ev.s_ii_ignition_s.unwrap_or(f64::INFINITY) + INTERSTAGE_DROP_AFTER_S {
            m -= S_II_INTERSTAGE_KG;
            interstage_on = false;
            ev.interstage_jettison_s = Some(t);
        }
        if les_on && t >= LES_JETTISON_S {
            m -= LES_KG;
            les_on = false;
            ev.les_jettison_s = Some(t);
        }
        last_pitch = pitch;
        let pr = pitch.to_radians();
        let (dr, dtn) = if v_rel > 0.0 { (-drag * vr / v_rel, -drag * vrel_t / v_rel) } else { (0.0, 0.0) };
        let fr = thrust * pr.sin() + dr;
        let ft = thrust * pr.cos() + dtn;
        let ar = fr / m - g + vt * vt / r;
        let at = ft / m - vr * vt / r;
        if step % sample_every == 0 {
            samples.push(AscentSample {
                met_s: t,
                altitude_km: h / 1000.0,
                inertial_velocity_mps: vr.hypot(vt),
                relative_velocity_mps: v_rel,
                vertical_velocity_mps: vr,
                sensed_accel_g: fr.hypot(ft) / m / G0,
                dynamic_pressure_kpa: q / 1000.0,
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
        match stage {
            1 => p1 -= mdot * dt,
            2 => {
                p2 -= mdot * dt;
                let ign = ev.s_ii_ignition_s.unwrap_or(t);
                if p2 <= 0.0 || t + dt >= ign + S_II_BURN_S {
                    ev.s_ii_cutoff_s = Some(t + dt);
                    m -= S_II_DRY_KG + p2.max(0.0);
                    p2 = 0.0;
                    stage = 0;
                    next_stage = 3;
                    coast_until = t + dt + S_II_S_IVB_COAST_S;
                }
            }
            3 => {
                p3 -= mdot * dt;
                if vt >= (MU_EARTH / r).sqrt() {
                    let met = t + dt;
                    ev.insertion_s = Some(met);
                    reached = true;
                    samples.push(AscentSample {
                        met_s: met,
                        altitude_km: (r - EARTH_RADIUS_M) / 1000.0,
                        inertial_velocity_mps: vr.hypot(vt),
                        relative_velocity_mps: vr.hypot(vt - omega * r),
                        vertical_velocity_mps: vr,
                        sensed_accel_g: 0.0,
                        dynamic_pressure_kpa: 0.0,
                        mach: 0.0,
                        mass_kg: m,
                        pitch_deg: 0.0,
                        stage: 3,
                    });
                    break;
                }
                if p3 <= 0.0 {
                    break;
                }
            }
            _ => {}
        }
        step += 1;
    }

    let last = samples.last().cloned();
    AscentProfile {
        glom_kg: glom,
        liftoff_twr: S_IC_THRUST_SL_N / (glom * G0),
        reached_orbit: reached,
        insertion_altitude_km: last.as_ref().map(|s| s.altitude_km).unwrap_or(0.0),
        insertion_velocity_mps: last.as_ref().map(|s| s.inertial_velocity_mps).unwrap_or(0.0),
        s_ivb_propellant_remaining_kg: p3.max(0.0),
        events: ev,
        samples,
        error_message: if reached { None } else { Some("Parking orbit not reached".to_string()) },
    }
}

/* ------------------------------------------------------------------ powered descent */

const MOON_RADIUS_M: f64 = 1_737_400.0;
const DPS_MAX_THRUST_N: f64 = 45_040.0;
const DPS_ISP_S: f64 = 311.0;
const DPS_THROTTLE_MIN: f64 = 0.10;
const DPS_THROTTLE_MAX_VARIABLE: f64 = 0.60;
const DPS_FTP_MIN: f64 = 0.925;
const DPS_ULLAGE_S: f64 = 26.0;
/// LM-5 Eagle at launch and its usable DPS propellant (§2.4, NASA SP-4029).
const LM_5_MASS_KG: f64 = 15_103.0;
const DPS_PROPELLANT_KG: f64 = 8_200.0;
const DOI_DELTA_V_MPS: f64 = 21.8;
const PDI_ALTITUDE_M: f64 = 15_240.0;
const PDI_HORIZONTAL_MPS: f64 = 1_695.0;
/// §4.3 gates: high gate (7,400 ft on Apollo 11), low gate (500 ft).
const HIGH_GATE_ALT_M: f64 = 2_255.5;
const HIGH_GATE_VX_MPS: f64 = 152.4;
const HIGH_GATE_VZ_MPS: f64 = -38.1;
const LOW_GATE_ALT_M: f64 = 152.4;
const LOW_GATE_VX_MPS: f64 = 18.3;
/// Mid-point of the catalogue's −4.6 to −5.8 m/s.
const LOW_GATE_VZ_MPS: f64 = -5.2;
/// Braking phase duration (§4.3, ~510 s).
const BRAKING_PHASE_S: f64 = 510.0;
/// Landing-radar lock altitude (§4.3).
const LANDING_RADAR_LOCK_M: f64 = 12_200.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DescentProfileRequest {
    /// Local lunar gravity; defaults to the engine's lunar constants (mascon included).
    #[serde(default)]
    pub local_gravity_mps2: Option<f64>,
    #[serde(default = "default_lm_mass")]
    pub lm_mass_kg: f64,
    #[serde(default = "default_dps_prop")]
    pub dps_propellant_kg: f64,
}

fn default_lm_mass() -> f64 {
    LM_5_MASS_KG
}
fn default_dps_prop() -> f64 {
    DPS_PROPELLANT_KG
}

impl Default for DescentProfileRequest {
    fn default() -> Self {
        Self { local_gravity_mps2: None, lm_mass_kg: LM_5_MASS_KG, dps_propellant_kg: DPS_PROPELLANT_KG }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DescentSample {
    pub t_s: f64,
    pub altitude_m: f64,
    pub horizontal_velocity_mps: f64,
    pub vertical_velocity_mps: f64,
    /// Fraction of the 45.04 kN rated thrust.
    pub throttle: f64,
    pub propellant_kg: f64,
    pub mass_kg: f64,
    /// LM attitude: thrust axis tilt from local vertical, degrees (braking ≈ 65–80°, landing ≈ 0°).
    pub attitude_from_vertical_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DescentGateState {
    pub t_s: f64,
    pub altitude_m: f64,
    pub horizontal_velocity_mps: f64,
    pub vertical_velocity_mps: f64,
    pub mass_kg: f64,
    pub propellant_kg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DescentProfile {
    pub local_gravity_mps2: f64,
    pub dps_max_thrust_n: f64,
    pub dps_isp_s: f64,
    pub dps_propellant_capacity_kg: f64,
    pub doi_propellant_kg: f64,
    pub throttle_down_s: Option<f64>,
    pub radar_lock_s: Option<f64>,
    pub high_gate: DescentGateState,
    pub low_gate: DescentGateState,
    /// Throttle that holds the LM level at the low gate.
    pub hover_throttle_at_low_gate: f64,
    /// One sample per second from PDI to the low gate.
    pub samples: Vec<DescentSample>,
}

pub fn simulate_powered_descent(req: &DescentProfileRequest) -> DescentProfile {
    let dt = 0.02;
    let sample_every = 50_usize;
    let g_local = req.local_gravity_mps2.unwrap_or_else(|| get_lunar_environment_constants().local_gravity_effective_mps2);
    let mu = g_local * MOON_RADIUS_M * MOON_RADIUS_M;
    let doi_prop = req.lm_mass_kg * (1.0 - (-DOI_DELTA_V_MPS / (DPS_ISP_S * G0)).exp());
    let mut m = req.lm_mass_kg - doi_prop;
    let mut prop = req.dps_propellant_kg - doi_prop;
    let mut r = MOON_RADIUS_M + PDI_ALTITUDE_M;
    let mut vr = 0.0_f64;
    let mut vt = PDI_HORIZONTAL_MPS;
    // Approach phase lasts as long as a constant deceleration between the two gate states takes.
    let t_low = BRAKING_PHASE_S
        + 2.0 * (HIGH_GATE_ALT_M - LOW_GATE_ALT_M) / (HIGH_GATE_VZ_MPS.abs() + LOW_GATE_VZ_MPS.abs());
    let mut samples = Vec::with_capacity(700);
    let mut throttle_down = None;
    let mut radar_lock = None;
    let mut high_gate = None;
    let mut step: usize = 0;
    loop {
        let t = step as f64 * dt;
        if t >= t_low - 1e-9 {
            break;
        }
        let h = r - MOON_RADIUS_M;
        let g = mu / (r * r);
        let braking = t < BRAKING_PHASE_S;
        let (h_t, vx_t, vz_t, t_end) = if braking {
            (HIGH_GATE_ALT_M, HIGH_GATE_VX_MPS, HIGH_GATE_VZ_MPS, BRAKING_PHASE_S)
        } else {
            (LOW_GATE_ALT_M, LOW_GATE_VX_MPS, LOW_GATE_VZ_MPS, t_low)
        };
        let tgo = (t_end - t).max(dt * 5.0);
        let a_r = 6.0 * (h_t - h) / (tgo * tgo) - (4.0 * vr + 2.0 * vz_t) / tgo;
        // Braking: null the forward-speed error over the phase. Approach: a linearly falling
        // deceleration (a = 2Δv/t_go) that reaches zero at the low gate, so the LM arrives upright.
        let a_t = if braking { (vx_t - vt) / tgo } else { 2.0 * (vx_t - vt) / tgo };
        let mut tr = m * (a_r + g - vt * vt / r);
        let mut tt = m * (a_t + vr * vt / r);
        let demand_n = tr.hypot(tt);
        let demand = demand_n / DPS_MAX_THRUST_N;
        let throttle = if t < DPS_ULLAGE_S {
            DPS_THROTTLE_MIN
        } else if demand > DPS_THROTTLE_MAX_VARIABLE {
            demand.clamp(DPS_FTP_MIN, 1.0)
        } else {
            if throttle_down.is_none() && t > 60.0 {
                throttle_down = Some(t);
            }
            demand.max(DPS_THROTTLE_MIN)
        };
        let scale = if demand_n > 0.0 { throttle * DPS_MAX_THRUST_N / demand_n } else { 0.0 };
        tr *= scale;
        tt *= scale;
        if radar_lock.is_none() && h <= LANDING_RADAR_LOCK_M {
            radar_lock = Some(t);
        }
        if high_gate.is_none() && !braking {
            high_gate = Some(DescentGateState {
                t_s: t,
                altitude_m: h,
                horizontal_velocity_mps: vt,
                vertical_velocity_mps: vr,
                mass_kg: m,
                propellant_kg: prop,
            });
        }
        if step % sample_every == 0 {
            samples.push(DescentSample {
                t_s: t,
                altitude_m: h,
                horizontal_velocity_mps: vt,
                vertical_velocity_mps: vr,
                throttle,
                propellant_kg: prop,
                mass_kg: m,
                attitude_from_vertical_deg: (-tt).atan2(tr).to_degrees(),
            });
        }
        let mdot = throttle * DPS_MAX_THRUST_N / (DPS_ISP_S * G0);
        let ar = tr / m - g + vt * vt / r;
        let at = tt / m - vr * vt / r;
        vr += ar * dt;
        vt += at * dt;
        r += vr * dt;
        m -= mdot * dt;
        prop -= mdot * dt;
        step += 1;
    }
    let low_gate = DescentGateState {
        t_s: step as f64 * dt,
        altitude_m: r - MOON_RADIUS_M,
        horizontal_velocity_mps: vt,
        vertical_velocity_mps: vr,
        mass_kg: m,
        propellant_kg: prop,
    };
    samples.push(DescentSample {
        t_s: low_gate.t_s,
        altitude_m: low_gate.altitude_m,
        horizontal_velocity_mps: vt,
        vertical_velocity_mps: vr,
        throttle: g_local * m / DPS_MAX_THRUST_N,
        propellant_kg: prop,
        mass_kg: m,
        attitude_from_vertical_deg: 0.0,
    });
    DescentProfile {
        local_gravity_mps2: g_local,
        dps_max_thrust_n: DPS_MAX_THRUST_N,
        dps_isp_s: DPS_ISP_S,
        dps_propellant_capacity_kg: req.dps_propellant_kg,
        doi_propellant_kg: doi_prop,
        throttle_down_s: throttle_down,
        radar_lock_s: radar_lock,
        high_gate: high_gate.unwrap_or_else(|| low_gate.clone()),
        hover_throttle_at_low_gate: g_local * low_gate.mass_kg / DPS_MAX_THRUST_N,
        low_gate,
        samples,
    }
}
