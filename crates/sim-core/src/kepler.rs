use std::f64::consts::PI;
use serde::{Deserialize, Serialize};

/// Earth standard gravitational parameter (km^3/s^2)
pub const EARTH_MU_KM3_S2: f64 = 398_600.4418;
/// Earth mean equatorial radius (km)
pub const EARTH_RADIUS_KM: f64 = 6_378.137;
/// Earth second zonal harmonic (oblateness) J2
pub const EARTH_J2: f64 = 1.08263e-3;

/// Moon standard gravitational parameter (km^3/s^2)
pub const MOON_MU_KM3_S2: f64 = 4_904.8695;
/// Moon mean volumetric radius (km)
pub const MOON_RADIUS_KM: f64 = 1_737.4;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeplerianOrbit {
    pub semi_major_axis_km: f64,
    pub eccentricity: f64,
    pub inclination_deg: f64,
    pub raan_deg: f64,
    pub arg_periapsis_deg: f64,
    pub true_anomaly_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrbitalState {
    pub semi_major_axis_km: f64,
    pub eccentricity: f64,
    pub inclination_deg: f64,
    pub period_seconds: f64,
    pub apoapsis_km: f64,
    pub periapsis_km: f64,
    pub is_in_eclipse: bool,
}

impl KeplerianOrbit {
    /// Calculate orbital period in seconds given central body standard gravitational parameter mu (km^3/s^2)
    /// T = 2 * pi * sqrt(a^3 / mu)
    pub fn orbital_period_seconds(&self, standard_gravitational_param: f64) -> f64 {
        if self.semi_major_axis_km <= 0.0 || standard_gravitational_param <= 0.0 {
            return 0.0;
        }
        2.0 * PI * (self.semi_major_axis_km.powi(3) / standard_gravitational_param).sqrt()
    }

    /// Calculate orbital period in minutes
    pub fn orbital_period_minutes(&self, standard_gravitational_param: f64) -> f64 {
        self.orbital_period_seconds(standard_gravitational_param) / 60.0
    }

    /// Solve Kepler's equation M = E - e * sin(E) for eccentric anomaly E (rad)
    /// using Newton-Raphson iteration with quadratic convergence
    pub fn solve_eccentric_anomaly(&self, mean_anomaly_rad: f64) -> f64 {
        let e = self.eccentricity.clamp(0.0, 0.999999);
        if e < 1e-12 {
            return mean_anomaly_rad;
        }

        // Normalize mean anomaly to [0, 2*pi)
        let two_pi = 2.0 * PI;
        let m = mean_anomaly_rad.rem_euclid(two_pi);

        // Initial guess E0
        let mut e_curr = if e < 0.8 {
            m + e * m.sin() + 0.5 * e * e * (2.0 * m).sin()
        } else {
            PI
        };

        let tolerance = 1e-12;
        let max_iterations = 50;

        for _ in 0..max_iterations {
            let f = e_curr - e * e_curr.sin() - m;
            let f_prime = 1.0 - e * e_curr.cos();
            let delta = f / f_prime;
            e_curr -= delta;
            if delta.abs() < tolerance {
                break;
            }
        }

        e_curr
    }

    /// Convert eccentric anomaly E (rad) to true anomaly nu (rad)
    pub fn true_anomaly_from_eccentric(&self, eccentric_anomaly_rad: f64) -> f64 {
        let e = self.eccentricity.clamp(0.0, 0.999999);
        let beta = ((1.0 + e) / (1.0 - e)).sqrt();
        let half_e = eccentric_anomaly_rad / 2.0;
        let nu = 2.0 * (beta * half_e.tan()).atan();
        nu.rem_euclid(2.0 * PI)
    }

    /// Radial distance from central body center (km) at eccentric anomaly E
    pub fn orbital_radius_km(&self, eccentric_anomaly_rad: f64) -> f64 {
        self.semi_major_axis_km * (1.0 - self.eccentricity * eccentric_anomaly_rad.cos())
    }

    /// Orbital velocity (km/s) via vis-viva equation: v = sqrt(mu * (2/r - 1/a))
    pub fn orbital_velocity_kmps(&self, r_km: f64, standard_gravitational_param: f64) -> f64 {
        if r_km <= 0.0 || self.semi_major_axis_km <= 0.0 {
            return 0.0;
        }
        (standard_gravitational_param * (2.0 / r_km - 1.0 / self.semi_major_axis_km)).max(0.0).sqrt()
    }

    /// Calculate lunar cylindrical eclipse/shadow duration in seconds
    /// using Moon radius RM = 1,737.4 km and lunar circular parking orbit geometry
    pub fn calculate_eclipse_duration(&self) -> f64 {
        let a = self.semi_major_axis_km;
        if a <= MOON_RADIUS_KM {
            return 0.0;
        }

        let sin_phi = (MOON_RADIUS_KM / a).clamp(0.0, 1.0);
        let phi = sin_phi.asin();
        let period_s = self.orbital_period_seconds(MOON_MU_KM3_S2);

        // Cylindrical shadow duration = (2 * phi / (2 * pi)) * T = (phi / pi) * T
        (phi / PI) * period_s
    }

    /// Calculate lunar cylindrical eclipse duration in minutes
    pub fn calculate_eclipse_duration_minutes(&self) -> f64 {
        self.calculate_eclipse_duration() / 60.0
    }

    /// Calculate Earth J2 secular nodal precession rate in degrees per day
    /// dOmega/dt = -1.5 * J2 * (R_E / p)^2 * n * cos(i)
    pub fn earth_j2_nodal_precession_deg_per_day(&self) -> f64 {
        let e = self.eccentricity;
        let a = self.semi_major_axis_km;
        let inc_rad = self.inclination_deg.to_radians();

        let p = a * (1.0 - e * e);
        if p <= 0.0 {
            return 0.0;
        }

        // Mean motion n = sqrt(mu / a^3) in rad/s
        let n = (EARTH_MU_KM3_S2 / a.powi(3)).sqrt();

        // Nodal precession rate in rad/s
        let d_omega_dt_rad_per_s = -1.5 * EARTH_J2 * (EARTH_RADIUS_KM / p).powi(2) * n * inc_rad.cos();

        // Convert rad/s to deg/day: rad/s * (180 / pi) * 86,400 s/day
        d_omega_dt_rad_per_s * (180.0 / PI) * 86_400.0
    }

    /// Get complete orbital state snapshot
    pub fn to_orbital_state(&self, central_body_mu: f64, central_body_radius_km: f64) -> OrbitalState {
        let period_seconds = self.orbital_period_seconds(central_body_mu);
        let apoapsis_km = self.semi_major_axis_km * (1.0 + self.eccentricity) - central_body_radius_km;
        let periapsis_km = self.semi_major_axis_km * (1.0 - self.eccentricity) - central_body_radius_km;

        let nu_rad = self.true_anomaly_deg.to_radians();
        let in_eclipse = nu_rad > (PI - 0.6) && nu_rad < (PI + 0.6);

        OrbitalState {
            semi_major_axis_km: self.semi_major_axis_km,
            eccentricity: self.eccentricity,
            inclination_deg: self.inclination_deg,
            period_seconds,
            apoapsis_km,
            periapsis_km,
            is_in_eclipse: in_eclipse,
        }
    }
}

// ============================================================================
// Lunar Gravity Mascon Anomaly & DSN Telemetry Propagation
// ============================================================================

/// Speed of light in vacuum (km/s)
pub const SPEED_OF_LIGHT_KM_S: f64 = 299_792.458;
/// Nominal Apollo Unified S-band carrier frequency (MHz)
pub const DSN_S_BAND_FREQ_MHZ: f64 = 2_282.5;
/// Nominal Earth-Moon center-to-center distance (km)
pub const EARTH_MOON_NOMINAL_DISTANCE_KM: f64 = 384_400.0;
/// Baseline received carrier power constant (dBm): 43.0 (tx) + 20.5 (gtx) + 53.0 (grx) - 6.0 (loss) = 110.5 dBm
pub const DSN_LINK_POWER_BUDGET_CONSTANT_DBM: f64 = 110.5;

/// Lunar mascon localized gravity perturbation (+280 mGal = 0.0028 m/s^2)
pub const LUNAR_MASCON_ANOMALY_MGAL: f64 = 280.0;
pub const LUNAR_MASCON_ANOMALY_MPS2: f64 = 0.0028;
/// Lunar standard equatorial surface gravity (m/s^2)
pub const LUNAR_STANDARD_GRAVITY_MPS2: f64 = 1.622;
/// Lunar regolith bulk density (kg/m^3)
pub const LUNAR_REGOLITH_DENSITY_KG_M3: f64 = 1_500.0;
/// Lunar regolith bearing capacity (kPa)
pub const LUNAR_REGOLITH_BEARING_CAPACITY_KPA: f64 = 140.0;
/// Lunar surface temperature during lunar day (deg C)
pub const LUNAR_SURFACE_TEMP_DAY_C: f64 = 101.0;
/// Lunar surface temperature during lunar night (deg C)
pub const LUNAR_SURFACE_TEMP_NIGHT_C: f64 = -130.0;
/// Nominal lunar landing terrain slope (deg)
pub const LUNAR_TERRAIN_SLOPE_DEG: f64 = 4.5;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LunarEnvironmentConstants {
    pub standard_gravity_mps2: f64,
    pub mascon_anomaly_mps2: f64,
    pub mascon_anomaly_mgal: f64,
    pub local_gravity_effective_mps2: f64,
    pub terrain_slope_deg: f64,
    pub regolith_bulk_density_kg_m3: f64,
    pub regolith_bearing_capacity_kpa: f64,
    pub surface_temperature_c: f64,
    pub surface_temperature_day_c: f64,
    pub surface_temperature_night_c: f64,
    pub moon_radius_km: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LunarGravityModel {
    pub base_gravity_mps2: f64,
    pub mascon_anomaly_mps2: f64,
    pub r_moon_m: f64,
}

impl Default for LunarGravityModel {
    fn default() -> Self {
        Self {
            base_gravity_mps2: LUNAR_STANDARD_GRAVITY_MPS2,
            mascon_anomaly_mps2: LUNAR_MASCON_ANOMALY_MPS2,
            r_moon_m: MOON_RADIUS_KM * 1000.0,
        }
    }
}

impl LunarGravityModel {
    /// Calculate local gravitational acceleration at altitude (m) including optional mascon perturbation
    pub fn local_acceleration(&self, altitude_m: f64, is_over_mascon: bool) -> f64 {
        let r = self.r_moon_m + altitude_m.max(0.0);
        let base = self.base_gravity_mps2 * (self.r_moon_m / r).powi(2);
        if is_over_mascon {
            base + self.mascon_anomaly_mps2
        } else {
            base
        }
    }
}

/// Calculate effective local lunar gravitational acceleration at specified altitude
pub fn calculate_lunar_gravity(altitude_m: f64, is_over_mascon: bool) -> f64 {
    LunarGravityModel::default().local_acceleration(altitude_m, is_over_mascon)
}

/// Retrieve static authentic NASA lunar surface environment constants
pub fn get_lunar_environment_constants() -> LunarEnvironmentConstants {
    LunarEnvironmentConstants {
        standard_gravity_mps2: LUNAR_STANDARD_GRAVITY_MPS2,
        mascon_anomaly_mps2: LUNAR_MASCON_ANOMALY_MPS2,
        mascon_anomaly_mgal: LUNAR_MASCON_ANOMALY_MGAL,
        local_gravity_effective_mps2: LUNAR_STANDARD_GRAVITY_MPS2 + LUNAR_MASCON_ANOMALY_MPS2,
        terrain_slope_deg: LUNAR_TERRAIN_SLOPE_DEG,
        regolith_bulk_density_kg_m3: LUNAR_REGOLITH_DENSITY_KG_M3,
        regolith_bearing_capacity_kpa: LUNAR_REGOLITH_BEARING_CAPACITY_KPA,
        surface_temperature_c: LUNAR_SURFACE_TEMP_DAY_C,
        surface_temperature_day_c: LUNAR_SURFACE_TEMP_DAY_C,
        surface_temperature_night_c: LUNAR_SURFACE_TEMP_NIGHT_C,
        moon_radius_km: MOON_RADIUS_KM,
        error_message: None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DsnTelemetryRequest {
    pub distance_km: f64,
    #[serde(default)]
    pub true_anomaly_deg: f64,
    #[serde(default)]
    pub is_farside: bool,
}

pub type DsnTelemetryInput = DsnTelemetryRequest;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DsnTelemetryResponse {
    pub rtlt_seconds: f64,
    pub path_loss_db: f64,
    pub received_power_dbm: f64,
    pub is_occulted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

pub type DsnTelemetryResult = DsnTelemetryResponse;

/// Calculate Deep Space Network Round-Trip Light Time (RTLT), path loss, and lunar radio occultation
pub fn calculate_dsn_telemetry(
    distance_km: f64,
    true_anomaly_deg: f64,
    is_farside: bool,
) -> DsnTelemetryResponse {
    let d = distance_km.max(1.0);
    // 1. RTLT in seconds = 2 * d / c
    let rtlt = (2.0 * d) / SPEED_OF_LIGHT_KM_S;

    // 2. Free Space Path Loss (FSPL) in dB: 20*log10(d_km) + 20*log10(f_MHz) + 32.4478
    let fspl = 20.0 * d.log10() + 20.0 * DSN_S_BAND_FREQ_MHZ.log10() + 32.4478;

    // 3. Occultation: True anomaly behind lunar limb [109.872 deg, 250.128 deg] or explicit farside flag
    let nu_norm = true_anomaly_deg.rem_euclid(360.0);
    let is_occulted = is_farside || (nu_norm >= 109.872 && nu_norm <= 250.128);

    // 4. Received Power: 110.5 dBm - FSPL when in LOS, -180.0 dBm during occultation
    let received_power = if is_occulted {
        -180.0
    } else {
        DSN_LINK_POWER_BUDGET_CONSTANT_DBM - fspl
    };

    DsnTelemetryResponse {
        rtlt_seconds: (rtlt * 100_000.0).round() / 100_000.0,
        path_loss_db: (fspl * 10_000.0).round() / 10_000.0,
        received_power_dbm: (received_power * 10_000.0).round() / 10_000.0,
        is_occulted,
        error_message: None,
    }
}

pub fn calculate_dsn_telemetry_full(req: &DsnTelemetryRequest) -> DsnTelemetryResponse {
    calculate_dsn_telemetry(req.distance_km, req.true_anomaly_deg, req.is_farside)
}

