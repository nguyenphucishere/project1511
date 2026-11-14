import { describe, expect, it } from "vitest";
import { FLOW, getNextStepId } from "@/game/flow";
import { ASCENT_BURN_S, BURN_TIME_SCALE, burnState } from "./logic";

describe("liftoff", () => {
  it("plays between the return briefing and the flight home", () => {
    expect(getNextStepId("return-briefing")).toBe("liftoff-scene");
    expect(getNextStepId("liftoff-scene")).toBe("return-scene");
    expect(FLOW.find((s) => s.id === "liftoff-scene")).toMatchObject({ kind: "scene", scene: "liftoff" });
  });

  it("burns for the 435 s of the real ascent, shown in 15 s", () => {
    expect(ASCENT_BURN_S / BURN_TIME_SCALE).toBeCloseTo(15, 0);
    const end = burnState(ASCENT_BURN_S);
    expect(end.fraction).toBe(1);
    expect(end.altKm).toBeGreaterThan(15);
    expect(end.speed).toBeGreaterThan(1600);
    expect(burnState(0)).toMatchObject({ altKm: 0, speed: 0 });
  });
});
