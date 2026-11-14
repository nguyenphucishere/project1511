use sim_core::{
    calculate_lmde_mass_flow_rate_kg_s, calculate_lmde_thrust_n, evaluate_touchdown_limits,
    is_in_prohibited_throttle_band, step_descent, validate_throttle, DescentState,
    BINGO_FUEL_RESERVE_KG, LOW_LEVEL_FUEL_WARNING_KG,
};

#[test]
fn test_lmde_throttle_prohibited_band() {
    // Continuous band 10-60%: allowed
    assert!(validate_throttle(10.0).is_ok());
    assert!(validate_throttle(40.0).is_ok());
    assert!(validate_throttle(60.0).is_ok());

    // FTP band 92.5-100%: allowed
    assert!(validate_throttle(92.5).is_ok());
    assert!(validate_throttle(95.0).is_ok());
    assert!(validate_throttle(100.0).is_ok());

    // Prohibited cavitation band 60.1-92.4%: rejected
    assert!(validate_throttle(60.1).is_err());
    assert!(validate_throttle(70.0).is_err());
    assert!(validate_throttle(80.0).is_err());
    assert!(validate_throttle(92.4).is_err());

    assert!(is_in_prohibited_throttle_band(70.0));
    assert!(!is_in_prohibited_throttle_band(50.0));
    assert!(!is_in_prohibited_throttle_band(95.0));
}

#[test]
fn test_fuel_warning_and_bingo_limit() {
    let mut state = DescentState {
        altitude_m: 50.0,
        vertical_velocity_mps: -1.0,
        horizontal_velocity_mps: 0.5,
        throttle_pct: 30.0, // Hover throttle
        propellant_remaining_kg: 300.0,
        agc_cpu_duty_pct: 70.0,
        is_bingo_fuel: false,
        is_landed: false,
        touchdown_status: "IN_FLIGHT".to_string(),
    };

    // Above warning
    assert!(state.propellant_remaining_kg > LOW_LEVEL_FUEL_WARNING_KG);

    // Step into low level warning
    state.propellant_remaining_kg = 250.0;
    step_descent(&mut state, 1.0);
    assert!(state.propellant_remaining_kg <= LOW_LEVEL_FUEL_WARNING_KG);
    assert!(!state.is_bingo_fuel);

    // Step into Bingo fuel limit (<= 112 kg)
    state.propellant_remaining_kg = 100.0;
    step_descent(&mut state, 1.0);
    assert!(state.is_bingo_fuel);
    assert!(state.propellant_remaining_kg <= BINGO_FUEL_RESERVE_KG);
}

#[test]
fn test_touchdown_structural_limits() {
    // Case 1: Nominal touchdown well inside envelope
    let (pass1, status1) = evaluate_touchdown_limits(0.5, 1.5, 3.0, 0.5);
    assert!(pass1);
    assert_eq!(status1, "Success");

    // Case 2: Boundary of maximum safe envelope (Vx = 1.22 m/s, Vz = 2.13 m/s)
    let (pass2, status2) = evaluate_touchdown_limits(1.22, 2.13, 12.0, 2.0);
    assert!(pass2);
    assert_eq!(status2, "Success");

    // Case 3: Horizontal tip-over (Vx = 1.25 m/s > 1.22 m/s)
    let (pass3, status3) = evaluate_touchdown_limits(1.25, 1.0, 5.0, 0.5);
    assert!(!pass3);
    assert_eq!(status3, "LateralTipOver");

    // Case 4: Vertical gear collapse (Vz = 3.10 m/s > 3.05 m/s)
    let (pass4, status4) = evaluate_touchdown_limits(0.0, 3.10, 5.0, 0.5);
    assert!(!pass4);
    assert_eq!(status4, "StructuralGearCollapse");

    // Case 5: Surface tilt angle exceeded (tilt = 12.5 deg > 12.0 deg)
    let (pass5, status5) = evaluate_touchdown_limits(0.5, 1.5, 12.5, 0.5);
    assert!(!pass5);
    assert_eq!(status5, "SurfaceSlopeExceeded");

    // Case 6: Angular body rate exceeded (rate = 2.2 deg/s > 2.0 deg/s)
    let (pass6, status6) = evaluate_touchdown_limits(0.5, 1.5, 5.0, 2.2);
    assert!(!pass6);
    assert_eq!(status6, "AngularRateExceeded");
}

#[test]
fn test_powered_descent_dynamics_propagation() {
    let mut state = DescentState {
        altitude_m: 10.0,
        vertical_velocity_mps: -2.0,
        horizontal_velocity_mps: 0.5,
        throttle_pct: 100.0,
        propellant_remaining_kg: 500.0,
        agc_cpu_duty_pct: 70.0,
        is_bingo_fuel: false,
        is_landed: false,
        touchdown_status: "IN_FLIGHT".to_string(),
    };

    let initial_fuel = state.propellant_remaining_kg;
    let thrust = calculate_lmde_thrust_n(100.0);
    let mdot = calculate_lmde_mass_flow_rate_kg_s(thrust);

    // FTP burn rate should be ~14.76 kg/s
    assert!((mdot - 14.76).abs() < 0.2);

    step_descent(&mut state, 1.0);
    let fuel_consumed = initial_fuel - state.propellant_remaining_kg;
    assert!((fuel_consumed - mdot).abs() < 0.1);

    // Terminal descent configuration for final touchdown
    state.altitude_m = 5.0;
    state.vertical_velocity_mps = -1.5;
    state.throttle_pct = 15.0;

    // Propagate until touchdown (altitude reaches 0)
    for _ in 0..10 {
        if state.is_landed {
            break;
        }
        step_descent(&mut state, 1.0);
    }

    assert!(state.is_landed, "Vehicle should have touched down");
    assert_eq!(state.altitude_m, 0.0);
    assert!(state.touchdown_status == "SAFE_LANDING" || state.touchdown_status == "ROUGH_LANDING");
}
