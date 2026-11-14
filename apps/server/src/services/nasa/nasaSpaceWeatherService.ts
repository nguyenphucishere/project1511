import { HISTORICAL_APOLLO_11_SPACE_WEATHER } from "./fixtures.js";
import {
  SpaceWeatherDataSchema,
  type SpaceWeatherData,
  type MissionRiskStatus,
} from "./index.js";

export interface NasaSpaceWeatherServiceOptions {
  apiUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class NasaSpaceWeatherService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cache: { data: SpaceWeatherData; expiresAt: number } | null = null;

  constructor(options?: NasaSpaceWeatherServiceOptions) {
    this.apiUrl = options?.apiUrl ?? "https://api.nasa.gov/DONKI/notifications";
    this.apiKey = options?.apiKey ?? "DEMO_KEY";
    this.timeoutMs = options?.timeoutMs ?? 1500;
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

    try {
      const signal = AbortSignal.timeout(this.timeoutMs);
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

      const url = new URL(this.apiUrl);
      url.searchParams.set("startDate", startDate);
      url.searchParams.set("endDate", endDate);
      url.searchParams.set("type", "all");
      url.searchParams.set("api_key", this.apiKey);

      const res = await fetch(url.toString(), {
        signal,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return { ...HISTORICAL_APOLLO_11_SPACE_WEATHER };
      }

      const json = await res.json();
      if (!Array.isArray(json)) {
        return { ...HISTORICAL_APOLLO_11_SPACE_WEATHER };
      }

      let cmeAlert = false;
      let sepAlert = false;
      let gstActive = false;

      for (const item of json) {
        const msgType = (item?.messageType ?? "").toString().toUpperCase();
        if (msgType === "CME") cmeAlert = true;
        if (msgType === "SEP") sepAlert = true;
        if (msgType === "GST" || msgType === "RBE") gstActive = true;
      }

      let riskStatus: MissionRiskStatus = "NOMINAL_QUIET";
      let doseRate = 0.92;
      let kpIndex = 1.7;
      let f107 = 152.0;

      if (sepAlert) {
        riskStatus = "SEVERE_ALERT";
        doseRate = 25.0; // Elevated energetic protons
        kpIndex = 7.5;
        f107 = 220.0;
      } else if (cmeAlert || gstActive) {
        riskStatus = "ELEVATED_WATCH";
        doseRate = 2.4;
        kpIndex = 4.3;
        f107 = 175.0;
      }

      const weather: SpaceWeatherData = {
        solar_cycle: 25,
        solar_flux_f107: f107,
        geomagnetic_kp_index: kpIndex,
        radiation_dose_rate_mrad_per_hour: doseRate,
        cme_alert: cmeAlert,
        solar_proton_event_alert: sepAlert,
        mission_risk_status: riskStatus,
        source: "api",
        fetched_at: new Date().toISOString(),
      };

      const validated = SpaceWeatherDataSchema.safeParse(weather);
      if (!validated.success) {
        return { ...HISTORICAL_APOLLO_11_SPACE_WEATHER };
      }

      this.cache = {
        data: validated.data,
        expiresAt: now + this.cacheTtlMs,
      };

      return validated.data;
    } catch {
      return { ...HISTORICAL_APOLLO_11_SPACE_WEATHER };
    }
  }
}
