import { describe, expect, it } from "vitest";
import {
  ADAPTER_SEC,
  FILM_END_SEC,
  LES_SEC,
  NOMINAL_EVENTS,
  ORBIT_SEC,
  STAGE2_IGNITION_SEC,
  STAGE2_SEP_SEC,
  STAGE3_IGNITION_SEC,
  STAGING_SEC,
  altitudeKm,
  missionSecondsAt,
  realSecondsAt,
  speedKms,
} from "./flight";
import { ascentProfile } from "@/game/ascentFlight";

describe("flight time warp", () => {
  it("plays liftoff in slow motion and reaches orbit insertion after the long film", () => {
    expect(missionSecondsAt(3)).toBeLessThan(3);
    expect(missionSecondsAt(95.8)).toBeGreaterThan(ORBIT_SEC);
    expect(realSecondsAt(FILM_END_SEC)).toBeGreaterThan(90);
  });

  it("is monotonic and inverts", () => {
    let last = -1;
    for (let r = 0; r <= 100; r += 0.25) {
      const m = missionSecondsAt(r);
      expect(m).toBeGreaterThan(last);
      expect(realSecondsAt(m)).toBeCloseTo(r, 6);
      last = m;
    }
  });

  it("keys every stage event to the engine's ascent", () => {
    const e = ascentProfile(185).events;
    expect(STAGING_SEC).toBe(e.s_ic_oeco_s);
    expect(STAGE2_IGNITION_SEC).toBe(e.s_ii_ignition_s);
    expect(LES_SEC).toBe(e.les_jettison_s);
    expect(STAGE2_SEP_SEC).toBe(e.s_ii_cutoff_s);
    expect(STAGE3_IGNITION_SEC).toBe(e.s_ivb_ignition_s);
    expect(ORBIT_SEC).toBe(e.insertion_s);
    expect(NOMINAL_EVENTS.find((x) => x.label === "eventMaxQ")!.t).toBe(e.max_q_s);
    // The HUD reads the engine profile: 185 km and orbital speed at insertion.
    expect(altitudeKm(ORBIT_SEC, 185)).toBeCloseTo(185, 0);
    expect(speedKms(ORBIT_SEC, 185)).toBeGreaterThan(7.2);
  });

  it("orders the stage events and leaves a visible gap around each", () => {
    const events = [STAGING_SEC, STAGE2_IGNITION_SEC, LES_SEC, STAGE2_SEP_SEC, STAGE3_IGNITION_SEC, ADAPTER_SEC].map(realSecondsAt);
    for (let i = 1; i < events.length; i++) expect(events[i]! - events[i - 1]!).toBeGreaterThan(1.5);
  });
});
