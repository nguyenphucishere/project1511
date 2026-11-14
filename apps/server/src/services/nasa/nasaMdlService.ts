import {
  HISTORICAL_APOLLO_11_EASEP,
  HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT,
} from "./fixtures.js";
import type { EasepData, LunarEnvironmentData } from "./index.js";

export class NasaMdlService {
  getEasepData(): EasepData {
    return {
      ...HISTORICAL_APOLLO_11_EASEP,
      experiments: [...HISTORICAL_APOLLO_11_EASEP.experiments],
      deployment_site: { ...HISTORICAL_APOLLO_11_EASEP.deployment_site },
    };
  }

  getEasepSpec(): EasepData {
    return this.getEasepData();
  }

  getLunarEnvironment(): LunarEnvironmentData {
    return { ...HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT };
  }
}
