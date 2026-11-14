import {
  HISTORICAL_APOLLO_11_EASEP,
  HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT,
} from "./fixtures.js";
import type { EasepData, LunarEnvironmentData } from "./index.js";
import { engineLunarConstants, type EngineLunarConstants } from "../simEngine.js";

export interface NasaMdlServiceOptions {
  /** Engine lookup; defaults to the Rust sim-core constants via sim-wasm. Injectable for tests. */
  lunarConstants?: () => Promise<EngineLunarConstants | null>;
}

export class NasaMdlService {
  private readonly lunarConstants: () => Promise<EngineLunarConstants | null>;

  constructor(options?: NasaMdlServiceOptions) {
    this.lunarConstants = options?.lunarConstants ?? engineLunarConstants;
  }

  /** EASEP is fixed 1969 flight hardware: there is no live feed, so it is reference data. */
  getEasepData(): EasepData {
    return {
      ...HISTORICAL_APOLLO_11_EASEP,
      experiments: [...HISTORICAL_APOLLO_11_EASEP.experiments],
      deployment_site: { ...HISTORICAL_APOLLO_11_EASEP.deployment_site },
      source: "reference",
    };
  }

  getEasepSpec(): EasepData {
    return this.getEasepData();
  }

  /**
   * Lunar surface constants from the simulation engine (the same values the descent physics
   * uses). Falls back to the Apollo 11 fixture when the engine binary is unavailable.
   */
  async getLunarEnvironment(): Promise<LunarEnvironmentData> {
    const c = await this.lunarConstants().catch(() => null);
    if (!c) return { ...HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT };
    return {
      standard_gravity_mps2: c.standard_gravity_mps2,
      mascon_anomaly_mps2: c.mascon_anomaly_mps2,
      local_gravity_effective_mps2: c.local_gravity_effective_mps2,
      terrain_slope_deg: c.terrain_slope_deg,
      regolith_bulk_density_kg_m3: c.regolith_bulk_density_kg_m3,
      regolith_bearing_capacity_kpa: c.regolith_bearing_capacity_kpa,
      surface_temperature_c: c.surface_temperature_c,
      ...(c.mascon_anomaly_mgal !== undefined && { mascon_anomaly_mgal: c.mascon_anomaly_mgal }),
      ...(c.surface_temperature_day_c !== undefined && { surface_temperature_day_c: c.surface_temperature_day_c }),
      ...(c.surface_temperature_night_c !== undefined && { surface_temperature_night_c: c.surface_temperature_night_c }),
      ...(c.moon_radius_km !== undefined && { moon_radius_km: c.moon_radius_km }),
      source: "engine",
    };
  }
}
