import { describe, expect, it } from "vitest";
import { realSecondsAt } from "./flight";
import { SEPARATION_T, STAGE2_T, rocketRise, rocketSpeed } from "./ascent";
import { SHOTS, shotAt } from "./launchShots";

describe("launch shots", () => {
  it("are listed in time order, starting at ignition", () => {
    expect(SHOTS[0]!.from).toBe(0);
    for (let i = 1; i < SHOTS.length; i++) expect(SHOTS[i]!.from).toBeGreaterThan(SHOTS[i - 1]!.from);
  });

  it("cut often enough to feel like a film but never faster than a beat", () => {
    for (let i = 1; i < SHOTS.length; i++) {
      const gap = SHOTS[i]!.from - SHOTS[i - 1]!.from;
      expect(gap).toBeGreaterThan(0.45);
      expect(gap).toBeLessThan(8);
    }
  });

  it("go macro on the bolts at separation and on the engine at stage 2 lighting", () => {
    expect(shotAt(SEPARATION_T).id).toBe("staging");
    expect(shotAt(STAGE2_T).id).toBe("ignite");
    expect(shotAt(STAGE2_T + 1).id).toBe("second-stage");
  });

  it("give every shot a finite frame for the whole flight", () => {
    const end = realSecondsAt(540);
    const pad: [number, number, number] = [5, -14, -85];
    for (let t = 0; t <= end; t += 0.25) {
      const f = shotAt(t).frame({ t, rise: rocketRise(t), speed: rocketSpeed(t), pad });
      for (const v of [...f.pos, ...f.aim, f.zoom, f.rate]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
