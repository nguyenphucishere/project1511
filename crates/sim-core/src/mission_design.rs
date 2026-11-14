use serde::{Deserialize, Serialize};
use crate::launch::STANDARD_GRAVITY;
pub use crate::launch::MAX_TLI_PAYLOAD_CAPACITY_KG;

/// Nominal Preliminary Design Mass Growth Allowance (MGA) per AIAA S-120-2006 (%)
pub const DEFAULT_MGA_MARGIN_PCT: f64 = 20.0;
/// Goddard MDL Minimum Power Margin standard (%)
pub const MIN_POWER_MARGIN_PCT: f64 = 30.0;
/// Goddard MDL Minimum Delta-V Reserve standard (%)
pub const MIN_DELTA_V_RESERVE_PCT: f64 = 10.0;
/// Nominal Apollo 11 EPS Fuel Cell power generation (Watts)
pub const APOLLO_11_NOMINAL_POWER_GEN_WATTS: f64 = 2_100.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageConfig {
    pub stage_name: String,
    pub dry_mass_kg: f64,
    pub propellant_mass_kg: f64,
    #[serde(alias = "isp_seconds", alias = "isp_vac_s")]
    pub isp_s: f64,
    #[serde(default)]
    pub burn_delta_v_mps: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SubsystemMel {
    #[serde(default)]
    pub structure_kg: f64,
    #[serde(default)]
    pub thermal_kg: f64,
    #[serde(default)]
    pub propulsion_hardware_kg: f64,
    #[serde(default)]
    pub eps_kg: f64,
    #[serde(default)]
    pub gnc_avionics_kg: f64,
    #[serde(default)]
    pub communications_kg: f64,
    #[serde(default)]
    pub eclss_kg: f64,
    #[serde(default)]
    pub science_payload_kg: f64,
}

impl SubsystemMel {
    pub fn total_basic_dry_mass(&self) -> f64 {
        self.structure_kg
            + self.thermal_kg
            + self.propulsion_hardware_kg
            + self.eps_kg
            + self.gnc_avionics_kg
            + self.communications_kg
            + self.eclss_kg
            + self.science_payload_kg
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionDesignBudgetRequest {
    pub dry_mass_basic_kg: f64,
    pub power_load_watts: f64,
    pub delta_v_required_mps: f64,
    #[serde(default)]
    pub stage_configs: Vec<StageConfig>,
    #[serde(default)]
    pub power_generation_watts: Option<f64>,
    #[serde(default)]
    pub launch_vehicle_capacity_kg: Option<f64>,
    #[serde(default)]
    pub mga_margin_pct: Option<f64>,
    #[serde(default)]
    pub mel_breakdown: Option<SubsystemMel>,
}

pub type MdlBudgetRequest = MissionDesignBudgetRequest;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MissionDesignBudgetResponse {
    pub dry_mass_with_mga_kg: f64,
    pub mass_margin_kg: f64,
    pub is_mass_compliant: bool,
    pub power_margin_pct: f64,
    pub is_power_compliant: bool,
    pub delta_v_available_mps: f64,
    pub delta_v_reserve_pct: f64,
    pub is_delta_v_compliant: bool,
    pub cml_score: u8,
    pub overall_mdl_score: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

pub type MdlBudgetEvaluation = MissionDesignBudgetResponse;

/// Calculate dry mass with Mass Growth Allowance (MGA) per AIAA S-120-2006
pub fn calculate_mga_dry_mass(basic_dry_mass_kg: f64, mga_margin_pct: f64) -> f64 {
    if basic_dry_mass_kg <= 0.0 {
        return 0.0;
    }
    basic_dry_mass_kg * (1.0 + (mga_margin_pct.max(0.0) / 100.0))
}

/// Calculate single stage Delta-V using Tsiolkovsky rocket equation
pub fn calculate_stage_delta_v(dry_mass_kg: f64, prop_mass_kg: f64, isp_s: f64) -> f64 {
    if dry_mass_kg <= 0.0 || prop_mass_kg <= 0.0 || isp_s <= 0.0 {
        return 0.0;
    }
    let m0 = dry_mass_kg + prop_mass_kg;
    let mf = dry_mass_kg;
    isp_s * STANDARD_GRAVITY * (m0 / mf).ln()
}

/// Calculate cumulative Delta-V across multi-stage stack
pub fn calculate_multi_stage_delta_v(stages: &[StageConfig]) -> f64 {
    let mut total_dv = 0.0;
    for stage in stages {
        if let Some(explicit_dv) = stage.burn_delta_v_mps {
            total_dv += explicit_dv;
        } else {
            total_dv += calculate_stage_delta_v(stage.dry_mass_kg, stage.propellant_mass_kg, stage.isp_s);
        }
    }
    total_dv
}

/// Evaluate Concept Maturity Level (CML 1 to 4) per JPL Wessen et al.
pub fn evaluate_cml_score(
    is_mass_compliant: bool,
    basic_mass_under_capacity: bool,
    power_margin_pct: f64,
    delta_v_reserve_pct: f64,
    delta_v_available_mps: f64,
    basic_dry_mass: f64,
    delta_v_required_mps: f64,
) -> u8 {
    if basic_dry_mass <= 0.0 || delta_v_required_mps <= 0.0 {
        return 1;
    }
    if is_mass_compliant
        && power_margin_pct >= MIN_POWER_MARGIN_PCT
        && delta_v_reserve_pct >= MIN_DELTA_V_RESERVE_PCT
        && delta_v_available_mps > 0.0
    {
        4 // Point Design / Preferred Baseline
    } else if is_mass_compliant
        && power_margin_pct >= 15.0
        && delta_v_reserve_pct >= 5.0
    {
        3 // Trade Space Exploration
    } else if basic_mass_under_capacity
        && power_margin_pct >= 0.0
        && delta_v_reserve_pct >= -20.0
    {
        2 // Initial Feasibility
    } else {
        1 // Cocktail Napkin
    }
}

/// Main evaluation entry point for Goddard MDL budget audit
pub fn evaluate_mission_design_budget(req: &MissionDesignBudgetRequest) -> MissionDesignBudgetResponse {
    let launch_capacity = req.launch_vehicle_capacity_kg.unwrap_or(MAX_TLI_PAYLOAD_CAPACITY_KG);

    // 1. Dry Mass with MGA
    let mga_pct = req.mga_margin_pct.unwrap_or(DEFAULT_MGA_MARGIN_PCT);
    let basic_dry_mass = if req.dry_mass_basic_kg > 0.0 {
        req.dry_mass_basic_kg
    } else if let Some(mel) = &req.mel_breakdown {
        mel.total_basic_dry_mass()
    } else {
        0.0
    };
    let dry_mass_with_mga_kg = calculate_mga_dry_mass(basic_dry_mass, mga_pct);
    let mass_margin_kg = launch_capacity - dry_mass_with_mga_kg;
    let is_mass_compliant = basic_dry_mass > 0.0 && mass_margin_kg >= 0.0;
    let basic_mass_under_capacity = basic_dry_mass > 0.0 && (launch_capacity - basic_dry_mass) >= 0.0;

    // 2. Power Budget & Margin
    let (power_margin_pct, is_power_compliant) = if req.power_load_watts <= 0.0 {
        (0.0, false)
    } else {
        let load_watts = req.power_load_watts;
        let gen_watts = req.power_generation_watts.unwrap_or_else(|| {
            if load_watts <= 1000.0 {
                1_400.0 // Nominal Apollo CSM 2-cell capability
            } else if load_watts <= 1500.0 {
                APOLLO_11_NOMINAL_POWER_GEN_WATTS // 2,100 W 3-cell capability
            } else {
                load_watts * 1.35
            }
        });
        let margin = ((gen_watts - load_watts) / load_watts) * 100.0;
        let compliant = margin >= MIN_POWER_MARGIN_PCT;
        (margin, compliant)
    };

    // 3. Multi-Stage Delta-V Budget & Reserve
    let delta_v_available_mps = calculate_multi_stage_delta_v(&req.stage_configs);
    let (delta_v_reserve_pct, is_delta_v_compliant) = if req.delta_v_required_mps <= 0.0 {
        (0.0, false)
    } else {
        let req_dv = req.delta_v_required_mps;
        let reserve = ((delta_v_available_mps - req_dv) / req_dv) * 100.0;
        let compliant = reserve >= MIN_DELTA_V_RESERVE_PCT;
        (reserve, compliant)
    };

    // 4. JPL CML Score
    let cml_score = evaluate_cml_score(
        is_mass_compliant,
        basic_mass_under_capacity,
        power_margin_pct,
        delta_v_reserve_pct,
        delta_v_available_mps,
        basic_dry_mass,
        req.delta_v_required_mps,
    );

    // 5. Overall Continuous Goddard MDL Score (0.0 to 100.0)
    let mass_margin_pct = (mass_margin_kg / launch_capacity) * 100.0;
    let mass_score = if is_mass_compliant {
        (50.0 + mass_margin_pct * 2.5).clamp(0.0, 100.0)
    } else if basic_dry_mass > 0.0 {
        (50.0 + mass_margin_pct * 3.4).clamp(0.0, 50.0)
    } else {
        0.0
    };

    let power_score = (power_margin_pct / MIN_POWER_MARGIN_PCT * 100.0).clamp(0.0, 100.0);
    let dv_score = (delta_v_reserve_pct / MIN_DELTA_V_RESERVE_PCT * 100.0).clamp(0.0, 100.0);

    let overall_mdl_score = if basic_dry_mass <= 0.0 || req.delta_v_required_mps <= 0.0 {
        0.0
    } else {
        let raw = 0.35 * mass_score + 0.35 * dv_score + 0.30 * power_score;
        (raw.clamp(0.0, 100.0) * 100.0).round() / 100.0
    };

    MissionDesignBudgetResponse {
        dry_mass_with_mga_kg,
        mass_margin_kg,
        is_mass_compliant,
        power_margin_pct,
        is_power_compliant,
        delta_v_available_mps,
        delta_v_reserve_pct,
        is_delta_v_compliant,
        cml_score,
        overall_mdl_score,
        error_message: None,
    }
}
