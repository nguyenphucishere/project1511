import { describe, expect, it } from "vitest";
import {
  FILM_END,
  MOON,
  OUTBOUND_END,
  R_MOON,
  R_ORBIT,
  SHOT_STARTS,
  T,
  frameAt,
  len,
  missionElapsed,
  orbitAngle,
  shipPose,
  shipPosition,
  shotIdAt,
  sub,
  thrust,
} from "./flight";

const dist = (a: number[], b: number[]) => len(sub(a as [number, number, number], b as [number, number, number]));

describe("flight path", () => {
  it("has no jumps in the ship's position at the seams", () => {
    for (const seam of [T.TLI_END, T.SEP, T.COAST, T.ORBIT_IN, OUTBOUND_END]) {
      const a = shipPosition(seam - 1e-3);
      const b = shipPosition(seam + 1e-3);
      expect(dist(a, b)).toBeLessThan(0.5);
    }
  });

  it("flies in a circle around the Moon, outside its surface", () => {
    for (let t = T.ORBIT_IN; t <= OUTBOUND_END; t += 3) {
      const p = shipPosition(t);
      expect(dist(p, MOON)).toBeCloseTo(R_ORBIT, 4);
      expect(R_ORBIT).toBeGreaterThan(R_MOON);
    }
  });

  it("is behind the Moon (far side) while radio contact is lost", () => {
    const mid = shipPosition((T.LOS + T.AOS) / 2);
    expect(mid[2]).toBeLessThan(MOON[2]);
  });

  it("points toward the Earth at the end of the outbound leg, ready to leave the orbit", () => {
    const pose = shipPose(OUTBOUND_END);
    expect(pose.fwd[2]).toBeGreaterThan(0.99);
    expect(orbitAngle(OUTBOUND_END) % (2 * Math.PI)).toBeCloseTo((3 * Math.PI) / 2, 4);
  });

  it("keeps unit-length headings", () => {
    for (let t = 0; t <= FILM_END; t += 2) expect(len(shipPose(t).fwd)).toBeCloseTo(1, 4);
  });
});

describe("film", () => {
  it("lists shots in increasing order and resolves every moment to one", () => {
    for (let i = 1; i < SHOT_STARTS.length; i++) expect(SHOT_STARTS[i][0]).toBeGreaterThan(SHOT_STARTS[i - 1][0]);
    expect(shotIdAt(0)).toBe("tli-wide");
    expect(shotIdAt(FILM_END - 1)).toBe("splash");
  });

  it("gives finite camera frames over the whole film", () => {
    for (let t = 0; t <= FILM_END; t += 0.5) {
      const f = frameAt(t);
      for (const v of [...f.pos, ...f.aim, ...f.up]) expect(Number.isFinite(v)).toBe(true);
      expect(f.fov).toBeGreaterThan(10);
    }
  });

  it("burns only during the three engine firings", () => {
    expect(thrust(10)).toBeGreaterThan(0.9);
    expect(thrust(60)).toBe(0);
    expect(thrust(79)).toBeGreaterThan(0.9);
    expect(thrust(100)).toBe(0);
    expect(thrust(145)).toBeGreaterThan(0.9);
  });

  it("runs the mission clock forward", () => {
    let last = -1;
    for (let t = 0; t <= FILM_END; t += 1) {
      const m = missionElapsed(t);
      expect(m).toBeGreaterThanOrEqual(last);
      last = m;
    }
  });
});
