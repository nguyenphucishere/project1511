import { describe, expect, it } from "vitest";
import { FILM_END_SEC, realSecondsAt } from "./flight";
import { ADAPTER_T, EPILOGUE, FILM_END, LES_T, SEP2_T, SEPARATION_T, STAGE2_T, STAGE3_T, rocketRise, rocketSpeed } from "./ascent";
import { SHOTS, shotAt } from "./launchShots";

describe("launch shots", () => {
  it("are listed in time order, starting at ignition", () => {
    expect(SHOTS[0]!.from).toBe(0);
    for (let i = 1; i < SHOTS.length; i++) expect(SHOTS[i]!.from).toBeGreaterThan(SHOTS[i - 1]!.from);
  });

  it("cut often enough to feel like a film but never faster than a beat", () => {
    for (let i = 1; i < SHOTS.length; i++) {
      const gap = SHOTS[i]!.from - SHOTS[i - 1]!.from;
      expect(gap).toBeGreaterThan(0.35);
      expect(gap).toBeLessThan(8);
    }
  });

  it("go macro on the bolts at every separation and on the engine at each lighting", () => {
    expect(shotAt(SEPARATION_T).id).toBe("staging");
    expect(shotAt(STAGE2_T).id).toBe("ignite");
    expect(shotAt(SEP2_T).id).toBe("staging-2");
    expect(shotAt(STAGE3_T).id).toBe("ignite-3");
    expect(shotAt(ADAPTER_T).id).toBe("adapter-bolts");
    expect(shotAt(LES_T).id).toBe("tower-bolts");
  });

  it("run for over a minute", () => {
    expect(realSecondsAt(FILM_END_SEC)).toBeGreaterThan(45);
    expect(SHOTS.length).toBeGreaterThan(35);
  });

  it("give every shot a finite frame for the whole flight", () => {
    const end = realSecondsAt(FILM_END_SEC);
    const pad: [number, number, number] = [5, -14, -85];
    for (let t = 0; t <= end; t += 0.25) {
      const f = shotAt(t).frame({ t, rise: rocketRise(t), speed: rocketSpeed(t), pad });
      for (const v of [...f.pos, ...f.aim, f.zoom, f.rate]) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("stay quiet for the epilogue: inside the cabin, looking out at the Earth", () => {
    expect(EPILOGUE).toBeGreaterThanOrEqual(10);
    expect(shotAt(FILM_END + 3).id).toBe("cabin-limb");
    expect(shotAt(FILM_END + EPILOGUE - 1).id).toBe("cabin-earth");
  });
});
