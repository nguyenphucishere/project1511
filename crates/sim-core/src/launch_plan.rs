//! Launch planning for the mission-control console: which vehicle, payload, propellant load,
//! parking orbit and launch-day weather, and whether that combination reaches its target.
//!
//! The vehicle model is the ideal rocket equation stage by stage, with gravity and drag losses
//! folded into the Δv requirement (9.2 km/s to a 185 km parking orbit, +3.05 km/s for TLI, the
//! same budget the server validator uses). Weather is judged against launch commit criteria
//! calibrated for the game from Apollo-era ground-wind and lightning rules.

use crate::launch::{simulate_ascent_max_q, S_IC_THRUST_SL_N};
use crate::STANDARD_GRAVITY;
use serde::{Deserialize, Serialize};

/// Δv to a 185 km parking orbit, including ~1.4 km/s of gravity and drag losses (m/s).
pub const DELTA_V_LEO_185_MPS: f64 = 9_200.0;
/// Additional Δv for translunar injection from the parking orbit (m/s).
pub const DELTA_V_TLI_MPS: f64 = 3_051.0;
/// Ascent Δv per km of parking-orbit altitude above / below 185 km (m/s per km).
pub const DELTA_V_PER_ORBIT_KM: f64 = 1.0;
/// TLI Δv saved per km of higher parking orbit (m/s per km).
pub const TLI_SAVING_PER_ORBIT_KM: f64 = 0.35;
/// Game timeline: mission seconds at which a nominal flight reaches orbit.
pub const NOMINAL_ORBIT_INSERTION_S: f64 = 540.0;
/// Apollo 11 spacecraft at TLI: CSM-107 (28,801 kg) + LM-5 (15,103 kg).
pub const APOLLO_11_STACK_KG: f64 = 43_904.0;

/// Launch commit criteria (ground weather and vehicle limits) applied to every launch.
pub const IDEAL_WIND_KMH: f64 = 20.0;
pub const MAX_SUSTAINED_WIND_KMH: f64 = 40.0;
pub const MAX_PEAK_GUST_KMH: f64 = 55.0;
pub const MIN_LIFTOFF_TWR: f64 = 1.05;
pub const MAX_Q_LIMIT_KPA: f64 = 45.0;
/// Apollo 12 was struck by lightning at T+36.5 s; a launch into a thunderstorm fails there.
pub const LIGHTNING_STRIKE_TIME_S: f64 = 36.5;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StageSpec {
    #[serde(default)]
    pub stage_name: Option<String>,
    pub dry_mass_kg: f64,
    pub propellant_mass_kg: f64,
    /// Effective specific impulse over the burn (s).
    pub isp_s: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VehicleSpec {
    pub id: String,
    pub name: String,
    /// First-stage sea-level thrust (N).
    pub thrust_sl_n: f64,
    /// Stages in firing order (first stage first).
    pub stages: Vec<StageSpec>,
}

fn stage(name: &str, dry: f64, prop: f64, isp: f64) -> StageSpec {
    StageSpec { stage_name: Some(name.to_string()), dry_mass_kg: dry, propellant_mass_kg: prop, isp_s: isp }
}

/// The three vehicles on the console. Saturn IB and Saturn V use flown stage masses; the
/// uprated Saturn V is the MLV-V-4(S) study (F-1A / J-2S, stretched tanks) and is approximate.
pub fn launch_vehicle_presets() -> Vec<VehicleSpec> {
    vec![
        VehicleSpec {
            id: "saturn-ib".to_string(),
            name: "Saturn IB".to_string(),
            thrust_sl_n: 7_100_000.0,
            stages: vec![stage("S-IB", 42_000.0, 407_000.0, 272.0), stage("S-IVB-200", 13_500.0, 105_000.0, 421.0)],
        },
        VehicleSpec {
            id: "saturn-v".to_string(),
            name: "Saturn V AS-506".to_string(),
            thrust_sl_n: S_IC_THRUST_SL_N,
            stages: vec![
                stage("S-IC", 130_860.0, 2_077_000.0, 280.0),
                stage("S-II", 39_870.0, 443_200.0, 421.0),
                stage("S-IVB", 15_116.0, 106_900.0, 421.0),
            ],
        },
        VehicleSpec {
            id: "saturn-v-uprated".to_string(),
            name: "Saturn V MLV-V-4(S)".to_string(),
            thrust_sl_n: 40_000_000.0,
            stages: vec![
                stage("S-IC (F-1A, stretched)", 150_000.0, 2_450_000.0, 285.0),
                stage("S-II (J-2S)", 42_000.0, 500_000.0, 436.0),
                stage("S-IVB (J-2S)", 16_000.0, 125_000.0, 436.0),
            ],
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchPlanRequest {
    /// Preset id ("saturn-ib", "saturn-v", "saturn-v-uprated"); ignored when `vehicle` is given.
    #[serde(default)]
    pub vehicle_id: Option<String>,
    #[serde(default)]
    pub vehicle: Option<VehicleSpec>,
    #[serde(default = "default_payload")]
    pub payload_mass_kg: f64,
    #[serde(default = "default_load")]
    pub propellant_load_pct: f64,
    #[serde(default = "default_orbit")]
    pub parking_orbit_km: f64,
    /// "TLI" (default) or "LEO".
    #[serde(default)]
    pub destination: Option<String>,
    #[serde(default)]
    pub wind_speed_kmh: f64,
    #[serde(default)]
    pub wind_gust_kmh: Option<f64>,
    #[serde(default)]
    pub thunderstorm: bool,
}

fn default_payload() -> f64 {
    APOLLO_11_STACK_KG
}
fn default_load() -> f64 {
    100.0
}
fn default_orbit() -> f64 {
    185.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LaunchCommitCriteria {
    pub ideal_wind_kmh: f64,
    pub max_sustained_wind_kmh: f64,
    pub max_peak_gust_kmh: f64,
    pub thunderstorms_allowed: bool,
    pub min_liftoff_twr: f64,
    pub max_q_limit_kpa: f64,
}

pub fn launch_commit_criteria() -> LaunchCommitCriteria {
    LaunchCommitCriteria {
        ideal_wind_kmh: IDEAL_WIND_KMH,
        max_sustained_wind_kmh: MAX_SUSTAINED_WIND_KMH,
        max_peak_gust_kmh: MAX_PEAK_GUST_KMH,
        thunderstorms_allowed: false,
        min_liftoff_twr: MIN_LIFTOFF_TWR,
        max_q_limit_kpa: MAX_Q_LIMIT_KPA,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchPlanResponse {
    pub vehicle_id: String,
    pub glom_kg: f64,
    pub liftoff_twr: f64,
    pub max_q_kpa: f64,
    pub max_q_time_s: f64,
    pub delta_v_available_mps: f64,
    pub delta_v_required_mps: f64,
    pub delta_v_margin_mps: f64,
    /// Heaviest payload this vehicle can deliver with a full propellant load (kg).
    pub payload_capacity_kg: f64,
    /// Smallest propellant load (%) that delivers this payload; None when 100 % is not enough.
    pub min_propellant_load_pct: Option<f64>,
    pub is_go: bool,
    /// "lightning_strike", "wind_shear", "no_liftoff", "max_q_breakup", "over_capacity", "propellant_depletion".
    pub failure_mode: Option<String>,
    pub failure_time_s: Option<f64>,
    pub failure_reason: Option<String>,
    pub criteria: LaunchCommitCriteria,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// Total ideal Δv of the stack with `payload_kg` on top and each stage loaded to `load_pct`.
pub fn stack_delta_v(vehicle: &VehicleSpec, payload_kg: f64, load_pct: f64) -> f64 {
    let load = (load_pct / 100.0).clamp(0.0, 1.0);
    let mut above = payload_kg.max(0.0);
    let mut total = 0.0;
    for s in vehicle.stages.iter().rev() {
        let mf = above + s.dry_mass_kg.max(0.0);
        let m0 = mf + s.propellant_mass_kg.max(0.0) * load;
        if mf > 0.0 && s.isp_s > 0.0 {
            total += s.isp_s * STANDARD_GRAVITY * (m0 / mf).ln();
        }
        above = m0;
    }
    total
}

/// Δv the target needs from the pad, for a parking orbit at `orbit_km`.
pub fn delta_v_required(orbit_km: f64, destination_tli: bool) -> f64 {
    let dh = orbit_km - 185.0;
    let leo = DELTA_V_LEO_185_MPS + DELTA_V_PER_ORBIT_KM * dh;
    if destination_tli {
        leo + DELTA_V_TLI_MPS - TLI_SAVING_PER_ORBIT_KM * dh
    } else {
        leo
    }
}

/// Mass on the pad: stages (with their propellant load) plus payload.
pub fn stack_glom(vehicle: &VehicleSpec, payload_kg: f64, load_pct: f64) -> f64 {
    let load = (load_pct / 100.0).clamp(0.0, 1.0);
    vehicle.stages.iter().map(|s| s.dry_mass_kg + s.propellant_mass_kg * load).sum::<f64>() + payload_kg.max(0.0)
}

/// Heaviest payload deliverable at a full load (bisection; Δv falls monotonically with payload).
pub fn payload_capacity(vehicle: &VehicleSpec, required: f64) -> f64 {
    if stack_delta_v(vehicle, 0.0, 100.0) < required {
        return 0.0;
    }
    let (mut lo, mut hi) = (0.0, 500_000.0);
    for _ in 0..60 {
        let mid = 0.5 * (lo + hi);
        if stack_delta_v(vehicle, mid, 100.0) >= required {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    lo
}

/// Smallest propellant load (%) that delivers `payload_kg`, rounded up to 0.1 %.
pub fn min_propellant_load(vehicle: &VehicleSpec, payload_kg: f64, required: f64) -> Option<f64> {
    if stack_delta_v(vehicle, payload_kg, 100.0) < required {
        return None;
    }
    let (mut lo, mut hi) = (0.0, 100.0);
    for _ in 0..60 {
        let mid = 0.5 * (lo + hi);
        if stack_delta_v(vehicle, payload_kg, mid) >= required {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    Some(((hi * 10.0).ceil() / 10.0).min(100.0))
}

pub fn resolve_vehicle(req: &LaunchPlanRequest) -> Option<VehicleSpec> {
    if let Some(v) = &req.vehicle {
        return Some(v.clone());
    }
    let id = req.vehicle_id.as_deref().unwrap_or("saturn-v");
    launch_vehicle_presets().into_iter().find(|v| v.id == id)
}

pub fn plan_launch(req: &LaunchPlanRequest) -> LaunchPlanResponse {
    let criteria = launch_commit_criteria();
    let Some(vehicle) = resolve_vehicle(req) else {
        let msg = format!("Unknown vehicle_id {:?}", req.vehicle_id);
        return LaunchPlanResponse {
            vehicle_id: req.vehicle_id.clone().unwrap_or_default(),
            glom_kg: 0.0,
            liftoff_twr: 0.0,
            max_q_kpa: 0.0,
            max_q_time_s: 0.0,
            delta_v_available_mps: 0.0,
            delta_v_required_mps: 0.0,
            delta_v_margin_mps: 0.0,
            payload_capacity_kg: 0.0,
            min_propellant_load_pct: None,
            is_go: false,
            failure_mode: None,
            failure_time_s: None,
            failure_reason: Some(msg.clone()),
            criteria,
            error_message: Some(msg),
        };
    };

    let tli = !matches!(req.destination.as_deref(), Some(d) if d.eq_ignore_ascii_case("LEO"));
    let payload = req.payload_mass_kg.max(0.0);
    let load = req.propellant_load_pct.clamp(0.0, 100.0);
    let required = delta_v_required(req.parking_orbit_km, tli);
    let available = stack_delta_v(&vehicle, payload, load);
    let glom = stack_glom(&vehicle, payload, load);
    let twr = if glom > 0.0 { vehicle.thrust_sl_n / (glom * STANDARD_GRAVITY) } else { 0.0 };
    // The max-Q integrator is calibrated on the Saturn V S-IC; other vehicles fly it at the
    // same thrust-to-weight ratio.
    let equivalent_glom = glom * (S_IC_THRUST_SL_N / vehicle.thrust_sl_n.max(1.0));
    let (max_q_kpa, max_q_time_s) = simulate_ascent_max_q(equivalent_glom, req.wind_speed_kmh.max(0.0));
    let capacity = payload_capacity(&vehicle, required);
    let min_load = min_propellant_load(&vehicle, payload, required);
    let gust = req.wind_gust_kmh.unwrap_or(req.wind_speed_kmh).max(req.wind_speed_kmh);

    let (mode, time, reason): (Option<&str>, Option<f64>, Option<String>) = if req.thunderstorm {
        (
            Some("lightning_strike"),
            Some(LIGHTNING_STRIKE_TIME_S),
            Some("Launched into a thunderstorm: the exhaust plume triggered a lightning strike".to_string()),
        )
    } else if req.wind_speed_kmh > MAX_SUSTAINED_WIND_KMH || gust > MAX_PEAK_GUST_KMH {
        (
            Some("wind_shear"),
            Some(max_q_time_s),
            Some(format!(
                "Wind {:.0} km/h (gusts {:.0} km/h) beyond the launch limit ({:.0} / {:.0} km/h): structural shear at Max-Q",
                req.wind_speed_kmh, gust, MAX_SUSTAINED_WIND_KMH, MAX_PEAK_GUST_KMH
            )),
        )
    } else if twr < MIN_LIFTOFF_TWR {
        (
            Some("no_liftoff"),
            Some(8.0),
            Some(format!("Liftoff TWR {:.3} below {:.2}: the vehicle barely clears the tower", twr, MIN_LIFTOFF_TWR)),
        )
    } else if max_q_kpa > MAX_Q_LIMIT_KPA {
        (
            Some("max_q_breakup"),
            Some(max_q_time_s),
            Some(format!("Max-Q {:.1} kPa exceeds the {:.0} kPa structural limit", max_q_kpa, MAX_Q_LIMIT_KPA)),
        )
    } else if payload > capacity {
        (
            Some("over_capacity"),
            Some(NOMINAL_ORBIT_INSERTION_S * (available / required).clamp(0.6, 1.0) - 10.0),
            Some(format!("Payload {:.0} kg exceeds the {:.0} kg this vehicle can deliver", payload, capacity)),
        )
    } else if available < required {
        (
            Some("propellant_depletion"),
            Some(NOMINAL_ORBIT_INSERTION_S * (available / required).clamp(0.6, 1.0) - 10.0),
            Some(format!(
                "Propellant depleted: {:.0} m/s available of {:.0} m/s required",
                available, required
            )),
        )
    } else {
        (None, None, None)
    };

    LaunchPlanResponse {
        vehicle_id: vehicle.id.clone(),
        glom_kg: glom,
        liftoff_twr: twr,
        max_q_kpa,
        max_q_time_s,
        delta_v_available_mps: available,
        delta_v_required_mps: required,
        delta_v_margin_mps: available - required,
        payload_capacity_kg: capacity,
        min_propellant_load_pct: min_load,
        is_go: mode.is_none(),
        failure_mode: mode.map(str::to_string),
        failure_time_s: time,
        failure_reason: reason,
        criteria,
        error_message: None,
    }
}
