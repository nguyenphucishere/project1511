use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfiguration {
    pub vehicle_id: String,
    pub wet_mass_kg: f64,
    pub target_perigee_km: f64,
    pub target_apogee_km: f64,
    pub target_inclination_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchValidation {
    pub is_valid: bool,
    pub payload_margin_kg: f64,
    pub error_message: Option<String>,
}

pub fn validate_launch_envelope(_config: &LaunchConfiguration) -> LaunchValidation {
    todo!("validate_launch_envelope placeholder")
}
