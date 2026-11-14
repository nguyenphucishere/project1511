use sim_core::*;

#[test]
fn apollo_11_ascent_matches_the_flight_record() {
    let p = simulate_ascent(&AscentProfileRequest::default());
    assert!(p.reached_orbit, "{:?}", p.error_message);
    // §1.2: GLOM 2,938,315 kg, TWR 1.174, Max-Q 34.3 kPa near T+83 s.
    assert!((p.glom_kg - 2_938_315.0).abs() < 1.0);
    assert!((p.liftoff_twr - 1.174).abs() < 0.002);
    assert!((p.events.max_q_kpa - 34.3).abs() < 2.0, "max-Q {}", p.events.max_q_kpa);
    assert!((p.events.max_q_s - 83.0).abs() < 10.0, "max-Q at {}", p.events.max_q_s);
    // Insertion: 185 km parking orbit, EPO velocity 7,791 m/s.
    assert!((p.insertion_altitude_km - 185.0).abs() < 1.0);
    assert!((p.insertion_velocity_mps - 7_791.0).abs() < 30.0);
    let ins = p.events.insertion_s.unwrap();
    assert!(ins > 650.0 && ins < 760.0, "insertion at {ins}");
    assert_eq!(p.events.s_ic_oeco_s.map(|t| (t * 10.0).round() / 10.0), Some(161.1));
    assert_eq!(p.events.les_jettison_s.map(|t| (t * 10.0).round() / 10.0), Some(197.9));
    // S-IVB keeps propellant for the TLI burn.
    assert!(p.s_ivb_propellant_remaining_kg > 40_000.0);
}

#[test]
fn ascent_samples_are_continuous_and_feel_like_a_saturn_v() {
    let p = simulate_ascent(&AscentProfileRequest::default());
    let peak_g = p.samples.iter().map(|s| s.sensed_accel_g).fold(0.0, f64::max);
    assert!(peak_g > 3.0 && peak_g < 4.8, "peak g {peak_g}");
    let liftoff = &p.samples[0];
    assert!((liftoff.sensed_accel_g - p.liftoff_twr).abs() < 1e-9);
    for w in p.samples.windows(2) {
        assert!(w[1].met_s > w[0].met_s);
    }
    // Staging coast: almost weightless between S-IC cutoff and S-II ignition.
    let coast = p.samples.iter().find(|s| s.stage == 0).unwrap();
    assert!(coast.sensed_accel_g < 0.1);
}

#[test]
fn ascent_targets_the_chosen_parking_orbit() {
    for km in [160.0, 185.0, 250.0] {
        let p = simulate_ascent(&AscentProfileRequest { parking_orbit_km: km, ..Default::default() });
        assert!(p.reached_orbit);
        assert!((p.insertion_altitude_km - km).abs() < 1.5, "{km}: {}", p.insertion_altitude_km);
    }
}

#[test]
fn powered_descent_reaches_the_low_gate_like_apollo_11() {
    let p = simulate_powered_descent(&DescentProfileRequest::default());
    assert!((p.local_gravity_mps2 - 1.6248).abs() < 1e-9, "gravity from the engine's lunar constants");
    // §4.3 low gate: 152.4 m, 18.3 m/s forward, −4.6…−5.8 m/s vertical.
    assert!((p.low_gate.altitude_m - 152.4).abs() < 2.0);
    assert!((p.low_gate.horizontal_velocity_mps - 18.3).abs() < 1.0);
    assert!(p.low_gate.vertical_velocity_mps < -4.4 && p.low_gate.vertical_velocity_mps > -6.0);
    assert!((p.high_gate.altitude_m - 2_255.5).abs() < 60.0);
    // Hover at the low gate needs 26–30 % of rated thrust (§4.3).
    assert!(p.hover_throttle_at_low_gate > 0.25 && p.hover_throttle_at_low_gate < 0.31);
    // The throttle comes down from FTP during braking, and the radar locks below 12.2 km.
    assert!(p.throttle_down_s.unwrap() > 300.0 && p.throttle_down_s.unwrap() < 500.0);
    assert!(p.radar_lock_s.is_some());
    // §4.3 attitude: ~65° braking → ~35° after the high-gate pitchover → < 10° at the low gate.
    let at = |t: f64| p.samples.iter().find(|s| s.t_s >= t).unwrap().attitude_from_vertical_deg;
    assert!(at(300.0) > 60.0, "braking attitude {}", at(300.0));
    assert!(at(515.0) < 60.0 && at(515.0) > 25.0, "after pitchover {}", at(515.0));
    assert!(at(560.0) < at(515.0) && at(600.0) < at(560.0), "keeps pitching upright through the approach");
    let near_lg = &p.samples[p.samples.len() - 3];
    assert!(near_lg.attitude_from_vertical_deg < 10.0, "low gate attitude {}", near_lg.attitude_from_vertical_deg);
    assert!(p.low_gate.propellant_kg > 0.0 && p.low_gate.propellant_kg < 0.25 * 8_200.0);
    // Throttle respects the DPS bands: 10–60 % or FTP 92.5–100 %.
    for s in &p.samples[..p.samples.len() - 1] {
        assert!((0.1..=0.6 + 1e-9).contains(&s.throttle) || (0.925 - 1e-9..=1.0).contains(&s.throttle), "{}", s.throttle);
    }
}
