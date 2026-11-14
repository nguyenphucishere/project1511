use sim_core::{
    calculate_liftoff_twr, evaluate_touchdown_limits, is_in_prohibited_throttle_band,
    simulate_ascent_max_q, KeplerianOrbit, ResourceGraph, ResourceKind, ResourceNode,
    APOLLO_11_PAYLOAD_MASS_KG, BINGO_FUEL_RESERVE_KG, EARTH_MU_KM3_S2, EARTH_RADIUS_KM,
    LMDE_MAX_THRUST_N, LOW_LEVEL_FUEL_WARNING_KG, MAX_LAUNCH_WIND_SPEED_KMH,
    MAX_TLI_PAYLOAD_CAPACITY_KG, MOON_MU_KM3_S2, MOON_RADIUS_KM, SATURN_V_GLOM_KG,
    S_IC_PROPELLANT_MASS_KG, S_IC_THRUST_SL_N, S_IC_THRUST_VAC_N, S_II_PROPELLANT_MASS_KG,
    S_II_THRUST_VAC_N, S_IVB_PROPELLANT_MASS_KG, S_IVB_THRUST_VAC_N,
};

#[test]
fn test_catalog_saturn_v_hardware_parameters() {
    // S-IC
    assert_eq!(S_IC_THRUST_SL_N, 33_850_000.0);
    assert_eq!(S_IC_THRUST_VAC_N, 38_700_000.0);
    assert_eq!(S_IC_PROPELLANT_MASS_KG, 2_077_000.0);

    // S-II
    assert_eq!(S_II_THRUST_VAC_N, 5_115_000.0);
    assert_eq!(S_II_PROPELLANT_MASS_KG, 443_200.0);

    // S-IVB
    assert_eq!(S_IVB_THRUST_VAC_N, 1_001_000.0);
    assert_eq!(S_IVB_PROPELLANT_MASS_KG, 106_900.0);

    // Mission mass
    assert_eq!(SATURN_V_GLOM_KG, 2_938_315.0);
    assert_eq!(APOLLO_11_PAYLOAD_MASS_KG, 45_702.0);
    assert_eq!(MAX_TLI_PAYLOAD_CAPACITY_KG, 48_609.0);
    assert_eq!(MAX_LAUNCH_WIND_SPEED_KMH, 74.0);
}

#[test]
fn test_catalog_ascent_telemetry_tolerances() {
    let twr = calculate_liftoff_twr(S_IC_THRUST_SL_N, SATURN_V_GLOM_KG);
    // Catalog §1.2: 1.174 +/- 0.005
    assert!((twr - 1.174).abs() < 0.005, "Liftoff TWR: {}", twr);

    let (max_q_kpa, max_q_time_s) = simulate_ascent_max_q(SATURN_V_GLOM_KG, 0.0);
    // Catalog §1.2: Max-Q = 34.3 +/- 1.0 kPa at 83.0 +/- 2.0s
    assert!((max_q_kpa - 34.3).abs() < 1.0, "Max-Q dynamic pressure: {} kPa", max_q_kpa);
    assert!((max_q_time_s - 83.0).abs() <= 2.0, "Max-Q time: {} s", max_q_time_s);
}

#[test]
fn test_catalog_orbital_mechanics_tolerances() {
    // Earth parking orbit: 183.2 x 185.9 km, period 88.18 min
    let a_earth = EARTH_RADIUS_KM + 184.55;
    let earth_orbit = KeplerianOrbit {
        semi_major_axis_km: a_earth,
        eccentricity: 0.000206,
        inclination_deg: 32.52,
        raan_deg: 0.0,
        arg_periapsis_deg: 0.0,
        true_anomaly_deg: 0.0,
    };
    let t_earth_min = earth_orbit.orbital_period_minutes(EARTH_MU_KM3_S2);
    assert!((t_earth_min - 88.18).abs() < 0.1, "Earth parking period: {} min", t_earth_min);

    let j2_rate = earth_orbit.earth_j2_nodal_precession_deg_per_day();
    assert!((j2_rate - (-7.60)).abs() < 0.08, "J2 precession: {} deg/day", j2_rate);

    // Lunar orbit: 111.1 km circular, period 118.7 min, eclipse 46.0-48.5 min
    let a_moon = MOON_RADIUS_KM + 111.1;
    let moon_orbit = KeplerianOrbit {
        semi_major_axis_km: a_moon,
        eccentricity: 0.0,
        inclination_deg: 178.7,
        raan_deg: 0.0,
        arg_periapsis_deg: 0.0,
        true_anomaly_deg: 0.0,
    };
    let t_moon_min = moon_orbit.orbital_period_minutes(MOON_MU_KM3_S2);
    assert!((t_moon_min - 118.7).abs() < 0.25, "Moon orbit period: {} min", t_moon_min);

    let eclipse_min = moon_orbit.calculate_eclipse_duration_minutes();
    assert!(
        eclipse_min >= 46.0 && eclipse_min <= 48.5,
        "Eclipse duration: {} min",
        eclipse_min
    );
}

#[test]
fn test_catalog_lunar_descent_and_touchdown_tolerances() {
    assert_eq!(LMDE_MAX_THRUST_N, 45_040.0);
    assert_eq!(LOW_LEVEL_FUEL_WARNING_KG, 255.0);
    assert_eq!(BINGO_FUEL_RESERVE_KG, 112.0);

    // Cavitation band
    assert!(is_in_prohibited_throttle_band(65.0));
    assert!(is_in_prohibited_throttle_band(85.0));
    assert!(!is_in_prohibited_throttle_band(55.0));
    assert!(!is_in_prohibited_throttle_band(95.0));

    // Touchdown limits: Vx <= 1.22, Vz <= 2.13 (with Vx) or 3.05 (with Vx=0)
    let (ok_nom, _) = evaluate_touchdown_limits(1.0, 2.0, 8.0, 1.0);
    assert!(ok_nom);

    let (fail_vx, reason_vx) = evaluate_touchdown_limits(1.23, 1.0, 8.0, 1.0);
    assert!(!fail_vx);
    assert_eq!(reason_vx, "LateralTipOver");

    let (fail_vz, reason_vz) = evaluate_touchdown_limits(0.0, 3.10, 8.0, 1.0);
    assert!(!fail_vz);
    assert_eq!(reason_vz, "StructuralGearCollapse");

    let (fail_tilt, reason_tilt) = evaluate_touchdown_limits(0.5, 1.0, 12.1, 1.0);
    assert!(!fail_tilt);
    assert_eq!(reason_tilt, "SurfaceSlopeExceeded");
}

#[test]
fn test_catalog_resource_fuel_cell_tolerances() {
    let mut rg = ResourceGraph::new();
    rg.add_node(ResourceNode::new_producer("EPS-SM-FC", "PC3A-2 Fuel Cell", 4260.0));
    rg.add_node(ResourceNode::new_storage("CRYO", "Cryo", 100.0, 100.0, ResourceKind::CryoReactantsKg));
    rg.add_node(ResourceNode::new_storage("WATER", "Water", 100.0, 0.0, ResourceKind::PotableWaterKg));
    rg.add_node(ResourceNode::new_consumer("BUS", "Bus", 4260.0, 1));

    rg.propagate_step(3600.0);
    // Consumption: 4.26 kWh * 0.37 kg/kWh = 1.5762 kg
    assert!((rg.cumulative_reactant_consumed_kg - 1.5762).abs() < 0.002);
}
