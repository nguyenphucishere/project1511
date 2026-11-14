use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailureTraceStep {
    pub timestamp_s: f64,
    pub subsystem: String,
    pub anomaly_code: String,
    pub description: String,
    pub consequence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationResult {
    pub is_success: bool,
    pub final_score: f64,
    pub science_score: f64,
    pub cost_score: f64,
    pub risk_penalty: f64,
    #[serde(default)]
    pub failure_chain: Vec<String>,
}

/// Calculate multi-criteria composite mission score:
/// Score = ws * Science - wc * Cost - wr * Risk
pub fn calculate_score(science: f64, cost: f64, risk: f64, ws: f64, wc: f64, wr: f64) -> f64 {
    let raw_score = ws * science - wc * cost - wr * risk;
    raw_score.max(0.0)
}

/// Retrieve the 8 authoritative Apollo program historical anomaly catalog records
pub fn get_historical_anomalies() -> Vec<FailureTraceStep> {
    vec![
        FailureTraceStep {
            timestamp_s: 369_502.0, // GET 102:38:22
            subsystem: "GNC".to_string(),
            anomaly_code: "ANOM-A11-01".to_string(),
            description: "1202 Program Alarm - CPU Duty Overflow (Rendezvous Radar in SLEW + Landing Radar active)".to_string(),
            consequence: "Executive BAILOUT restart; low-priority radar tasks dropped to preserve landing guidance".to_string(),
        },
        FailureTraceStep {
            timestamp_s: 369_840.0, // GET 102:44:00
            subsystem: "PROP".to_string(),
            anomaly_code: "ANOM-A11-02".to_string(),
            description: "Mascon trajectory perturbation downrange error + West Crater boulder field hazard".to_string(),
            consequence: "P66 manual semi-automatic hover redesignation; -260 kg DPS fuel; 25s Bingo hover reserve remaining".to_string(),
        },
        FailureTraceStep {
            timestamp_s: 36.5, // T+36.5s
            subsystem: "EPS".to_string(),
            anomaly_code: "ANOM-A12-01".to_string(),
            description: "Atmospheric lightning discharge through vehicle ionization wake".to_string(),
            consequence: "3 Fuel Cells disconnected; bus voltage drops 1.4 kW; recovered via SCE to AUX".to_string(),
        },
        FailureTraceStep {
            timestamp_s: 201_293.0, // GET 55:54:53
            subsystem: "EPS".to_string(),
            anomaly_code: "ANOM-A13-01".to_string(),
            description: "Cryogenic Oxygen Tank 2 short circuit and combustion pressure rupture".to_string(),
            consequence: "Service Module O2 lost; all 3 fuel cells fail; SPS unusable; LM lifeboat protocol activated".to_string(),
        },
        FailureTraceStep {
            timestamp_s: 211_200.0, // GET 58:40:00
            subsystem: "ECLSS".to_string(),
            anomaly_code: "ANOM-A13-02".to_string(),
            description: "LM environmental control lithium hydroxide CO2 saturation with 3 crew members".to_string(),
            consequence: "CO2 partial pressure rises to 1.99 kPa; makeshift CM cube-to-LM cylinder adapter constructed".to_string(),
        },
        FailureTraceStep {
            timestamp_s: 11_580.0, // GET 03:13:00
            subsystem: "DOCKING".to_string(),
            anomaly_code: "ANOM-A14-01".to_string(),
            description: "Docking probe capture latch failure during transposition and docking".to_string(),
            consequence: "5 docking attempts required; 48 kg SM RCS propellant expended; 1h 45m mission delay".to_string(),
        },
        FailureTraceStep {
            timestamp_s: 374_400.0, // GET 104:00:00
            subsystem: "GNC".to_string(),
            anomaly_code: "ANOM-A14-02".to_string(),
            description: "Contaminant solder ball short circuit in LM Abort switch contact".to_string(),
            consequence: "False abort command threat; MIT memory patch (V25N07) applied in flight to ignore abort bit".to_string(),
        },
        FailureTraceStep {
            timestamp_s: 1_062_642.0, // GET 295:10:42
            subsystem: "RECOVERY".to_string(),
            anomaly_code: "ANOM-A15-01".to_string(),
            description: "CM RCS raw fuel propellant dump ignites recovery parachute riser line".to_string(),
            consequence: "1 of 3 main parachutes deflates; splashdown sink rate increases from 8.5 m/s to 9.7 m/s".to_string(),
        },
    ]
}

/// Trace failure chain diagnostics for Apollo 11 anomalies
pub fn trace_failure_chain() -> Vec<String> {
    get_historical_anomalies()
        .into_iter()
        .filter(|a| a.anomaly_code.starts_with("ANOM-A11"))
        .map(|a| {
            format!(
                "[T+{:.0}s] [{}] {}: {}",
                a.timestamp_s, a.subsystem, a.anomaly_code, a.consequence
            )
        })
        .collect()
}

/// Complete mission evaluation with anomaly diagnosis
pub fn evaluate_mission(
    science: f64,
    cost: f64,
    risk: f64,
    ws: f64,
    wc: f64,
    wr: f64,
    active_anomaly_codes: &[&str],
) -> EvaluationResult {
    let final_score = calculate_score(science, cost, risk, ws, wc, wr);
    let all_anomalies = get_historical_anomalies();

    let failure_chain: Vec<String> = all_anomalies
        .into_iter()
        .filter(|a| active_anomaly_codes.contains(&a.anomaly_code.as_str()))
        .map(|a| {
            format!(
                "[T+{:.0}s] [{}] {}: {}",
                a.timestamp_s, a.subsystem, a.anomaly_code, a.consequence
            )
        })
        .collect();

    EvaluationResult {
        is_success: final_score > 0.0,
        final_score,
        science_score: science,
        cost_score: cost,
        risk_penalty: risk,
        failure_chain,
    }
}
