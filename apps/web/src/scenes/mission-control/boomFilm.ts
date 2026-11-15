import { HOLD_DOWN, rocketRise } from "./ascent";
import { GROUND_Y, PAD } from "./layout";
import type { Shot, ShotContext, ShotFrame, Vec } from "./launchShots";

/**
 * Dev-only "boom film": the launch film, but the vehicle breaks up shortly after it clears the
 * tower, filmed with its own camera shots. Used to record trailer footage (window.__mc.boom()).
 * Everything is a pure function of the film clock, so a seek lands on the same frame every time.
 *
 * Times below are `s`, seconds after the first rupture (negative = the leak before it).
 */
export const boomFilm: { t: number | null } = { t: null };

/** Default rupture time: twelve seconds into the climb, the stack well clear of the tower. */
export const BOOM_T = HOLD_DOWN + 12;
/** The leak at the engine bay starts this long before the rupture. */
export const LEAK_LEAD = 2.4;
/** The vehicle model is gone this long after the rupture (the flash covers the swap). */
export const BREAK_AT = 0.12;

const G = 9.8;
export const boomTime = () => boomFilm.t ?? BOOM_T;
/** Height of the stack's base above the pad at the rupture. */
export const boomRise = () => rocketRise(boomTime());
const rel = (dx: number, dy: number, dz: number): Vec => [PAD[0] + dx, PAD[1] + dy, PAD[2] + dz];
/** Where the first blast is: the interstage, between stage 1 and stage 2. */
export const blastCentre = (): Vec => rel(0, boomRise() + 14, 0);

/** The blasts, one after another: the tanks going, the first stage hitting the ground. */
export interface Blast {
  s: number;
  pos: () => Vec;
  scale: number;
  seed: number;
}

/** The first stage's hull: thrown out by the second blast, it falls burning and hits near the pad. */
const HULL_S = 1.1;
const HULL_V: Vec = [3.2, 4, -2.2];
const hullStart = () => rel(4, boomRise() + 4, 0);
export const HULL_IMPACT_S = (() => {
  const y0 = boomRise() + 4 + PAD[1] - (GROUND_Y + 1);
  return HULL_S + (HULL_V[1] + Math.sqrt(HULL_V[1] ** 2 + 2 * G * y0)) / G;
})();
export function hullPose(s: number): { pos: Vec; spin: number; landed: boolean } {
  const tau = Math.min(Math.max(0, s - HULL_S), HULL_IMPACT_S - HULL_S);
  const p = hullStart();
  return {
    pos: [p[0] + HULL_V[0] * tau, p[1] + HULL_V[1] * tau - 0.5 * G * tau * tau, p[2] + HULL_V[2] * tau],
    spin: tau * 0.9,
    landed: s >= HULL_IMPACT_S,
  };
}

export const BLASTS: Blast[] = [
  { s: 0, pos: blastCentre, scale: 1, seed: 11 },
  { s: 1.1, pos: () => rel(3, boomRise() + 2, 1.5), scale: 1.4, seed: 23 },
  { s: 2.35, pos: () => rel(-8, boomRise() + 22, -4), scale: 0.75, seed: 37 },
  { s: HULL_IMPACT_S, pos: () => { const h = hullPose(HULL_IMPACT_S).pos; return [h[0], GROUND_Y + 3, h[2]]; }, scale: 1.15, seed: 51 },
];

/** The launch escape system: its motor pulls the capsule up and away from the fireball. */
const LES_LIGHT = 0.3;
const LES_BURN = 3;
const LES_A: Vec = [-5, 17, 1.2];
export function lesPose(s: number): { pos: Vec; burning: boolean; age: number } {
  const p0 = rel(0, boomRise() + 37, 0);
  const tau = Math.max(0, s - LES_LIGHT);
  const b = Math.min(tau, LES_BURN);
  const c = Math.max(0, tau - LES_BURN);
  const v: Vec = [LES_A[0] * b, LES_A[1] * b, LES_A[2] * b];
  return {
    pos: [
      p0[0] + 0.5 * LES_A[0] * b * b + v[0] * c,
      p0[1] + 0.5 * LES_A[1] * b * b + v[1] * c - 0.5 * G * c * c,
      p0[2] + 0.5 * LES_A[2] * b * b + v[2] * c,
    ],
    burning: s >= LES_LIGHT && tau < LES_BURN,
    age: tau,
  };
}

/** A camera jolt that hits at `at` and dies away. */
const jolt = (s: number, at: number, k: number, decay = 2.6) => (s >= at ? k * Math.exp(-(s - at) * decay) : 0);
/** Every blast shakes the lens, harder the closer it is. */
const quake = (s: number, k = 1) =>
  k * (jolt(s, 0, 0.55) + jolt(s, 1.1, 0.7) + jolt(s, 2.35, 0.25) + jolt(s, HULL_IMPACT_S, 0.6, 3.2));

interface BoomShot {
  id: string;
  s: number;
  frame: (s: number, c: ShotContext) => ShotFrame;
}

const BOOM_SHOTS: BoomShot[] = [
  {
    // Macro on the engine bay: the flames climbing past, then fire where there should be none.
    id: "boom-bay",
    s: -3.4,
    frame: (_s, { pad, rise }) => ({
      pos: [pad[0] + 7, pad[1] + rise - 3.5, pad[2] + 7.5],
      aim: [pad[0] + 0.8, pad[1] + rise + 3.5, pad[2]],
      rate: 30,
      zoom: 1.7,
      shake: 0.06,
      lock: true,
    }),
  },
  {
    // The long lens from the viewing field: all looks well, then the sky turns white.
    id: "boom-long",
    s: -1.25,
    frame: (s, { pad }) => {
      const r = s < 0 ? rocketRise(boomTime() + s) : boomRise();
      return {
        pos: [pad[0] - 31, pad[1] + 4, pad[2] + 47],
        aim: [pad[0], pad[1] + r + 18 + Math.max(0, s) * 4, pad[2]],
        rate: 7,
        zoom: 1.55,
        shake: 0.015 + quake(s, 0.5),
        lock: true,
      };
    },
  },
  {
    // Under it: from the pad, straight up into the fireball as the second blast goes and the debris rains.
    id: "boom-under",
    s: 0.95,
    frame: (s, { pad }) => {
      const e = blastCentre();
      return {
        pos: [pad[0] + 15 + s * 0.4, pad[1] + 3, pad[2] + 19],
        aim: [e[0], e[1] - 12 + s * 3, e[2]],
        rate: 4,
        zoom: 0.78,
        shake: quake(s, 0.8),
        lock: true,
      };
    },
  },
  {
    // Out at the fireball's height, a slow orbit: it rolls into black smoke, trails arcing down.
    id: "boom-orbit",
    s: 2.85,
    frame: (s, { pad }) => {
      const e = blastCentre();
      const a = 0.9 + (s - 2.85) * 0.07;
      return {
        pos: [e[0] + Math.sin(a) * 150, e[1] - 6, e[2] + Math.cos(a) * 150],
        aim: [e[0], e[1] - 4, e[2]],
        rate: 5,
        zoom: 1.05,
        shake: 0.02 + quake(s, 0.15),
        lock: true,
      };
    },
  },
  {
    // The escape tower drags the capsule clear: the crew gets out.
    id: "boom-les",
    s: 4.4,
    frame: (s) => {
      const p = lesPose(s).pos;
      return {
        pos: [p[0] + 16, p[1] - 9, p[2] + 15],
        aim: [p[0], p[1] - 1, p[2]],
        rate: 9,
        zoom: 1.45,
        shake: 0.03,
        lock: true,
      };
    },
  },
  {
    // Behind the crowd: the hull comes down by the pad and the ground erupts.
    id: "boom-crowd",
    s: 5.7,
    frame: (s, { pad }) => {
      const h = hullPose(HULL_IMPACT_S).pos;
      return {
        pos: [pad[0] - 36, pad[1] + 2.3, pad[2] + 54],
        aim: [h[0] - 4, pad[1] + 16 + (s - 5.7) * 2.5, h[2]],
        rate: 4,
        zoom: 1.3,
        shake: 0.01 + quake(s, 0.35),
        lock: true,
      };
    },
  },
  {
    // Wide and far: the smoke column, burning debris still falling, a slow push in.
    id: "boom-wide",
    s: 8.6,
    frame: (s, { pad }) => {
      const k = Math.min(1, (s - 8.6) / 9);
      return {
        pos: [pad[0] - 150 + k * 25, pad[1] + 6, pad[2] + 330 - k * 50],
        aim: [pad[0], pad[1] + 62, pad[2]],
        rate: 3,
        zoom: 1.0,
        shake: 0.004,
        lock: true,
      };
    },
  },
];

/** The boom film's shot at `t` (seconds after ignition), or null when it isn't running there. */
export function boomShotAt(t: number): Shot | null {
  if (boomFilm.t === null) return null;
  const s = t - boomFilm.t;
  if (s < BOOM_SHOTS[0]!.s) return null;
  let cur = BOOM_SHOTS[0]!;
  for (const b of BOOM_SHOTS) if (s >= b.s) cur = b;
  const at0 = boomFilm.t;
  return { id: cur.id, from: at0 + cur.s, frame: (c) => cur.frame(c.t - at0, c) };
}
