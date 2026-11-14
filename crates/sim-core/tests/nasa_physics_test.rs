use sim_core::{
    calculate_dsn_telemetry, calculate_landing_radar, calculate_landing_radar_full,
    calculate_lunar_gravity, calculate_mga_dry_mass, calculate_multi_stage_delta_v,
    calculate_stage_delta_v, evaluate_cml_score, evaluate_mission_design_budget,
    get_lunar_environment_constants, LandingRadarInput,
    LunarGravityModel, MissionDesignBudgetRequest, StageConfig, SubsystemMel,
    DEFAULT_MGA_MARGIN_PCT, LUNAR_MASCON_ANOMALY_MPS2, LUNAR_STANDARD_GRAVITY_MPS2,
    MAX_TLI_PAYLOAD_CAPACITY_KG,
};

#[test]
fn test_goddard_mdl_mel_mga_closure() {
    let mel = SubsystemMel {
        structure_kg: 4_000.0,
        thermal_kg: 800.0,
        propulsion_hardware_kg: 3_200.0,
        eps_kg: 1_500.0,
        gnc_avionics_kg: 1_200.0,
        communications_kg: 600.0,
        eclss_kg: 2_800.0,
        science_payload_kg: 1_000.0,
    };
    let basic_mass = mel.total_basic_dry_mass();
    assert_eq!(basic_mass, 15_100.0);

    let mga_mass = calculate_mga_dry_mass(basic_mass, DEFAULT_MGA_MARGIN_PCT);
    assert_eq!(mga_mass, 18_120.0);

    let req = MissionDesignBudgetRequest {
        dry_mass_basic_kg: basic_mass,
        power_load_watts: 950.0,
        delta_v_required_mps: 4_000.0,
        stage_configs: vec![
            StageConfig {
                stage_name: "CSM SPS".to_string(),
                dry_mass_kg: 10_000.0,
                propellant_mass_kg: 18_400.0,
                isp_s: 314.5,
                burn_delta_v_mps: None,
            },
            StageConfig {
                stage_name: "LM Descent".to_string(),
                dry_mass_kg: 4_500.0,
                propellant_mass_kg: 8_200.0,
                isp_s: 311.0,
                burn_delta_v_mps: None,
            },
        ],
        power_generation_watts: Some(1_400.0),
        launch_vehicle_capacity_kg: Some(MAX_TLI_PAYLOAD_CAPACITY_KG),
        mga_margin_pct: Some(20.0),
        mel_breakdown: Some(mel),
    };

    let eval = evaluate_mission_design_budget(&req);
    assert_eq!(eval.dry_mass_with_mga_kg, 18_120.0);
    assert_eq!(eval.mass_margin_kg, 48_609.0 - 18_120.0);
    assert!(eval.is_mass_compliant);
    assert!((eval.power_margin_pct - 47.3684).abs() < 1e-3);
    assert!(eval.is_power_compliant);
    assert!((eval.delta_v_available_mps - 6_383.6047).abs() < 1e-2);
    assert!((eval.delta_v_reserve_pct - 59.5901).abs() < 1e-2);
    assert!(eval.is_delta_v_compliant);
    assert_eq!(eval.cml_score, 4);
    assert_eq!(eval.overall_mdl_score, 100.0);
}

#[test]
fn test_goddard_mdl_overweight_rejection() {
    let req = MissionDesignBudgetRequest {
        dry_mass_basic_kg: 45_000.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4_000.0,
        stage_configs: vec![
            StageConfig {
                stage_name: "CSM SPS".to_string(),
                dry_mass_kg: 10_000.0,
                propellant_mass_kg: 18_400.0,
                isp_s: 314.5,
                burn_delta_v_mps: None,
            },
            StageConfig {
                stage_name: "LM Descent".to_string(),
                dry_mass_kg: 4_500.0,
                propellant_mass_kg: 8_200.0,
                isp_s: 311.0,
                burn_delta_v_mps: None,
            },
        ],
        power_generation_watts: Some(1_400.0),
        launch_vehicle_capacity_kg: Some(MAX_TLI_PAYLOAD_CAPACITY_KG),
        mga_margin_pct: Some(20.0),
        mel_breakdown: None,
    };

    let eval = evaluate_mission_design_budget(&req);
    assert_eq!(eval.dry_mass_with_mga_kg, 54_000.0);
    assert_eq!(eval.mass_margin_kg, -5_391.0);
    assert!(!eval.is_mass_compliant);
    // Overweight designs fail Point Design closure and are downgraded to CML 2
    assert_eq!(eval.cml_score, 2);
    assert!((eval.overall_mdl_score - 69.30).abs() <= 0.1);
}

#[test]
fn test_goddard_mdl_power_margin_rule() {
    // Compliant case: 2100W gen, 1400W load -> 50% margin
    let req_ok = MissionDesignBudgetRequest {
        dry_mass_basic_kg: 15_000.0,
        power_load_watts: 1_400.0,
        delta_v_required_mps: 1_000.0,
        stage_configs: vec![
            StageConfig {
                stage_name: "Test Stage".to_string(),
                dry_mass_kg: 1_000.0,
                propellant_mass_kg: 2_000.0,
                isp_s: 300.0,
                burn_delta_v_mps: None,
            },
        ],
        power_generation_watts: Some(2_100.0),
        launch_vehicle_capacity_kg: None,
        mga_margin_pct: None,
        mel_breakdown: None,
    };
    let eval_ok = evaluate_mission_design_budget(&req_ok);
    assert_eq!(eval_ok.power_margin_pct, 50.0);
    assert!(eval_ok.is_power_compliant);

    // Deficient power case: 1400W gen, 1200W load -> 16.67% margin (< 30%)
    let req_fail = MissionDesignBudgetRequest {
        power_generation_watts: Some(1_400.0),
        power_load_watts: 1_200.0,
        ..req_ok
    };
    let eval_fail = evaluate_mission_design_budget(&req_fail);
    assert!((eval_fail.power_margin_pct - 16.6667).abs() < 1e-3);
    assert!(!eval_fail.is_power_compliant);

    // Zero power load edge case
    let req_zero = MissionDesignBudgetRequest {
        power_load_watts: 0.0,
        ..eval_ok_req()
    };
    let eval_zero = evaluate_mission_design_budget(&req_zero);
    assert_eq!(eval_zero.power_margin_pct, 0.0);
    assert!(!eval_zero.is_power_compliant);
}

fn eval_ok_req() -> MissionDesignBudgetRequest {
    MissionDesignBudgetRequest {
        dry_mass_basic_kg: 10_000.0,
        power_load_watts: 1_000.0,
        delta_v_required_mps: 2_000.0,
        stage_configs: vec![],
        power_generation_watts: Some(1_500.0),
        launch_vehicle_capacity_kg: None,
        mga_margin_pct: None,
        mel_breakdown: None,
    }
}

#[test]
fn test_multi_stage_delta_v_tsiolkovsky_budget() {
    let s_ivb_dv = calculate_stage_delta_v(15_116.0, 106_900.0, 421.0);
    assert!(s_ivb_dv > 8_000.0);

    let stages = vec![
        StageConfig {
            stage_name: "CSM SPS".to_string(),
            dry_mass_kg: 10_000.0,
            propellant_mass_kg: 18_400.0,
            isp_s: 314.5,
            burn_delta_v_mps: None,
        },
        StageConfig {
            stage_name: "LM Descent".to_string(),
            dry_mass_kg: 4_500.0,
            propellant_mass_kg: 8_200.0,
            isp_s: 311.0,
            burn_delta_v_mps: None,
        },
    ];
    let total_dv = calculate_multi_stage_delta_v(&stages);
    assert!((total_dv - 6_383.6047).abs() < 1e-2);

    // Test explicit burn delta_v override
    let stages_override = vec![
        StageConfig {
            stage_name: "Explicit Burn".to_string(),
            dry_mass_kg: 1_000.0,
            propellant_mass_kg: 1_000.0,
            isp_s: 300.0,
            burn_delta_v_mps: Some(2_500.0),
        },
    ];
    assert_eq!(calculate_multi_stage_delta_v(&stages_override), 2_500.0);
}

#[test]
fn test_jpl_cml_1_to_4_maturity_gates() {
    // CML 4: All 3 gates pass
    let cml4 = evaluate_cml_score(true, true, 35.0, 15.0, 5000.0, 15000.0, 4000.0);
    assert_eq!(cml4, 4);

    // CML 3: Mass compliant, power >= 15%, delta-v reserve >= 5% but not meeting full CML 4
    let cml3 = evaluate_cml_score(true, true, 20.0, 7.0, 4280.0, 15000.0, 4000.0);
    assert_eq!(cml3, 3);

    // CML 2: Basic mass within capacity, power >= 0%, but MGA mass not compliant
    let cml2 = evaluate_cml_score(false, true, 35.0, 15.0, 5000.0, 45000.0, 4000.0);
    assert_eq!(cml2, 2);

    // CML 1: Idea / Cocktail Napkin (negative power margin or zero mass)
    let cml1_a = evaluate_cml_score(false, false, -10.0, -30.0, 0.0, 55000.0, 4000.0);
    assert_eq!(cml1_a, 1);
    let cml1_b = evaluate_cml_score(true, true, 35.0, 15.0, 5000.0, 0.0, 4000.0);
    assert_eq!(cml1_b, 1);
}

#[test]
fn test_landing_radar_high_low_scale_shift() {
    // High scale: radar altitude > 762.0m
    let m1 = calculate_landing_radar(1_200.0, -25.0, 140.0, 150.0);
    assert_eq!(m1.inertial_altitude_m, 1_200.0);
    assert_eq!(m1.radar_altitude_m, 1_050.0);
    assert_eq!(m1.altitude_delta_m, 150.0);
    assert_eq!(m1.forward_velocity_mps, 140.0);
    assert_eq!(m1.vertical_velocity_mps, -25.0);
    assert_eq!(m1.lateral_velocity_mps, 0.0);
    assert_eq!(m1.scale_mode, 1);
    assert!(m1.data_good);

    // Exact threshold boundary: 762.0m -> Scale 2 (Low Scale)
    let m2 = calculate_landing_radar(762.0, -12.0, 60.0, 0.0);
    assert_eq!(m2.radar_altitude_m, 762.0);
    assert_eq!(m2.scale_mode, 2);
    assert!(m2.data_good);

    // Low scale: radar altitude < 762.0m
    let m3 = calculate_landing_radar(200.0, -5.0, 20.0, 0.0);
    assert_eq!(m3.scale_mode, 2);
    assert!(m3.data_good);
}

#[test]
fn test_landing_radar_crater_depression_and_clamping() {
    // Crater depression: terrain offset -15.0m -> radar alt rises to 65.0m
    let m_crater = calculate_landing_radar(50.0, -1.5, 2.0, -15.0);
    assert_eq!(m_crater.radar_altitude_m, 65.0);
    assert_eq!(m_crater.altitude_delta_m, -15.0);
    assert_eq!(m_crater.scale_mode, 2);
    assert!(m_crater.data_good);

    // Ground contact clamping: terrain offset 12.0m with 5.0m inertial alt -> clamped to 0.0m
    let m_clamp = calculate_landing_radar(5.0, -0.5, 0.2, 12.0);
    assert_eq!(m_clamp.radar_altitude_m, 0.0);
    assert_eq!(m_clamp.altitude_delta_m, 5.0);
    assert_eq!(m_clamp.scale_mode, 2);
    assert!(m_clamp.data_good);
}

#[test]
fn test_landing_radar_operational_envelopes_and_data_good() {
    // Altitude exceeds 15,240m (50,000 ft)
    let m_high = calculate_landing_radar(16_000.0, -30.0, 1_695.0, 0.0);
    assert!(!m_high.data_good);

    // Negative inertial altitude
    let m_neg = calculate_landing_radar(-1.0, 0.0, 0.0, 0.0);
    assert!(!m_neg.data_good);

    // Excessive horizontal velocity (> 1,800 m/s)
    let m_speed = calculate_landing_radar(5_000.0, -10.0, 1_850.0, 0.0);
    assert!(!m_speed.data_good);

    // Pitch limit check (> 65 degrees)
    let m_pitch = calculate_landing_radar_full(&LandingRadarInput {
        inertial_alt_m: 1_000.0,
        vertical_vel_mps: -10.0,
        horizontal_vel_mps: 50.0,
        terrain_elevation_offset_m: 0.0,
        pitch_angle_deg: Some(70.0),
        lateral_vel_mps: Some(2.5),
    });
    assert!(!m_pitch.data_good);
    assert_eq!(m_pitch.lateral_velocity_mps, 2.5);

    // Nominal pitch angle (<= 65 degrees)
    let m_pitch_ok = calculate_landing_radar_full(&LandingRadarInput {
        inertial_alt_m: 1_000.0,
        vertical_vel_mps: -10.0,
        horizontal_vel_mps: 50.0,
        terrain_elevation_offset_m: 0.0,
        pitch_angle_deg: Some(45.0),
        lateral_vel_mps: Some(1.0),
    });
    assert!(m_pitch_ok.data_good);
}

#[test]
fn test_lunar_mascon_gravitational_perturbation() {
    let model = LunarGravityModel::default();

    // Surface gravity without mascon
    let g_normal = model.local_acceleration(0.0, false);
    assert_eq!(g_normal, LUNAR_STANDARD_GRAVITY_MPS2);

    // Surface gravity with mascon (+280 mGal = 0.0028 m/s^2)
    let g_mascon = model.local_acceleration(0.0, true);
    assert!((g_mascon - 1.6248).abs() < 1e-6);

    // Direct helper function
    assert!((calculate_lunar_gravity(0.0, true) - 1.6248).abs() < 1e-6);
    assert_eq!(calculate_lunar_gravity(0.0, false), 1.622);

    // Orbital altitude (110.0 km = 110,000 m)
    let g_orb_normal = calculate_lunar_gravity(110_000.0, false);
    assert!((g_orb_normal - 1.43459).abs() < 1e-3);
    let g_orb_mascon = calculate_lunar_gravity(110_000.0, true);
    assert!((g_orb_mascon - (g_orb_normal + LUNAR_MASCON_ANOMALY_MPS2)).abs() < 1e-6);
}

#[test]
fn test_dsn_rtlt_and_lunar_occultation() {
    let nominal_dist = 384_400.0;

    // Case C1: Nominal Earth-Moon line of sight
    let res_c1 = calculate_dsn_telemetry(nominal_dist, 0.0, false);
    assert!((res_c1.rtlt_seconds - 2.56444).abs() < 1e-4);
    assert!((res_c1.path_loss_db - 211.3117).abs() < 1e-2);
    assert!((res_c1.received_power_dbm - (-100.8117)).abs() < 1e-2);
    assert!(!res_c1.is_occulted);

    // Case C2: Lunar farside occultation
    let res_c2 = calculate_dsn_telemetry(nominal_dist, 180.0, true);
    assert!(res_c2.is_occulted);
    assert_eq!(res_c2.received_power_dbm, -180.0);

    // Case C3: Occultation shadow cone window [109.872, 250.128]
    let res_c3 = calculate_dsn_telemetry(nominal_dist, 115.0, false);
    assert!(res_c3.is_occulted);
    assert_eq!(res_c3.received_power_dbm, -180.0);

    // Just outside occultation cone
    let res_outside = calculate_dsn_telemetry(nominal_dist, 105.0, false);
    assert!(!res_outside.is_occulted);

    // Anomaly modulo 360 wrap-around
    let res_wrap = calculate_dsn_telemetry(nominal_dist, 720.0, false);
    assert!(!res_wrap.is_occulted);
}

#[test]
fn test_lunar_environment_constants() {
    let consts = get_lunar_environment_constants();
    assert_eq!(consts.standard_gravity_mps2, 1.622);
    assert_eq!(consts.mascon_anomaly_mps2, 0.0028);
    assert_eq!(consts.mascon_anomaly_mgal, 280.0);
    assert_eq!(consts.local_gravity_effective_mps2, 1.6248);
    assert_eq!(consts.regolith_bulk_density_kg_m3, 1_500.0);
    assert_eq!(consts.regolith_bearing_capacity_kpa, 140.0);
    assert_eq!(consts.surface_temperature_c, 101.0);
    assert_eq!(consts.surface_temperature_day_c, 101.0);
    assert_eq!(consts.surface_temperature_night_c, -130.0);
    assert_eq!(consts.terrain_slope_deg, 4.5);
    assert_eq!(consts.moon_radius_km, 1_737.4);
}
