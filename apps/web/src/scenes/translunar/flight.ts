/**
 * The translunar flight as pure data and maths (no three.js), so the cut list can be tested.
 *
 * World (arbitrary units, Earth radius 40): the Earth sits at the origin and the Moon 1300 units
 * away along -Z, so from the Moon the Earth is about as small in the sky as the real one. The
 * spacecraft is cartoon-large (3 units long) so it reads from the camera. The Sun lights the
 * scene from SUN, which puts the side of the Earth that faces the Moon in daylight.
 *
 * One film clock `t` (seconds) drives everything. The film is cut in two parts, one per chapter:
 * the outbound leg (0 → OUTBOUND_END) and the way home (OUTBOUND_END → FILM_END).
 */
export type Vec = [number, number, number];

export const R_EARTH = 40;
export const R_MOON = 11;
export const MOON: Vec = [0, 0, -1300];
export const R_ORBIT = 12.2;
/** Where the splashdown set sits, far from everything else. */
export const SEA: Vec = [6000, 0, 6000];

/* ---------------------------------------------------------------- vector helpers */

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
export function norm(a: Vec): Vec {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
/** Where the Sun is (unit vector toward it). */
export const SUN: Vec = norm([-0.75, 0.25, -0.5]);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
export const smooth = (k: number) => {
  const x = clamp01(k);
  return x * x * (3 - 2 * x);
};

/** Cubic Hermite between two values with the given slopes (per unit of s ∈ [0,1], pre-scaled). */
function hermite(p0: number, p1: number, m0: number, m1: number, s: number) {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
}

/* ---------------------------------------------------------------- timeline */

export const T = {
  /** Translunar injection: the third stage burns and the ship leaves Earth orbit. */
  TLI_END: 22,
  /** The service module separates from the spent stage. */
  SEP: 26,
  /** Transposition: the ship turns around to face the lunar module still in the adapter. */
  FLIP_A: 28,
  FLIP_A_END: 34,
  /** Soft dock with Eagle (the ship backs away with it a moment later), then the ship turns forward again. */
  DOCK: 38,
  FLIP_B: 41,
  FLIP_B_END: 46,
  /** Three days of coasting, compressed. */
  COAST: 42,
  /** The ship reaches the Moon and enters orbit. */
  ORBIT_IN: 70,
  /** Behind the Moon: radio contact lost, the orbit burn. */
  LOS: 76,
  BURN_IN: 77,
  BURN_IN_END: 82,
  AOS: 90,
  /** Earthrise, from inside the cabin. */
  RISE: 90,
  /** Christmas Eve in the cabin. */
  CABIN: 118,
  OUTBOUND_END: 140,
  /** The way home. */
  TEI_END: 150,
  REENTRY: 150,
  CHUTES: 158,
  FILM_END: 172,
} as const;

export const OUTBOUND_END = T.OUTBOUND_END;
/** The outbound film ends once the ship is in lunar orbit and behind the Moon, ready for the descent. */
export const OUTBOUND_FILM_END = 88;
export const FILM_END = T.FILM_END;

/** Orbit angle around the Moon (0 = the point facing the Earth, π = the far side). */
const PHI_KEYS: [number, number][] = [
  [T.ORBIT_IN, Math.PI / 2],
  [90, 4.15],
  [118, 5.05],
  // Ends at 3π/2 + 2π: there the orbit's tangent points straight at the Earth, ready to leave.
  [T.OUTBOUND_END, (3 * Math.PI) / 2 + 2 * Math.PI],
];

export function orbitAngle(t: number) {
  if (t <= PHI_KEYS[0][0]) return PHI_KEYS[0][1];
  for (let i = 1; i < PHI_KEYS.length; i++) {
    const [t1, p1] = PHI_KEYS[i];
    const [t0, p0] = PHI_KEYS[i - 1];
    if (t <= t1) return lerp(p0, p1, (t - t0) / (t1 - t0));
  }
  return PHI_KEYS[PHI_KEYS.length - 1][1];
}

/** Distance of the ship's aft end ahead of the stage's adapter joint, in the same units as the model. */
const DOCK_GAP = 1.1;

/**
 * How far ahead of the spent stage the service module is: it pushes off at separation, turns round,
 * backs in to dock with Eagle (the ship's nose then touches the adapter joint) and pulls Eagle out.
 */
export function separation(t: number) {
  if (t < T.SEP) return 0;
  if (t < T.FLIP_A) return 2.4 * smooth((t - T.SEP) / (T.FLIP_A - T.SEP));
  if (t < T.FLIP_A_END) return 2.4 + (0.8 * (t - T.FLIP_A)) / (T.FLIP_A_END - T.FLIP_A);
  if (t < T.DOCK) return lerp(3.2, DOCK_GAP, smooth((t - T.FLIP_A_END) / (T.DOCK - T.FLIP_A_END)));
  if (t < T.COAST) return lerp(DOCK_GAP, 8, smooth((t - T.DOCK) / (T.COAST - T.DOCK)));
  return 8;
}

/** The leg out of Earth orbit: burning along -Z over the top of the Earth. */
function baseTrack(t: number): Vec {
  const c = Math.min(t, T.TLI_END);
  const burn: Vec = [0, 44.5 + 0.012 * c * c, -0.25 * c * c];
  if (t <= T.TLI_END) return burn;
  const dt = t - T.TLI_END;
  return [0, burn[1] + 0.264 * dt, burn[2] - 11 * dt];
}

/** Spent third stage: stays on the track it was burning along. */
export function stagePosition(t: number): Vec {
  return baseTrack(t);
}

/** The service module (the ship's origin): the track plus the push-off, then the free coast. */
export function shipPosition(t: number): Vec {
  if (t < T.COAST) return add(baseTrack(t), [0, 0, -separation(t)]);
  const p0 = shipPosition(T.COAST - 1e-6);
  const dur = T.ORBIT_IN - T.COAST;
  const s = (t - T.COAST) / dur;
  const orbitStart = add(MOON, [R_ORBIT, 0, 0]);
  // Slopes in units per second at both ends, scaled to the segment.
  const m0: Vec = [0, 0.264, -11.5];
  const m1: Vec = [0, 0, -(0.129 * R_ORBIT)];
  if (t < T.ORBIT_IN)
    return [
      hermite(p0[0], orbitStart[0], m0[0] * dur, m1[0] * dur, s),
      hermite(p0[1], orbitStart[1], m0[1] * dur, m1[1] * dur, s),
      hermite(p0[2], orbitStart[2], m0[2] * dur, m1[2] * dur, s),
    ];
  if (t <= T.OUTBOUND_END) {
    const phi = orbitAngle(t);
    return [MOON[0] + R_ORBIT * Math.sin(phi), 0, MOON[2] + R_ORBIT * Math.cos(phi)];
  }
  // Homebound: leaves the orbit along the tangent, toward the Earth, and speeds up.
  const dt = t - T.OUTBOUND_END;
  const start = add(MOON, [-R_ORBIT, 0, 0]);
  return [start[0], 0, start[2] + 1.5 * dt + 2.2 * dt * dt];
}

export interface Pose {
  pos: Vec;
  /** Unit vector the nose points along. */
  fwd: Vec;
  /** Unit vector "up" for the crew: away from the Moon in orbit, else world up. */
  up: Vec;
}

/** The flip after separation: a half turn to look back at the spent stage, then a half turn back. */
function flipAngle(t: number) {
  return Math.PI * smooth((t - T.FLIP_A) / (T.FLIP_A_END - T.FLIP_A)) + Math.PI * smooth((t - T.FLIP_B) / (T.FLIP_B_END - T.FLIP_B));
}

export function shipPose(t: number): Pose {
  const pos = shipPosition(t);
  if (t >= T.ORBIT_IN && t <= T.OUTBOUND_END) {
    const phi = orbitAngle(t);
    return { pos, fwd: [Math.cos(phi), 0, -Math.sin(phi)], up: [Math.sin(phi), 0, Math.cos(phi)] };
  }
  if (t > T.OUTBOUND_END) return { pos, fwd: [0, 0, 1], up: [-1, 0, 0] };
  // Before the orbit: along the direction of travel, except during the flip.
  const e = 0.05;
  const ahead = shipPosition(Math.min(t + e, T.ORBIT_IN - 1e-6));
  const behind = shipPosition(Math.max(t - e, 0));
  let fwd = norm(sub(ahead, behind));
  if (t < 0.5) fwd = norm([0, 0.04, -1]);
  if (t >= T.FLIP_A && t < T.FLIP_B_END + 2) {
    const psi = flipAngle(t);
    const turned: Vec = [-Math.sin(psi), 0, -Math.cos(psi)];
    fwd = t < T.FLIP_B_END ? turned : norm(add(mul(turned, 1 - smooth((t - T.FLIP_B_END) / 2)), mul(fwd, smooth((t - T.FLIP_B_END) / 2))));
  }
  return { pos, fwd, up: [0, 1, 0] };
}

/** Point in the ship's frame: a to the right, b up, c along the nose. */
export function shipAt(pose: Pose, a: number, b: number, c: number): Vec {
  const right = norm(cross(pose.fwd, pose.up));
  const up = norm(cross(right, pose.fwd));
  return add(pose.pos, add(mul(right, a), add(mul(up, b), mul(pose.fwd, c))));
}

/* ---------------------------------------------------------------- burns and glow */

/** 0…1 engine thrust of the stage/ship at film time t, for flames and engine sound. */
export function thrust(t: number) {
  if (t < T.TLI_END) return smooth(t / 1.2) * (1 - smooth((t - (T.TLI_END - 0.8)) / 0.8));
  if (t >= T.BURN_IN && t < T.BURN_IN_END) return smooth((t - T.BURN_IN) / 0.5) * (1 - smooth((t - (T.BURN_IN_END - 0.5)) / 0.5));
  if (t >= T.OUTBOUND_END && t < T.TEI_END) return smooth((t - T.OUTBOUND_END) / 0.6) * (1 - smooth((t - (T.TEI_END - 1.2)) / 1.2));
  return 0;
}

/** Petal angle of the adapter (0 closed → 1 fully open) and how far they have flown off. */
export function petals(t: number) {
  return { open: smooth((t - (T.SEP - 1.8)) / 1.6), flown: Math.max(0, t - (T.SEP - 0.2)) };
}

/** Reentry path past the top of the Earth, and how hot the capsule glows. */
export function reentryPosition(t: number): Vec {
  const k = t - T.REENTRY;
  return [0, 62 - 1.9 * k - 0.0 * k * k, 70 - 12 * k];
}
export function plasma(t: number) {
  const k = t - T.REENTRY;
  return smooth(k / 1.5) * (1 - smooth((k - 6) / 1.6));
}

/** Parachute descent at the splashdown set. */
export function capsuleAltitude(t: number) {
  const k = clamp01((t - T.CHUTES) / (T.FILM_END - T.CHUTES - 3));
  return lerp(34, 0.4, k * k * (3 - 2 * k) * 0.6 + k * 0.4);
}

/* ---------------------------------------------------------------- cameras */

export type ViewKind = "space" | "cabin" | "sea";

export interface Shot {
  id: string;
  kind: ViewKind;
  pos: Vec;
  aim: Vec;
  /** The crew's up, so horizons stay level in orbit. */
  up: Vec;
  fov: number;
  /** Seconds of handheld-style wobble amplitude, in world units. */
  shake: number;
}

const WORLD_UP: Vec = [0, 1, 0];

export const SHOT_STARTS: [number, string][] = [
  [0, "tli-wide"],
  [9, "tli-engine"],
  [16, "tli-front"],
  [T.TLI_END, "adapter"],
  [T.FLIP_A, "flip-wide"],
  [T.FLIP_A_END, "dock"],
  [T.FLIP_B, "flip-back"],
  [T.COAST, "coast-ahead"],
  [53, "coast-moon"],
  [66, "arrive"],
  [74, "loi-burn"],
  [82, "far-side"],
  [T.RISE, "earthrise"],
  [T.CABIN, "cabin-window"],
  [126, "cabin-crew"],
  [T.OUTBOUND_END, "tei"],
  [T.REENTRY, "reentry"],
  [T.CHUTES, "chutes"],
  [165, "splash"],
];

/** Which set the camera is in: out in space, inside the cabin looking out, or at the sea. */
export function viewKind(t: number): ViewKind {
  const id = shotIdAt(t);
  if (id === "earthrise" || id === "cabin-window" || id === "cabin-crew") return "cabin";
  if (id === "chutes" || id === "splash") return "sea";
  return "space";
}

export function shotIdAt(t: number) {
  let id = SHOT_STARTS[0][1];
  for (const [from, name] of SHOT_STARTS) if (t >= from) id = name;
  return id;
}

/** Direction to look so the Earth sits where the Earthrise frame wants it. */
function earthriseLook(t: number, pose: Pose) {
  const toEarth = norm(sub([0, 0, 0], pose.pos));
  // Horizontal part of the direction to the Earth (in the plane perpendicular to the crew's up).
  const h = norm(sub(toEarth, mul(pose.up, dot(toEarth, pose.up))));
  // Start with the horizon mid-frame and the Earth just clearing it; then drift up after it.
  const earthElev = Math.asin(Math.max(-1, Math.min(1, dot(toEarth, pose.up))));
  const elev = -0.4 + 0.95 * Math.max(0, earthElev + 0.34);
  return norm(add(mul(h, Math.cos(elev)), mul(pose.up, Math.sin(elev))));
}

/** The cabin looking out the window; looks along `look` with `up` overhead. */
export function cabinLook(t: number, pose: Pose) {
  if (t < T.CABIN) return earthriseLook(t, pose);
  // Christmas Eve: the surface slides by below, tilting slowly back toward the horizon.
  return norm(add(mul(pose.fwd, 0.85), mul(pose.up, -0.4)));
}

/**
 * Where the camera sits inside the cabin (local metres, looking down -Z at the window): at the
 * window first, then craning up and back over the crew's helmets to see them against it.
 */
export function cabinEye(t: number): Vec {
  const s = smooth((t - 126) / 9);
  return [0, 0.2 * s, 0.05 + 1.0 * s];
}

export function frameAt(t: number): Shot {
  const id = shotIdAt(t);
  const pose = shipPose(t);
  const stage = stagePosition(t);
  const k = (from: number, to: number) => clamp01((t - from) / (to - from));
  const base = { id, up: WORLD_UP, shake: 0 };
  switch (id) {
    case "tli-wide": {
      const p = baseTrack(t);
      return { ...base, kind: "space", pos: [-14 + 0.2 * t, 48 + 0.1 * t, -4 - 0.6 * t], aim: p, fov: 38, shake: 0.01 };
    }
    case "tli-engine": {
      const q = k(9, 16);
      return { ...base, kind: "space", pos: shipAt(pose, -3.6 + q * 0.8, 1.1, -5.6 + q * 0.8), aim: shipAt(pose, 0, 0, -2.5), fov: 40, shake: 0.012 };
    }
    case "tli-front": {
      const q = k(16, 22);
      return { ...base, kind: "space", pos: shipAt(pose, -3.4 + q * 0.5, 1.4, 6.6), aim: shipAt(pose, 0, 0, -0.6), fov: 40, shake: 0.008 };
    }
    case "adapter": {
      // Macro on the adapter joint: an orbit around the petals as they swing open.
      const q = k(T.TLI_END, T.FLIP_A);
      const a = 0.7 + q * 0.9;
      const joint = shipAt(stagePose(t), 0, 0, -0.18);
      return {
        ...base,
        kind: "space",
        pos: shipAt(stagePose(t), -Math.sin(a) * 1.9, Math.cos(a) * 0.8 + 0.2, 0.3 + Math.sin(q * 3) * 0.15),
        aim: joint,
        fov: 34,
        shake: 0.004,
      };
    }
    case "flip-wide": {
      const mid = mul(add(stage, pose.pos), 0.5);
      return { ...base, kind: "space", pos: add(stage, [-7, 2.2, -2.4 - (t - T.FLIP_A) * 0.3]), aim: add(mid, [0, 0.2, -1]), fov: 38 };
    }
    case "dock": {
      // A close side view of the ship backing in to Eagle, then drawing it out of the adapter.
      const mid = add(mul(add(stage, pose.pos), 0.5), [0, 0, t < T.DOCK ? 0 : -(t - T.DOCK) * 0.2]);
      return { ...base, kind: "space", pos: add(mid, [-2.7, 0.55, 0.1]), aim: add(mid, [0, 0, 0]), fov: 36, shake: 0.004 };
    }
    case "flip-back": {
      return { ...base, kind: "space", pos: shipAt(pose, 2.4, 0.7, 2.2), aim: add(stage, [0, 0, 0.6]), fov: 34 };
    }
    case "coast-ahead": {
      const a = 0.5 + (t - T.COAST) * 0.07;
      return { ...base, kind: "space", pos: add(pose.pos, [-Math.sin(a) * 5, 1.5 + Math.cos(a), -9]), aim: pose.pos, fov: 38 };
    }
    case "coast-moon": {
      const a = 0.4 + (t - 53) * 0.04;
      return { ...base, kind: "space", pos: add(pose.pos, [-5 * Math.cos(a), 1.4, 6.5]), aim: add(pose.pos, mul(norm(sub(MOON, pose.pos)), 18)), fov: 36 };
    }
    case "arrive": {
      return { ...base, kind: "space", pos: add(pose.pos, [-6 + (t - 66) * 0.2, 2.2, 10]), aim: add(pose.pos, [-2.4, 0, -0.4]), fov: 40 };
    }
    case "loi-burn": {
      return { ...base, kind: "space", pos: shipAt(pose, -4.4, 0.9, -0.2 + (t - 74) * 0.05), aim: shipAt(pose, 0, 0, -0.9), fov: 36, shake: 0.006 };
    }
    case "far-side": {
      const a = 0.9 + (t - 82) * 0.02;
      return { ...base, kind: "space", pos: add(MOON, [Math.sin(a) * 66, 12, Math.cos(a) * -60]), aim: add(MOON, mul(sub(pose.pos, MOON), 0.3)), fov: 30 };
    }
    case "earthrise":
    case "cabin-window":
    case "cabin-crew": {
      return { ...base, kind: "cabin", pos: pose.pos, aim: add(pose.pos, cabinLook(t, pose)), up: pose.up, fov: id === "cabin-crew" ? 50 : id === "cabin-window" ? 36 : 32 };
    }
    case "tei": {
      const q = t - T.OUTBOUND_END;
      return { ...base, kind: "space", pos: shipAt(pose, 3.6 + q * 0.25, 0.8, -0.2 - q * 0.15), aim: shipAt(pose, 0, 0, -0.5), fov: 38, shake: 0.01 };
    }
    case "reentry": {
      const p = reentryPosition(t);
      return { ...base, kind: "space", pos: add(p, [-15, 2.2, 7]), aim: add(p, [0, 0, 3]), fov: 34, shake: 0.02 };
    }
    case "chutes": {
      const alt = capsuleAltitude(t);
      return { ...base, kind: "sea", pos: add(SEA, [10, 2.5, 18]), aim: add(SEA, [0, alt + 12, 0]), fov: 52 };
    }
    default: {
      // "splash": wide over the water as the capsule settles.
      const alt = capsuleAltitude(t);
      return { ...base, kind: "sea", pos: add(SEA, [-22 + (t - 165) * 0.5, 4.2, 30]), aim: add(SEA, [0, Math.max(alt, 3) * 0.7 + 1.2, 0]), fov: 38 };
    }
  }
}

/** The spent stage always points the way it was flying. */
export function stagePose(t: number): Pose {
  return { pos: stagePosition(t), fwd: norm([0, 0.04, -1]), up: WORLD_UP };
}

/* ---------------------------------------------------------------- readouts */

/** Mission elapsed time (seconds) by film time, compressing days into seconds. */
const MET_KEYS: [number, number][] = [
  [0, 2 * 3600 + 44 * 60],
  [T.TLI_END, 2 * 3600 + 50 * 60 + 30],
  [T.COAST, 3 * 3600 + 20 * 60],
  [66, 68 * 3600 + 50 * 60],
  [T.LOS, 69 * 3600 + 8 * 60],
  [T.AOS, 74 * 3600 + 20 * 60],
  [104, 74 * 3600 + 34 * 60],
  [T.CABIN, 75 * 3600 + 30 * 60],
  [128, 86 * 3600],
  [T.OUTBOUND_END, 89 * 3600 + 15 * 60],
  [T.REENTRY, 146 * 3600 + 40 * 60],
  [T.FILM_END, 147 * 3600],
];

export function missionElapsed(t: number) {
  const first = MET_KEYS[0];
  if (t <= first[0]) return first[1];
  for (let i = 1; i < MET_KEYS.length; i++) {
    const [t1, m1] = MET_KEYS[i];
    const [t0, m0] = MET_KEYS[i - 1];
    if (t <= t1) return lerp(m0, m1, (t - t0) / (t1 - t0));
  }
  return MET_KEYS[MET_KEYS.length - 1][1];
}

export function formatMet(seconds: number) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `T+${String(h).padStart(3, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Behind the Moon, with no radio, between these film times. */
export const SIGNAL_LOST: [number, number] = [T.LOS, T.AOS];
