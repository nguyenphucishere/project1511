use wasm_bindgen::prelude::*;
use sim_core::{
    calculate_dsn_telemetry_full, calculate_landing_radar_full,
    evaluate_mission_design_budget as core_evaluate_mdl, get_lunar_environment_constants as core_get_lunar_constants,
    DescentState, DsnTelemetryRequest, DsnTelemetryResponse, LandingRadarInput,
    LandingRadarMeasurement, LaunchConfiguration, LaunchValidation,
    MissionDesignBudgetRequest, MissionDesignBudgetResponse, evaluate_mission,
    step_descent, validate_launch_envelope,
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
                let err_resp = LaunchValidation {
                    is_valid: false,
                    glom_kg: 0.0,
                    liftoff_twr: 0.0,
                    max_q_kpa: 0.0,
                    max_q_time_s: 0.0,
                    payload_margin_kg: 0.0,
                    failure_reason: Some(format!("Serialization error: {}", e)),
                    error_message: Some(format!("Serialization error: {}", e)),
                };
                serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                    r#"{"is_valid":false,"glom_kg":0.0,"liftoff_twr":0.0,"max_q_kpa":0.0,"max_q_time_s":0.0,"payload_margin_kg":0.0,"failure_reason":"Serialization error","error_message":"Serialization error"}"#.to_string()
                })
            })
        }
        Err(e) => {
            let err_resp = LaunchValidation {
                is_valid: false,
                glom_kg: 0.0,
                liftoff_twr: 0.0,
                max_q_kpa: 0.0,
                max_q_time_s: 0.0,
                payload_margin_kg: 0.0,
                failure_reason: Some(format!("Invalid JSON: {}", e)),
                error_message: Some(format!("Invalid JSON: {}", e)),
            };
            serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                r#"{"is_valid":false,"glom_kg":0.0,"liftoff_twr":0.0,"max_q_kpa":0.0,"max_q_time_s":0.0,"payload_margin_kg":0.0,"failure_reason":"Invalid JSON","error_message":"Invalid JSON"}"#.to_string()
            })
        }
    }
}

#[wasm_bindgen]
pub fn run_descent_step(json_str: &str) -> String {
    match serde_json::from_str::<DescentState>(json_str) {
        Ok(mut state) => {
            step_descent(&mut state, 1.0);
            serde_json::to_string(&state).unwrap_or_else(|e| {
                let err = DescentState {
                    altitude_m: 0.0,
                    vertical_velocity_mps: 0.0,
                    horizontal_velocity_mps: 0.0,
                    throttle_pct: 0.0,
                    propellant_remaining_kg: 0.0,
                    agc_cpu_duty_pct: 0.0,
                    is_bingo_fuel: false,
                    is_landed: false,
                    touchdown_status: format!("Serialization error: {}", e),
                };
                serde_json::to_string(&err).unwrap_or_else(|_| {
                    r#"{"altitude_m":0.0,"vertical_velocity_mps":0.0,"horizontal_velocity_mps":0.0,"throttle_pct":0.0,"propellant_remaining_kg":0.0,"agc_cpu_duty_pct":0.0,"is_bingo_fuel":false,"is_landed":false,"touchdown_status":"Serialization error"}"#.to_string()
                })
            })
        }
        Err(e) => {
            let err = DescentState {
                altitude_m: 0.0,
                vertical_velocity_mps: 0.0,
                horizontal_velocity_mps: 0.0,
                throttle_pct: 0.0,
                propellant_remaining_kg: 0.0,
                agc_cpu_duty_pct: 0.0,
                is_bingo_fuel: false,
                is_landed: false,
                touchdown_status: format!("Invalid JSON: {}", e),
            };
            serde_json::to_string(&err).unwrap_or_else(|_| {
                r#"{"altitude_m":0.0,"vertical_velocity_mps":0.0,"horizontal_velocity_mps":0.0,"throttle_pct":0.0,"propellant_remaining_kg":0.0,"agc_cpu_duty_pct":0.0,"is_bingo_fuel":false,"is_landed":false,"touchdown_status":"Invalid JSON"}"#.to_string()
            })
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreResponse {
    pub is_success: bool,
    pub final_score: f64,
    pub science_score: f64,
    pub cost_score: f64,
    pub risk_penalty: f64,
    pub failure_chain: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
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
                let err_msg = format!("Serialization error: {}", e);
                let err_resp = ScoreResponse {
                    is_success: false,
                    final_score: 0.0,
                    science_score: 0.0,
                    cost_score: 0.0,
                    risk_penalty: 0.0,
                    failure_chain: Vec::new(),
                    error: Some(err_msg.clone()),
                    error_message: Some(err_msg),
                };
                serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                    r#"{"is_success":false,"final_score":0.0,"science_score":0.0,"cost_score":0.0,"risk_penalty":0.0,"failure_chain":[],"error":"Serialization error","error_message":"Serialization error"}"#.to_string()
                })
            })
        }
        Err(e) => {
            let err_msg = format!("Invalid JSON: {}", e);
            let err_resp = ScoreResponse {
                is_success: false,
                final_score: 0.0,
                science_score: 0.0,
                cost_score: 0.0,
                risk_penalty: 0.0,
                failure_chain: Vec::new(),
                error: Some(err_msg.clone()),
                error_message: Some(err_msg),
            };
            serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                r#"{"is_success":false,"final_score":0.0,"science_score":0.0,"cost_score":0.0,"risk_penalty":0.0,"failure_chain":[],"error":"Invalid JSON","error_message":"Invalid JSON"}"#.to_string()
            })
        }
    }
}

#[wasm_bindgen]
pub fn run_step(config: JsValue) -> JsValue {
    // Legacy JsValue wrapper delegating to validate_launch or ping
    serde_wasm_bindgen::to_value(&ping()).unwrap_or(config)
}

#[wasm_bindgen]
pub fn calculate_landing_radar(json_str: &str) -> String {
    match serde_json::from_str::<LandingRadarInput>(json_str) {
        Ok(input) => {
            let res = calculate_landing_radar_full(&input);
            serde_json::to_string(&res).unwrap_or_else(|e| {
                let err_resp = LandingRadarMeasurement {
                    inertial_altitude_m: 0.0,
                    radar_altitude_m: 0.0,
                    altitude_delta_m: 0.0,
                    forward_velocity_mps: 0.0,
                    vertical_velocity_mps: 0.0,
                    lateral_velocity_mps: 0.0,
                    scale_mode: 1,
                    data_good: false,
                    error_message: Some(format!("Serialization error: {}", e)),
                };
                serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                    r#"{"inertial_altitude_m":0.0,"radar_altitude_m":0.0,"altitude_delta_m":0.0,"forward_velocity_mps":0.0,"vertical_velocity_mps":0.0,"lateral_velocity_mps":0.0,"scale_mode":1,"data_good":false,"error_message":"Serialization error"}"#.to_string()
                })
            })
        }
        Err(e) => {
            let err_resp = LandingRadarMeasurement {
                inertial_altitude_m: 0.0,
                radar_altitude_m: 0.0,
                altitude_delta_m: 0.0,
                forward_velocity_mps: 0.0,
                vertical_velocity_mps: 0.0,
                lateral_velocity_mps: 0.0,
                scale_mode: 1,
                data_good: false,
                error_message: Some(format!("Invalid JSON: {}", e)),
            };
            serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                r#"{"inertial_altitude_m":0.0,"radar_altitude_m":0.0,"altitude_delta_m":0.0,"forward_velocity_mps":0.0,"vertical_velocity_mps":0.0,"lateral_velocity_mps":0.0,"scale_mode":1,"data_good":false,"error_message":"Invalid JSON"}"#.to_string()
            })
        }
    }
}

#[wasm_bindgen]
pub fn evaluate_mission_design_budget(json_str: &str) -> String {
    match serde_json::from_str::<MissionDesignBudgetRequest>(json_str) {
        Ok(req) => {
            let res = core_evaluate_mdl(&req);
            serde_json::to_string(&res).unwrap_or_else(|e| {
                let err_resp = MissionDesignBudgetResponse {
                    dry_mass_with_mga_kg: 0.0,
                    mass_margin_kg: 0.0,
                    is_mass_compliant: false,
                    power_margin_pct: 0.0,
                    is_power_compliant: false,
                    delta_v_available_mps: 0.0,
                    delta_v_reserve_pct: 0.0,
                    is_delta_v_compliant: false,
                    cml_score: 1,
                    overall_mdl_score: 0.0,
                    error_message: Some(format!("Serialization error: {}", e)),
                };
                serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                    r#"{"dry_mass_with_mga_kg":0.0,"mass_margin_kg":0.0,"is_mass_compliant":false,"power_margin_pct":0.0,"is_power_compliant":false,"delta_v_available_mps":0.0,"delta_v_reserve_pct":0.0,"is_delta_v_compliant":false,"cml_score":1,"overall_mdl_score":0.0,"error_message":"Serialization error"}"#.to_string()
                })
            })
        }
        Err(e) => {
            let err_resp = MissionDesignBudgetResponse {
                dry_mass_with_mga_kg: 0.0,
                mass_margin_kg: 0.0,
                is_mass_compliant: false,
                power_margin_pct: 0.0,
                is_power_compliant: false,
                delta_v_available_mps: 0.0,
                delta_v_reserve_pct: 0.0,
                is_delta_v_compliant: false,
                cml_score: 1,
                overall_mdl_score: 0.0,
                error_message: Some(format!("Invalid JSON: {}", e)),
            };
            serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                r#"{"dry_mass_with_mga_kg":0.0,"mass_margin_kg":0.0,"is_mass_compliant":false,"power_margin_pct":0.0,"is_power_compliant":false,"delta_v_available_mps":0.0,"delta_v_reserve_pct":0.0,"is_delta_v_compliant":false,"cml_score":1,"overall_mdl_score":0.0,"error_message":"Invalid JSON"}"#.to_string()
            })
        }
    }
}

#[wasm_bindgen]
pub fn calculate_dsn_telemetry(json_str: &str) -> String {
    match serde_json::from_str::<DsnTelemetryRequest>(json_str) {
        Ok(req) => {
            let res = calculate_dsn_telemetry_full(&req);
            serde_json::to_string(&res).unwrap_or_else(|e| {
                let err_resp = DsnTelemetryResponse {
                    rtlt_seconds: 0.0,
                    path_loss_db: 0.0,
                    received_power_dbm: 0.0,
                    is_occulted: false,
                    error_message: Some(format!("Serialization error: {}", e)),
                };
                serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                    r#"{"rtlt_seconds":0.0,"path_loss_db":0.0,"received_power_dbm":0.0,"is_occulted":false,"error_message":"Serialization error"}"#.to_string()
                })
            })
        }
        Err(e) => {
            let err_resp = DsnTelemetryResponse {
                rtlt_seconds: 0.0,
                path_loss_db: 0.0,
                received_power_dbm: 0.0,
                is_occulted: false,
                error_message: Some(format!("Invalid JSON: {}", e)),
            };
            serde_json::to_string(&err_resp).unwrap_or_else(|_| {
                r#"{"rtlt_seconds":0.0,"path_loss_db":0.0,"received_power_dbm":0.0,"is_occulted":false,"error_message":"Invalid JSON"}"#.to_string()
            })
        }
    }
}

#[wasm_bindgen]
pub fn get_lunar_environment_constants() -> String {
    let constants = core_get_lunar_constants();
    serde_json::to_string(&constants).unwrap_or_else(|e| {
        let mut fallback = core_get_lunar_constants();
        fallback.error_message = Some(format!("Serialization error: {}", e));
        serde_json::to_string(&fallback).unwrap_or_else(|_| {
            r#"{"standard_gravity_mps2":1.622,"mascon_anomaly_mps2":0.0028,"mascon_anomaly_mgal":280.0,"local_gravity_effective_mps2":1.6248,"terrain_slope_deg":4.5,"regolith_bulk_density_kg_m3":1500.0,"regolith_bearing_capacity_kpa":140.0,"surface_temperature_c":101.0,"surface_temperature_day_c":101.0,"surface_temperature_night_c":-130.0,"moon_radius_km":1737.4,"error_message":"Serialization error"}"#.to_string()
        })
    })
}


/// Launch planning for the mission-control console (vehicle, payload, propellant load, orbit, weather).
#[wasm_bindgen]
pub fn plan_launch(json_str: &str) -> String {
    let error_json = |msg: String| {
        serde_json::json!({ "is_go": false, "error_message": msg, "failure_reason": msg }).to_string()
    };
    match serde_json::from_str::<sim_core::LaunchPlanRequest>(json_str) {
        Ok(req) => serde_json::to_string(&sim_core::plan_launch(&req))
            .unwrap_or_else(|e| error_json(format!("Serialization error: {}", e))),
        Err(e) => error_json(format!("Invalid JSON: {}", e)),
    }
}

/// Vehicle presets and launch commit criteria the console offers.
#[wasm_bindgen]
pub fn get_launch_catalog() -> String {
    serde_json::json!({
        "vehicles": sim_core::launch_vehicle_presets(),
        "criteria": sim_core::launch_commit_criteria(),
    })
    .to_string()
}

/// Scene 4: Saturn V ascent profile from liftoff to parking-orbit insertion.
#[wasm_bindgen]
pub fn simulate_ascent(json_str: &str) -> String {
    match serde_json::from_str::<sim_core::AscentProfileRequest>(json_str) {
        Ok(req) => serde_json::to_string(&sim_core::simulate_ascent(&req))
            .unwrap_or_else(|e| serde_json::json!({ "error_message": format!("Serialization error: {}", e) }).to_string()),
        Err(e) => serde_json::json!({ "error_message": format!("Invalid JSON: {}", e) }).to_string(),
    }
}

/// Scene 6: LM powered descent profile from PDI to the low gate.
#[wasm_bindgen]
pub fn simulate_powered_descent(json_str: &str) -> String {
    match serde_json::from_str::<sim_core::DescentProfileRequest>(json_str) {
        Ok(req) => serde_json::to_string(&sim_core::simulate_powered_descent(&req))
            .unwrap_or_else(|e| serde_json::json!({ "error_message": format!("Serialization error: {}", e) }).to_string()),
        Err(e) => serde_json::json!({ "error_message": format!("Invalid JSON: {}", e) }).to_string(),
    }
}
