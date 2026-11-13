import { describe, expect, it } from "vitest";
import {
  COUPLING,
  STAR_ORDER,
  checkBolt,
  createCoupling,
  createWrench,
  currentLine,
  lockCoupling,
  stepCoupling,
  stepWrench,
} from "./handworkRules";

describe("fuel couplings", () => {
  it("seats only inside the green zone, and the lines go in order", () => {
    const s = createCoupling();
    expect(currentLine(s)).toBe("oxidizer");
    s.pos = 0.1;
    expect(lockCoupling(s)).toBe("miss");
    expect(s.slips).toBe(1);
    s.pos = 0.5 + COUPLING.zone - 0.01;
    expect(lockCoupling(s)).toBe("hit");
    expect(currentLine(s)).toBe("fuel");
    s.pos = 0.5;
    expect(lockCoupling(s)).toBe("hit");
    expect(currentLine(s)).toBeNull();
    expect(lockCoupling(s)).toBe("none");
  });

  it("sweeps back and forth across the track", () => {
    const s = createCoupling();
    for (let i = 0; i < 400; i++) stepCoupling(s, 1 / 60);
    expect(s.pos).toBeGreaterThanOrEqual(0);
    expect(s.pos).toBeLessThanOrEqual(1);
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      stepCoupling(s, 1 / 60);
      seen.add(s.dir);
    }
    expect(seen.size).toBe(2);
  });
});

describe("flange bolts", () => {
  it("accepts only the star order", () => {
    const done: number[] = [];
    for (const idx of STAR_ORDER) {
      const wrong = (idx + 1) % 5;
      if (wrong !== idx) expect(checkBolt(done, wrong)).toEqual({ ok: false, expected: idx });
      expect(checkBolt(done, idx)).toEqual({ ok: true });
      done.push(idx);
    }
  });

  const hold = (seconds: number) => {
    const w = createWrench();
    for (let t = 0; t < seconds; t += 1 / 60) stepWrench(w, true, 1 / 60);
    return w;
  };

  it("clicks, and letting go after the click is a good torque", () => {
    const w = hold(2.3);
    expect(w.clicked).toBe(true);
    expect(w.result).toBe("idle");
    stepWrench(w, false, 1 / 60);
    expect(w.result).toBe("tight");
  });

  it("strips the thread if the player keeps turning past the click", () => {
    expect(hold(4).result).toBe("stripped");
  });

  it("unwinds when released before the click", () => {
    const w = hold(1);
    const before = w.torque;
    expect(w.clicked).toBe(false);
    for (let i = 0; i < 30; i++) stepWrench(w, false, 1 / 60);
    expect(w.torque).toBeLessThan(before);
    expect(w.result).toBe("idle");
  });
});
