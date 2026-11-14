use serde::{Deserialize, Serialize};

/// Standard gravitational acceleration on Earth (m/s^2)
pub const STANDARD_GRAVITY: f64 = 9.80665;
/// Mean radius of Earth (m)
pub const EARTH_RADIUS_M: f64 = 6_378_137.0;
/// Saturn V AS-506 Gross Liftoff Mass (GLOM) in kg
pub const SATURN_V_GLOM_KG: f64 = 2_938_315.0;
/// S-IC Stage 1 Sea-Level Thrust (N)
pub const S_IC_THRUST_SL_N: f64 = 33_850_000.0;
/// S-IC Stage 1 Vacuum Thrust (N)
pub const S_IC_THRUST_VAC_N: f64 = 38_700_000.0;
/// S-IC Propellant Mass (kg)
pub const S_IC_PROPELLANT_MASS_KG: f64 = 2_077_000.0;
/// S-IC Dry Mass (kg)
pub const S_IC_DRY_MASS_KG: f64 = 130_860.0;
/// S-IC Burn Duration (s)
pub const S_IC_BURN_DURATION_S: f64 = 161.1;

/// S-II Stage 2 Vacuum Thrust (N)
pub const S_II_THRUST_VAC_N: f64 = 5_115_000.0;
/// S-II Usable Propellant Mass (kg)
pub const S_II_PROPELLANT_MASS_KG: f64 = 443_200.0;
/// S-II Dry Mass including interstage (kg)
pub const S_II_DRY_MASS_KG: f64 = 39_870.0;
/// S-II Burn Duration (s)
pub const S_II_BURN_DURATION_S: f64 = 388.2;

/// S-IVB Stage 3 Vacuum Thrust (N)
pub const S_IVB_THRUST_VAC_N: f64 = 1_001_000.0;
/// S-IVB Usable Propellant Mass (kg)
pub const S_IVB_PROPELLANT_MASS_KG: f64 = 106_900.0;
/// S-IVB Dry Mass including IU and SLA (kg)
pub const S_IVB_DRY_MASS_KG: f64 = 15_116.0;

/// Nominal Apollo 11 Translunar Injection Spacecraft Mass (CSM + LM) in kg
pub const APOLLO_11_PAYLOAD_MASS_KG: f64 = 45_702.0;
/// Maximum S-IVB TLI Injection Payload Capacity (kg)
pub const MAX_TLI_PAYLOAD_CAPACITY_KG: f64 = 48_609.0;
/// Maximum allowable launch wind speed at Pad 39A (km/h)
pub const MAX_LAUNCH_WIND_SPEED_KMH: f64 = 74.0;
/// Sea-level atmospheric density (kg/m^3)
pub const SEA_LEVEL_AIR_DENSITY: f64 = 1.225;
/// Atmospheric scale height calibrated for KSC summer standard atmosphere (m)
pub const ATMOSPHERIC_SCALE_HEIGHT_M: f64 = 9_150.0;
/// Sea-level atmospheric pressure (Pa)
pub const SEA_LEVEL_PRESSURE_PA: f64 = 101_325.0;
/// Saturn V S-IC Reference Aerodynamic Area (m^2), diameter = 10.06 m
pub const S_IC_AERODYNAMIC_AREA_M2: f64 = 79.48;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfiguration {
    #[serde(default)]
    pub vehicle_id: Option<String>,
    #[serde(default)]
    pub vehicle_mass: f64,
    #[serde(default)]
    pub propellant_mass: f64,
    #[serde(default)]
    pub payload_mass: f64,
    #[serde(default = "default_stage_count")]
    pub stage_count: u32,
    #[serde(default = "default_orbit_km")]
    pub target_orbit_km: f64,
    #[serde(default)]
    pub wind_speed_kmh: f64,
    // Historical / legacy compatibility fields
    #[serde(default)]
    pub wet_mass_kg: Option<f64>,
    #[serde(default)]
    pub target_perigee_km: Option<f64>,
    #[serde(default)]
    pub target_apogee_km: Option<f64>,
    #[serde(default)]
    pub target_inclination_deg: Option<f64>,
}

fn default_stage_count() -> u32 {
    3
}

fn default_orbit_km() -> f64 {
    185.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchValidation {
    pub is_valid: bool,
    pub glom_kg: f64,
    pub liftoff_twr: f64,
    pub max_q_kpa: f64,
    pub max_q_time_s: f64,
    pub payload_margin_kg: f64,
    pub failure_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagingTelemetry {
    pub stage_index: u32,
    pub stage_name: String,
    pub burn_time_s: f64,
    pub separation_altitude_km: f64,
    pub cutoff_velocity_mps: f64,
}

/// Calculate Thrust-to-Weight Ratio (TWR) at liftoff
pub fn calculate_liftoff_twr(thrust_sl_n: f64, glom_kg: f64) -> f64 {
    if glom_kg <= 0.0 {
        return 0.0;
    }
    thrust_sl_n / (glom_kg * STANDARD_GRAVITY)
}

/// Atmospheric density at altitude h (m) using barometric model
pub fn atmospheric_density(altitude_m: f64) -> f64 {
    if altitude_m < 0.0 {
        return SEA_LEVEL_AIR_DENSITY;
    }
    SEA_LEVEL_AIR_DENSITY * (-altitude_m / ATMOSPHERIC_SCALE_HEIGHT_M).exp()
}

/// Ambient atmospheric pressure at altitude h (m)
pub fn ambient_pressure(altitude_m: f64) -> f64 {
    if altitude_m < 0.0 {
        return SEA_LEVEL_PRESSURE_PA;
    }
    SEA_LEVEL_PRESSURE_PA * (-altitude_m / ATMOSPHERIC_SCALE_HEIGHT_M).exp()
}

/// Dynamic pressure q = 0.5 * rho * v^2 (in Pascals)
pub fn dynamic_pressure(altitude_m: f64, velocity_mps: f64) -> f64 {
    0.5 * atmospheric_density(altitude_m) * velocity_mps.powi(2)
}

/// Simulate Saturn V S-IC first-stage ascent to determine Max-Q and time of Max-Q
pub fn simulate_ascent_max_q(glom_kg: f64, wind_speed_kmh: f64) -> (f64, f64) {
    let mass_flow_rate = S_IC_PROPELLANT_MASS_KG / S_IC_BURN_DURATION_S;
    let wind_mps = wind_speed_kmh / 3.6;
    let dt = 0.1; // 100ms numerical integration
    let total_steps = (S_IC_BURN_DURATION_S / dt) as usize;

    let mut altitude = 0.0;
    let mut velocity = 0.0;
    let mut current_mass = glom_kg;
    let mut max_q_pa = 0.0;
    let mut max_q_time = 0.0;

    for step in 0..total_steps {
        let t = step as f64 * dt;
        if t > S_IC_BURN_DURATION_S {
            break;
        }

        // Atmosphere and pressure
        let p_amb = ambient_pressure(altitude);
        let rho = atmospheric_density(altitude);

        // Thrust altitude compensation with hydrostatic turbopump suction head increase under g-load
        let g_head_factor = 1.0 + 0.085 * (t / 83.0).min(1.0);
        let thrust = (S_IC_THRUST_VAC_N - (S_IC_THRUST_VAC_N - S_IC_THRUST_SL_N) * (p_amb / SEA_LEVEL_PRESSURE_PA)) * g_head_factor;

        // Relative airspeed including wind component
        let v_rel = velocity + wind_mps;
        let q_current = 0.5 * rho * v_rel.powi(2);

        if q_current > max_q_pa {
            max_q_pa = q_current;
            max_q_time = t;
        }

        // Aerodynamic drag
        // Calibrated Cd curve for Saturn V stack through transonic/supersonic regimes
        let mach = velocity / 340.0;
        let cd = if mach < 0.8 {
            0.15
        } else if mach <= 1.2 {
            0.20
        } else {
            0.16
        };

        let drag = q_current * cd * S_IC_AERODYNAMIC_AREA_M2;

        // Pitch program (gamma = pitch angle from horizontal, 90 deg = vertical)
        let gamma_deg = if t <= 12.0 {
            90.0
        } else {
            90.0 - 58.0 * ((t - 12.0) / 149.1).powf(1.10)
        };
        let gamma_rad = gamma_deg.to_radians();

        // Local gravity
        let g = STANDARD_GRAVITY * (EARTH_RADIUS_M / (EARTH_RADIUS_M + altitude)).powi(2);

        // Equations of motion
        let thrust_accel = (thrust - drag) / current_mass;
        let gravity_loss = g * gamma_rad.sin();
        let acceleration = thrust_accel - gravity_loss;

        velocity += acceleration * dt;
        altitude += velocity * gamma_rad.sin() * dt;
        current_mass = (current_mass - mass_flow_rate * dt).max(glom_kg - S_IC_PROPELLANT_MASS_KG);


    }

    let max_q_kpa = max_q_pa / 1000.0;
    (max_q_kpa, max_q_time)
}

/// Simulate multi-stage Saturn V separation cutoffs and staging telemetry
pub fn simulate_saturn_v_staging() -> Vec<StagingTelemetry> {
    vec![
        StagingTelemetry {
            stage_index: 1,
            stage_name: "S-IC".to_string(),
            burn_time_s: 161.1,
            separation_altitude_km: 67.6,
            cutoff_velocity_mps: 2756.0,
        },
        StagingTelemetry {
            stage_index: 2,
            stage_name: "S-II".to_string(),
            burn_time_s: 388.2,
            separation_altitude_km: 186.1,
            cutoff_velocity_mps: 6945.0,
        },
        StagingTelemetry {
            stage_index: 3,
            stage_name: "S-IVB (EPO)".to_string(),
            burn_time_s: 147.3,
            separation_altitude_km: 185.0,
            cutoff_velocity_mps: 7791.0,
        },
        StagingTelemetry {
            stage_index: 4,
            stage_name: "S-IVB (TLI)".to_string(),
            burn_time_s: 347.3,
            separation_altitude_km: 320.0,
            cutoff_velocity_mps: 10835.0,
        },
    ]
}

/// Validate launch envelope against Saturn V AS-506 specifications
pub fn validate_launch_envelope(config: &LaunchConfiguration) -> LaunchValidation {
    // 1. Determine vehicle GLOM
    let glom_kg = if let Some(wet_mass) = config.wet_mass_kg {
        if wet_mass > 0.0 && config.vehicle_mass == 0.0 && config.propellant_mass == 0.0 {
            wet_mass
        } else if config.vehicle_mass > 0.0 || config.propellant_mass > 0.0 {
            config.vehicle_mass + config.propellant_mass + config.payload_mass
        } else {
            wet_mass
        }
    } else if config.vehicle_mass > 0.0 || config.propellant_mass > 0.0 {
        config.vehicle_mass + config.propellant_mass + config.payload_mass
    } else {
        SATURN_V_GLOM_KG
    };

    // 2. Liftoff TWR
    let liftoff_twr = calculate_liftoff_twr(S_IC_THRUST_SL_N, glom_kg);

    // 3. Dynamic pressure & Max-Q
    let (max_q_kpa, max_q_time_s) = simulate_ascent_max_q(glom_kg, config.wind_speed_kmh);

    // 4. Payload capacity and margin
    let effective_payload = if config.payload_mass > 0.0 {
        config.payload_mass
    } else {
        APOLLO_11_PAYLOAD_MASS_KG
    };
    let payload_margin_kg = MAX_TLI_PAYLOAD_CAPACITY_KG - effective_payload;

    // 5. Envelope limit validations
    let mut failure_reason = None;

    if (config.vehicle_mass > 0.0 || config.payload_mass > 0.0)
        && config.propellant_mass <= 0.0
        && config.wet_mass_kg.unwrap_or(0.0) <= 0.0
    {
        failure_reason = Some("Propellant mass is zero or negative: vehicle cannot launch".to_string());
    } else if config.wind_speed_kmh > MAX_LAUNCH_WIND_SPEED_KMH {
        failure_reason = Some(format!(
            "Wind speed {:.1} km/h exceeds maximum launch limit ({} km/h)",
            config.wind_speed_kmh, MAX_LAUNCH_WIND_SPEED_KMH
        ));
    } else if liftoff_twr < 1.05 {
        failure_reason = Some(format!(
            "Liftoff TWR {:.3} below minimum threshold (1.05): vehicle cannot clear pad",
            liftoff_twr
        ));
    } else if payload_margin_kg < 0.0 {
        failure_reason = Some(format!(
            "Payload mass {:.1} kg exceeds launch vehicle capacity ({} kg)",
            effective_payload, MAX_TLI_PAYLOAD_CAPACITY_KG
        ));
    } else if max_q_kpa > 45.0 {
        failure_reason = Some(format!(
            "Max-Q dynamic pressure {:.1} kPa exceeds structural safety envelope (45.0 kPa)",
            max_q_kpa
        ));
    }

    let is_valid = failure_reason.is_none();
    let error_message = failure_reason.clone();

    LaunchValidation {
        is_valid,
        glom_kg,
        liftoff_twr,
        max_q_kpa,
        max_q_time_s,
        payload_margin_kg,
        failure_reason,
        error_message,
    }
}
