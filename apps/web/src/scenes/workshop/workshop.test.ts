import { describe, expect, it } from "vitest";
import { CHECKLIST_ORDER, PRESSURE, checkStation, createPressure, stepPressure } from "./checks";
import { CRANE, createCrane, loadOffset, stepCrane, type CraneInput, type LiftSpec } from "./crane";
import { FAULTS, faultPosition, scannerSignal } from "./faults";
import { CRANE_LIFTS } from "./layout";
import { DEFAULT_LOADOUT, ENGINES, TANKS, assessLoadout, consoleSeed, isLoadout } from "./loadout";

const LIFT: LiftSpec = { id: "t", seatY: 12, start: { x: -4, z: 2, y: 16 } };
const IDLE: CraneInput = { moveX: 0, moveZ: 0, hoist: 0 };
const DT = 1 / 60;

function run(s: ReturnType<typeof createCrane>, input: CraneInput, seconds: number) {
  const events: string[] = [];
  for (let i = 0; i < seconds / DT; i++) events.push(...stepCrane(s, input, DT, LIFT));
  return events;
}

describe("crane", () => {
  it("swings when the trolley stops and settles back over time", () => {
    const s = createCrane(LIFT);
    run(s, { ...IDLE, moveX: 1 }, 1.2);
    run(s, IDLE, 0.3);
    expect(Math.abs(s.sx)).toBeGreaterThan(0.05);
    run(s, IDLE, 25);
    expect(Math.abs(s.sx)).toBeLessThan(0.03);
  });

  it("seats a load that is lined up and lowered gently", () => {
    const s = createCrane(LIFT);
    s.x = 0;
    s.z = 0;
    // Feather it: short holds of the lower key, never long enough to build up speed.
    const events: string[] = [];
    for (let i = 0; i < 60 && !s.seated; i++) {
      events.push(...run(s, { ...IDLE, hoist: -1 }, 0.5));
      events.push(...run(s, IDLE, 0.3));
    }
    expect(events).not.toContain("hard-landing");
    expect(s.seated).toBe(true);
    expect(s.y).toBe(LIFT.seatY);
    expect(loadOffset(s)).toBeLessThan(0.01);
  });

  it("holds a misaligned load above the stack instead of letting it through", () => {
    const s = createCrane(LIFT);
    s.x = 2;
    s.z = 0;
    const events = run(s, { ...IDLE, hoist: -1 }, 6);
    expect(events).toContain("blocked");
    expect(s.seated).toBe(false);
    expect(s.y).toBeGreaterThanOrEqual(LIFT.seatY + CRANE.approach - 1e-6);
  });

  it("bounces a load that touches down too fast", () => {
    const s = createCrane(LIFT);
    s.x = 0;
    s.z = 0;
    const events = run(s, { ...IDLE, hoist: -1 }, 6);
    expect(events).toContain("hard-landing");
    expect(s.seated).toBe(false);
    expect(s.y).toBeGreaterThan(LIFT.seatY);
  });

  it("starts every lift clear of the stack below it and inside the crane's reach", () => {
    for (const l of CRANE_LIFTS) {
      expect(l.start.y).toBeGreaterThan(l.seatY + CRANE.approach);
      expect(l.start.y).toBeLessThanOrEqual(CRANE.ceiling);
      expect(Math.hypot(l.start.x, l.start.z)).toBeGreaterThan(2);
    }
  });
});

describe("checklist", () => {
  it("accepts fuel, then electrical, then pressure", () => {
    expect(CHECKLIST_ORDER).toEqual(["fuel", "electrical", "pressure"]);
    expect(checkStation([], "fuel").ok).toBe(true);
    expect(checkStation(["fuel"], "electrical").ok).toBe(true);
    expect(checkStation(["fuel", "electrical"], "pressure").ok).toBe(true);
  });

  it("rejects the wrong order and says what was expected", () => {
    expect(checkStation([], "pressure")).toEqual({ ok: false, expected: "fuel" });
    expect(checkStation(["fuel"], "pressure")).toEqual({ ok: false, expected: "electrical" });
  });

  it("completes the pressure gauge only after holding the window", () => {
    const s = createPressure();
    // Overshoot first: too much pressure never counts.
    for (let i = 0; i < 6 * 60; i++) stepPressure(s, true, DT);
    expect(s.done).toBe(false);
    expect(s.bar).toBeGreaterThan(PRESSURE.max);
    // Bleed back into the window, then hold it by tapping the pump.
    let guard = 0;
    while (!s.done && guard++ < 60 * 40) stepPressure(s, s.bar < (PRESSURE.min + PRESSURE.max) / 2, DT);
    expect(s.done).toBe(true);
  });
});

describe("faults", () => {
  it("hides four faults at distinct places on the hull", () => {
    expect(FAULTS).toHaveLength(4);
    const spots = FAULTS.map((f) => faultPosition(f).map((n) => n.toFixed(1)).join());
    expect(new Set(spots).size).toBe(4);
  });

  it("rings loudest when the view points straight at a fault", () => {
    const target = faultPosition(FAULTS[0]);
    const cam: [number, number, number] = [0, 1.65, 13];
    const dir = (to: [number, number, number]): [number, number, number] => {
      const d = [to[0] - cam[0], to[1] - cam[1], to[2] - cam[2]];
      const n = Math.hypot(...d);
      return [d[0] / n, d[1] / n, d[2] / n];
    };
    expect(scannerSignal(cam, dir(target), target)).toBeCloseTo(1, 3);
    expect(scannerSignal(cam, dir([target[0] + 6, target[1], target[2]]), target)).toBe(0);
  });
});

describe("loadout", () => {
  it("passes the default build and seeds the console with the matching vehicle", () => {
    const stats = assessLoadout(DEFAULT_LOADOUT);
    expect(stats.ok).toBe(true);
    expect(consoleSeed(DEFAULT_LOADOUT)).toEqual({ vehicle: "saros", fuelPct: 90 });
  });

  it("flags engines too weak for the tanks they have to lift", () => {
    const stats = assessLoadout({ engine: "light", tank: "large" });
    expect(stats.twrTooLow).toBe(true);
    expect(stats.ok).toBe(false);
  });

  it("flags short tanks that cannot add enough velocity", () => {
    const stats = assessLoadout({ engine: "standard", tank: "small" });
    expect(stats.deltaVLow).toBe(true);
    expect(stats.ok).toBe(false);
  });

  it("flags a thrust-to-weight ratio that would crush the crew", () => {
    expect(assessLoadout({ engine: "heavy", tank: "small" }).twrTooHigh).toBe(true);
  });

  it("leaves a handful of workable builds, not every one", () => {
    const grid = ENGINES.flatMap((e) => TANKS.map((t) => assessLoadout({ engine: e.id, tank: t.id }).ok));
    const good = grid.filter(Boolean).length;
    expect(good).toBeGreaterThanOrEqual(3);
    expect(good).toBeLessThan(grid.length);
  });

  it("recognises only valid saved loadouts", () => {
    expect(isLoadout({ engine: "heavy", tank: "large" })).toBe(true);
    expect(isLoadout({ engine: "ion", tank: "large" })).toBe(false);
    expect(isLoadout(null)).toBe(false);
  });
});
