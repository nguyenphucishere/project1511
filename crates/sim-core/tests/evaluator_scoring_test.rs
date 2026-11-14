use sim_core::{
    calculate_score, evaluate_mission, get_historical_anomalies, trace_failure_chain,
};

#[test]
fn test_composite_score_formula_baseline() {
    let s = 2000.0;
    let c = 10000.0;
    let r = 150.0;
    let ws = 1.0;
    let wc = 0.1;
    let wr = 1.0;

    let score = calculate_score(s, c, r, ws, wc, wr);
    let expected = 1.0 * 2000.0 - 0.1 * 10000.0 - 1.0 * 150.0; // 850.0
    assert!((score - expected).abs() < 1e-6);
}

#[test]
fn test_composite_score_difficulty_tiers() {
    let s = 1000.0;
    let c = 400.0;
    let r = 50.0;

    // Beginner weights: (1.0, 0.5, 0.5)
    let score_beg = calculate_score(s, c, r, 1.0, 0.5, 0.5);
    assert_eq!(score_beg, 1000.0 - 200.0 - 25.0); // 775.0

    // Intermediate weights: (1.0, 1.0, 1.0)
    let score_int = calculate_score(s, c, r, 1.0, 1.0, 1.0);
    assert_eq!(score_int, 1000.0 - 400.0 - 50.0); // 550.0

    // Advanced weights: (1.2, 1.5, 2.0)
    let score_adv = calculate_score(s, c, r, 1.2, 1.5, 2.0);
    assert_eq!(score_adv, 1200.0 - 600.0 - 100.0); // 500.0

    // Floor clamp at 0.0
    let score_zero = calculate_score(10.0, 1000.0, 500.0, 1.0, 1.0, 1.0);
    assert_eq!(score_zero, 0.0);
}

#[test]
fn test_failure_chain_tracing_apollo11_alarms() {
    let chain = trace_failure_chain();
    assert!(!chain.is_empty());

    let has_1202 = chain.iter().any(|entry| entry.contains("ANOM-A11-01") && entry.contains("102:38:22") || entry.contains("369502"));
    let has_bailout = chain.iter().any(|entry| entry.contains("BAILOUT") || entry.contains("1202"));
    let has_west_crater = chain.iter().any(|entry| entry.contains("ANOM-A11-02") || entry.contains("hover"));

    assert!(has_1202, "Trace chain should record ANOM-A11-01 1202 alarm");
    assert!(has_bailout, "Trace chain should record BAILOUT recovery");
    assert!(has_west_crater, "Trace chain should record West Crater redesignation");
}

#[test]
fn test_evaluate_mission_outcomes() {
    // Mission 1: Successful landing with Apollo 11 historical alarms handled
    let res_success = evaluate_mission(
        800.0,
        380.0,
        20.0,
        1.0,
        0.5,
        0.8,
        &["ANOM-A11-01", "ANOM-A11-02"],
    );

    assert!(res_success.is_success);
    assert!(res_success.final_score > 0.0);
    assert_eq!(res_success.failure_chain.len(), 2);

    // Mission 2: Mission catastrophe with massive penalty
    let res_fail = evaluate_mission(
        50.0,
        800.0,
        500.0,
        1.0,
        1.0,
        2.0,
        &["ANOM-A13-01"],
    );

    assert!(!res_fail.is_success);
    assert_eq!(res_fail.final_score, 0.0);
    assert_eq!(res_fail.failure_chain.len(), 1);
    assert!(res_fail.failure_chain[0].contains("ANOM-A13-01"));
}

#[test]
fn test_all_historical_anomalies_registered() {
    let anomalies = get_historical_anomalies();
    assert_eq!(anomalies.len(), 8, "Expected exactly 8 historical anomalies");

    let codes: Vec<String> = anomalies.iter().map(|a| a.anomaly_code.clone()).collect();
    assert!(codes.contains(&"ANOM-A11-01".to_string()));
    assert!(codes.contains(&"ANOM-A11-02".to_string()));
    assert!(codes.contains(&"ANOM-A12-01".to_string()));
    assert!(codes.contains(&"ANOM-A13-01".to_string()));
    assert!(codes.contains(&"ANOM-A13-02".to_string()));
    assert!(codes.contains(&"ANOM-A14-01".to_string()));
    assert!(codes.contains(&"ANOM-A14-02".to_string()));
    assert!(codes.contains(&"ANOM-A15-01".to_string()));
}
