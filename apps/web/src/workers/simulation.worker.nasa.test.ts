import { describe, expect, it } from "vitest";
import { handleWorkerMessage } from "./simulation.worker";
import { APOLLO_11_DESIGN_BASELINE } from "@/lib/simulation/nasa.physics";

describe("simulation worker NASA messages", () => {
  it("answers LANDING_RADAR, MISSION_DESIGN_BUDGET and DSN_TELEMETRY", async () => {
    const radar = await handleWorkerMessage({
      id: "r",
      type: "LANDING_RADAR",
      payload: { inertial_alt_m: 600, vertical_vel_mps: -6, horizontal_vel_mps: 15, terrain_elevation_offset_m: 10 },
    });
    expect(radar.type).toBe("RESULT");
    expect(radar.result).toMatchObject({ radar_altitude_m: 590, scale_mode: 2, data_good: true });

    const mdl = await handleWorkerMessage({ id: "m", type: "MISSION_DESIGN_BUDGET", payload: APOLLO_11_DESIGN_BASELINE });
    expect(mdl.result).toMatchObject({ cml_score: 4, is_mass_compliant: true });

    const dsn = await handleWorkerMessage({ id: "d", type: "DSN_TELEMETRY", payload: { distance_km: 384_400 } });
    expect((dsn.result as { rtlt_seconds: number }).rtlt_seconds).toBeCloseTo(2.564, 3);
  });
});
