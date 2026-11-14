use sim_wasm::{calculate_score, ping, run_descent_step, validate_launch};

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
