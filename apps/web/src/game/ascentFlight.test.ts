import { describe, expect, it } from "vitest";
import {
  EVENTS,
  INSERTION_MET,
  altitudeKm,
  eventsBetween,
  formatMet,
  gForce,
  heating,
  inertialSpeedKms,
  insertionMet,
  TROUBLE_LEAD,
  CRITICAL_LEAD,
  skyBlend,
  speedKms,
  vibration,
} from "./ascentFlight";

describe("ascent flight profile (engine)", () => {
  it("climbs to the chosen orbit and stays there after insertion", () => {
    for (const km of [160, 185, 250]) {
      const ins = insertionMet(km);
      expect(altitudeKm(ins, km)).toBeCloseTo(km, 0);
      expect(altitudeKm(ins + 100, km)).toBeCloseTo(km, 0);
    }
    expect(altitudeKm(0)).toBe(0);
    expect(altitudeKm(60)).toBeGreaterThan(3);
  });

  it("inserts near Apollo 11's T+11:49 at orbital speed", () => {
    expect(INSERTION_MET).toBeGreaterThan(650);
    expect(INSERTION_MET).toBeLessThan(760);
    expect(speedKms(0)).toBe(0);
    expect(inertialSpeedKms(INSERTION_MET)).toBeCloseTo(7.79, 1);
  });

  it("feels the liftoff TWR, peaks above 3 g, and is weightless after cutoff", () => {
    expect(gForce(0)).toBeCloseTo(1.17, 2);
    expect(gForce(150)).toBeGreaterThan(3);
    expect(gForce(INSERTION_MET + 5)).toBe(0);
    expect(vibration(INSERTION_MET + 5)).toBe(0);
  });

  it("goes nearly weightless in the staging coast after S-IC cutoff", () => {
    const sep = EVENTS.find((e) => e.id === "stageSep")!.met;
    expect(sep).toBeCloseTo(161.1, 1);
    expect(gForce(Math.ceil(sep))).toBeLessThan(0.2); // the per-second sample inside the 1.4 s coast
    expect(gForce(sep - 1)).toBeGreaterThan(3);
  });
});

describe("ascent events", () => {
  it("are in time order, at the engine's times, and end at insertion", () => {
    const times = EVENTS.map((e) => e.met);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[times.length - 1]).toBe(INSERTION_MET);
    expect(EVENTS.find((e) => e.id === "towerJettison")!.met).toBeCloseTo(197.9, 1);
    const maxQ = EVENTS.find((e) => e.id === "maxQ")!.met;
    expect(maxQ).toBeGreaterThan(75);
    expect(maxQ).toBeLessThan(95);
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
  it("heats up around max q and is gone above the atmosphere", () => {
    const maxQ = EVENTS.find((e) => e.id === "maxQ")!.met;
    expect(heating(maxQ)).toBeGreaterThan(0.95);
    expect(heating(300)).toBeLessThan(0.001);
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
