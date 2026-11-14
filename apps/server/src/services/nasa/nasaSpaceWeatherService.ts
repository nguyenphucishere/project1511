import { HISTORICAL_APOLLO_11_SPACE_WEATHER } from "./fixtures.js";
import {
  SpaceWeatherDataSchema,
  type SpaceWeatherData,
  type MissionRiskStatus,
} from "./index.js";

export interface NasaSpaceWeatherServiceOptions {
  /** NASA DONKI notifications endpoint (CME / SEP / GST alerts). */
  apiUrl?: string;
  /** api.nasa.gov key; defaults to NASA_API_KEY, then the shared (heavily rate-limited) DEMO_KEY. */
  apiKey?: string;
  /** NOAA SWPC base URL (measured Kp, F10.7, GOES proton flux; no key needed). */
  swpcBaseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

/** Galactic-cosmic-ray background inside the CSM (Apollo dosimetry average), mrad/h. */
const GCR_BASELINE_MRAD_H = 0.92;
/** NOAA S1 radiation storm threshold: >=10 MeV integral proton flux of 10 pfu. */
const SEP_THRESHOLD_PFU = 10;

interface SwpcReadings {
  kp: number | null;
  f107: number | null;
  protonPfu: number | null;
}

interface DonkiAlerts {
  cme: boolean;
  sep: boolean;
  gst: boolean;
}

const latestByTime = <T extends { time_tag?: unknown }>(rows: T[]): T | undefined =>
  rows
    .filter((r) => typeof r?.time_tag === "string")
    .sort((a, b) => String(a.time_tag).localeCompare(String(b.time_tag)))
    .at(-1);

const finite = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

export class NasaSpaceWeatherService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly swpcBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cache: { data: SpaceWeatherData; expiresAt: number } | null = null;

  constructor(options?: NasaSpaceWeatherServiceOptions) {
    this.apiUrl = options?.apiUrl ?? "https://api.nasa.gov/DONKI/notifications";
    this.apiKey = options?.apiKey ?? process.env.NASA_API_KEY ?? "DEMO_KEY";
    this.swpcBaseUrl = (options?.swpcBaseUrl ?? "https://services.swpc.noaa.gov").replace(/\/$/, "");
    this.timeoutMs = options?.timeoutMs ?? 4000;
    this.cacheTtlMs = options?.cacheTtlMs ?? 300_000; // 300s (5min) cache TTL
  }

  clearCache(): void {
    this.cache = null;
  }

  async getSpaceWeather(options?: { forceFallback?: boolean }): Promise<SpaceWeatherData> {
    if (options?.forceFallback) {
      return { ...HISTORICAL_APOLLO_11_SPACE_WEATHER };
    }

    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return { ...this.cache.data, cached: true };
    }

    const [swpc, donki] = await Promise.all([this.fetchSwpc(), this.fetchDonki()]);
    const haveSwpc = swpc.kp !== null || swpc.f107 !== null || swpc.protonPfu !== null;

    if (!haveSwpc && !donki) {
      // Both upstreams down: keep serving the last live reading rather than 1969 data.
      if (this.cache) return { ...this.cache.data, cached: true };
      return { ...HISTORICAL_APOLLO_11_SPACE_WEATHER };
    }

    const weather = haveSwpc ? this.fromMeasurements(swpc, donki) : this.fromDonkiOnly(donki!);
    const validated = SpaceWeatherDataSchema.safeParse(weather);
    if (!validated.success) {
      if (this.cache) return { ...this.cache.data, cached: true };
      return { ...HISTORICAL_APOLLO_11_SPACE_WEATHER };
    }

    this.cache = { data: validated.data, expiresAt: now + this.cacheTtlMs };
    return validated.data;
  }

  /** Measured values from NOAA SWPC, with DONKI alerts merged in when DONKI answered. */
  private fromMeasurements(swpc: SwpcReadings, donki: DonkiAlerts | null): SpaceWeatherData {
    const kp = swpc.kp ?? 1.7;
    const pfu = swpc.protonPfu ?? 0;
    const sep = Boolean(donki?.sep) || pfu >= SEP_THRESHOLD_PFU;
    const cme = Boolean(donki?.cme);
    const storm = Boolean(donki?.gst) || kp >= 5;

    let risk: MissionRiskStatus = "NOMINAL_QUIET";
    if (sep || kp >= 7) risk = "SEVERE_ALERT";
    else if (cme || storm) risk = "ELEVATED_WATCH";

    // GCR background plus a linear proton term (~3.3 mrad/h at the S1 threshold).
    const dose = Math.round((GCR_BASELINE_MRAD_H + 0.24 * pfu) * 100) / 100;

    return {
      solar_cycle: 25,
      solar_flux_f107: swpc.f107 ?? 152.0,
      geomagnetic_kp_index: Math.round(kp * 100) / 100,
      radiation_dose_rate_mrad_per_hour: dose,
      cme_alert: cme,
      solar_proton_event_alert: sep,
      mission_risk_status: risk,
      source: "api",
      provider: donki ? "NOAA SWPC + NASA DONKI" : "NOAA SWPC",
      fetched_at: new Date().toISOString(),
    };
  }

  /** DONKI notifications only (SWPC unreachable): representative values per alert class. */
  private fromDonkiOnly(donki: DonkiAlerts): SpaceWeatherData {
    let risk: MissionRiskStatus = "NOMINAL_QUIET";
    let doseRate = GCR_BASELINE_MRAD_H;
    let kpIndex = 1.7;
    let f107 = 152.0;

    if (donki.sep) {
      risk = "SEVERE_ALERT";
      doseRate = 25.0; // Elevated energetic protons
      kpIndex = 7.5;
      f107 = 220.0;
    } else if (donki.cme || donki.gst) {
      risk = "ELEVATED_WATCH";
      doseRate = 2.4;
      kpIndex = 4.3;
      f107 = 175.0;
    }

    return {
      solar_cycle: 25,
      solar_flux_f107: f107,
      geomagnetic_kp_index: kpIndex,
      radiation_dose_rate_mrad_per_hour: doseRate,
      cme_alert: donki.cme,
      solar_proton_event_alert: donki.sep,
      mission_risk_status: risk,
      source: "api",
      provider: "NASA DONKI",
      fetched_at: new Date().toISOString(),
    };
  }

  private async getJson(url: string): Promise<unknown> {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private async fetchSwpc(): Promise<SwpcReadings> {
    const base = this.swpcBaseUrl;
    const [kpRows, fluxRows, protonRows] = await Promise.all([
      this.getJson(`${base}/products/noaa-planetary-k-index.json`),
      this.getJson(`${base}/json/f107_cm_flux.json`),
      this.getJson(`${base}/json/goes/primary/integral-protons-1-day.json`),
    ]);

    const rows = (v: unknown): Record<string, unknown>[] =>
      Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : [];

    const kp = finite(latestByTime(rows(kpRows).filter((r) => "Kp" in r))?.Kp);
    const f107 = finite(latestByTime(rows(fluxRows).filter((r) => "flux" in r && !("energy" in r)))?.flux);
    const protonPfu = finite(
      latestByTime(rows(protonRows).filter((r) => r.energy === ">=10 MeV"))?.flux,
    );
    return { kp, f107, protonPfu };
  }

  private async fetchDonki(): Promise<DonkiAlerts | null> {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const url = new URL(this.apiUrl);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("type", "all");
    url.searchParams.set("api_key", this.apiKey);

    const json = await this.getJson(url.toString());
    if (!Array.isArray(json)) return null;
    // A DONKI notification always carries messageType; anything else is not a DONKI payload.
    if (json.some((item) => !item || typeof item !== "object" || !("messageType" in item))) return null;

    const alerts: DonkiAlerts = { cme: false, sep: false, gst: false };
    for (const item of json as { messageType?: unknown }[]) {
      const msgType = String(item.messageType ?? "").toUpperCase();
      if (msgType === "CME") alerts.cme = true;
      if (msgType === "SEP") alerts.sep = true;
      if (msgType === "GST" || msgType === "RBE") alerts.gst = true;
    }
    return alerts;
  }
}
