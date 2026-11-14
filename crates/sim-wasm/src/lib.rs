use wasm_bindgen::prelude::*;
use sim_core::{
    DescentState, LaunchConfiguration,
    evaluate_mission, step_descent, validate_launch_envelope,
};
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
pub fn init_simulation_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn ping() -> String {
    "sim-wasm v1.0.0 (Apollo 11 engine)".to_string()
}

#[wasm_bindgen]
pub fn validate_launch(json_str: &str) -> String {
    match serde_json::from_str::<LaunchConfiguration>(json_str) {
        Ok(config) => {
            let validation = validate_launch_envelope(&config);
            serde_json::to_string(&validation).unwrap_or_else(|e| {
                format!(
                    r#"{{"is_valid":false,"glom_kg":0.0,"liftoff_twr":0.0,"max_q_kpa":0.0,"max_q_time_s":0.0,"payload_margin_kg":0.0,"failure_reason":"Serialization error: {}","error_message":"Serialization error: {}"}}"#,
                    e, e
                )
            })
        }
        Err(e) => {
            format!(
                r#"{{"is_valid":false,"glom_kg":0.0,"liftoff_twr":0.0,"max_q_kpa":0.0,"max_q_time_s":0.0,"payload_margin_kg":0.0,"failure_reason":"Invalid JSON: {}","error_message":"Invalid JSON: {}"}}"#,
                e, e
            )
        }
    }
}

#[wasm_bindgen]
pub fn run_descent_step(json_str: &str) -> String {
    match serde_json::from_str::<DescentState>(json_str) {
        Ok(mut state) => {
            step_descent(&mut state, 1.0);
            serde_json::to_string(&state).unwrap_or_else(|e| {
                format!(
                    r#"{{"altitude_m":0.0,"vertical_velocity_mps":0.0,"horizontal_velocity_mps":0.0,"throttle_pct":0.0,"propellant_remaining_kg":0.0,"agc_cpu_duty_pct":0.0,"is_bingo_fuel":false,"is_landed":false,"touchdown_status":"Serialization error: {}"}}"#,
                    e
                )
            })
        }
        Err(e) => {
            format!(
                r#"{{"altitude_m":0.0,"vertical_velocity_mps":0.0,"horizontal_velocity_mps":0.0,"throttle_pct":0.0,"propellant_remaining_kg":0.0,"agc_cpu_duty_pct":0.0,"is_bingo_fuel":false,"is_landed":false,"touchdown_status":"Invalid JSON: {}"}}"#,
                e
            )
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScoreInputRequest {
    #[serde(default)]
    pub science_score: f64,
    #[serde(default)]
    pub cost_score: f64,
    #[serde(default)]
    pub risk_penalty: f64,
    #[serde(default = "default_ws")]
    pub weight_science: f64,
    #[serde(default = "default_wc")]
    pub weight_cost: f64,
    #[serde(default = "default_wr")]
    pub weight_risk: f64,
    #[serde(default)]
    pub active_anomalies: Vec<String>,
}

fn default_ws() -> f64 {
    1.0
}
fn default_wc() -> f64 {
    0.5
}
fn default_wr() -> f64 {
    0.8
}

#[wasm_bindgen]
pub fn calculate_score(json_str: &str) -> String {
    match serde_json::from_str::<ScoreInputRequest>(json_str) {
        Ok(req) => {
            let anomaly_refs: Vec<&str> = req.active_anomalies.iter().map(|s| s.as_str()).collect();
            let result = evaluate_mission(
                req.science_score,
                req.cost_score,
                req.risk_penalty,
                req.weight_science,
                req.weight_cost,
                req.weight_risk,
                &anomaly_refs,
            );
            serde_json::to_string(&result).unwrap_or_else(|e| {
                format!(
                    r#"{{"is_success":false,"final_score":0.0,"science_score":0.0,"cost_score":0.0,"risk_penalty":0.0,"failure_chain":[],"error":"{}"}}"#,
                    e
                )
            })
        }
        Err(e) => {
            format!(
                r#"{{"is_success":false,"final_score":0.0,"science_score":0.0,"cost_score":0.0,"risk_penalty":0.0,"failure_chain":[],"error":"Invalid JSON: {}"}}"#,
                e
            )
        }
    }
}

#[wasm_bindgen]
pub fn run_step(config: JsValue) -> JsValue {
    // Legacy JsValue wrapper delegating to validate_launch or ping
    serde_wasm_bindgen::to_value(&ping()).unwrap_or(config)
}
