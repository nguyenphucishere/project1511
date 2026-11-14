import { describe, expect, it } from "vitest";
import {
  ENTRY_BLACKOUT,
  FILM_END,
  MOON,
  OUTBOUND_END,
  R_MOON,
  R_ORBIT,
  RETURN_LOG,
  SHOT_STARTS,
  T,
  TEI_LOS,
  entryAt,
  entryState,
  formatMet,
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
    expect(shotIdAt(FILM_END - 1)).toBe("recovery");
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

// The way home is told on the real Apollo 11 clock (NASA Apollo Flight Journal, SP-4029).
describe("the way home on the Apollo 11 clock", () => {
  const hms = (h: number, m: number, sec = 0) => h * 3600 + m * 60 + sec;

  it("lights the engine at 135:23:42 and touches the sea at 195:18:35", () => {
    expect(missionElapsed(T.OUTBOUND_END)).toBe(hms(135, 23, 42));
    expect(missionElapsed(T.TOUCHDOWN)).toBe(hms(195, 18, 35));
  });

  it("carries the logged moments on the clock", () => {
    for (const e of RETURN_LOG) expect(formatMet(missionElapsed(e.t)), e.id).toBe(`T+${e.get.split(":")[0].padStart(3, "0")}:${e.get.split(":")[1]}:${e.get.split(":")[2]}`);
    const times = RETURN_LOG.map((e) => e.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBeGreaterThanOrEqual(OUTBOUND_END);
    expect(times[times.length - 1]).toBeLessThanOrEqual(FILM_END);
  });

  it("makes the plasma blackout last about three and a half minutes of mission time (195:03:25 to 195:06:56)", () => {
    const seconds = missionElapsed(ENTRY_BLACKOUT[1]) - missionElapsed(ENTRY_BLACKOUT[0]);
    expect(seconds).toBeGreaterThan(205);
    expect(seconds).toBeLessThan(217);
  });

  it("burns the return engine behind the Moon, before the air", () => {
    expect(TEI_LOS[0]).toBe(OUTBOUND_END);
    expect(TEI_LOS[1]).toBeLessThan(T.REENTRY);
  });

  it("enters at 122 km and 11.0 km/s and ends on the sea at walking pace", () => {
    const start = entryState(T.REENTRY);
    expect(start.altKm).toBeCloseTo(121.9, 1);
    expect(start.speedKms).toBeCloseTo(11.03, 2);
    const end = entryState(T.TOUCHDOWN);
    expect(end.altKm).toBe(0);
    expect(end.speedKms).toBeLessThan(0.02);
  });

  it("never gains height or speed on the way down", () => {
    let alt = Infinity;
    let speed = Infinity;
    for (let t = T.REENTRY; t <= T.TOUCHDOWN; t += 0.1) {
      const e = entryState(t);
      expect(e.altKm).toBeLessThanOrEqual(alt + 1e-9);
      expect(e.speedKms).toBeLessThanOrEqual(speed + 1e-9);
      alt = e.altKm;
      speed = e.speedKms;
    }
  });

  it("has two load peaks of about 6.5 g and 6 g, the second at about 3.8 km/s, and 1 g under the parachutes", () => {
    let first = 0;
    let second = 0;
    let secondSpeed = 0;
    for (let t = T.REENTRY; t <= T.CHUTES; t += 0.05) {
      const e = entryState(t);
      if (t < entryAt(0.4)) first = Math.max(first, e.g);
      else if (e.g > second) {
        second = e.g;
        secondSpeed = e.speedKms;
      }
    }
    expect(first).toBeGreaterThan(6.3);
    expect(first).toBeLessThan(6.8);
    expect(second).toBeGreaterThan(5.8);
    expect(second).toBeLessThan(6.2);
    expect(secondSpeed).toBeGreaterThan(3.4);
    expect(secondSpeed).toBeLessThan(4.2);
    expect(entryState(T.CHUTES + 3).g).toBe(1);
  });
});

describe("the cuts of the flight home", () => {
  it("dip through black around each hard cut and are clear elsewhere", async () => {
    const { cutDip, HOME_CUTS } = await import("./flight");
    for (const c of HOME_CUTS) {
      expect(cutDip(c)).toBe(1);
      expect(cutDip(c - 0.4)).toBeGreaterThan(0);
      expect(cutDip(c - 0.4)).toBeLessThan(1);
      expect(cutDip(c + 0.5)).toBeGreaterThan(0);
      expect(cutDip(c - 3)).toBe(0);
      expect(cutDip(c + 3)).toBe(0);
    }
    expect(cutDip(T.OUTBOUND_END + 2)).toBe(0);
  });
});
