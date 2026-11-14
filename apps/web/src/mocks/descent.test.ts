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

  it("only ever descends, never below the ground, and burns fuel steadily", () => {
    let prev = sampleAt(0);
    for (let t = 0.5; t <= KEYFRAMES.at(-1)!.t; t += 0.5) {
      const s = sampleAt(t);
      expect(s.altM).toBeGreaterThanOrEqual(0);
      expect(s.altM).toBeLessThanOrEqual(prev.altM + 1e-9);
      expect(s.vsMs).toBeLessThanOrEqual(1e-9);
      expect(s.fuelPct).toBeLessThanOrEqual(prev.fuelPct + 1e-9);
      prev = s;
    }
  });

  it("vertical speed is the slope of altitude", () => {
    for (const t of [100, 400, 500, 650, 701]) {
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
