use sim_core::{
    calculate_liftoff_twr, simulate_saturn_v_staging, validate_launch_envelope,
    LaunchConfiguration, APOLLO_11_PAYLOAD_MASS_KG, MAX_TLI_PAYLOAD_CAPACITY_KG,
    SATURN_V_GLOM_KG, S_IC_THRUST_SL_N,
};

#[test]
fn test_apollo11_nominal_ascent_envelope() {
    let config = LaunchConfiguration {
        vehicle_id: Some("AS-506".to_string()),
        vehicle_mass: 0.0,
        propellant_mass: 0.0,
        payload_mass: APOLLO_11_PAYLOAD_MASS_KG,
        stage_count: 3,
        target_orbit_km: 185.0,
        wind_speed_kmh: 15.0,
        wet_mass_kg: Some(SATURN_V_GLOM_KG),
        target_perigee_km: Some(183.2),
        target_apogee_km: Some(185.9),
        target_inclination_deg: Some(32.52),
    };

    let val = validate_launch_envelope(&config);

    assert!(val.is_valid, "Apollo 11 nominal launch must be valid");
    assert!(val.failure_reason.is_none());

    // GLOM assert
    assert!(
        (val.glom_kg - 2_938_315.0).abs() < 1.0,
        "GLOM should match nominal 2,938,315 kg, got {}",
        val.glom_kg
    );

    // Liftoff TWR assert: 1.174 +/- 0.005
    assert!(
        (val.liftoff_twr - 1.174).abs() < 0.005,
        "Liftoff TWR expected ~1.174, got {}",
        val.liftoff_twr
    );

    // Max-Q assert: 34.3 +/- 1.0 kPa at 83.0 +/- 2.0s
    assert!(
        (val.max_q_kpa - 34.3).abs() < 1.0,
        "Max-Q expected ~34.3 kPa, got {}",
        val.max_q_kpa
    );
    assert!(
        (val.max_q_time_s - 83.0).abs() <= 2.0,
        "Max-Q time expected ~83s, got {}",
        val.max_q_time_s
    );

    // Payload margin assert: 48,609 - 45,702 = 2,907 kg
    let expected_margin = MAX_TLI_PAYLOAD_CAPACITY_KG - APOLLO_11_PAYLOAD_MASS_KG;
    assert!(
        (val.payload_margin_kg - expected_margin).abs() < 1.0,
        "Payload margin expected {}, got {}",
        expected_margin,
        val.payload_margin_kg
    );
}

#[test]
fn test_launch_envelope_high_wind_abort() {
    let config = LaunchConfiguration {
        vehicle_id: Some("AS-506-WIND".to_string()),
        vehicle_mass: 0.0,
        propellant_mass: 0.0,
        payload_mass: APOLLO_11_PAYLOAD_MASS_KG,
        stage_count: 3,
        target_orbit_km: 185.0,
        wind_speed_kmh: 85.0, // Exceeds 74 km/h limit
        wet_mass_kg: Some(SATURN_V_GLOM_KG),
        target_perigee_km: None,
        target_apogee_km: None,
        target_inclination_deg: None,
    };

    let val = validate_launch_envelope(&config);
    assert!(!val.is_valid, "Wind > 74 km/h must abort launch");
    assert!(val.failure_reason.is_some());
    let reason = val.failure_reason.unwrap();
    assert!(
        reason.contains("Wind speed") && reason.contains("exceeds"),
        "Failure reason should cite wind speed: {}",
        reason
    );
}

#[test]
fn test_launch_envelope_excess_payload_abort() {
    let config = LaunchConfiguration {
        vehicle_id: Some("AS-506-HEAVY".to_string()),
        vehicle_mass: 185_000.0,
        propellant_mass: 2_600_000.0,
        payload_mass: 55_000.0, // Exceeds 48,609 kg capacity
        stage_count: 3,
        target_orbit_km: 185.0,
        wind_speed_kmh: 10.0,
        wet_mass_kg: None,
        target_perigee_km: None,
        target_apogee_km: None,
        target_inclination_deg: None,
    };

    let val = validate_launch_envelope(&config);
    assert!(!val.is_valid, "Overweight payload must fail validation");
    assert!(val.payload_margin_kg < 0.0);
    let reason = val.failure_reason.unwrap();
    assert!(
        reason.contains("exceeds launch vehicle capacity"),
        "Failure reason should cite capacity: {}",
        reason
    );
}

#[test]
fn test_launch_envelope_insufficient_twr() {
    let twr = calculate_liftoff_twr(S_IC_THRUST_SL_N, 4_000_000.0);
    assert!(twr < 1.0, "Mass of 4,000,000 kg with 33.85 MN thrust gives TWR < 1.0");

    let config = LaunchConfiguration {
        vehicle_id: Some("AS-506-UNDERPOWERED".to_string()),
        vehicle_mass: 500_000.0,
        propellant_mass: 3_500_000.0,
        payload_mass: 45_702.0,
        stage_count: 3,
        target_orbit_km: 185.0,
        wind_speed_kmh: 10.0,
        wet_mass_kg: None,
        target_perigee_km: None,
        target_apogee_km: None,
        target_inclination_deg: None,
    };

    let val = validate_launch_envelope(&config);
    assert!(!val.is_valid, "TWR < 1.05 must fail launch validation");
    let reason = val.failure_reason.unwrap();
    assert!(reason.contains("Liftoff TWR"));
}

#[test]
fn test_saturn_v_staging_velocities() {
    let stages = simulate_saturn_v_staging();
    assert_eq!(stages.len(), 4);

    // S-IC
    assert_eq!(stages[0].stage_name, "S-IC");
    assert!((stages[0].cutoff_velocity_mps - 2756.0).abs() < 10.0);
    assert!((stages[0].separation_altitude_km - 67.6).abs() < 1.0);

    // S-II
    assert_eq!(stages[1].stage_name, "S-II");
    assert!((stages[1].cutoff_velocity_mps - 6945.0).abs() < 15.0);
    assert!((stages[1].separation_altitude_km - 186.1).abs() < 2.0);

    // S-IVB EPO
    assert_eq!(stages[2].stage_name, "S-IVB (EPO)");
    assert!((stages[2].cutoff_velocity_mps - 7791.0).abs() < 10.0);
    assert!((stages[2].separation_altitude_km - 185.0).abs() < 2.0);

    // S-IVB TLI
    assert_eq!(stages[3].stage_name, "S-IVB (TLI)");
    assert!((stages[3].cutoff_velocity_mps - 10835.0).abs() < 25.0);
}
