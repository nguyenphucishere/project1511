import type { MissionDesign } from "@space-sim/shared-schema";

export class MissionService {
  async getMissionById(_id: string): Promise<MissionDesign | null> {
    throw new Error("TODO: Implement getMissionById");
  }

  async saveMission(_mission: MissionDesign): Promise<void> {
    throw new Error("TODO: Implement saveMission");
  }
}
