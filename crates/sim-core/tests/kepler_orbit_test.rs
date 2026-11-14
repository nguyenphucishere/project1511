use std::f64::consts::PI;
use sim_core::{
    KeplerianOrbit, EARTH_MU_KM3_S2, EARTH_RADIUS_KM, MOON_MU_KM3_S2, MOON_RADIUS_KM,
};

#[test]
fn test_earth_parking_orbit_period() {
    // Apollo 11 Earth Parking Orbit: 183.2 km x 185.9 km, i = 32.52 deg
    let hp = 183.2;
    let ha = 185.9;
    let a = EARTH_RADIUS_KM + (hp + ha) / 2.0;
    let e = (ha - hp) / (2.0 * a);

    let orbit = KeplerianOrbit {
        semi_major_axis_km: a,
        eccentricity: e,
        inclination_deg: 32.52,
        raan_deg: 0.0,
        arg_periapsis_deg: 0.0,
        true_anomaly_deg: 0.0,
    };

    let period_s = orbit.orbital_period_seconds(EARTH_MU_KM3_S2);
    let period_min = orbit.orbital_period_minutes(EARTH_MU_KM3_S2);

    // Catalog baseline: 88.18 min (5,290.8 s)
    assert!(
        (period_min - 88.18).abs() < 0.1,
        "Earth parking orbit period expected ~88.18 min, got {:.3} min",
        period_min
    );
    assert!(
        (period_s - 5290.8).abs() < 5.0,
        "Period in seconds expected ~5,291s, got {:.1}s",
        period_s
    );
}

#[test]
fn test_lunar_parking_orbit_period_and_velocity() {
    // Apollo 11 circular lunar orbit at 111.1 km altitude (60 nmi)
    let h = 111.1;
    let a = MOON_RADIUS_KM + h;

    let orbit = KeplerianOrbit {
        semi_major_axis_km: a,
        eccentricity: 0.0,
        inclination_deg: 178.7, // Retrograde equatorial capture
        raan_deg: 0.0,
        arg_periapsis_deg: 0.0,
        true_anomaly_deg: 0.0,
    };

    let period_s = orbit.orbital_period_seconds(MOON_MU_KM3_S2);
    let period_min = orbit.orbital_period_minutes(MOON_MU_KM3_S2);

    // Catalog baseline: 118.7 min (7,122 s)
    assert!(
        (period_min - 118.7).abs() < 0.25,
        "Lunar orbit period expected ~118.7 min, got {:.3} min",
        period_min
    );
    assert!(
        (period_s - 7122.0).abs() < 15.0,
        "Lunar period seconds expected ~7,122s, got {:.1}s",
        period_s
    );

    // Circular velocity: v = sqrt(mu / a) ~ 1.629 km/s (catalog ~1,633 m/s)
    let v_kmps = orbit.orbital_velocity_kmps(a, MOON_MU_KM3_S2);
    let v_mps = v_kmps * 1000.0;
    assert!(
        v_mps >= 1625.0 && v_mps <= 1635.0,
        "Lunar orbit circular velocity expected in [1625, 1635] m/s, got {:.1} m/s",
        v_mps
    );
}

#[test]
fn test_newton_raphson_kepler_convergence() {
    let orbit = KeplerianOrbit {
        semi_major_axis_km: 7000.0,
        eccentricity: 0.1,
        inclination_deg: 28.5,
        raan_deg: 0.0,
        arg_periapsis_deg: 0.0,
        true_anomaly_deg: 0.0,
    };

    // Case 1: Circular e = 0.0
    let mut circ = orbit.clone();
    circ.eccentricity = 0.0;
    let m1 = PI / 2.0;
    let e1 = circ.solve_eccentric_anomaly(m1);
    assert!((e1 - m1).abs() < 1e-12, "Circular orbit E == M");

    // Case 2: Moderate eccentricity e = 0.1
    let m2 = 0.8;
    let e2 = orbit.solve_eccentric_anomaly(m2);
    let residual2 = e2 - 0.1 * e2.sin() - m2;
    assert!(residual2.abs() < 1e-11, "Convergence residual: {}", residual2);

    // Case 3: High eccentricity e = 0.8
    let mut high_e = orbit.clone();
    high_e.eccentricity = 0.8;
    let m3 = 1.2;
    let e3 = high_e.solve_eccentric_anomaly(m3);
    let residual3 = e3 - 0.8 * e3.sin() - m3;
    assert!(residual3.abs() < 1e-11, "Convergence residual: {}", residual3);
}

#[test]
fn test_lunar_cylindrical_eclipse_duration() {
    let h = 111.1;
    let a = MOON_RADIUS_KM + h;

    let orbit = KeplerianOrbit {
        semi_major_axis_km: a,
        eccentricity: 0.0,
        inclination_deg: 178.7,
        raan_deg: 0.0,
        arg_periapsis_deg: 0.0,
        true_anomaly_deg: 0.0,
    };

    let eclipse_min = orbit.calculate_eclipse_duration_minutes();
    let eclipse_s = orbit.calculate_eclipse_duration();

    // Catalog range: 46.0 - 48.5 min (~2,771s)
    assert!(
        eclipse_min >= 46.0 && eclipse_min <= 48.5,
        "Eclipse duration expected in [46.0, 48.5] min, got {:.2} min",
        eclipse_min
    );
    assert!(
        (eclipse_s - 2771.0).abs() < 30.0,
        "Eclipse seconds expected ~2,771s, got {:.1}s",
        eclipse_s
    );
}

#[test]
fn test_earth_j2_secular_precession() {
    // Apollo 11 Earth Parking Orbit: a = 6,562.7 km, e = 0.000206, i = 32.52 deg
    let hp = 183.2;
    let ha = 185.9;
    let a = EARTH_RADIUS_KM + (hp + ha) / 2.0;
    let e = (ha - hp) / (2.0 * a);

    let orbit = KeplerianOrbit {
        semi_major_axis_km: a,
        eccentricity: e,
        inclination_deg: 32.52,
        raan_deg: 0.0,
        arg_periapsis_deg: 0.0,
        true_anomaly_deg: 0.0,
    };

    let precession_rate = orbit.earth_j2_nodal_precession_deg_per_day();

    // Catalog baseline: -7.60 deg/day +/- 0.08 deg/day
    assert!(
        (precession_rate - (-7.60)).abs() < 0.08,
        "J2 nodal precession expected ~ -7.60 deg/day, got {:.3} deg/day",
        precession_rate
    );
}
