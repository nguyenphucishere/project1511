use sim_core::*;

fn req(vehicle: &str, payload: f64, load: f64) -> LaunchPlanRequest {
    LaunchPlanRequest {
        vehicle_id: Some(vehicle.to_string()),
        vehicle: None,
        payload_mass_kg: payload,
        propellant_load_pct: load,
        parking_orbit_km: 185.0,
        destination: None,
        wind_speed_kmh: 15.0,
        wind_gust_kmh: None,
        thunderstorm: false,
    }
}

#[test]
fn saturn_v_delivers_the_apollo_11_stack_near_its_flown_capacity() {
    let r = plan_launch(&req("saturn-v", APOLLO_11_STACK_KG, 100.0));
    assert!(r.is_go, "{:?}", r.failure_reason);
    // Flown TLI capacity 48,609 kg; the ideal-rocket model lands within 3 %.
    assert!((r.payload_capacity_kg - MAX_TLI_PAYLOAD_CAPACITY_KG).abs() / MAX_TLI_PAYLOAD_CAPACITY_KG < 0.03);
    assert!(r.liftoff_twr > 1.15 && r.liftoff_twr < 1.25);
    assert!(r.max_q_kpa > 30.0 && r.max_q_kpa < 40.0);
    let min = r.min_propellant_load_pct.unwrap();
    assert!(min > 85.0 && min < 100.0);
}

#[test]
fn saturn_ib_cannot_reach_tli_with_any_apollo_stack() {
    let r = plan_launch(&req("saturn-ib", APOLLO_11_STACK_KG, 100.0));
    assert!(!r.is_go);
    assert_eq!(r.failure_mode.as_deref(), Some("over_capacity"));
    assert!(r.payload_capacity_kg < 1_000.0);
    assert_eq!(r.min_propellant_load_pct, None);
}

#[test]
fn below_the_minimum_load_runs_out_of_propellant_earlier_the_shorter_it_is() {
    let min = plan_launch(&req("saturn-v", APOLLO_11_STACK_KG, 100.0)).min_propellant_load_pct.unwrap();
    let at_min = plan_launch(&req("saturn-v", APOLLO_11_STACK_KG, min));
    assert!(at_min.is_go);
    let short = plan_launch(&req("saturn-v", APOLLO_11_STACK_KG, min - 2.0));
    assert_eq!(short.failure_mode.as_deref(), Some("propellant_depletion"));
    let shorter = plan_launch(&req("saturn-v", APOLLO_11_STACK_KG, 70.0));
    assert!(shorter.failure_time_s.unwrap() < short.failure_time_s.unwrap());
}

#[test]
fn higher_parking_orbits_need_more_propellant() {
    let mut low = req("saturn-v", APOLLO_11_STACK_KG, 100.0);
    low.parking_orbit_km = 160.0;
    let mut high = low.clone();
    high.parking_orbit_km = 250.0;
    assert!(plan_launch(&low).min_propellant_load_pct < plan_launch(&high).min_propellant_load_pct);
}

#[test]
fn weather_outside_the_commit_criteria_fails_whatever_the_vehicle() {
    let mut windy = req("saturn-v", APOLLO_11_STACK_KG, 100.0);
    windy.wind_speed_kmh = MAX_SUSTAINED_WIND_KMH + 1.0;
    let r = plan_launch(&windy);
    assert_eq!(r.failure_mode.as_deref(), Some("wind_shear"));
    assert!((r.failure_time_s.unwrap() - r.max_q_time_s).abs() < 1e-9);

    let mut gusty = req("saturn-v", APOLLO_11_STACK_KG, 100.0);
    gusty.wind_gust_kmh = Some(MAX_PEAK_GUST_KMH + 1.0);
    assert_eq!(plan_launch(&gusty).failure_mode.as_deref(), Some("wind_shear"));

    let mut edge = req("saturn-v", APOLLO_11_STACK_KG, 100.0);
    edge.wind_speed_kmh = MAX_SUSTAINED_WIND_KMH;
    edge.wind_gust_kmh = Some(MAX_PEAK_GUST_KMH);
    assert!(plan_launch(&edge).is_go, "the limits themselves are still launchable");

    let mut storm = req("saturn-v", APOLLO_11_STACK_KG, 100.0);
    storm.thunderstorm = true;
    let r = plan_launch(&storm);
    assert_eq!(r.failure_mode.as_deref(), Some("lightning_strike"));
    assert_eq!(r.failure_time_s, Some(LIGHTNING_STRIKE_TIME_S));
}

#[test]
fn unknown_vehicle_is_reported_not_panicked() {
    let r = plan_launch(&req("n1", 1.0, 100.0));
    assert!(!r.is_go);
    assert!(r.error_message.unwrap().contains("Unknown vehicle_id"));
}
