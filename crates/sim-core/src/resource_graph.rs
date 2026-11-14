use petgraph::algo::is_cyclic_directed;
use petgraph::graph::{DiGraph, NodeIndex};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResourceKind {
    ElectricalWatts,
    ElectricalWattHours,
    CryoReactantsKg,
    PotableWaterKg,
    PropellantKg,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeType {
    Producer {
        rate: f64,
        #[serde(default)]
        resource_kind: Option<ResourceKind>,
    },
    Storage {
        capacity: f64,
        initial: f64,
        #[serde(default)]
        current: f64,
        #[serde(default)]
        resource_kind: Option<ResourceKind>,
    },
    Consumer {
        rate: f64,
        #[serde(default = "default_priority")]
        priority: u8, // 1 = critical (AGC, IMU), 2 = operational (radars), 3 = non-essential
    },
}

fn default_priority() -> u8 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceNode {
    pub id: String,
    pub name: String,
    pub node_type: NodeType,
    #[serde(default = "default_active")]
    pub is_active: bool,
}

fn default_active() -> bool {
    true
}

impl ResourceNode {
    pub fn new_producer(id: &str, name: &str, rate_watts: f64) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            node_type: NodeType::Producer {
                rate: rate_watts,
                resource_kind: Some(ResourceKind::ElectricalWatts),
            },
            is_active: true,
        }
    }

    pub fn new_storage(id: &str, name: &str, capacity: f64, initial: f64, kind: ResourceKind) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            node_type: NodeType::Storage {
                capacity,
                initial,
                current: initial,
                resource_kind: Some(kind),
            },
            is_active: true,
        }
    }

    pub fn new_consumer(id: &str, name: &str, rate_watts: f64, priority: u8) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            node_type: NodeType::Consumer {
                rate: rate_watts,
                priority,
            },
            is_active: true,
        }
    }
}

#[derive(Debug)]
pub struct ResourceGraph {
    pub graph: DiGraph<ResourceNode, f64>,
    pub brownout_active: bool,
    pub cumulative_reactant_consumed_kg: f64,
    pub cumulative_water_produced_kg: f64,
}

impl Default for ResourceGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl ResourceGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            brownout_active: false,
            cumulative_reactant_consumed_kg: 0.0,
            cumulative_water_produced_kg: 0.0,
        }
    }

    pub fn add_node(&mut self, mut node: ResourceNode) -> NodeIndex {
        // Initialize current storage level if not set
        if let NodeType::Storage { initial, ref mut current, .. } = node.node_type {
            if *current == 0.0 && initial > 0.0 {
                *current = initial;
            }
        }
        self.graph.add_node(node)
    }

    pub fn add_edge(&mut self, from: NodeIndex, to: NodeIndex, weight: f64) {
        self.graph.add_edge(from, to, weight);
    }

    pub fn has_cycle(&self) -> bool {
        is_cyclic_directed(&self.graph)
    }

    pub fn total_generation(&self) -> f64 {
        let mut sum = 0.0;
        for node in self.graph.node_weights() {
            if node.is_active {
                if let NodeType::Producer { rate, .. } = node.node_type {
                    sum += rate;
                }
            }
        }
        sum
    }

    pub fn total_consumption(&self) -> f64 {
        let mut sum = 0.0;
        for node in self.graph.node_weights() {
            if node.is_active {
                if let NodeType::Consumer { rate, .. } = node.node_type {
                    sum += rate;
                }
            }
        }
        sum
    }

    pub fn get_storage_current(&self, id: &str) -> Option<f64> {
        for node in self.graph.node_weights() {
            if node.id == id {
                if let NodeType::Storage { current, .. } = node.node_type {
                    return Some(current);
                }
            }
        }
        None
    }

    pub fn set_storage_current(&mut self, id: &str, value: f64) {
        for node in self.graph.node_weights_mut() {
            if node.id == id {
                if let NodeType::Storage { ref mut current, capacity, .. } = node.node_type {
                    *current = value.clamp(0.0, capacity);
                }
            }
        }
    }

    pub fn set_node_active(&mut self, id: &str, active: bool) {
        for node in self.graph.node_weights_mut() {
            if node.id == id {
                node.is_active = active;
            }
        }
    }

    /// Propagate discrete time step of delta_t seconds across resource DAG
    pub fn propagate_step(&mut self, delta_t_s: f64) {
        let dt = delta_t_s.max(0.0);

        // 1. Calculate Fuel Cell power generation and Cryo reactant / water balance
        // Specific reactant consumption: 0.37 kg / kWh = 0.37 / 3,600,000 kg / (W * s)
        let mut fc_power_generated = 0.0;
        for node in self.graph.node_weights() {
            if node.is_active && node.id.contains("FC") {
                if let NodeType::Producer { rate, .. } = node.node_type {
                    fc_power_generated += rate;
                }
            }
        }

        if fc_power_generated > 0.0 {
            let energy_kwh = (fc_power_generated * dt) / 3_600_000.0;
            let reactant_consumed_kg = energy_kwh * 0.37;
            self.cumulative_reactant_consumed_kg += reactant_consumed_kg;
            self.cumulative_water_produced_kg += reactant_consumed_kg;

            let mut fc_exhausted = false;
            // Deduct from cryo reactant storage node
            for node in self.graph.node_weights_mut() {
                if node.id.contains("CRYO") || node.id.contains("TK") {
                    if let NodeType::Storage { ref mut current, .. } = node.node_type {
                        *current = (*current - reactant_consumed_kg).max(0.0);
                        if *current <= 0.0 {
                            fc_exhausted = true;
                        }
                    }
                }
                if node.id.contains("WATER") {
                    if let NodeType::Storage { ref mut current, capacity, .. } = node.node_type {
                        *current = (*current + reactant_consumed_kg).min(capacity);
                    }
                }
            }

            if fc_exhausted {
                for fc_node in self.graph.node_weights_mut() {
                    if fc_node.id.contains("FC") {
                        fc_node.is_active = false;
                    }
                }
            }
        }

        // 2. Net electrical power balance
        let generation = self.total_generation();
        let consumption = self.total_consumption();
        let net_power_w = generation - consumption;

        // 3. Update battery storage
        if net_power_w < 0.0 {
            // Deficit: discharge batteries
            let deficit_energy_wh = (-net_power_w * dt) / 3600.0;
            let deficit_energy_kwh = deficit_energy_wh / 1000.0;

            let mut remaining_deficit_kwh = deficit_energy_kwh;
            for node in self.graph.node_weights_mut() {
                if node.is_active && remaining_deficit_kwh > 0.0 {
                    if let NodeType::Storage { ref mut current, .. } = node.node_type {
                        if *current > 0.0 {
                            let drawn = remaining_deficit_kwh.min(*current);
                            *current -= drawn;
                            remaining_deficit_kwh -= drawn;
                        }
                    }
                }
            }

            // Brownout check: if batteries are exhausted and deficit remains
            if remaining_deficit_kwh > 0.0 {
                self.brownout_active = true;
                // Priority load shedding: shed priority 3 first, then priority 2
                for node in self.graph.node_weights_mut() {
                    if let NodeType::Consumer { priority, .. } = node.node_type {
                        if priority >= 3 {
                            node.is_active = false;
                        }
                    }
                }
            } else {
                self.brownout_active = false;
            }
        } else if net_power_w > 0.0 {
            // Surplus: charge rechargeable storage
            let surplus_energy_kwh = (net_power_w * dt) / 3_600_000.0;
            let mut remaining_surplus = surplus_energy_kwh;

            for node in self.graph.node_weights_mut() {
                if remaining_surplus > 0.0 {
                    if let NodeType::Storage { ref mut current, capacity, .. } = node.node_type {
                        if *current < capacity {
                            let added = remaining_surplus.min(capacity - *current);
                            *current += added;
                            remaining_surplus -= added;
                        }
                    }
                }
            }
            self.brownout_active = false;
        }
    }
}
