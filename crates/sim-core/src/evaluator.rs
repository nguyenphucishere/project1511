use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationResult {
    pub is_success: bool,
    pub final_score: f64,
    pub science_score: f64,
    pub cost_score: f64,
    pub risk_penalty: f64,
}

pub fn calculate_score(_science: f64, _cost: f64, _risk: f64, _ws: f64, _wc: f64, _wr: f64) -> f64 {
    todo!("calculate_score placeholder")
}

pub fn trace_failure_chain() -> Vec<String> {
    todo!("trace_failure_chain placeholder")
}
