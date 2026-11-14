use sim_wasm::{
    calculate_dsn_telemetry, calculate_landing_radar, calculate_score,
    evaluate_mission_design_budget, get_lunar_environment_constants, ping,
    run_descent_step, validate_launch,
};

#[test]
fn test_sim_wasm_ping() {
    let result = ping();
    assert_eq!(result, "sim-wasm v1.0.0 (Apollo 11 engine)");
}

#[test]
fn test_sim_wasm_validate_launch_valid() {
    let config_json = r#"{
        "vehicle_id": "AS-506",
        "vehicle_mass": 0.0,
        "propellant_mass": 0.0,
        "payload_mass": 45702.0,
        "stage_count": 3,
        "target_orbit_km": 185.0,
        "wind_speed_kmh": 15.0,
        "wet_mass_kg": 2938315.0
    }"#;

    let res_json = validate_launch(config_json);
    let v: serde_json::Value = serde_json::from_str(&res_json).expect("Must return valid JSON");

    assert_eq!(v["is_valid"], true);
    assert!((v["glom_kg"].as_f64().unwrap() - 2938315.0).abs() < 1.0);
    assert!((v["liftoff_twr"].as_f64().unwrap() - 1.174).abs() < 0.01);
    assert!((v["max_q_kpa"].as_f64().unwrap() - 34.3).abs() < 1.0);
}

#[test]
fn test_sim_wasm_validate_launch_invalid_json() {
    let bad_json = "NOT_JSON_DATA";
    let res_json = validate_launch(bad_json);
    let v: serde_json::Value = serde_json::from_str(&res_json).expect("Must return error JSON");

    assert_eq!(v["is_valid"], false);
    assert!(v["failure_reason"].as_str().unwrap().contains("Invalid JSON"));
}

#[test]
fn test_sim_wasm_run_descent_step() {
    let state_json = r#"{
        "altitude_m": 500.0,
        "vertical_velocity_mps": -5.0,
        "horizontal_velocity_mps": 18.0,
        "throttle_pct": 30.0,
        "propellant_remaining_kg": 1000.0,
        "agc_cpu_duty_pct": 72.0,
        "is_bingo_fuel": false,
        "is_landed": false,
        "touchdown_status": "IN_FLIGHT"
    }"#;

    let res_json = run_descent_step(state_json);
    let v: serde_json::Value = serde_json::from_str(&res_json).expect("Must return valid JSON");

    assert_eq!(v["is_landed"], false);
    assert!(v["altitude_m"].as_f64().unwrap() < 500.0);
    assert!(v["propellant_remaining_kg"].as_f64().unwrap() < 1000.0);
}

#[test]
fn test_sim_wasm_calculate_score() {
    let req_json = r#"{
        "science_score": 1000.0,
        "cost_score": 400.0,
        "risk_penalty": 50.0,
        "weight_science": 1.0,
        "weight_cost": 0.5,
        "weight_risk": 0.8,
        "active_anomalies": ["ANOM-A11-01"]
    }"#;

    let res_json = calculate_score(req_json);
    let v: serde_json::Value = serde_json::from_str(&res_json).expect("Must return valid JSON");

    assert_eq!(v["is_success"], true);
    // 1000 - 200 - 40 = 760
    assert!((v["final_score"].as_f64().unwrap() - 760.0).abs() < 1e-4);
    let failure_chain = v["failure_chain"].as_array().unwrap();
    assert_eq!(failure_chain.len(), 1);
    assert!(failure_chain[0].as_str().unwrap().contains("ANOM-A11-01"));
}

#[test]
fn test_wasm_calculate_landing_radar_valid() {
    let input_json = r#"{
        "inertial_alt_m": 1200.0,
        "vertical_vel_mps": -25.0,
        "horizontal_vel_mps": 140.0,
        "terrain_elevation_offset_m": 150.0
    }"#;
    let res = calculate_landing_radar(input_json);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["scale_mode"], 1);
    assert_eq!(v["radar_altitude_m"], 1050.0);
    assert_eq!(v["altitude_delta_m"], 150.0);
    assert_eq!(v["data_good"], true);
}

#[test]
fn test_wasm_calculate_landing_radar_scale_shift() {
    let input_json = r#"{
        "inertial_alt_m": 762.0,
        "vertical_vel_mps": -10.0,
        "horizontal_vel_mps": 50.0,
        "terrain_elevation_offset_m": 0.0
    }"#;
    let res = calculate_landing_radar(input_json);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["scale_mode"], 2);
    assert_eq!(v["radar_altitude_m"], 762.0);
    assert_eq!(v["data_good"], true);
}

#[test]
fn test_wasm_calculate_landing_radar_malformed_json() {
    let res = calculate_landing_radar("NOT_A_VALID_JSON");
    let v: serde_json::Value = serde_json::from_str(&res).expect("Error JSON must be valid JSON");

    assert_eq!(v["data_good"], false);
    assert!(v["error_message"].as_str().unwrap().contains("Invalid JSON"));
}

#[test]
fn test_wasm_evaluate_mdl_budget_nominal_cml4() {
    let input_json = r#"{
        "dry_mass_basic_kg": 15100.0,
        "power_load_watts": 950.0,
        "delta_v_required_mps": 4000.0,
        "stage_configs": [
            {
                "stage_name": "CSM SPS",
                "dry_mass_kg": 10000.0,
                "propellant_mass_kg": 18400.0,
                "isp_s": 314.5
            },
            {
                "stage_name": "LM Descent",
                "dry_mass_kg": 4500.0,
                "propellant_mass_kg": 8200.0,
                "isp_s": 311.0
            }
        ]
    }"#;
    let res = evaluate_mission_design_budget(input_json);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["cml_score"], 4);
    assert_eq!(v["is_mass_compliant"], true);
    assert_eq!(v["is_power_compliant"], true);
    assert_eq!(v["is_delta_v_compliant"], true);
    assert_eq!(v["overall_mdl_score"], 100.0);
}

#[test]
fn test_wasm_evaluate_mdl_budget_overweight_cml2() {
    let input_json = r#"{
        "dry_mass_basic_kg": 45000.0,
        "power_load_watts": 950.0,
        "delta_v_required_mps": 4000.0,
        "stage_configs": [
            {
                "stage_name": "CSM SPS",
                "dry_mass_kg": 10000.0,
                "propellant_mass_kg": 18400.0,
                "isp_s": 314.5
            },
            {
                "stage_name": "LM Descent",
                "dry_mass_kg": 4500.0,
                "propellant_mass_kg": 8200.0,
                "isp_s": 311.0
            }
        ]
    }"#;
    let res = evaluate_mission_design_budget(input_json);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["cml_score"], 2);
    assert_eq!(v["is_mass_compliant"], false);
    assert!(v["overall_mdl_score"].as_f64().unwrap() < 75.0);
}

#[test]
fn test_wasm_evaluate_mdl_budget_deficient_deltav_cml3() {
    let input_json = r#"{
        "dry_mass_basic_kg": 15100.0,
        "power_load_watts": 950.0,
        "delta_v_required_mps": 6000.0,
        "stage_configs": [
            {
                "stage_name": "CSM SPS",
                "dry_mass_kg": 10000.0,
                "propellant_mass_kg": 18400.0,
                "isp_s": 314.5
            },
            {
                "stage_name": "LM Descent",
                "dry_mass_kg": 4500.0,
                "propellant_mass_kg": 8200.0,
                "isp_s": 311.0
            }
        ]
    }"#;
    let res = evaluate_mission_design_budget(input_json);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["cml_score"], 3);
    assert_eq!(v["is_mass_compliant"], true);
    assert_eq!(v["is_power_compliant"], true);
    assert_eq!(v["is_delta_v_compliant"], false);
    let reserve = v["delta_v_reserve_pct"].as_f64().unwrap();
    assert!((reserve - 6.3934).abs() < 0.05);
}

#[test]
fn test_wasm_evaluate_mdl_budget_malformed_json() {
    let res = evaluate_mission_design_budget("{incomplete_json");
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON error response");

    assert_eq!(v["cml_score"], 1);
    assert_eq!(v["is_mass_compliant"], false);
    assert!(v["error_message"].as_str().unwrap().contains("Invalid JSON"));
}

#[test]
fn test_wasm_calculate_dsn_telemetry_line_of_sight() {
    let input_json = r#"{
        "distance_km": 384400.0,
        "true_anomaly_deg": 0.0,
        "is_farside": false
    }"#;
    let res = calculate_dsn_telemetry(input_json);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["is_occulted"], false);
    assert!((v["rtlt_seconds"].as_f64().unwrap() - 2.5644).abs() < 1e-3);
    assert!((v["path_loss_db"].as_f64().unwrap() - 211.31).abs() < 0.1);
}

#[test]
fn test_wasm_calculate_dsn_telemetry_occultation() {
    let input_json = r#"{
        "distance_km": 384400.0,
        "true_anomaly_deg": 180.0,
        "is_farside": true
    }"#;
    let res = calculate_dsn_telemetry(input_json);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["is_occulted"], true);
    assert_eq!(v["received_power_dbm"], -180.0);
}

#[test]
fn test_wasm_get_lunar_environment_constants() {
    let res = get_lunar_environment_constants();
    let v: serde_json::Value = serde_json::from_str(&res).expect("Valid JSON");

    assert_eq!(v["standard_gravity_mps2"], 1.622);
    assert_eq!(v["mascon_anomaly_mps2"], 0.0028);
    assert_eq!(v["local_gravity_effective_mps2"], 1.6248);
    assert_eq!(v["regolith_bulk_density_kg_m3"], 1500.0);
    assert_eq!(v["regolith_bearing_capacity_kpa"], 140.0);
    assert_eq!(v["surface_temperature_c"], 101.0);
}

#[test]
fn test_wasm_evaluate_mdl_budget_type_mismatch() {
    let bad_input = r#"{"dry_mass_basic_kg": "not_a_number", "power_load_watts": 950.0, "delta_v_required_mps": 4000.0}"#;
    let res = evaluate_mission_design_budget(bad_input);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Must parse cleanly without syntax error");

    assert_eq!(v["cml_score"], 1);
    assert_eq!(v["is_mass_compliant"], false);
    assert_eq!(v["is_power_compliant"], false);
    let err_msg = v["error_message"].as_str().expect("error_message must be a string");
    assert!(err_msg.contains("Invalid JSON:"));
    assert!(err_msg.contains("not_a_number"));
}

#[test]
fn test_wasm_calculate_landing_radar_type_mismatch() {
    let bad_input = r#"{"inertial_alt_m": "not_a_number", "vertical_vel_mps": -20.0, "horizontal_vel_mps": 100.0}"#;
    let res = calculate_landing_radar(bad_input);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Must parse cleanly without syntax error");

    assert_eq!(v["data_good"], false);
    let err_msg = v["error_message"].as_str().expect("error_message must be a string");
    assert!(err_msg.contains("Invalid JSON:"));
    assert!(err_msg.contains("not_a_number"));
}

#[test]
fn test_wasm_validate_launch_type_mismatch() {
    let bad_input = r#"{"payload_mass": "not_a_number"}"#;
    let res = validate_launch(bad_input);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Must parse cleanly without syntax error");

    assert_eq!(v["is_valid"], false);
    let err_msg = v["error_message"].as_str().expect("error_message must be a string");
    assert!(err_msg.contains("Invalid JSON:"));
    assert!(err_msg.contains("not_a_number"));
}

#[test]
fn test_wasm_run_descent_step_type_mismatch() {
    let bad_input = r#"{"altitude_m": "not_a_number"}"#;
    let res = run_descent_step(bad_input);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Must parse cleanly without syntax error");

    assert_eq!(v["is_landed"], false);
    let status = v["touchdown_status"].as_str().expect("touchdown_status must be a string");
    assert!(status.contains("Invalid JSON:"));
    assert!(status.contains("not_a_number"));
}

#[test]
fn test_wasm_calculate_score_type_mismatch() {
    let bad_input = r#"{"science_score": "not_a_number"}"#;
    let res = calculate_score(bad_input);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Must parse cleanly without syntax error");

    assert_eq!(v["is_success"], false);
    let err = v["error"].as_str().expect("error must be a string");
    assert!(err.contains("Invalid JSON:"));
    assert!(err.contains("not_a_number"));
}

#[test]
fn test_wasm_calculate_dsn_telemetry_type_mismatch() {
    let bad_input = r#"{"distance_km": "not_a_number"}"#;
    let res = calculate_dsn_telemetry(bad_input);
    let v: serde_json::Value = serde_json::from_str(&res).expect("Must parse cleanly without syntax error");

    assert_eq!(v["is_occulted"], false);
    let err_msg = v["error_message"].as_str().expect("error_message must be a string");
    assert!(err_msg.contains("Invalid JSON:"));
    assert!(err_msg.contains("not_a_number"));
}


