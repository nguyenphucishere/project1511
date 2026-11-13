import { describe, expect, it } from "vitest";
import {
  EVENTS,
  INSERTION_MET,
  altitudeKm,
  eventsBetween,
  formatMet,
  gForce,
  heating,
  TROUBLE_LEAD,
  CRITICAL_LEAD,
  skyBlend,
  speedKms,
  vibration,
} from "./ascentFlight";

describe("ascent flight profile", () => {
  it("climbs monotonically and reaches the chosen orbit at insertion", () => {
    let last = -1;
    for (let met = 0; met <= INSERTION_MET; met += 5) {
      const alt = altitudeKm(met, 200);
      expect(alt).toBeGreaterThanOrEqual(last);
      last = alt;
    }
    expect(altitudeKm(INSERTION_MET, 200)).toBeCloseTo(200, 5);
    expect(altitudeKm(INSERTION_MET + 100, 200)).toBeCloseTo(200, 5);
  });

  it("builds up to orbital speed", () => {
    expect(speedKms(0)).toBe(0);
    expect(speedKms(INSERTION_MET)).toBeGreaterThan(7.5);
  });

  it("is weightless and still after cutoff", () => {
    expect(gForce(INSERTION_MET + 5)).toBe(0);
    expect(vibration(INSERTION_MET + 5)).toBe(0);
    expect(gForce(60)).toBeGreaterThan(1);
  });

  it("dips in g and shake at stage separation", () => {
    expect(gForce(131)).toBeLessThan(0.5);
    expect(gForce(125)).toBeGreaterThan(3);
  });
});

describe("ascent events", () => {
  it("are in time order and end at insertion", () => {
    const times = EVENTS.map((e) => e.met);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[times.length - 1]).toBe(INSERTION_MET);
  });

  it("each fire exactly once as the clock advances in steps", () => {
    const fired: string[] = [];
    let prev = -1;
    for (let met = 0; met <= INSERTION_MET + 6; met += 3.7) {
      for (const e of eventsBetween(prev, met)) fired.push(e.id);
      prev = met;
    }
    expect(fired).toEqual(EVENTS.map((e) => e.id));
  });
});

describe("failure timing", () => {
  it("gives a longer warning than the critical window", () => {
    expect(TROUBLE_LEAD).toBeGreaterThan(CRITICAL_LEAD);
  });
  it("heats up around max q and is gone after staging", () => {
    expect(heating(85)).toBe(1);
    expect(heating(300)).toBe(0);
  });
});

describe("helpers", () => {
  it("fades the blue sky out into space", () => {
    expect(skyBlend(0)).toBe(1);
    expect(skyBlend(120)).toBe(0);
    expect(skyBlend(50)).toBeGreaterThan(0);
    expect(skyBlend(50)).toBeLessThan(1);
  });

  it("formats mission time", () => {
    expect(formatMet(0)).toBe("T+00:00");
    expect(formatMet(125.7)).toBe("T+02:05");
  });
});
