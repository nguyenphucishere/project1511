import { z } from "zod";

/**
 * Launch sites for the mission-control console and the weather at each launch window.
 *
 * Kennedy LC-39A keeps Apollo 11's three July 1969 launch opportunities, with the weather that
 * actually occurred at those hours (ERA5 reanalysis via the Open-Meteo archive API). Every other
 * pad offers the next three daily windows from the live Open-Meteo forecast. Neither source
 * needs a key; NASA has no public weather-forecast API.
 *
 * Only measurements are returned (wind, gusts, cloud, precipitation, thunderstorm flag): the
 * GO / NO-GO judgement is left to the player and the engine.
 */

export interface LaunchSite {
  id: string;
  name: string;
  pad: string;
  operator: string;
  country: string;
  latitude_deg: number;
  longitude_deg: number;
  elevation_m: number;
  /** IANA zone for showing window times in local time. */
  time_zone: string;
  /** "historical" = Apollo 11's July 1969 windows; "live" = upcoming forecast windows. */
  windows: "historical" | "live";
}

export const LAUNCH_SITES: readonly LaunchSite[] = Object.freeze([
  {
    id: "ksc-39a",
    name: "Kennedy Space Center",
    pad: "LC-39A",
    operator: "NASA",
    country: "USA",
    latitude_deg: 28.6084,
    longitude_deg: -80.6043,
    elevation_m: 3,
    time_zone: "America/New_York",
    windows: "historical",
  },
  {
    id: "vandenberg-slc6",
    name: "Vandenberg",
    pad: "SLC-6",
    operator: "US Space Force",
    country: "USA",
    latitude_deg: 34.5813,
    longitude_deg: -120.6266,
    elevation_m: 120,
    time_zone: "America/Los_Angeles",
    windows: "live",
  },
  {
    id: "baikonur-110",
    name: "Baikonur Cosmodrome",
    pad: "Site 110",
    operator: "Roscosmos",
    country: "Kazakhstan",
    latitude_deg: 45.9655,
    longitude_deg: 63.3052,
    elevation_m: 90,
    time_zone: "Asia/Almaty",
    windows: "live",
  },
  {
    id: "kourou-ela",
    name: "Guiana Space Centre",
    pad: "ELA-3",
    operator: "ESA / CNES",
    country: "French Guiana",
    latitude_deg: 5.239,
    longitude_deg: -52.7684,
    elevation_m: 15,
    time_zone: "America/Cayenne",
    windows: "live",
  },
  {
    id: "tanegashima",
    name: "Tanegashima Space Center",
    pad: "Yoshinobu LP-1",
    operator: "JAXA",
    country: "Japan",
    latitude_deg: 30.4009,
    longitude_deg: 130.9749,
    elevation_m: 30,
    time_zone: "Asia/Tokyo",
    windows: "live",
  },
  {
    id: "wenchang",
    name: "Wenchang",
    pad: "LC-101",
    operator: "CNSA",
    country: "China",
    latitude_deg: 19.6145,
    longitude_deg: 110.951,
    elevation_m: 10,
    time_zone: "Asia/Shanghai",
    windows: "live",
  },
  {
    id: "sriharikota",
    name: "Satish Dhawan Space Centre",
    pad: "SLP",
    operator: "ISRO",
    country: "India",
    latitude_deg: 13.7199,
    longitude_deg: 80.2304,
    elevation_m: 5,
    time_zone: "Asia/Kolkata",
    windows: "live",
  },
] satisfies LaunchSite[]);

export interface WindowWeather {
  temperature_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  wind_gust_kmh: number;
  wind_direction_deg: number;
  precipitation_mm: number;
  cloud_cover_pct: number;
  /** WMO weather code (95–99 = thunderstorm). */
  weather_code: number;
  thunderstorm: boolean;
}

export interface LaunchWindow {
  id: "w1" | "w2" | "w3";
  /** UTC instant the window opens. */
  opens_at: string;
  label: string;
  /** Pad crew, range re-booking and propellant top-off for waiting (US$ millions). */
  delay_cost_m: number;
  weather: WindowWeather;
}

export interface LaunchWindowsResponse {
  site: LaunchSite;
  kind: "historical" | "live";
  /** "ERA5 reanalysis (Open-Meteo archive)" or "Open-Meteo forecast". */
  provider: string;
  windows: LaunchWindow[];
  source: "api" | "offline_fallback";
  fetched_at?: string;
  cached?: boolean;
}

/** Apollo 11's July 1969 opportunities (the 16th flew at 13:32 UTC; backups on the 18th and 21st). */
const APOLLO_11_OPPORTUNITIES: { id: LaunchWindow["id"]; opens_at: string; label: string; delay_cost_m: number }[] = [
  { id: "w1", opens_at: "1969-07-16T13:32:00Z", label: "July 16, 1969 — Apollo 11 T-0", delay_cost_m: 0 },
  { id: "w2", opens_at: "1969-07-18T13:32:00Z", label: "July 18, 1969 — first backup opportunity", delay_cost_m: 60 },
  { id: "w3", opens_at: "1969-07-21T13:32:00Z", label: "July 21, 1969 — second backup opportunity", delay_cost_m: 120 },
];

/**
 * Offline stand-in for the 1969 windows: ERA5 values for those hours at LC-39A, captured
 * 2026-11-14, so the game plays the same without network.
 */
const OFFLINE_1969_WEATHER: Record<LaunchWindow["id"], WindowWeather> = {
  w1: { temperature_c: 28.1, humidity_pct: 81, wind_speed_kmh: 9.1, wind_gust_kmh: 16.6, wind_direction_deg: 156, precipitation_mm: 0.1, cloud_cover_pct: 100, weather_code: 3, thunderstorm: false },
  w2: { temperature_c: 28.1, humidity_pct: 78, wind_speed_kmh: 15.3, wind_gust_kmh: 28.1, wind_direction_deg: 117, precipitation_mm: 0.2, cloud_cover_pct: 72, weather_code: 51, thunderstorm: false },
  w3: { temperature_c: 27.1, humidity_pct: 83, wind_speed_kmh: 13.4, wind_gust_kmh: 22.7, wind_direction_deg: 172, precipitation_mm: 0, cloud_cover_pct: 50, weather_code: 2, thunderstorm: false },
};

const HOURLY_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "precipitation",
  "cloud_cover",
  "weather_code",
] as const;

const HourlySchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    relative_humidity_2m: z.array(z.number().nullable()),
    wind_speed_10m: z.array(z.number().nullable()),
    wind_gusts_10m: z.array(z.number().nullable()),
    wind_direction_10m: z.array(z.number().nullable()),
    precipitation: z.array(z.number().nullable()),
    cloud_cover: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()),
  }),
});
type Hourly = z.infer<typeof HourlySchema>["hourly"];

export const isThunderstorm = (code: number) => code >= 95 && code <= 99;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Weather at `at`, interpolated linearly between the surrounding hourly samples (codes: nearest). */
export function weatherAt(h: Hourly, at: Date): WindowWeather | null {
  const times = h.time.map((t) => Date.parse(t.endsWith("Z") ? t : `${t}Z`));
  const target = at.getTime();
  let i = times.findIndex((t) => t > target) - 1;
  if (i < 0) i = times[0] !== undefined && target <= times[0] ? 0 : times.length - 1;
  const j = Math.min(i + 1, times.length - 1);
  const span = times[j]! - times[i]!;
  const f = span > 0 ? Math.min(1, Math.max(0, (target - times[i]!) / span)) : 0;
  const lerp = (arr: (number | null)[]) => {
    const a = arr[i];
    const b = arr[j];
    if (a == null || b == null) return a ?? b ?? null;
    return a + (b - a) * f;
  };
  const wind = lerp(h.wind_speed_10m);
  const gust = lerp(h.wind_gusts_10m);
  const code = (f < 0.5 ? h.weather_code[i] : h.weather_code[j]) ?? h.weather_code[i] ?? 0;
  if (wind == null) return null;
  return {
    temperature_c: round1(lerp(h.temperature_2m) ?? 0),
    humidity_pct: Math.round(lerp(h.relative_humidity_2m) ?? 0),
    wind_speed_kmh: round1(wind),
    wind_gust_kmh: round1(Math.max(gust ?? wind, wind)),
    wind_direction_deg: Math.round(lerp(h.wind_direction_10m) ?? 0),
    precipitation_mm: round1(lerp(h.precipitation) ?? 0),
    cloud_cover_pct: Math.round(lerp(h.cloud_cover) ?? 0),
    weather_code: code,
    thunderstorm: isThunderstorm(code),
  };
}

/** Next three daily windows: the next whole hour at least two hours out, then +24 h and +48 h. */
export function upcomingWindowTimes(now: Date): Date[] {
  const first = new Date(now.getTime() + 2 * 3600_000);
  first.setUTCMinutes(0, 0, 0);
  if (first.getTime() < now.getTime() + 2 * 3600_000) first.setUTCHours(first.getUTCHours() + 1);
  return [0, 1, 2].map((d) => new Date(first.getTime() + d * 86_400_000));
}

export interface LaunchSiteServiceOptions {
  forecastUrl?: string;
  archiveUrl?: string;
  timeoutMs?: number;
  liveTtlMs?: number;
  now?: () => Date;
}

export class LaunchSiteService {
  private readonly forecastUrl: string;
  private readonly archiveUrl: string;
  private readonly timeoutMs: number;
  private readonly liveTtlMs: number;
  private readonly now: () => Date;
  private cache = new Map<string, { data: LaunchWindowsResponse; expiresAt: number }>();

  constructor(options?: LaunchSiteServiceOptions) {
    this.forecastUrl = options?.forecastUrl ?? "https://api.open-meteo.com/v1/forecast";
    this.archiveUrl = options?.archiveUrl ?? "https://archive-api.open-meteo.com/v1/archive";
    this.timeoutMs = options?.timeoutMs ?? 4000;
    this.liveTtlMs = options?.liveTtlMs ?? 10 * 60_000;
    this.now = options?.now ?? (() => new Date());
  }

  clearCache(): void {
    this.cache.clear();
  }

  getSites(): LaunchSite[] {
    return LAUNCH_SITES.map((s) => ({ ...s }));
  }

  getSite(id: string): LaunchSite | undefined {
    const s = LAUNCH_SITES.find((x) => x.id === id);
    return s ? { ...s } : undefined;
  }

  async getWindows(siteId: string, options?: { forceFallback?: boolean }): Promise<LaunchWindowsResponse | null> {
    const site = this.getSite(siteId);
    if (!site) return null;
    if (options?.forceFallback) return this.fallback(site);

    const cached = this.cache.get(site.id);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.data, cached: true };

    const data = site.windows === "historical" ? await this.historical(site) : await this.live(site);
    if (data) {
      this.cache.set(site.id, {
        data,
        // The past does not change: keep the 1969 hours for the server's lifetime.
        expiresAt: site.windows === "historical" ? Number.POSITIVE_INFINITY : Date.now() + this.liveTtlMs,
      });
      return data;
    }
    // Upstream failed: the last live answer beats the offline stand-in.
    if (cached) return { ...cached.data, cached: true };
    return this.fallback(site);
  }

  private async hourly(base: string, site: LaunchSite, params: Record<string, string>): Promise<Hourly | null> {
    try {
      const url = new URL(base);
      url.searchParams.set("latitude", String(site.latitude_deg));
      url.searchParams.set("longitude", String(site.longitude_deg));
      url.searchParams.set("hourly", HOURLY_FIELDS.join(","));
      url.searchParams.set("timezone", "GMT");
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const parsed = HourlySchema.safeParse(await res.json());
      return parsed.success && parsed.data.hourly.time.length > 0 ? parsed.data.hourly : null;
    } catch {
      return null;
    }
  }

  private async historical(site: LaunchSite): Promise<LaunchWindowsResponse | null> {
    const h = await this.hourly(this.archiveUrl, site, { start_date: "1969-07-16", end_date: "1969-07-21" });
    if (!h) return null;
    const windows: LaunchWindow[] = [];
    for (const w of APOLLO_11_OPPORTUNITIES) {
      const weather = weatherAt(h, new Date(w.opens_at));
      if (!weather) return null;
      windows.push({ ...w, weather });
    }
    return {
      site,
      kind: "historical",
      provider: "ERA5 reanalysis (Open-Meteo archive)",
      windows,
      source: "api",
      fetched_at: new Date().toISOString(),
    };
  }

  private async live(site: LaunchSite): Promise<LaunchWindowsResponse | null> {
    const h = await this.hourly(this.forecastUrl, site, { forecast_days: "4" });
    if (!h) return null;
    const ids: LaunchWindow["id"][] = ["w1", "w2", "w3"];
    const windows: LaunchWindow[] = [];
    const times = upcomingWindowTimes(this.now());
    for (const [k, at] of times.entries()) {
      const weather = weatherAt(h, at);
      if (!weather) return null;
      windows.push({
        id: ids[k]!,
        opens_at: at.toISOString(),
        label: k === 0 ? "Next window" : k === 1 ? "+24 h recycle" : "+48 h recycle",
        delay_cost_m: k * 60,
        weather,
      });
    }
    return { site, kind: "live", provider: "Open-Meteo forecast", windows, source: "api", fetched_at: new Date().toISOString() };
  }

  /** No network: 1969 values at LC-39A for every site, flagged offline. */
  private fallback(site: LaunchSite): LaunchWindowsResponse {
    const now = this.now();
    const times = site.windows === "historical" ? null : upcomingWindowTimes(now);
    return {
      site,
      kind: site.windows,
      provider: "Apollo 11 archive (offline)",
      windows: APOLLO_11_OPPORTUNITIES.map((w, k) => ({
        ...w,
        ...(times && { opens_at: times[k]!.toISOString(), label: k === 0 ? "Next window" : `+${k * 24} h recycle`, delay_cost_m: k * 60 }),
        weather: { ...OFFLINE_1969_WEATHER[w.id] },
      })),
      source: "offline_fallback",
    };
  }
}
