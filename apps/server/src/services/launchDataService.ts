import { z } from "zod";

export const WeatherStatusEnum = z.enum(["GO", "HOLD", "NO-GO"]);
export type WeatherStatus = z.infer<typeof WeatherStatusEnum>;

export const DataSourceEnum = z.enum(["api", "offline_fallback"]);
export type DataSource = z.infer<typeof DataSourceEnum>;

export const LaunchWeatherSchema = z.object({
  temperature_c: z.number(),
  pressure_kpa: z.number(),
  wind_speed_kmh: z.number(),
  wind_direction_deg: z.number(),
  humidity_pct: z.number(),
  status: WeatherStatusEnum,
  source: DataSourceEnum,
  fetched_at: z.string().optional(),
  cached: z.boolean().optional(),
});
export type LaunchWeather = z.infer<typeof LaunchWeatherSchema>;

export interface LaunchSiteData {
  name: string;
  lat: number;
  lon: number;
  elevation_m: number;
  azimuth_deg: number;
  pad_id?: string;
  target_inclination_deg?: number;
}

export interface LunarTargetData {
  name: string;
  lat: number;
  lon: number;
  elevation_m: number;
  site_code?: string;
}

export interface StageData {
  stage: string;
  dry_mass_kg: number;
  propellant_mass_kg: number;
  thrust_kn: number;
  isp_s: number;
  total_mass_kg?: number;
  thrust_sl_kn?: number;
  thrust_vac_kn?: number;
  isp_sl_s?: number;
  isp_vac_s?: number;
  burn_duration_s?: number;
}

export interface VehicleData {
  name: string;
  glom_kg: number;
  stages: StageData[];
  mission_id?: string;
  liftoff_twr?: number;
  max_q_kpa?: number;
  max_q_time_s?: number;
}

export interface LaunchTelemetryResponse {
  mission_id: string; // "AS-506"
  target: string; // "Tranquility Base"
  site: LaunchSiteData;
  launch_site?: LaunchSiteData;
  lunar_target: LunarTargetData;
  landing_site?: LunarTargetData;
  vehicle: VehicleData;
  weather: LaunchWeather;
  source: DataSource;
}

// Open-Meteo Current Forecast Response Schema
const OpenMeteoCurrentResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    surface_pressure: z.number(), // in hPa
    wind_speed_10m: z.number(), // in km/h
    wind_direction_10m: z.number(), // in deg
  }),
});

/**
 * Historical Apollo 11 Liftoff Weather Snapshot (July 16, 1969 13:32 UTC)
 */
export const HISTORICAL_APOLLO_11_WEATHER: Readonly<LaunchWeather> = Object.freeze({
  temperature_c: 29.4,
  pressure_kpa: 101.4,
  wind_speed_kmh: 18.5,
  wind_direction_deg: 290,
  humidity_pct: 72,
  status: "GO",
  source: "offline_fallback",
});

/**
 * Kennedy Space Center Launch Complex 39A (Pad 39A) Coordinates & Geometry
 */
export const KSC_PAD_39A: Readonly<LaunchSiteData> = Object.freeze({
  name: "Kennedy Space Center LC-39A",
  pad_id: "LC-39A",
  lat: 28.5721,
  lon: -80.6480,
  elevation_m: 3.0,
  azimuth_deg: 72.058,
  target_inclination_deg: 32.52,
});

/**
 * Mare Tranquillitatis Lunar Landing Target Coordinates (Tranquility Base)
 */
export const MARE_TRANQUILLITATIS: Readonly<LunarTargetData> = Object.freeze({
  name: "Mare Tranquillitatis",
  site_code: "ALS-2",
  lat: 0.67408,
  lon: 23.47297,
  elevation_m: -2570,
});

/**
 * Saturn V AS-506 Vehicle Staging Specifications & Mass Breakdown
 */
export const SATURN_V_AS506: VehicleData = {
  name: "Saturn V AS-506",
  mission_id: "AS-506",
  glom_kg: 2938315,
  liftoff_twr: 1.174,
  max_q_kpa: 34.3,
  max_q_time_s: 83.0,
  stages: [
    {
      stage: "S-IC",
      dry_mass_kg: 130860,
      propellant_mass_kg: 2077000,
      total_mass_kg: 2207860,
      thrust_kn: 33850,
      thrust_sl_kn: 33850,
      thrust_vac_kn: 38700,
      isp_s: 263.0,
      isp_sl_s: 263.0,
      isp_vac_s: 304.0,
      burn_duration_s: 161.1,
    },
    {
      stage: "S-II",
      dry_mass_kg: 39870, // 36,200 kg structure + 3,670 kg interstage
      propellant_mass_kg: 443200,
      total_mass_kg: 483070,
      thrust_kn: 5115,
      thrust_sl_kn: 4400,
      thrust_vac_kn: 5115,
      isp_s: 421.0,
      isp_sl_s: 200.0,
      isp_vac_s: 421.0,
      burn_duration_s: 388.2,
    },
    {
      stage: "S-IVB",
      dry_mass_kg: 15116, // 11,300 kg dry + 3,816 kg IU/SLA
      propellant_mass_kg: 106900,
      total_mass_kg: 122016,
      thrust_kn: 1001,
      thrust_sl_kn: 486,
      thrust_vac_kn: 1001,
      isp_s: 421.0,
      isp_sl_s: 200.0,
      isp_vac_s: 421.0,
      burn_duration_s: 494.6,
    },
    {
      stage: "CSM-107",
      dry_mass_kg: 10757, // 5,557 kg CM + 5,200 kg SM
      propellant_mass_kg: 18044,
      total_mass_kg: 28801,
      thrust_kn: 91.2,
      thrust_vac_kn: 91.2,
      isp_s: 314.5,
      isp_vac_s: 314.5,
    },
    {
      stage: "LM-5",
      dry_mass_kg: 4287, // 2,134 kg Descent + 2,153 kg Ascent
      propellant_mass_kg: 10816, // 8,248 kg Descent + 2,568 kg Ascent
      total_mass_kg: 15103,
      thrust_kn: 43.9,
      thrust_vac_kn: 43.9,
      isp_s: 311.0,
      isp_vac_s: 311.0,
    },
  ],
};

/**
 * Evaluates weather launch commit status based on Pad 39A surface wind speed.
 * Commit rule:
 *   wind_speed <= 40 km/h -> "GO"
 *   40 < wind_speed <= 55 km/h -> "HOLD"
 *   wind_speed > 55 km/h -> "NO-GO"
 */
export function evaluateWeatherStatus(windSpeedKmh: number): WeatherStatus {
  if (!Number.isFinite(windSpeedKmh) || windSpeedKmh < 0) {
    return "NO-GO";
  }
  if (windSpeedKmh <= 40.0) {
    return "GO";
  }
  if (windSpeedKmh <= 55.0) {
    return "HOLD";
  }
  return "NO-GO";
}

export interface LaunchDataServiceOptions {
  apiUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class LaunchDataService {
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cache: { weather: LaunchWeather; expiresAt: number } | null = null;

  constructor(options?: LaunchDataServiceOptions) {
    this.apiUrl =
      options?.apiUrl ??
      "https://api.open-meteo.com/v1/forecast?latitude=28.5721&longitude=-80.6480&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m";
    this.timeoutMs = options?.timeoutMs ?? 1500;
    this.cacheTtlMs = options?.cacheTtlMs ?? 60_000;
  }

  /**
   * Clears the in-memory weather cache (primarily for unit testing).
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Retrieves KSC Pad 39A launch weather with non-blocking 1500ms timeout,
   * 60s in-memory caching, and non-crashing historical Apollo 11 fallback.
   */
  async getKscWeather(options?: { forceFallback?: boolean }): Promise<LaunchWeather> {
    if (options?.forceFallback) {
      return { ...HISTORICAL_APOLLO_11_WEATHER };
    }

    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return { ...this.cache.weather, cached: true };
    }

    try {
      const signal = AbortSignal.timeout(this.timeoutMs);
      const response = await fetch(this.apiUrl, {
        signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return { ...HISTORICAL_APOLLO_11_WEATHER };
      }

      const json = await response.json();
      const parsed = OpenMeteoCurrentResponseSchema.safeParse(json);
      if (!parsed.success) {
        return { ...HISTORICAL_APOLLO_11_WEATHER };
      }

      const current = parsed.data.current;
      const windSpeed = current.wind_speed_10m;
      const status = evaluateWeatherStatus(windSpeed);

      // Open-Meteo provides surface_pressure in hPa; convert to kPa: hPa / 10 -> kPa
      const pressureKpa = Math.round((current.surface_pressure / 10) * 10) / 10;
      const temperatureC = Math.round(current.temperature_2m * 10) / 10;
      const windSpeedKmh = Math.round(windSpeed * 10) / 10;
      const windDirectionDeg = Math.round(current.wind_direction_10m);
      const humidityPct = Math.round(current.relative_humidity_2m);

      const liveWeather: LaunchWeather = {
        temperature_c: temperatureC,
        pressure_kpa: pressureKpa,
        wind_speed_kmh: windSpeedKmh,
        wind_direction_deg: windDirectionDeg,
        humidity_pct: humidityPct,
        status,
        source: "api",
        fetched_at: new Date().toISOString(),
      };

      this.cache = {
        weather: liveWeather,
        expiresAt: now + this.cacheTtlMs,
      };

      return liveWeather;
    } catch {
      // Immediate non-crashing fallback on any network error, ENOTFOUND, timeout, or parse failure
      return { ...HISTORICAL_APOLLO_11_WEATHER };
    }
  }

  /**
   * Retrieves full Apollo 11 launch telemetry including site coordinates,
   * vehicle staging specs, and integrated live/fallback launch weather.
   */
  async getLaunchTelemetry(options?: { forceFallback?: boolean }): Promise<LaunchTelemetryResponse> {
    const weather = await this.getKscWeather(options);

    return {
      mission_id: "AS-506",
      target: "Tranquility Base",
      site: { ...KSC_PAD_39A },
      launch_site: { ...KSC_PAD_39A },
      lunar_target: { ...MARE_TRANQUILLITATIS },
      landing_site: { ...MARE_TRANQUILLITATIS },
      vehicle: {
        ...SATURN_V_AS506,
        stages: [...SATURN_V_AS506.stages],
      },
      weather,
      source: weather.source,
    };
  }
}
