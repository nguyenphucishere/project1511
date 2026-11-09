use petgraph::graph::DiGraph;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeType {
    Producer { rate: f64 },
    Storage { capacity: f64, initial: f64 },
    Consumer { rate: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceNode {
    pub id: String,
    pub name: String,
    pub node_type: NodeType,
}

#[derive(Debug, Default)]
pub struct ResourceGraph {
    pub graph: DiGraph<ResourceNode, f64>,
}

impl ResourceGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
        }
    }

    pub fn propagate_step(&mut self, _delta_t: f64) {
        todo!("propagate_step placeholder")
    }
}
