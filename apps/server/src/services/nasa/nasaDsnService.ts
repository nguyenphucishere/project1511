import { HISTORICAL_APOLLO_11_DSN_STATUS } from "./fixtures.js";
import { DsnStatusDataSchema, type DsnStatusData, type DsnComplex } from "./index.js";

export interface NasaDsnServiceOptions {
  apiUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class NasaDsnService {
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cache: { data: DsnStatusData; expiresAt: number } | null = null;

  constructor(options?: NasaDsnServiceOptions) {
    this.apiUrl = options?.apiUrl ?? "https://eyes.nasa.gov/dsn/data/dsn.xml";
    this.timeoutMs = options?.timeoutMs ?? 1500;
    this.cacheTtlMs = options?.cacheTtlMs ?? 15_000; // 15s cache TTL
  }

  clearCache(): void {
    this.cache = null;
  }

  async getDsnStatus(options?: { forceFallback?: boolean }): Promise<DsnStatusData> {
    if (options?.forceFallback) {
      return { ...HISTORICAL_APOLLO_11_DSN_STATUS };
    }

    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return { ...this.cache.data, cached: true };
    }

    try {
      const signal = AbortSignal.timeout(this.timeoutMs);
      const res = await fetch(this.apiUrl, { signal });

      if (!res.ok) {
        return { ...HISTORICAL_APOLLO_11_DSN_STATUS };
      }

      const xmlText = await res.text();
      const parsed = this.parseDsnXml(xmlText);
      if (!parsed) {
        return { ...HISTORICAL_APOLLO_11_DSN_STATUS };
      }

      const validated = DsnStatusDataSchema.safeParse(parsed);
      if (!validated.success) {
        return { ...HISTORICAL_APOLLO_11_DSN_STATUS };
      }

      this.cache = {
        data: validated.data,
        expiresAt: now + this.cacheTtlMs,
      };

      return validated.data;
    } catch {
      return { ...HISTORICAL_APOLLO_11_DSN_STATUS };
    }
  }

  private parseDsnXml(xml: string): DsnStatusData | null {
    if (!xml || typeof xml !== "string") return null;

    const lines = xml.split("\n");
    let currentStation = "Goldstone";
    const complexes: DsnComplex[] = [];
    let activeDishName = "";
    let maxSignalPower = -999;
    let upFreq = 2106.4;
    let downFreq = 2287.5;
    let detectedRtlt = 2.56;
    let carrierLock = false;
    let telemetryLock = false;
    let detectedBitrate = 51.2;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match <station name="..." friendlyName="..." ...>
      const stationMatch = line.match(
        /<station\s+[^>]*?(?:friendlyName="([^"]+)"[^>]*?name="([^"]+)"|name="([^"]+)"[^>]*?friendlyName="([^"]+)")/i
      ) || line.match(/<station\s+name="([^"]+)"/i);

      if (stationMatch) {
        const friendly = stationMatch[1] || stationMatch[4] || stationMatch[2] || stationMatch[3] || "Goldstone";
        currentStation = friendly;
        continue;
      }

      // Match <dish ...>
      if (line.includes("<dish")) {
        const nameMatch = line.match(/name="([^"]*)"/i);
        const azMatch = line.match(/azimuthAngle="([^"]*)"/i);
        const elMatch = line.match(/elevationAngle="([^"]*)"/i);
        const actMatch = line.match(/activity="([^"]*)"/i);

        if (nameMatch && nameMatch[1]) {
          const dishName = nameMatch[1];
          const az = azMatch && azMatch[1] !== "" ? parseFloat(azMatch[1]) || 0 : 0;
          const el = elMatch && elMatch[1] !== "" ? parseFloat(elMatch[1]) || 0 : 0;
          const act = actMatch ? actMatch[1] : "TRACKING";

          complexes.push({
            id: dishName,
            name: `${currentStation} (${dishName})`,
            dish: dishName,
            azimuth_deg: Math.round(az * 10) / 10,
            elevation_deg: Math.round(el * 10) / 10,
            status: act,
            signal_type: "carrier",
          });
        }
      }

      // Match downlink / downSignal
      if (line.includes("<downSignal") || line.includes("<downlink")) {
        const activeMatch = line.match(/active="([^"]*)"/i);
        const isActive = !activeMatch || activeMatch[1] === "true";
        if (isActive) {
          carrierLock = true;
          const sigTypeMatch = line.match(/signalType="([^"]*)"/i);
          const sigType = sigTypeMatch ? sigTypeMatch[1] : "carrier";
          if (sigType === "data") {
            telemetryLock = true;
          }

          const powerMatch = line.match(/power="([^"]*)"/i);
          if (powerMatch && powerMatch[1]) {
            const power = parseFloat(powerMatch[1]);
            if (!isNaN(power) && power > maxSignalPower) {
              maxSignalPower = power;
              if (complexes.length > 0) {
                activeDishName = complexes[complexes.length - 1].name;
                complexes[complexes.length - 1].signal_type = sigType;
              }
            }
          }

          const dataRateMatch = line.match(/dataRate="([^"]*)"/i);
          if (dataRateMatch && dataRateMatch[1]) {
            const dr = parseFloat(dataRateMatch[1]);
            if (!isNaN(dr) && dr > 0) {
              detectedBitrate = dr > 100 ? Math.round((dr / 1000) * 10) / 10 : dr;
              telemetryLock = true;
            }
          }

          const freqMatch = line.match(/frequency="([^"]*)"/i);
          if (freqMatch && freqMatch[1]) {
            const f = parseFloat(freqMatch[1]);
            if (!isNaN(f) && f > 0) {
              downFreq = f > 1_000_000 ? Math.round((f / 1_000_000) * 10) / 10 : f;
            }
          }
        }
      }

      // Match uplink / upSignal
      if (line.includes("<upSignal") || line.includes("<uplink")) {
        const freqMatch = line.match(/frequency="([^"]*)"/i);
        if (freqMatch && freqMatch[1]) {
          const f = parseFloat(freqMatch[1]);
          if (!isNaN(f) && f > 0) {
            upFreq = f > 1_000_000 ? Math.round((f / 1_000_000) * 10) / 10 : f;
          }
        }
      }

      // Match target roundTripLightTime or rtlt
      if (line.includes("<target")) {
        const targetMatch = line.match(/(?:roundTripLightTime="([^"]*)"|rtlt="([^"]*)")/i);
        if (targetMatch) {
          const rawRtlt = targetMatch[1] || targetMatch[2];
          if (rawRtlt) {
            const r = parseFloat(rawRtlt);
            if (!isNaN(r) && r > 0) {
              detectedRtlt = Math.round(r * 100) / 100;
            }
          }
        }
      }
    }

    if (complexes.length === 0) return null;

    return {
      active_station: activeDishName || complexes[0].name,
      complexes: complexes.slice(0, 10),
      rtlt_seconds: detectedRtlt,
      uplink_frequency_mhz: upFreq,
      downlink_frequency_mhz: downFreq,
      carrier_lock: carrierLock,
      telemetry_lock: telemetryLock,
      bitrate_kbps: detectedBitrate,
      signal_strength_dbm: maxSignalPower > -900 ? maxSignalPower : -118.5,
      is_lunar_occultation: false,
      source: "api",
      fetched_at: new Date().toISOString(),
    };
  }
}
