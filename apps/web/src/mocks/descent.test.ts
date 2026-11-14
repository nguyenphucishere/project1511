import { describe, expect, it } from "vitest";
import { DESCENT_STEPS, KEYFRAMES, missionTimeAt, sampleAt } from "./descent";

describe("descent profile", () => {
  it("passes exactly through every keyframe", () => {
    for (const k of KEYFRAMES.slice(0, -1)) {
      const s = sampleAt(k.t);
      expect(s.altM).toBeCloseTo(k.altM, 6);
      expect(s.vsMs).toBeCloseTo(k.vsMs, 6);
      expect(s.fuelPct).toBeCloseTo(k.fuelPct, 6);
    }
    expect(sampleAt(1e6).altM).toBe(0);
  });

  it("never goes below the ground, burns fuel steadily, and descends once the braking burn bites", () => {
    // At PDI the LM is slightly faster than circular speed, so it rises a few metres during the
    // ullage burn (real orbital mechanics). From a minute in it only descends.
    for (let t = 0; t <= 60; t += 0.5) expect(sampleAt(t).altM).toBeLessThan(KEYFRAMES[0]!.altM + 20);
    let prev = sampleAt(60);
    for (let t = 60.5; t <= KEYFRAMES.at(-1)!.t; t += 0.5) {
      const s = sampleAt(t);
      expect(s.altM).toBeGreaterThanOrEqual(0);
      expect(s.altM).toBeLessThanOrEqual(prev.altM + 1e-9);
      expect(s.vsMs).toBeLessThanOrEqual(1e-9);
      expect(s.fuelPct).toBeLessThanOrEqual(prev.fuelPct + 1e-9);
      prev = s;
    }
  });

  it("vertical speed is the slope of altitude", () => {
    const end = KEYFRAMES.at(-1)!.t;
    for (const t of [100, 400, 500, 600, KEYFRAMES[2]!.t + 10, end - 0.5]) {
      const slope = (sampleAt(t + 0.01).altM - sampleAt(t - 0.01).altM) / 0.02;
      expect(sampleAt(t).vsMs).toBeCloseTo(slope, 1);
    }
  });

  it("leaves the flown steps (site choice, engine stop) to the flight model", () => {
    expect(DESCENT_STEPS.map((s) => s.playSec !== null)).toEqual([true, true, false, false]);
    expect(missionTimeAt(2, 5)).toBe(KEYFRAMES[2].t);
  });

  it("plays each scripted step's segment from one keyframe to the next", () => {
    DESCENT_STEPS.forEach((step, i) => {
      if (step.playSec === null) return;
      expect(missionTimeAt(i, 0)).toBe(KEYFRAMES[i].t);
      expect(missionTimeAt(i, step.playSec)).toBe(KEYFRAMES[i + 1].t);
      expect(missionTimeAt(i, step.playSec * 10)).toBe(KEYFRAMES[i + 1].t);
    });
  });
});
