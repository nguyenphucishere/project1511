import { z } from "zod";

// ==========================================
// Common Types & Schemas
// ==========================================

/**
 * api              live upstream feed
 * engine           computed by the Rust simulation engine (crates/sim-core via sim-wasm)
 * reference        fixed historical specification (no live feed exists)
 * offline_fallback Apollo 11 baseline served because the live feed / engine was unavailable
 */
export const DataSourceEnum = z.enum(["api", "engine", "reference", "offline_fallback"]);
export type DataSource = z.infer<typeof DataSourceEnum>;

// ==========================================
// Ephemeris Schemas
// ==========================================

export const EphemerisVectorSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  vx: z.number(),
  vy: z.number(),
  vz: z.number(),
});
export type EphemerisVector = z.infer<typeof EphemerisVectorSchema>;

export const EphemerisDataSchema = z.object({
  target_body: z.string(),
  center_body: z.string(),
  epoch: z.string(),
  distance_km: z.number(),
  radial_velocity_km_s: z.number(),
  orbital_velocity_km_s: z.number(),
  one_way_light_time_s: z.number(),
  state_vector_eci_km: EphemerisVectorSchema,
  source: DataSourceEnum,
  cached: z.boolean().optional(),
  fetched_at: z.string().optional(),
});
export type EphemerisData = z.infer<typeof EphemerisDataSchema>;
export const HorizonsEphemerisSchema = EphemerisDataSchema;
export type HorizonsEphemeris = EphemerisData;

// ==========================================
// DSN Schemas
// ==========================================

export const DsnComplexSchema = z.object({
  id: z.string(),
  name: z.string(),
  dish: z.string(),
  azimuth_deg: z.number(),
  elevation_deg: z.number(),
  status: z.string(),
  signal_type: z.string(),
});
export type DsnComplex = z.infer<typeof DsnComplexSchema>;

export const DsnStatusDataSchema = z.object({
  active_station: z.string(),
  complexes: z.array(DsnComplexSchema),
  rtlt_seconds: z.number(),
  uplink_frequency_mhz: z.number(),
  downlink_frequency_mhz: z.number(),
  carrier_lock: z.boolean(),
  telemetry_lock: z.boolean(),
  bitrate_kbps: z.number(),
  signal_strength_dbm: z.number(),
  is_lunar_occultation: z.boolean(),
  source: DataSourceEnum,
  cached: z.boolean().optional(),
  fetched_at: z.string().optional(),
});
export type DsnStatusData = z.infer<typeof DsnStatusDataSchema>;
export const DsnStatusSchema = DsnStatusDataSchema;
export type DsnStatus = DsnStatusData;

// ==========================================
// Space Weather Schemas
// ==========================================

export const MissionRiskStatusEnum = z.enum([
  "NOMINAL_QUIET",
  "ELEVATED_WATCH",
  "SEVERE_ALERT",
]);
export type MissionRiskStatus = z.infer<typeof MissionRiskStatusEnum>;

export const SpaceWeatherDataSchema = z.object({
  solar_cycle: z.number(),
  solar_flux_f107: z.number(),
  geomagnetic_kp_index: z.number(),
  radiation_dose_rate_mrad_per_hour: z.number(),
  cme_alert: z.boolean(),
  solar_proton_event_alert: z.boolean(),
  mission_risk_status: MissionRiskStatusEnum,
  source: DataSourceEnum,
  /** Upstream feeds that answered, e.g. "NOAA SWPC + NASA DONKI". */
  provider: z.string().optional(),
  cached: z.boolean().optional(),
  fetched_at: z.string().optional(),
});
export type SpaceWeatherData = z.infer<typeof SpaceWeatherDataSchema>;
export const SpaceWeatherSchema = SpaceWeatherDataSchema;
export type SpaceWeather = SpaceWeatherData;

// ==========================================
// EASEP Schemas
// ==========================================

export const EasepExperimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mass_kg: z.number(),
  power_draw_watts: z.number(),
  operating_lifetime_days: z.number(),
  scientific_value: z.union([z.number(), z.string()]),
  description: z.string(),
});
export type EasepExperiment = z.infer<typeof EasepExperimentSchema>;

export const EasepDataSchema = z.object({
  package_name: z.string(),
  total_mass_kg: z.number(),
  experiments: z.array(EasepExperimentSchema),
  deployment_site: z.object({
    name: z.string(),
    latitude_deg: z.number(),
    longitude_deg: z.number(),
    distance_from_lm_m: z.number(),
  }),
  source: DataSourceEnum,
});
export type EasepData = z.infer<typeof EasepDataSchema>;
export const EasepSpecSchema = EasepDataSchema;
export type EasepSpec = EasepData;

// ==========================================
// Lunar Environment Schemas
// ==========================================

export const LunarEnvironmentDataSchema = z.object({
  standard_gravity_mps2: z.number(),
  mascon_anomaly_mps2: z.number(),
  local_gravity_effective_mps2: z.number(),
  terrain_slope_deg: z.number(),
  regolith_bulk_density_kg_m3: z.number(),
  regolith_bearing_capacity_kpa: z.number(),
  surface_temperature_c: z.number(),
  /** Engine-only extras (absent on the offline fixture). */
  mascon_anomaly_mgal: z.number().optional(),
  surface_temperature_day_c: z.number().optional(),
  surface_temperature_night_c: z.number().optional(),
  moon_radius_km: z.number().optional(),
  source: DataSourceEnum,
});
export type LunarEnvironmentData = z.infer<typeof LunarEnvironmentDataSchema>;
export const LunarEnvironmentSchema = LunarEnvironmentDataSchema;
export type LunarEnvironment = LunarEnvironmentData;

// ==========================================
// Re-exports
// ==========================================

export * from "./fixtures.js";
export * from "./nasaHorizonsService.js";
export * from "./nasaDsnService.js";
export * from "./nasaSpaceWeatherService.js";
export * from "./nasaMdlService.js";
