import { HISTORICAL_APOLLO_11_EPHEMERIS } from "./fixtures.js";
import { EphemerisDataSchema, type EphemerisData } from "./index.js";

export interface NasaHorizonsServiceOptions {
  apiUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class NasaHorizonsService {
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cache: Map<string, { data: EphemerisData; expiresAt: number }> = new Map();

  constructor(options?: NasaHorizonsServiceOptions) {
    this.apiUrl = options?.apiUrl ?? "https://ssd.jpl.nasa.gov/api/horizons.api";
    this.timeoutMs = options?.timeoutMs ?? 4000;
    this.cacheTtlMs = options?.cacheTtlMs ?? 3600_000; // 3600s cache TTL
  }

  clearCache(): void {
    this.cache.clear();
  }

  async getEphemeris(options?: {
    epoch?: string;
    target?: string;
    forceFallback?: boolean;
  }): Promise<EphemerisData> {
    if (options?.forceFallback) {
      return { ...HISTORICAL_APOLLO_11_EPHEMERIS };
    }

    const target = options?.target ?? "301"; // Default to Moon (301)
    const epoch = options?.epoch ?? new Date().toISOString().slice(0, 10);
    const cacheKey = `${target}_${epoch}`;
    const now = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return { ...cached.data, cached: true };
    }

    try {
      const signal = AbortSignal.timeout(this.timeoutMs);
      const url = new URL(this.apiUrl);
      url.searchParams.set("format", "json");
      url.searchParams.set("COMMAND", `'${target}'`);
      url.searchParams.set("CENTER", "'500@399'"); // Geocentric body center
      url.searchParams.set("MAKE_EPHEM", "'YES'");
      url.searchParams.set("EPHEM_TYPE", "'VECTORS'");
      url.searchParams.set("START_TIME", `'${epoch}'`);
      url.searchParams.set("STOP_TIME", `'${epoch} 00:02'`);
      url.searchParams.set("STEP_SIZE", "'1m'");

      const res = await fetch(url.toString(), {
        signal,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return this.fallback(cached);
      }

      const json = (await res.json()) as { result?: string; error?: string };
      if (json.error || !json?.result) {
        return this.fallback(cached);
      }

      const parsed = this.parseHorizonsOutput(json.result, target, epoch);
      if (!parsed) {
        return this.fallback(cached);
      }

      const validated = EphemerisDataSchema.safeParse(parsed);
      if (!validated.success) {
        return this.fallback(cached);
      }

      this.cache.set(cacheKey, {
        data: validated.data,
        expiresAt: now + this.cacheTtlMs,
      });

      return validated.data;
    } catch {
      return this.fallback(cached);
    }
  }

  /** Upstream failed: reuse the last live vector for this target/epoch, else the 1969 baseline. */
  private fallback(stale?: { data: EphemerisData }): EphemerisData {
    if (stale) return { ...stale.data, cached: true };
    return { ...HISTORICAL_APOLLO_11_EPHEMERIS };
  }

  private parseHorizonsOutput(
    text: string,
    target: string,
    epochRequested: string
  ): EphemerisData | null {
    const soeIdx = text.indexOf("$$SOE");
    const eoeIdx = text.indexOf("$$EOE");
    if (soeIdx === -1 || eoeIdx === -1 || eoeIdx <= soeIdx) return null;

    const block = text.slice(soeIdx, eoeIdx);

    const xMatch = block.match(/\bX\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const yMatch = block.match(/\bY\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const zMatch = block.match(/\bZ\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const vxMatch = block.match(/\bVX\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const vyMatch = block.match(/\bVY\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const vzMatch = block.match(/\bVZ\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const ltMatch = block.match(/\bLT\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const rgMatch = block.match(/\bRG\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);
    const rrMatch = block.match(/\bRR\s*=\s*([+-]?\d+\.?\d*(?:E[+-]?\d+)?)/i);

    let x: number;
    let y: number;
    let z: number;
    let vx: number;
    let vy: number;
    let vz: number;
    let lt: number;
    let rg: number;
    let rr: number;

    if (xMatch && yMatch && zMatch && vxMatch && vyMatch && vzMatch) {
      x = parseFloat(xMatch[1]);
      y = parseFloat(yMatch[1]);
      z = parseFloat(zMatch[1]);
      vx = parseFloat(vxMatch[1]);
      vy = parseFloat(vyMatch[1]);
      vz = parseFloat(vzMatch[1]);
      lt = ltMatch ? parseFloat(ltMatch[1]) : 1.2991;
      rg = rgMatch ? parseFloat(rgMatch[1]) : Math.sqrt(x * x + y * y + z * z);
      rr = rrMatch ? parseFloat(rrMatch[1]) : (x * vx + y * vy + z * vz) / (rg || 1);
    } else {
      // Check CSV line format
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("$$"));
      if (lines.length === 0) return null;
      const tokens = lines[0].split(",").map((t) => t.trim());
      if (tokens.length >= 8) {
        const numTokens = tokens.slice(2).map(parseFloat).filter((n) => !isNaN(n));
        if (numTokens.length >= 6) {
          x = numTokens[0];
          y = numTokens[1];
          z = numTokens[2];
          vx = numTokens[3];
          vy = numTokens[4];
          vz = numTokens[5];
          lt = numTokens[6] ?? 1.2991;
          rg = numTokens[7] ?? Math.sqrt(x * x + y * y + z * z);
          rr = numTokens[8] ?? (x * vx + y * vy + z * vz) / (rg || 1);
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(vx) || isNaN(vy) || isNaN(vz)) {
      return null;
    }

    const orbitalVel = Math.sqrt(vx * vx + vy * vy + vz * vz);

    return {
      target_body: target === "301" ? "Moon (301)" : `Body (${target})`,
      center_body: "Earth Center (500@399)",
      epoch: epochRequested,
      distance_km: Math.round(rg * 1000) / 1000,
      radial_velocity_km_s: Math.round(rr * 10000) / 10000,
      orbital_velocity_km_s: Math.round(orbitalVel * 10000) / 10000,
      one_way_light_time_s: Math.round(lt * 10000) / 10000,
      state_vector_eci_km: {
        x,
        y,
        z,
        vx,
        vy,
        vz,
      },
      source: "api",
      fetched_at: new Date().toISOString(),
    };
  }
}
