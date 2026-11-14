import type {
  DsnStatusData,
  EasepData,
  EphemerisData,
  LunarEnvironmentData,
  SpaceWeatherData,
} from "./nasa.types";

/**
 * Client helpers for the server's NASA data routes (`/api/nasa/*`). Every call has a short
 * timeout and falls back to the Apollo 11 (July 1969) baseline, which mirrors
 * apps/server/src/services/nasa/fixtures.ts, so the game works offline and without a server.
 */

export const OFFLINE_EPHEMERIS: EphemerisData = {
  target_body: "Moon (301)",
  center_body: "Earth (399)",
  epoch: "1969-07-20T20:17:40.000Z",
  distance_km: 389472.8,
  radial_velocity_km_s: -0.0557,
  orbital_velocity_km_s: 1.0064,
  one_way_light_time_s: 1.2991,
  state_vector_eci_km: { x: -385291.5, y: -56157.1, z: -9268.1, vx: 0.2015, vy: -0.9823, vz: -0.0852 },
  source: "offline_fallback",
};

export const OFFLINE_DSN_STATUS: DsnStatusData = {
  active_station: "DSS-44 Honeysuckle Creek (Canberra MSFN)",
  complexes: [
    { id: "DSS-44", name: "Canberra Complex (Honeysuckle Creek)", dish: "DSS-44", azimuth_deg: 144.2, elevation_deg: 52.6, status: "ACTIVE_PRIMARY", signal_type: "data" },
    { id: "DSS-14", name: "Goldstone Deep Space Communications Complex", dish: "DSS-14", azimuth_deg: 228.5, elevation_deg: 18.2, status: "STANDBY_BACKUP", signal_type: "carrier" },
    { id: "DSS-61", name: "Madrid Deep Space Communications Complex", dish: "DSS-61", azimuth_deg: 112.4, elevation_deg: 45.1, status: "TRACKING", signal_type: "data" },
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
};

export const OFFLINE_SPACE_WEATHER: SpaceWeatherData = {
  solar_cycle: 20,
  solar_flux_f107: 152.0,
  geomagnetic_kp_index: 1.7,
  radiation_dose_rate_mrad_per_hour: 0.92,
  cme_alert: false,
  solar_proton_event_alert: false,
  mission_risk_status: "NOMINAL_QUIET",
  source: "offline_fallback",
};

export const OFFLINE_EASEP: EasepData = {
  package_name: "Early Apollo Surface Experiments Package (EASEP)",
  total_mass_kg: 77.0,
  experiments: [
    { id: "PSEP", name: "Passive Seismic Experiment Package", mass_kg: 48.0, power_draw_watts: 34.0, operating_lifetime_days: 21.0, scientific_value: 300, description: "Solar-powered 4-component seismometer detecting lunar internal seismic events, moonquakes, and impacts" },
    { id: "LRRR", name: "Laser Ranging Retro-Reflector", mass_kg: 21.0, power_draw_watts: 0.0, operating_lifetime_days: 18250.0, scientific_value: 400, description: "Passive array of 100 fused-silica retroreflectors for precision Earth-Moon laser ranging and optical prism experiments" },
    { id: "SWC", name: "Solar Wind Composition Foil", mass_kg: 0.45, power_draw_watts: 0.0, operating_lifetime_days: 0.08, scientific_value: 150, description: "Deployable high-purity aluminum foil sheet capturing solar wind composition noble gases" },
  ],
  deployment_site: { name: "Tranquility Base (Mare Tranquillitatis)", latitude_deg: 0.67408, longitude_deg: 23.47297, distance_from_lm_m: 16.8 },
  source: "offline_fallback",
};

export const OFFLINE_LUNAR_ENVIRONMENT: LunarEnvironmentData = {
  standard_gravity_mps2: 1.622,
  mascon_anomaly_mps2: 0.0028,
  local_gravity_effective_mps2: 1.6248,
  terrain_slope_deg: 4.5,
  regolith_bulk_density_kg_m3: 1500.0,
  regolith_bearing_capacity_kpa: 35.0,
  surface_temperature_c: 85.0,
  source: "offline_fallback",
};

// Server upstream timeout is 4 s; leave room for a cold cache before falling back.
const TIMEOUT_MS = 6000;

export function nasaApiBase(override?: string): string {
  if (override) return override.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "http://127.0.0.1:4000";
}

/**
 * GETs `path` and merges the JSON over `fallback`, so a partial or older server response still
 * yields every field. Any network error, timeout, non-2xx or non-object body returns `fallback`.
 */
async function getWithFallback<T extends object>(path: string, fallback: T, baseUrl?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${nasaApiBase(baseUrl)}/api/nasa${path}`, { signal: controller.signal });
    if (!res.ok) return fallback;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return fallback;
    return { ...fallback, ...(data as Partial<T>) };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchNasaEphemeris = (baseUrl?: string) => getWithFallback("/ephemeris", OFFLINE_EPHEMERIS, baseUrl);
export const fetchNasaDsnStatus = (baseUrl?: string) => getWithFallback("/dsn/status", OFFLINE_DSN_STATUS, baseUrl);
export const fetchNasaSpaceWeather = (baseUrl?: string) =>
  getWithFallback("/space-weather", OFFLINE_SPACE_WEATHER, baseUrl);
export const fetchNasaEasep = (baseUrl?: string) => getWithFallback("/mission-design/easep", OFFLINE_EASEP, baseUrl);
export const fetchNasaLunarEnvironment = (baseUrl?: string) =>
  getWithFallback("/lunar-environment", OFFLINE_LUNAR_ENVIRONMENT, baseUrl);

export interface NasaMissionData {
  ephemeris: EphemerisData;
  dsn: DsnStatusData;
  spaceWeather: SpaceWeatherData;
  easep: EasepData;
  lunarEnvironment: LunarEnvironmentData;
}

export const OFFLINE_NASA_DATA: NasaMissionData = {
  ephemeris: OFFLINE_EPHEMERIS,
  dsn: OFFLINE_DSN_STATUS,
  spaceWeather: OFFLINE_SPACE_WEATHER,
  easep: OFFLINE_EASEP,
  lunarEnvironment: OFFLINE_LUNAR_ENVIRONMENT,
};

/** All five feeds in parallel; never rejects. */
export async function fetchNasaMissionData(baseUrl?: string): Promise<NasaMissionData> {
  const [ephemeris, dsn, spaceWeather, easep, lunarEnvironment] = await Promise.all([
    fetchNasaEphemeris(baseUrl),
    fetchNasaDsnStatus(baseUrl),
    fetchNasaSpaceWeather(baseUrl),
    fetchNasaEasep(baseUrl),
    fetchNasaLunarEnvironment(baseUrl),
  ]);
  return { ephemeris, dsn, spaceWeather, easep, lunarEnvironment };
}
