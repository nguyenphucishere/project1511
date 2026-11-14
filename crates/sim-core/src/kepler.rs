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
