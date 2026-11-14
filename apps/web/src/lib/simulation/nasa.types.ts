/**
 * Shapes shared with apps/server (`/api/nasa/*`, see services/nasa/index.ts) and with the WASM
 * engine (crates/sim-core: descent.rs, kepler.rs, mission_design.rs). Field names are snake_case
 * because they cross the JSON boundary verbatim.
 */

export type NasaDataSource = "api" | "offline_fallback" | (string & {});

export interface EphemerisData {
  target_body: string;
  center_body: string;
  epoch: string;
  distance_km: number;
  radial_velocity_km_s: number;
  orbital_velocity_km_s: number;
  one_way_light_time_s: number;
  state_vector_eci_km: { x: number; y: number; z: number; vx: number; vy: number; vz: number };
  source: NasaDataSource;
  cached?: boolean;
  fetched_at?: string;
}

export interface DsnComplex {
  id: string;
  name: string;
  dish: string;
  azimuth_deg: number;
  elevation_deg: number;
  status: string;
  signal_type: string;
}

export interface DsnStatusData {
  active_station: string;
  complexes: DsnComplex[];
  rtlt_seconds: number;
  uplink_frequency_mhz: number;
  downlink_frequency_mhz: number;
  carrier_lock: boolean;
  telemetry_lock: boolean;
  bitrate_kbps: number;
  signal_strength_dbm: number;
  is_lunar_occultation: boolean;
  source: NasaDataSource;
  cached?: boolean;
  fetched_at?: string;
}

export type MissionRiskStatus = "NOMINAL_QUIET" | "ELEVATED_WATCH" | "SEVERE_ALERT";

export interface SpaceWeatherData {
  solar_cycle: number;
  solar_flux_f107: number;
  geomagnetic_kp_index: number;
  radiation_dose_rate_mrad_per_hour: number;
  cme_alert: boolean;
  solar_proton_event_alert: boolean;
  mission_risk_status: MissionRiskStatus;
  source: NasaDataSource;
  cached?: boolean;
  fetched_at?: string;
}

export interface EasepExperiment {
  id: string;
  name: string;
  mass_kg: number;
  power_draw_watts: number;
  operating_lifetime_days: number;
  scientific_value: number | string;
  description: string;
}

export interface EasepData {
  package_name: string;
  total_mass_kg: number;
  experiments: EasepExperiment[];
  deployment_site: { name: string; latitude_deg: number; longitude_deg: number; distance_from_lm_m: number };
  source: NasaDataSource;
}

export interface LunarEnvironmentData {
  standard_gravity_mps2: number;
  mascon_anomaly_mps2: number;
  local_gravity_effective_mps2: number;
  terrain_slope_deg: number;
  regolith_bulk_density_kg_m3: number;
  regolith_bearing_capacity_kpa: number;
  surface_temperature_c: number;
  source: NasaDataSource;
}

/* ------------------------------------------------------------------ WASM engine contracts */

export interface LandingRadarInput {
  inertial_alt_m: number;
  vertical_vel_mps: number;
  horizontal_vel_mps: number;
  terrain_elevation_offset_m?: number;
  pitch_angle_deg?: number;
  lateral_vel_mps?: number;
}

export interface LandingRadarMeasurement {
  inertial_altitude_m: number;
  radar_altitude_m: number;
  altitude_delta_m: number;
  forward_velocity_mps: number;
  vertical_velocity_mps: number;
  lateral_velocity_mps: number;
  /** 1 = high scale (> 762 m), 2 = low scale (<= 762 m). */
  scale_mode: 1 | 2;
  data_good: boolean;
  error_message?: string;
}

export interface StageConfig {
  stage_name: string;
  dry_mass_kg: number;
  propellant_mass_kg: number;
  isp_s: number;
  /** When set, used instead of the rocket equation for this stage. */
  burn_delta_v_mps?: number;
}

export interface MissionDesignBudgetInput {
  dry_mass_basic_kg: number;
  power_load_watts: number;
  delta_v_required_mps: number;
  stage_configs: StageConfig[];
  power_generation_watts?: number;
  launch_vehicle_capacity_kg?: number;
  mga_margin_pct?: number;
}

export interface MissionDesignBudgetResult {
  dry_mass_with_mga_kg: number;
  mass_margin_kg: number;
  is_mass_compliant: boolean;
  power_margin_pct: number;
  is_power_compliant: boolean;
  delta_v_available_mps: number;
  delta_v_reserve_pct: number;
  is_delta_v_compliant: boolean;
  /** JPL Concept Maturity Level, 1..4. */
  cml_score: number;
  overall_mdl_score: number;
  error_message?: string;
}

export interface DsnTelemetryInput {
  distance_km: number;
  true_anomaly_deg?: number;
  is_farside?: boolean;
}

export interface DsnTelemetryResult {
  rtlt_seconds: number;
  path_loss_db: number;
  received_power_dbm: number;
  is_occulted: boolean;
  error_message?: string;
}
