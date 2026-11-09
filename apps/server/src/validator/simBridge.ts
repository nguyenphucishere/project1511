import type { SimulationResult, MissionDesign } from "@space-sim/shared-schema";

export class SimulationValidatorBridge {
  async runAuthoritativeSimulation(_design: MissionDesign): Promise<SimulationResult> {
    throw new Error("TODO: Implement runAuthoritativeSimulation via sim-core");
  }
}
