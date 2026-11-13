import { describe, expect, it } from "vitest";
import { STAGE2_IGNITION_SEC, STAGING_SEC, STRETCH, missionSecondsAt, realSecondsAt } from "./flight";

describe("flight time warp", () => {
  it("plays liftoff in slow motion and reaches orbit insertion after the stretched flight", () => {
    expect(missionSecondsAt(3 * STRETCH)).toBeCloseTo(3, 6);
    expect(missionSecondsAt(15.35 * STRETCH)).toBeGreaterThan(539);
  });

  it("is monotonic and inverts", () => {
    let last = -1;
    for (let r = 0; r <= 16 * STRETCH; r += 0.25) {
      const m = missionSecondsAt(r);
      expect(m).toBeGreaterThan(last);
      expect(realSecondsAt(m)).toBeCloseTo(r, 6);
      last = m;
    }
  });

  it("leaves a visible gap between separation and stage 2 ignition", () => {
    expect(realSecondsAt(STAGE2_IGNITION_SEC) - realSecondsAt(STAGING_SEC)).toBeGreaterThan(0.5);
  });
});
