use serde::{Deserialize, Serialize};

/// Lunar surface gravity (m/s^2)
pub const LUNAR_GRAVITY: f64 = 1.622;
/// LMDE maximum thrust (N)
pub const LMDE_MAX_THRUST_N: f64 = 45_040.0;
/// LMDE specific impulse (s)
pub const LMDE_ISP_S: f64 = 311.0;
pub use crate::launch::STANDARD_GRAVITY;

/// LM descent stage dry mass (kg)
pub const LM_DESCENT_DRY_MASS_KG: f64 = 2_134.0;
/// LM ascent stage mass (kg)
pub const LM_ASCENT_STAGE_MASS_KG: f64 = 4_548.0;
/// LM total dry mass (kg)
pub const LM_TOTAL_DRY_MASS_KG: f64 = LM_DESCENT_DRY_MASS_KG + LM_ASCENT_STAGE_MASS_KG;

/// Fuel low-level warning quantity light threshold (5.0% usable propellant ~ 255 kg)
pub const LOW_LEVEL_FUEL_WARNING_KG: f64 = 255.0;
/// Bingo fuel reserve threshold (25.0s hover fuel ~ 112.0 kg)
pub const BINGO_FUEL_RESERVE_KG: f64 = 112.0;

/// Maximum allowable horizontal touchdown velocity (m/s)
pub const MAX_TOUCHDOWN_VX_MPS: f64 = 1.22;
/// Maximum allowable vertical touchdown velocity at zero horizontal velocity (m/s)
pub const MAX_TOUCHDOWN_VZ_ZERO_VX_MPS: f64 = 3.05;
/// Maximum allowable vertical touchdown velocity at max horizontal velocity (m/s)
pub const MAX_TOUCHDOWN_VZ_MAX_VX_MPS: f64 = 2.13;
/// Maximum allowable surface slope / vehicle tilt angle (degrees)
pub const MAX_TOUCHDOWN_TILT_DEG: f64 = 12.0;
/// Maximum allowable body angular rates at touchdown (degrees/second)
pub const MAX_TOUCHDOWN_ANGULAR_RATE_DEG_S: f64 = 2.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DescentState {
    pub altitude_m: f64,
    pub vertical_velocity_mps: f64,
    pub horizontal_velocity_mps: f64,
    pub throttle_pct: f64,
    pub propellant_remaining_kg: f64,
    pub agc_cpu_duty_pct: f64,
    pub is_bingo_fuel: bool,
    pub is_landed: bool,
    pub touchdown_status: String,
}

impl Default for DescentState {
    fn default() -> Self {
        Self {
            altitude_m: 15_240.0,
            vertical_velocity_mps: 0.0,
            horizontal_velocity_mps: 1_695.0,
            throttle_pct: 100.0,
            propellant_remaining_kg: 8_200.0,
            agc_cpu_duty_pct: 72.0,
            is_bingo_fuel: false,
            is_landed: false,
            touchdown_status: "IN_FLIGHT".to_string(),
        }
    }
}

/// Check if throttle is in prohibited cavitation band (60.1% to 92.4%)
pub fn is_in_prohibited_throttle_band(throttle_pct: f64) -> bool {
    throttle_pct > 60.05 && throttle_pct < 92.45
}

/// Sanitize or validate commanded throttle percentage
pub fn validate_throttle(throttle_pct: f64) -> Result<f64, String> {
    if throttle_pct < 0.0 || throttle_pct > 100.0 {
        return Err(format!("Throttle {:.1}% out of range [0, 100]", throttle_pct));
    }
    if is_in_prohibited_throttle_band(throttle_pct) {
        return Err(format!(
            "Throttle {:.1}% is in prohibited cavitation band [60.1%, 92.4%]: throat erosion risk",
            throttle_pct
        ));
    }
    Ok(throttle_pct)
}

/// Clamp throttle avoiding prohibited cavitation band
pub fn clamp_safe_throttle(throttle_pct: f64) -> f64 {
    let t = throttle_pct.clamp(0.0, 100.0);
    if is_in_prohibited_throttle_band(t) {
        if t < 76.25 {
            60.0
        } else {
            92.5
        }
    } else {
        t
    }
}

/// Calculate thrust in Newtons from throttle percentage
pub fn calculate_lmde_thrust_n(throttle_pct: f64) -> f64 {
    let safe_throttle = clamp_safe_throttle(throttle_pct);
    (safe_throttle / 100.0) * LMDE_MAX_THRUST_N
}

/// Calculate propellant mass flow rate (kg/s)
pub fn calculate_lmde_mass_flow_rate_kg_s(thrust_n: f64) -> f64 {
    thrust_n / (LMDE_ISP_S * STANDARD_GRAVITY)
}

/// Evaluate touchdown contact conditions against Apollo 11 structural envelope
pub fn evaluate_touchdown_limits(
    vx_mps: f64,
    vz_mps: f64,
    tilt_deg: f64,
    angular_rate_deg_s: f64,
) -> (bool, String) {
    let vx = vx_mps.abs();
    let vz = vz_mps.abs();

    if tilt_deg > MAX_TOUCHDOWN_TILT_DEG {
        return (false, "SurfaceSlopeExceeded".to_string());
    }
    if angular_rate_deg_s > MAX_TOUCHDOWN_ANGULAR_RATE_DEG_S {
        return (false, "AngularRateExceeded".to_string());
    }
    if vx > MAX_TOUCHDOWN_VX_MPS {
        return (false, "LateralTipOver".to_string());
    }
    if vz > MAX_TOUCHDOWN_VZ_ZERO_VX_MPS {
        return (false, "StructuralGearCollapse".to_string());
    }

    // Combined envelope: Vz_max = 3.05 - ((3.05 - 2.13) / 1.22) * Vx
    let max_allowed_vz = MAX_TOUCHDOWN_VZ_ZERO_VX_MPS
        - ((MAX_TOUCHDOWN_VZ_ZERO_VX_MPS - MAX_TOUCHDOWN_VZ_MAX_VX_MPS) / MAX_TOUCHDOWN_VX_MPS) * vx;

    if vz > max_allowed_vz {
        return (true, "RoughLanding".to_string());
    }

    (true, "Success".to_string())
}

/// Advance LM powered descent simulation by delta_t seconds (nominal 1.0s)
pub fn step_descent(state: &mut DescentState, delta_t_s: f64) {
    if state.is_landed {
        return;
    }

    let dt = delta_t_s.max(0.01);

    // 1. Check fuel status and Bingo fuel limit
    state.is_bingo_fuel = state.propellant_remaining_kg <= BINGO_FUEL_RESERVE_KG;

    let available_fuel = state.propellant_remaining_kg;
    let thrust_n = if available_fuel > 0.0 {
        calculate_lmde_thrust_n(state.throttle_pct)
    } else {
        0.0
    };

    // 2. Propellant consumption
    let mass_flow = calculate_lmde_mass_flow_rate_kg_s(thrust_n);
    let fuel_consumed = (mass_flow * dt).min(available_fuel);
    state.propellant_remaining_kg = (available_fuel - fuel_consumed).max(0.0);

    // 3. Acceleration calculation
    // During P63 orbital braking (high horizontal velocity > 200 m/s), the LM is pitched ~75 deg
    // from vertical so most thrust decelerates orbital velocity while altitude decreases smoothly.
    let vehicle_mass = LM_TOTAL_DRY_MASS_KG + state.propellant_remaining_kg;
    let vertical_thrust_factor = if state.horizontal_velocity_mps > 200.0 {
        0.25
    } else {
        1.0
    };
    let upward_accel = (thrust_n * vertical_thrust_factor) / vehicle_mass;
    let net_vertical_accel = upward_accel - LUNAR_GRAVITY;

    // Pitch reduction of horizontal velocity
    let horizontal_decel = if state.horizontal_velocity_mps > 0.0 && state.altitude_m > 100.0 {
        let horiz_factor = if state.horizontal_velocity_mps > 200.0 { 0.96 } else { 0.15 };
        (thrust_n * horiz_factor / vehicle_mass).min(state.horizontal_velocity_mps / dt)
    } else {
        0.0
    };

    // 4. Update velocity and position
    state.vertical_velocity_mps += net_vertical_accel * dt;
    state.horizontal_velocity_mps = (state.horizontal_velocity_mps - horizontal_decel * dt).max(0.0);
    state.altitude_m += state.vertical_velocity_mps * dt;

    // 5. Check touchdown or contact probe trigger (probe length = 1.71m)
    if state.altitude_m <= 0.0 {
        state.altitude_m = 0.0;
        state.is_landed = true;

        let (is_safe, status_detail) = evaluate_touchdown_limits(
            state.horizontal_velocity_mps,
            state.vertical_velocity_mps,
            3.0, // nominal tilt
            0.5, // nominal rate
        );

        state.touchdown_status = if state.propellant_remaining_kg <= 0.0 && !is_safe {
            "BINGO_ABORT".to_string()
        } else if is_safe {
            if status_detail == "RoughLanding" {
                "ROUGH_LANDING".to_string()
            } else {
                "SAFE_LANDING".to_string()
            }
        } else {
            status_detail.to_uppercase()
        };
    }
}
