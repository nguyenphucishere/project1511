import { assessLaunch, mockLaunchSimulator, ORBIT_INSERTION_SEC, runLaunch, TRACE_TEXT } from "./launch.mock";
import type { LaunchAssessment, LaunchConfig, LaunchResult, LaunchSimulator, LaunchTraceStep } from "./launch.types";
import { PAYLOADS, VEHICLES, WINDOWS } from "@/mocks/launch-options";

export interface ServerLaunchWeather {
  temperature_c: number;
  pressure_kpa: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  humidity_pct: number;
  status: "GO" | "HOLD" | "NO-GO";
  source: "api" | "offline_fallback";
}

export interface ServerLaunchTelemetry {
  mission_id: string;
  mission_name: string;
  launch_site: {
    name: string;
    latitude_deg: number;
    longitude_deg: number;
    elevation_m: number;
  };
  landing_site: {
    name: string;
    latitude_deg: number;
    longitude_deg: number;
    elevation_m: number;
  };
  vehicle: {
    id: string;
    name: string;
    glom_kg: number;
    liftoff_thrust_sl_kn: number;
    liftoff_twr: number;
    max_q_kpa: number;
    max_q_time_s: number;
    payload_leo_capacity_kg: number;
    payload_tli_capacity_kg: number;
  };
  weather: ServerLaunchWeather;
  source: "api" | "offline_fallback";
}

export const OFFLINE_APOLLO11_TELEMETRY: ServerLaunchTelemetry = {
  mission_id: "AS-506",
  mission_name: "Apollo 11 (Saturn V AS-506 / CSM-107 Columbia / LM-5 Eagle)",
  launch_site: {
    name: "Kennedy Space Center Launch Complex 39A (LC-39A)",
    latitude_deg: 28.608389,
    longitude_deg: -80.604333,
    elevation_m: 16.0,
  },
  landing_site: {
    name: "Mare Tranquillitatis (Tranquility Base)",
    latitude_deg: 0.67408,
    longitude_deg: 23.47297,
    elevation_m: -2600.0,
  },
  vehicle: {
    id: "saturn_v_as506",
    name: "Saturn V AS-506",
    glom_kg: 2_938_315,
    liftoff_thrust_sl_kn: 33_850,
    liftoff_twr: 1.174,
    max_q_kpa: 34.3,
    max_q_time_s: 83.0,
    payload_leo_capacity_kg: 140_000,
    payload_tli_capacity_kg: 48_609,
  },
  weather: {
    temperature_c: 29.4,
    pressure_kpa: 101.8,
    wind_speed_kmh: 18.5,
    wind_direction_deg: 115,
    humidity_pct: 73,
    status: "GO",
    source: "offline_fallback",
  },
  source: "offline_fallback",
};

type ServerSite = ServerLaunchTelemetry["launch_site"];

/**
 * The server names a site's coordinates `lat`/`lon`; this app reads `latitude_deg`/`longitude_deg`.
 * Accepts either, and falls back field by field so a partial or odd payload can never leave a
 * coordinate undefined (the panel formats them with toFixed).
 */
export function normalizeSite(raw: unknown, fallback: ServerSite): ServerSite {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const v = s[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return undefined;
  };
  return {
    name: typeof s.name === "string" ? s.name : fallback.name,
    latitude_deg: num("latitude_deg", "lat") ?? fallback.latitude_deg,
    longitude_deg: num("longitude_deg", "lon", "lng") ?? fallback.longitude_deg,
    elevation_m: num("elevation_m") ?? fallback.elevation_m,
  };
}

function getServerBaseUrl(overrideUrl?: string): string {
  if (overrideUrl) return overrideUrl.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "http://127.0.0.1:4000";
}

/**
 * Retrieves real-time or historical fallback launch telemetry (map coordinates, mass, weather)
 * from the server API (`/api/launch/telemetry`). Falls back cleanly if offline.
 */
export async function fetchLaunchTelemetryFromServer(baseUrl?: string): Promise<ServerLaunchTelemetry> {
  try {
    const url = `${getServerBaseUrl(baseUrl)}/api/launch/telemetry`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return OFFLINE_APOLLO11_TELEMETRY;
    const data = await res.json();
    return {
      ...OFFLINE_APOLLO11_TELEMETRY,
      ...data,
      launch_site: normalizeSite(data.launch_site ?? data.site, OFFLINE_APOLLO11_TELEMETRY.launch_site),
      landing_site: normalizeSite(data.landing_site ?? data.lunar_target, OFFLINE_APOLLO11_TELEMETRY.landing_site),
      vehicle: {
        ...OFFLINE_APOLLO11_TELEMETRY.vehicle,
        ...(data.vehicle ?? {}),
      },
      weather: {
        ...OFFLINE_APOLLO11_TELEMETRY.weather,
        ...(data.weather ?? {}),
      },
    };
  } catch {
    return OFFLINE_APOLLO11_TELEMETRY;
  }
}

/**
 * Retrieves Pad 39A weather from `/api/weather/ksc` with deterministic Apollo 11 fallback.
 */
export async function fetchKscWeatherFromServer(baseUrl?: string): Promise<ServerLaunchWeather> {
  try {
    const url = `${getServerBaseUrl(baseUrl)}/api/weather/ksc`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return OFFLINE_APOLLO11_TELEMETRY.weather;
    const data = await res.json();
    return {
      ...OFFLINE_APOLLO11_TELEMETRY.weather,
      ...data,
    };
  } catch {
    return OFFLINE_APOLLO11_TELEMETRY.weather;
  }
}

/**
 * Full-stack LaunchSimulator implementation bridging frontend LaunchConfig to
 * server validation (`/api/simulation/validate`) and local physics assessment.
 */
export const launchSimulator: LaunchSimulator = {
  assess(config: LaunchConfig): LaunchAssessment {
    return assessLaunch(config);
  },

  async simulate(config: LaunchConfig): Promise<LaunchResult> {
    const localResult = runLaunch(config);

    // If local assessment already flags overCapacity or fuelShort, preserve exact trajectory trace timing
    if (!localResult.isSuccess) {
      return mockLaunchSimulator.simulate(config);
    }

    // Attempt authoritative server validation round-trip when online
    try {
      const vehicle = VEHICLES.find((v) => v.id === config.vehicle);
      const payload = PAYLOADS.find((p) => p.id === config.payload);
      const windowOpt = WINDOWS.find((w) => w.id === config.window);

      const url = `${getServerBaseUrl()}/api/simulation/validate`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicle?.id ?? "saturn_v_as506",
          vehicle_name: vehicle?.name ?? "Saturn V AS-506",
          payload_mass: (payload?.massT ?? 46) * 1000,
          target_orbit_km: config.orbitKm,
          target_destination: "TLI",
          wind_speed_kmh: windowOpt?.windKmh ?? 18.5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const val = await res.json();
        if (val.is_valid === false) {
          const trace: LaunchTraceStep[] = [
            {
              code: "slow-climb",
              timestampSec: 38,
              subsystem: TRACE_TEXT["slow-climb"].subsystem.en,
              anomaly: TRACE_TEXT["slow-climb"].anomaly.en,
              consequence: val.failure_reason ?? TRACE_TEXT["slow-climb"].consequence.en,
            },
          ];
          return {
            isSuccess: false,
            budgetCostMillions: localResult.budgetCostMillions,
            failureTrace: trace,
            endSec: Math.round(val.max_q_time_s || 83),
          };
        }
      }
    } catch {
      // Offline or test environment: fall back seamlessly to deterministic local simulation
    }

    return {
      isSuccess: true,
      budgetCostMillions: localResult.budgetCostMillions,
      failureTrace: [],
      endSec: ORBIT_INSERTION_SEC,
    };
  },
};
