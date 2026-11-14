import { describe, expect, it } from "vitest";
import { getNextStepId } from "./flow";

describe("mission control → next step", () => {
  it("a normal launch goes on to the weather call", () => {
    expect(getNextStepId("mission-control-scene", { narrative: { decisions: {} } })).toBe("weather-decision");
  });

  it("a vehicle lost to the weather from the console ends the mission (ENDING-5)", () => {
    expect(getNextStepId("mission-control-scene", { narrative: { decisions: { weather: "severe_wind" } } })).toBe("end");
  });
});
