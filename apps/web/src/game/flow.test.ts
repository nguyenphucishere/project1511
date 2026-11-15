import { describe, expect, it } from "vitest";
import { getNextStepId } from "./flow";

describe("mission control → next step", () => {
  it("a normal launch goes on to the capsule", () => {
    expect(getNextStepId("mission-control-scene", { narrative: { decisions: {} } })).toBe("launch-video");
  });

  it("a vehicle lost to the weather from the console ends the mission (ENDING-5)", () => {
    expect(getNextStepId("mission-control-scene", { narrative: { decisions: { weather: "severe_wind" } } })).toBe("end");
  });
});

describe("the landing chapter", () => {
  it("goes straight from the flight to the Moon into the landing scene", () => {
    expect(getNextStepId("translunar-scene")).toBe("lunar-descent-scene");
  });

  it("a safe landing plays the touchdown film, then the flag", () => {
    expect(getNextStepId("lunar-descent-scene", { narrative: { decisions: {}, ending: null } })).toBe("touchdown-film");
    expect(getNextStepId("touchdown-film")).toBe("flag-video");
  });

  it("an abort, a landing in the boulders or a wave-off ends the mission", () => {
    for (const ending of ["ending-2", "ending-3", "ending-4"])
      expect(getNextStepId("lunar-descent-scene", { narrative: { decisions: {}, ending } })).toBe("end");
  });
});
