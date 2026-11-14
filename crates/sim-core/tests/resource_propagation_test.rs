use sim_core::{
    ResourceGraph, ResourceKind, ResourceNode,
};

#[test]
fn test_fuel_cell_mass_and_water() {
    let mut rg = ResourceGraph::new();

    // 1. PC3A-2 Fuel Cell producer: 4,260 W nominal
    let fc = ResourceNode::new_producer("EPS-SM-FC", "PC3A-2 Fuel Cell", 4260.0);
    let fc_idx = rg.add_node(fc);

    // 2. Cryo reactant tank: 325.6 kg
    let cryo = ResourceNode::new_storage("EPS-SM-TK1-CRYO", "Cryo Tank", 325.6, 325.6, ResourceKind::CryoReactantsKg);
    let cryo_idx = rg.add_node(cryo);

    // 3. Potable water storage: 100 kg capacity, initially 20 kg
    let water = ResourceNode::new_storage("EPS-SM-WATER", "Potable Water", 100.0, 20.0, ResourceKind::PotableWaterKg);
    let water_idx = rg.add_node(water);

    // 4. Electrical consumer: 4,260 W
    let load = ResourceNode::new_consumer("BUS-LOAD", "Electrical Bus Load", 4260.0, 1);
    let load_idx = rg.add_node(load);

    rg.add_edge(cryo_idx, fc_idx, 1.0);
    rg.add_edge(fc_idx, water_idx, 1.0);
    rg.add_edge(fc_idx, load_idx, 1.0);

    assert!(!rg.has_cycle());

    // Propagate 1 hour (3,600 seconds)
    rg.propagate_step(3600.0);

    // Reactant consumed: 4.26 kWh * 0.37 kg/kWh = 1.5762 kg
    let consumed = rg.cumulative_reactant_consumed_kg;
    let water_produced = rg.cumulative_water_produced_kg;

    assert!(
        (consumed - 1.5762).abs() < 0.002,
        "Expected reactant consumed ~1.5762 kg, got {:.4} kg",
        consumed
    );
    assert!(
        (water_produced - 1.5762).abs() < 0.002,
        "Expected water produced ~1.5762 kg, got {:.4} kg",
        water_produced
    );

    let cryo_remaining = rg.get_storage_current("EPS-SM-TK1-CRYO").unwrap();
    assert!((cryo_remaining - (325.6 - 1.5762)).abs() < 0.002);

    let water_current = rg.get_storage_current("EPS-SM-WATER").unwrap();
    assert!((water_current - (20.0 + 1.5762)).abs() < 0.002);
}

#[test]
fn test_eclipse_battery_drain() {
    let mut rg = ResourceGraph::new();

    // In lunar eclipse: solar generation is 0 W
    // LM Descent Battery: 46.48 kWh (1,660 Ah @ 28V)
    let bat = ResourceNode::new_storage(
        "EPS-LMD-BAT",
        "LM Descent Battery",
        46.48,
        46.48,
        ResourceKind::ElectricalWattHours,
    );
    let bat_idx = rg.add_node(bat);

    // Consumers: Spacecraft baseline 2,400 W + shadow heater penalty 85 W = 2,485 W
    let baseline = ResourceNode::new_consumer("LM-BASELINE", "Spacecraft Baseline", 2400.0, 1);
    let heater = ResourceNode::new_consumer("LM-HEATER", "Shadow Heaters", 85.0, 1);
    let base_idx = rg.add_node(baseline);
    let heat_idx = rg.add_node(heater);

    rg.add_edge(bat_idx, base_idx, 1.0);
    rg.add_edge(bat_idx, heat_idx, 1.0);

    // Eclipse duration: 2,771 seconds (46.18 min)
    let dt = 2771.0;
    rg.propagate_step(dt);

    // Energy consumed: 2,485 W * (2,771 / 3,600) Wh = 1,912.76 Wh ~ 1.9128 kWh
    let remaining = rg.get_storage_current("EPS-LMD-BAT").unwrap();
    let expected_remaining = 46.48 - (2485.0 * (dt / 3600.0) / 1000.0);

    assert!(
        (remaining - expected_remaining).abs() < 0.01,
        "Expected remaining battery ~{:.3} kWh, got {:.3} kWh",
        expected_remaining,
        remaining
    );
    assert!(!rg.brownout_active);
}

#[test]
fn test_empty_battery_brownout() {
    let mut rg = ResourceGraph::new();

    // Nearly empty battery: 0.001 kWh
    let bat = ResourceNode::new_storage("BAT", "Battery", 10.0, 0.001, ResourceKind::ElectricalWattHours);
    let bat_idx = rg.add_node(bat);

    // Critical consumer (priority 1)
    let agc = ResourceNode::new_consumer("AGC", "AGC Computer", 55.0, 1);
    let agc_idx = rg.add_node(agc);

    // Non-essential consumer (priority 3)
    let sci = ResourceNode::new_consumer("SCI", "Science Package", 200.0, 3);
    let sci_idx = rg.add_node(sci);

    rg.add_edge(bat_idx, agc_idx, 1.0);
    rg.add_edge(bat_idx, sci_idx, 1.0);

    // Step 20 seconds: 255W load consumes 1.42 Wh, depleting 0.001 kWh (1.0 Wh)
    rg.propagate_step(20.0);

    let current = rg.get_storage_current("BAT").unwrap();
    assert_eq!(current, 0.0);
    assert!(rg.brownout_active);

    // Non-essential priority 3 consumer should be shed (disabled)
    let sci_node = rg.graph.node_weights().find(|n| n.id == "SCI").unwrap();
    assert!(!sci_node.is_active, "Priority 3 consumer should be load-shed");
}

#[test]
fn test_cycle_detection() {
    let mut rg = ResourceGraph::new();
    let n1 = rg.add_node(ResourceNode::new_producer("P1", "Producer 1", 100.0));
    let n2 = rg.add_node(ResourceNode::new_consumer("C1", "Consumer 1", 100.0, 1));

    rg.add_edge(n1, n2, 1.0);
    assert!(!rg.has_cycle());

    // Introduce cycle: C1 -> P1
    rg.add_edge(n2, n1, 1.0);
    assert!(rg.has_cycle());
}
