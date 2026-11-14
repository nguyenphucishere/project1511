import { describe, expect, it } from "vitest";
import { GEARS, SEP_OPS, driveAngle, gearAngle, opTime } from "./separation";

describe("stage separation", () => {
  it("has twenty operations in time order, from the gears outward to the cut", () => {
    expect(SEP_OPS).toHaveLength(20);
    for (let i = 1; i < SEP_OPS.length; i++) expect(SEP_OPS[i]!.t).toBeGreaterThanOrEqual(SEP_OPS[i - 1]!.t);
    const zones = SEP_OPS.map((o) => o.zone);
    expect(zones[0]).toBe("gears");
    expect(zones[zones.length - 1]).toBe("cut");
    expect(new Set(SEP_OPS.map((o) => o.id)).size).toBe(20);
  });

  it("fires the shaped charge at the cut itself", () => {
    expect(opTime("shaped-charge")).toBe(0);
  });

  it("turns meshed gears opposite ways and compound gears together", () => {
    const th = 3;
    expect(Math.sign(gearAngle(1, th))).toBe(-Math.sign(gearAngle(0, th)));
    expect(gearAngle(2, th)).toBe(gearAngle(1, th));
    expect(Math.sign(gearAngle(3, th))).toBe(-Math.sign(gearAngle(2, th)));
    // the big gear is slower than the pinion by the tooth ratio
    expect(Math.abs(gearAngle(3, th))).toBeCloseTo((th * GEARS[0]!.teeth * GEARS[2]!.teeth) / (GEARS[1]!.teeth * GEARS[3]!.teeth), 6);
  });

  it("keeps the drive turning from the start, and faster once the pump spins up", () => {
    const pump = opTime("pump-spin");
    // Idling before the pump: never still while in view.
    expect(driveAngle(pump - 1)).toBeGreaterThan(driveAngle(pump - 2));
    // Faster after the pump starts than during the idle.
    const idleRate = driveAngle(pump - 0.5) - driveAngle(pump - 1.0);
    const spunRate = driveAngle(pump + 2.0) - driveAngle(pump + 1.5);
    expect(spunRate).toBeGreaterThan(idleRate * 5);
    expect(driveAngle(0)).toBeGreaterThan(driveAngle(-5));
  });
});
