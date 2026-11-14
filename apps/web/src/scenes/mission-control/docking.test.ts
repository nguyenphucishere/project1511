import { describe, expect, it } from "vitest";
import { CSM_SEP_T, DOCK_T, FLIP_FROM, FLIP_TO, TOW_T } from "./ascent";
import { csmPose, towOffset } from "./docking";

describe("transposition and docking", () => {
  it("starts and ends in the right order", () => {
    expect(CSM_SEP_T).toBeLessThan(FLIP_FROM);
    expect(FLIP_FROM).toBeLessThan(FLIP_TO);
    expect(FLIP_TO).toBeLessThan(DOCK_T);
    expect(DOCK_T).toBeLessThan(TOW_T);
  });

  it("sits on the stack until it separates", () => {
    const p = csmPose(CSM_SEP_T - 1);
    expect(p).toMatchObject({ dy: 0, dx: 0, pitch: 0, roll: 0 });
  });

  it("turns end for end and rolls once, then comes back to dock", () => {
    const mid = csmPose((FLIP_FROM + FLIP_TO) / 2);
    expect(mid.pitch).toBeGreaterThan(1);
    expect(mid.dy).toBeGreaterThan(10);
    const docked = csmPose(DOCK_T);
    expect(docked.pitch).toBeCloseTo(Math.PI, 6);
    expect(docked.roll).toBeCloseTo(Math.PI * 2, 6);
    expect(docked.dy).toBeCloseTo(-0.7, 1);
    expect(docked.dx).toBeCloseTo(0, 6);
  });

  it("tows the lander away after docking, with the capsule moving with it", () => {
    expect(towOffset(DOCK_T)).toBe(0);
    expect(towOffset(TOW_T + 4)).toBeGreaterThan(5);
    expect(csmPose(TOW_T + 4).dy - towOffset(TOW_T + 4)).toBeCloseTo(-0.7, 1);
  });
});
