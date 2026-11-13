import { describe, expect, it } from "vitest";
import { ADAPTER_SEC, LES_SEC, STAGE2_IGNITION_SEC, STAGE2_SEP_SEC, STAGE3_IGNITION_SEC, STAGING_SEC, missionSecondsAt, realSecondsAt } from "./flight";

describe("flight time warp", () => {
  it("plays liftoff in slow motion and reaches orbit insertion after the long film", () => {
    expect(missionSecondsAt(3)).toBeLessThan(3);
    expect(missionSecondsAt(73.8)).toBeGreaterThan(535);
    expect(realSecondsAt(540)).toBeGreaterThan(70);
  });

  it("is monotonic and inverts", () => {
    let last = -1;
    for (let r = 0; r <= 75; r += 0.25) {
      const m = missionSecondsAt(r);
      expect(m).toBeGreaterThan(last);
      expect(realSecondsAt(m)).toBeCloseTo(r, 6);
      last = m;
    }
  });

  it("orders the stage events and leaves a visible gap around each", () => {
    const events = [STAGING_SEC, STAGE2_IGNITION_SEC, LES_SEC, STAGE2_SEP_SEC, STAGE3_IGNITION_SEC, ADAPTER_SEC].map(realSecondsAt);
    for (let i = 1; i < events.length; i++) expect(events[i]! - events[i - 1]!).toBeGreaterThan(1.5);
  });
});
