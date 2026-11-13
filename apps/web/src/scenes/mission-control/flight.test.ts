import { describe, expect, it } from "vitest";
import { STAGE2_IGNITION_SEC, STAGING_SEC, missionSecondsAt, realSecondsAt } from "./flight";

describe("flight time warp", () => {
  it("plays liftoff at 1× and reaches orbit insertion in about 15.3 s", () => {
    expect(missionSecondsAt(3)).toBe(3);
    expect(missionSecondsAt(15.3)).toBeGreaterThan(539);
  });

  it("is monotonic and inverts", () => {
    let last = -1;
    for (let r = 0; r <= 16; r += 0.25) {
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
