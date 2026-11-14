import { assessLaunch, costOf, planRequestFor, resultFromPlan } from "./launch.engine";
import { planLaunch, type LaunchPlan } from "./launch.physics";
import type {
  LaunchAssessment,
  LaunchConfig,
  LaunchResult,
  LaunchSimulator,
  LaunchSite,
  LaunchWindow,
  LaunchWindowsData,
} from "./launch.types";
import { LAUNCH_SITES, OFFLINE_KSC_WINDOWS, WINDOWS } from "@/mocks/launch-options";

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

async function getJson<T>(url: string, init?: RequestInit, timeoutMs = 6000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/launch/sites, or the offline copy. */
export async function fetchLaunchSites(baseUrl?: string): Promise<LaunchSite[]> {
  const data = await getJson<{ sites?: LaunchSite[] }>(`${getServerBaseUrl(baseUrl)}/api/launch/sites`);
  return Array.isArray(data?.sites) && data.sites.length > 0 ? data.sites : LAUNCH_SITES;
}

const isWindow = (w: unknown): w is LaunchWindow => {
  const x = w as Partial<LaunchWindow> | null;
  return (
    !!x &&
    (x.id === "w1" || x.id === "w2" || x.id === "w3") &&
    typeof x.opens_at === "string" &&
    !!x.weather &&
    Number.isFinite(x.weather.wind_speed_kmh) &&
    Number.isFinite(x.weather.wind_gust_kmh)
  );
};

/**
 * GET /api/launch/sites/:id/windows: three launch windows with the real weather at that pad
 * (1969 reanalysis at Kennedy, live forecast elsewhere). Offline: Apollo 11's 1969 windows.
 */
export async function fetchLaunchWindows(siteId: string, baseUrl?: string): Promise<LaunchWindowsData> {
  const url = `${getServerBaseUrl(baseUrl)}/api/launch/sites/${encodeURIComponent(siteId)}/windows`;
  const data = await getJson<LaunchWindowsData>(url);
  if (data && Array.isArray(data.windows) && data.windows.length === 3 && data.windows.every(isWindow) && data.site) {
    return data;
  }
  const site = LAUNCH_SITES.find((s) => s.id === siteId) ?? OFFLINE_KSC_WINDOWS.site;
  return { ...OFFLINE_KSC_WINDOWS, site };
}

/** POST /api/engine/launch/plan: the server's engine decides; null when it cannot be reached. */
export async function fetchLaunchPlan(config: LaunchConfig, window: LaunchWindow, baseUrl?: string): Promise<LaunchPlan | null> {
  const plan = await getJson<LaunchPlan>(`${getServerBaseUrl(baseUrl)}/api/engine/launch/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(planRequestFor(config, window)),
  });
  return plan && typeof plan.is_go === "boolean" && !plan.error_message ? plan : null;
}

export const DEFAULT_WINDOW: LaunchWindow = WINDOWS[0]!;

/**
 * The console's simulator. Readouts are instant (the engine's TypeScript mirror); the flight's
 * outcome is the server engine's answer, or the same calculation in the browser when offline.
 */
export const launchSimulator: LaunchSimulator = {
  assess(config: LaunchConfig, window: LaunchWindow): LaunchAssessment {
    return assessLaunch(config, window);
  },

  async simulate(config: LaunchConfig, window: LaunchWindow): Promise<LaunchResult> {
    const costM = costOf(config, window);
    const server = await fetchLaunchPlan(config, window);
    if (server) return resultFromPlan(server, costM, "server-engine");
    return resultFromPlan(planLaunch(planRequestFor(config, window)), costM, "browser-engine");
  },
};
