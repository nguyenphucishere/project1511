import { afterEach, describe, expect, it, vi } from "vitest";
import { ORBIT_INSERTION_SEC, assessLaunch, mockLaunchSimulator, runLaunch } from "./launch.mock";
import type { LaunchConfig } from "./launch.types";

/** The scene's first-attempt config: right vehicle and payload, 90 % fuel, the windy window. */
const FIRST: LaunchConfig = { vehicle: "saros", payload: "standard", fuelPct: 90, orbitKm: 185, window: "w1" };
const GOOD: LaunchConfig = { ...FIRST, fuelPct: 100, window: "w2" };

describe("assessLaunch", () => {
  it("applies the fuel rule: round(55 + 45 × payload / capacity) + orbit delta", () => {
    expect(assessLaunch(FIRST).requiredFuelPct).toBe(98); // 55 + 45 × 46/48 = 98.1
    expect(assessLaunch({ ...FIRST, orbitKm: 160 }).requiredFuelPct).toBe(95);
    expect(assessLaunch({ ...FIRST, orbitKm: 250 }).requiredFuelPct).toBe(102);
  });

  it("teaches both rules on the first attempt", () => {
    const a = assessLaunch(FIRST);
    expect(a.fuelShort).toBe(true);
    expect(a.weatherGo).toBe(false);
    expect(a.overCapacity).toBe(false);
    expect(a.overBudget).toBe(false);
  });

  it("flags a payload heavier than the vehicle can carry", () => {
    const a = assessLaunch({ ...GOOD, vehicle: "kestrel" });
    expect(a.overCapacity).toBe(true);
    expect(a.requiredFuelPct).toBeGreaterThan(100);
  });

  it("adds the delayed window's cost and blocks over-budget configs", () => {
    expect(assessLaunch(GOOD).costM).toBe(1450);
    expect(assessLaunch({ ...GOOD, window: "w3" }).costM).toBe(1510);
    const big = assessLaunch({ ...GOOD, vehicle: "orison", payload: "rover" });
    expect(big.costM).toBe(2550);
    expect(big.overBudget).toBe(true);
  });
});

describe("runLaunch", () => {
  it("reaches orbit with enough fuel and a light enough payload", () => {
    const r = runLaunch(GOOD);
    expect(r.isSuccess).toBe(true);
    expect(r.failureTrace).toEqual([]);
    expect(r.endSec).toBe(ORBIT_INSERTION_SEC);
    expect(r.budgetCostMillions).toBe(1450);
  });

  it("runs stage 2 dry earlier the shorter the fuel load", () => {
    const r = runLaunch(FIRST);
    expect(r.isSuccess).toBe(false);
    expect(r.failureTrace.map((s) => s.code)).toEqual(["fuel-depleted"]);
    expect(r.endSec).toBe(486); // round(540 × 90/98) − 10: T+08:06
    expect(runLaunch({ ...FIRST, fuelPct: 70 }).endSec).toBeLessThan(r.endSec);
  });

  it("never fails earlier than 60 % of the way to orbit", () => {
    // Below the slider's minimum; guards the rule itself.
    const r = runLaunch({ ...GOOD, fuelPct: 40 });
    expect(r.endSec).toBe(Math.round(ORBIT_INSERTION_SEC * 0.6) - 10);
  });

  it("reports a slow climb, then fuel depletion, when overweight", () => {
    const r = runLaunch({ ...GOOD, vehicle: "kestrel" });
    expect(r.failureTrace.map((s) => [s.code, s.timestampSec])).toEqual([
      ["slow-climb", 38],
      ["fuel-depleted", 470],
    ]);
    expect(r.endSec).toBe(470);
  });

  it("fills the shared-schema text fields in English", () => {
    const [s] = runLaunch(FIRST).failureTrace;
    expect(s).toMatchObject({ subsystem: "Stage 2", anomaly: "Propellant depleted", consequence: "Orbit not reached" });
  });
});

describe("mockLaunchSimulator", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves asynchronously with the same result as runLaunch", async () => {
    vi.useFakeTimers();
    let settled = false;
    const p = mockLaunchSimulator.simulate(FIRST).then((r) => ((settled = true), r));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.runAllTimersAsync();
    expect(await p).toEqual(runLaunch(FIRST));
  });
});
