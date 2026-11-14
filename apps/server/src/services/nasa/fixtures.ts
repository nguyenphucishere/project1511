import type {
  EphemerisData,
  DsnStatusData,
  SpaceWeatherData,
  EasepData,
  LunarEnvironmentData,
} from "./index.js";

/**
 * Apollo 11 Touchdown Epoch DE441 Ephemeris: July 20, 1969 20:17:40 UTC
 * Verbatim from JPL Horizons DE441 Integration for Moon (301) relative to Earth (399).
 */
export const HISTORICAL_APOLLO_11_EPHEMERIS: Readonly<EphemerisData> = Object.freeze({
  target_body: "Moon (301)",
  center_body: "Earth (399)",
  epoch: "1969-07-20T20:17:40.000Z",
  distance_km: 389472.8,
  radial_velocity_km_s: -0.0557,
  orbital_velocity_km_s: 1.0064,
  one_way_light_time_s: 1.2991,
  state_vector_eci_km: {
    x: -385291.5,
    y: -56157.1,
    z: -9268.1,
    vx: 0.2015,
    vy: -0.9823,
    vz: -0.0852,
  },
  source: "offline_fallback",
});
export const APOLLO_11_DE441_EPHEMERIS = HISTORICAL_APOLLO_11_EPHEMERIS;

/**
 * Apollo 11 Manned Space Flight Network (MSFN) & DSN 85-ft Tracking Baseline
 * Honeysuckle Creek (DSS-44 Canberra), Goldstone (DSS-14), and Madrid (DSS-61).
 */
export const HISTORICAL_APOLLO_11_DSN_STATUS: Readonly<DsnStatusData> = Object.freeze({
  active_station: "DSS-44 Honeysuckle Creek (Canberra MSFN)",
  complexes: [
    {
      id: "DSS-44",
      name: "Canberra Complex (Honeysuckle Creek)",
      dish: "DSS-44",
      azimuth_deg: 144.2,
      elevation_deg: 52.6,
      status: "ACTIVE_PRIMARY",
      signal_type: "data",
    },
    {
      id: "DSS-14",
      name: "Goldstone Deep Space Communications Complex",
      dish: "DSS-14",
      azimuth_deg: 228.5,
      elevation_deg: 18.2,
      status: "STANDBY_BACKUP",
      signal_type: "carrier",
    },
    {
      id: "DSS-61",
      name: "Madrid Deep Space Communications Complex",
      dish: "DSS-61",
      azimuth_deg: 112.4,
      elevation_deg: 45.1,
      status: "TRACKING",
      signal_type: "data",
    },
  ],
  rtlt_seconds: 2.56,
  uplink_frequency_mhz: 2106.4,
  downlink_frequency_mhz: 2287.5,
  carrier_lock: true,
  telemetry_lock: true,
  bitrate_kbps: 51.2,
  signal_strength_dbm: -118.5,
  is_lunar_occultation: false,
  source: "offline_fallback",
});
export const HISTORICAL_MSFN_DSN_STATUS = HISTORICAL_APOLLO_11_DSN_STATUS;

/**
 * July 1969 Quiet Sun Space Weather Baseline (Solar Cycle 20)
 * Solar flux F10.7: 152.0 sfu, Kp index: 1.7, dose rate: 0.92 mrad/h.
 */
export const HISTORICAL_APOLLO_11_SPACE_WEATHER: Readonly<SpaceWeatherData> = Object.freeze({
  solar_cycle: 20,
  solar_flux_f107: 152.0,
  geomagnetic_kp_index: 1.7,
  radiation_dose_rate_mrad_per_hour: 0.92,
  cme_alert: false,
  solar_proton_event_alert: false,
  mission_risk_status: "NOMINAL_QUIET",
  source: "offline_fallback",
});
export const HISTORICAL_DONKI_QUIET_SUN = HISTORICAL_APOLLO_11_SPACE_WEATHER;

/**
 * Early Apollo Surface Experiments Package (EASEP) Specification
 * Flown on Apollo 11 (LM-5) due to single EVA duration constraint.
 */
export const HISTORICAL_APOLLO_11_EASEP: Readonly<EasepData> = Object.freeze({
  package_name: "Early Apollo Surface Experiments Package (EASEP)",
  total_mass_kg: 77.0,
  experiments: [
    {
      id: "PSEP",
      name: "Passive Seismic Experiment Package",
      mass_kg: 48.0,
      power_draw_watts: 34.0,
      operating_lifetime_days: 21.0,
      scientific_value: 300,
      description: "Solar-powered 4-component seismometer detecting lunar internal seismic events, moonquakes, and impacts",
    },
    {
      id: "LRRR",
      name: "Laser Ranging Retro-Reflector",
      mass_kg: 21.0,
      power_draw_watts: 0.0,
      operating_lifetime_days: 18250.0,
      scientific_value: 400,
      description: "Passive array of 100 fused-silica retroreflectors for precision Earth-Moon laser ranging and optical prism experiments",
    },
    {
      id: "SWC",
      name: "Solar Wind Composition Foil",
      mass_kg: 0.45,
      power_draw_watts: 0.0,
      operating_lifetime_days: 0.08,
      scientific_value: 150,
      description: "Deployable high-purity aluminum foil sheet capturing solar wind composition noble gases",
    },
  ],
  deployment_site: {
    name: "Tranquility Base (Mare Tranquillitatis)",
    latitude_deg: 0.67408,
    longitude_deg: 23.47297,
    distance_from_lm_m: 16.8,
  },
  source: "offline_fallback",
});
export const APOLLO_11_EASEP_SPEC = HISTORICAL_APOLLO_11_EASEP;
export const HISTORICAL_EASEP_DATA = HISTORICAL_APOLLO_11_EASEP;

/**
 * Apollo 11 Lunar Surface Environment & Mare Mascon Parameters
 * Nominal lunar gravity 1.622 m/s^2 with +280 mGal (+0.0028 m/s^2) mascon anomaly.
 */
export const HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT: Readonly<LunarEnvironmentData> = Object.freeze({
  standard_gravity_mps2: 1.622,
  mascon_anomaly_mps2: 0.0028, // +280 mGal localized mass concentration
  local_gravity_effective_mps2: 1.6248,
  terrain_slope_deg: 4.5,
  regolith_bulk_density_kg_m3: 1500.0,
  regolith_bearing_capacity_kpa: 35.0,
  surface_temperature_c: 85.0,
  source: "offline_fallback",
});
export const MARE_TRANQUILLITATIS_LUNAR_ENV = HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT;
export const HISTORICAL_LUNAR_ENVIRONMENT = HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT;
