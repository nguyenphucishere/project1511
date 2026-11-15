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
  /** The way home (about four minutes in all): the engine burns for home... */
  TEI_END: 158,
  /** ...the command module sheds the service module... */
  SM_SEP: 184,
  /** ...meets the air at the entry interface... */
  REENTRY: 206,
  /** ...opens the drogue parachutes... */
  CHUTES: 280,
  /** ...and touches the sea (the touchdown sound plays here, twenty seconds before the film ends). */
  TOUCHDOWN: 332,
  FILM_END: 352,
} as const;

/** Seconds from the drogues to the main parachutes in the film (the real gap was 48 s). */
export const MAIN_DELAY = 6;
/** Film seconds of the entry, from the interface to the drogues. */
export const ENTRY_SPAN = T.CHUTES - T.REENTRY;
/** The film time a fraction (0 to 1) of the way through the entry. */
export const entryAt = (f: number) => T.REENTRY + f * ENTRY_SPAN;

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
  return homePosition(t);
}

/**
 * Homebound: out of lunar orbit along the tangent, a long glide toward the Earth, and then the entry path
 * over the top of the air. The command module takes over from the whole ship at the service module's
 * separation, at the same place.
 */
export function homePosition(t: number): Vec {
  if (t >= T.REENTRY) return reentryPosition(t);
  const start = add(MOON, [-R_ORBIT, 0, 0]);
  const end = reentryPosition(T.REENTRY);
  const dur = T.REENTRY - T.OUTBOUND_END;
  const s = clamp01((t - T.OUTBOUND_END) / dur);
  // Slow off the burn, fast through the middle, easing to the entry's own pace.
  return [
    hermite(start[0], end[0], 0, 0, s),
    hermite(start[1], end[1], 0, 0, s),
    hermite(start[2], end[2], 3 * dur, 1.6 * dur, s),
  ];
}

const WORLD_UP: Vec = [0, 1, 0];

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
  if (t > T.OUTBOUND_END) {
    if (t < T.TEI_END) return { pos, fwd: [0, 0, 1], up: [-1, 0, 0] };
    const ahead = homePosition(t + 0.05);
    const along = sub(ahead, homePosition(t - 0.05));
    // Once the capsule hangs under its parachutes it no longer travels: keep the last heading.
    const still = Math.hypot(along[0], along[1], along[2]) < 1e-6;
    return { pos, fwd: still ? [0, 0, 1] : norm(along), up: WORLD_UP };
  }
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
  if (t >= T.OUTBOUND_END && t < T.TEI_END) return smooth((t - T.OUTBOUND_END) / 1.2) * (1 - smooth((t - (T.TEI_END - 3)) / 3));
  return 0;
}

/** Petal angle of the adapter (0 closed → 1 fully open) and how far they have flown off. */
export function petals(t: number) {
  return { open: smooth((t - (T.SEP - 1.8)) / 1.6), flown: Math.max(0, t - (T.SEP - 0.2)) };
}

/** Reentry path past the top of the Earth, and how hot the capsule glows. */
export function reentryPosition(t: number): Vec {
  const u = clamp01((t - T.REENTRY) / ENTRY_SPAN);
  // Height above the Earth follows the real altitude (0.18 world units a kilometre); it crosses the sky from -Z to +Z.
  const { altKm } = entryState(Math.max(t, T.REENTRY));
  return [0, R_EARTH + altKm * 0.18, lerp(-60, 60, u)];
}
/**
 * How hot the capsule glows, 0 to 1. Heating comes from compressing the air in front of the heat
 * shield, so it follows how dense the air is and how fast the capsule goes (convective heating goes as
 * the square root of density times speed cubed). Almost nothing at 122 km where the air is a trace, a
 * long glow through the thick part from about 90 km down to 20, and gone under the parachutes.
 */
export function plasma(t: number) {
  const { altKm, speedKms } = entryState(t);
  const rho = 1.225 * Math.exp(-altKm / 7.2);
  return clamp01((Math.sqrt(rho) * speedKms ** 3) / 8);
}

export type AtmosphereLayer = "thermosphere" | "mesosphere" | "stratosphere" | "troposphere";

/** The layers the capsule falls through, and where each one starts (km). */
export const ATMOSPHERE: { id: AtmosphereLayer; fromKm: number; toKm: number }[] = [
  { id: "thermosphere", fromKm: 85, toKm: 122 },
  { id: "mesosphere", fromKm: 50, toKm: 85 },
  { id: "stratosphere", fromKm: 12, toKm: 50 },
  { id: "troposphere", fromKm: 0, toKm: 12 },
];

export function atmosphereLayer(altKm: number): AtmosphereLayer {
  return (ATMOSPHERE.find((l) => altKm >= l.fromKm) ?? ATMOSPHERE[ATMOSPHERE.length - 1]).id;
}

/** How much of the sky is air by now, 0 (vacuum, black) to 1 (blue): the glow along the horizon. */
export function skyAir(altKm: number): number {
  return clamp01(1 - (altKm - 8) / 100);
}

/**
 * The hard cuts of the flight home, each softened by dipping through black: the jump of two and a half
 * days to the top of the air, and the cut from space to the sea under the parachutes.
 */
export const HOME_CUTS = [T.CHUTES];
const DIP_IN = 0.8;
const DIP_OUT = 1.0;

/** How black the screen is at film time t (0 clear, 1 black): it closes just before a cut and opens just after. */
export function cutDip(t: number, cuts: number[] = HOME_CUTS): number {
  let dip = 0;
  for (const c of cuts) {
    const k = t < c ? 1 - (c - t) / DIP_IN : 1 - (t - c) / DIP_OUT;
    if (k > 0) dip = Math.max(dip, smooth(k));
  }
  return dip;
}

/**
 * The capsule's tilt about X after touchdown (radians; -pi/2 is nose up, +pi/2 nose down). It topples onto
 * its nose (Apollo 11 came to rest apex down, "Stable 2"), and the uprighting bags then right it.
 */
export function landedTilt(t: number): number {
  const up = -Math.PI / 2;
  const down = Math.PI / 2;
  if (t < T.TOUCHDOWN) return up;
  const over = smooth((t - T.TOUCHDOWN) / 1.8);
  const righted = smooth((t - (T.TOUCHDOWN + 5)) / 10);
  return up + (down - up) * over * (1 - righted);
}

/** Parachute descent at the splashdown set. */
export function capsuleAltitude(t: number) {
  const k = clamp01((t - T.CHUTES) / (T.TOUCHDOWN - T.CHUTES));
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
  [T.OUTBOUND_END + 9, "tei-cabin"],
  [T.TEI_END, "coast-fly"],
  [T.TEI_END + 13, "coast-earth"],
  [T.SM_SEP, "sm-sep"],
  [T.REENTRY, "reentry"],
  [entryAt(0.135), "entry-cabin"],
  [entryAt(0.35), "entry-orbit"],
  [entryAt(0.53), "reentry-low"],
  [entryAt(0.73), "entry-cabin"],
  [entryAt(0.92), "reentry"],
  [T.CHUTES, "chutes"],
  [T.CHUTES + 22, "heli"],
  [T.CHUTES + 38, "splash"],
  [T.TOUCHDOWN + 2, "recovery"],
];

/** Which set the camera is in: out in space, inside the cabin looking out, or at the sea. */
export function viewKind(t: number): ViewKind {
  const id = shotIdAt(t);
  if (id === "earthrise" || id === "cabin-window" || id === "cabin-crew" || id === "tei-cabin" || id === "entry-cabin") return "cabin";
  if (id === "chutes" || id === "heli" || id === "splash" || id === "recovery") return "sea";
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
  if (t > T.OUTBOUND_END) {
    // Burning for home: looking back over the stern at the Moon falling away. In the entry: forward and down, at the glow and the Earth.
    if (t < T.REENTRY) return norm(add(mul(pose.fwd, -0.8), mul(pose.up, 0.25)));
    return norm(add(mul(pose.fwd, 0.55), mul(pose.up, -0.5)));
  }
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
    case "tei-cabin":
    case "entry-cabin": {
      return { ...base, kind: "cabin", pos: pose.pos, aim: add(pose.pos, cabinLook(t, pose)), up: pose.up, fov: id === "tei-cabin" ? 42 : 46 };
    }
    case "coast-fly": {
      // A fly cam around the ship as it glides home: the Moon behind, the Earth growing ahead.
      const q = t - T.TEI_END;
      const ang = 0.4 + q * 0.05;
      const r = 6 + q * 0.12;
      return { ...base, kind: "space", pos: add(pose.pos, [Math.sin(ang) * r, 1.4 + Math.cos(ang) * 1.6, -Math.cos(ang) * r * 0.8]), aim: add(pose.pos, mul(pose.fwd, 2.5)), fov: 36 };
    }
    case "coast-earth": {
      // From behind the ship, looking ahead at the Earth swelling in the dark.
      const q = t - (T.TEI_END + 13);
      return { ...base, kind: "space", pos: add(pose.pos, [-2.4 + q * 0.05, 1.1, -5.5]), aim: add(pose.pos, mul(pose.fwd, 9)), fov: 38 - q * 0.4, shake: 0.004 };
    }
    case "sm-sep": {
      // Beside the command module as the service module falls away behind it.
      const behind = mul(pose.fwd, -2.5);
      return { ...base, kind: "space", pos: add(pose.pos, add([-12, 2.6, 0], mul(pose.fwd, -2))), aim: add(pose.pos, mul(pose.fwd, -2.2)), fov: 34, shake: 0.005 };
    }
    case "reentry": {
      const p = reentryPosition(t);
      return { ...base, kind: "space", pos: add(p, [-15, 2.2, -7]), aim: add(p, [0, 0, -3]), fov: 34, shake: 0.02 };
    }
    case "entry-orbit": {
      // A fly cam circling the capsule from above: the glow, and the Earth's curve and clouds below it.
      const p = reentryPosition(t);
      const ang = -2.2 + (t - entryAt(0.35)) * 0.11;
      return { ...base, kind: "space", pos: add(p, [Math.cos(ang) * 11, 3.5 + Math.sin(t * 0.3) * 0.6, Math.sin(ang) * 11]), aim: p, fov: 34, shake: 0.012 };
    }
    case "reentry-low": {
      // Low and ahead, looking back up at the heat shield taking the fire.
      const p = reentryPosition(t);
      return { ...base, kind: "space", pos: add(p, [-9, -3.6, 8]), aim: add(p, [0, 0.4, -0.5]), fov: 36, shake: 0.016 };
    }
    case "chutes": {
      const alt = capsuleAltitude(t);
      return { ...base, kind: "sea", pos: add(SEA, [10, 2.5, 18]), aim: add(SEA, [0, alt + 12, 0]), fov: 52 };
    }
    case "heli": {
      // The recovery helicopter's view: high over the water, drifting round to the capsule under its chutes.
      const alt = capsuleAltitude(t);
      const q = t - (T.CHUTES + 22);
      return { ...base, kind: "sea", pos: add(SEA, [-70 + q * 1.4, 36 - q * 0.6, 90 - q * 1.8]), aim: add(SEA, [0, Math.max(alt, 2) * 0.8 + 1, 0]), fov: 40, shake: 0.03 };
    }
    case "recovery": {
      // Close on the capsule as it is righted and the swimmers reach it, the helicopters overhead.
      const q = t - (T.TOUCHDOWN + 2);
      const a = 0.9 + q * 0.03;
      return { ...base, kind: "sea", pos: add(SEA, [Math.sin(a) * 27, 4 + q * 0.03, Math.cos(a) * 27]), aim: add(SEA, [0, 5.5, 0]), fov: 48, shake: 0.012 };
    }
    default: {
      // "splash": wide over the water as the capsule settles.
      const alt = capsuleAltitude(t);
      return { ...base, kind: "sea", pos: add(SEA, [-22 + (t - (T.CHUTES + 38)) * 0.3, 4.2, 30]), aim: add(SEA, [0, Math.max(alt, 3) * 0.7 + 1.2, 0]), fov: 38 };
    }
  }
}

/** The spent stage always points the way it was flying. */
export function stagePose(t: number): Pose {
  return { pos: stagePosition(t), fwd: norm([0, 0.04, -1]), up: WORLD_UP };
}

/* ---------------------------------------------------------------- readouts */

export const hms = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

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
  // The outbound film ends at the moment the engine lights for home (the cabin scenes stand for the whole
  // stay in lunar orbit, which in Apollo 11 included the landing): see RETURN_MET_KEYS for what follows.
  [T.OUTBOUND_END, hms(135, 23, 42)],
];

export function missionElapsed(t: number) {
  if (t > T.OUTBOUND_END) return returnMissionElapsed(t);
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

/* ---------------------------------------------------------------- the way home (Apollo 11 numbers) */

/**
 * The flight home, on the real Apollo 11 clock (NASA Apollo Flight Journal and SP-4029): the engine
 * lights behind the Moon at 135:23:42 and burns about two and a half minutes; two and a half days
 * pass in a second; the capsule meets the air at about 195:03:25, the radio goes quiet until
 * 195:06:56, the drogues open at 195:12:04, the mains at 195:12:52 and it touches the Pacific at
 * 195:18:35. The film squeezes all of that into thirty-odd seconds, so each key below pins a film
 * time to the moment it stands for.
 */
const RETURN_MET_KEYS: [number, number][] = [
  [T.OUTBOUND_END, hms(135, 23, 42)], // TEI ignition
  [T.TEI_END - 1, hms(135, 26, 14)], // cutoff, 151 s later
  [T.REENTRY, hms(195, 3, 25)], // two and a half days in the film's long glide, then the air
  [T.CHUTES, hms(195, 12, 4)], // drogue parachutes
  [T.CHUTES + MAIN_DELAY, hms(195, 12, 52)], // main parachutes
  [T.TOUCHDOWN, hms(195, 18, 35)], // splashdown
  [T.FILM_END, hms(195, 20, 30)],
];

/** Mission elapsed time (seconds) at film time t during the flight home. */
export function returnMissionElapsed(t: number) {
  const keys = RETURN_MET_KEYS;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, m1] = keys[i];
    const [t0, m0] = keys[i - 1];
    if (t <= t1) return lerp(m0, m1, (t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}

/** The film time at which the flight home stands at this mission elapsed time (the inverse of returnMissionElapsed). */
export function filmAtMet(met: number): number {
  let lo: number = T.OUTBOUND_END;
  let hi: number = T.FILM_END;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (returnMissionElapsed(mid) < met) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The burn that takes the ship out of lunar orbit happens behind the Moon: no radio until it comes round. */
export const TEI_LOS: [number, number] = [T.OUTBOUND_END, T.TEI_END + 2];
/** The plasma around the capsule blocks radio: 195:03:25 to 195:06:56, about three and a half minutes. */
export const ENTRY_BLACKOUT: [number, number] = [
  T.REENTRY,
  // Placed on the film by the clock itself, so the film's blackout is exactly as long as the real one (211 s of 519).
  T.REENTRY + ((hms(195, 6, 56) - hms(195, 3, 25)) / (hms(195, 12, 4) - hms(195, 3, 25))) * (T.CHUTES - T.REENTRY) + 1e-6,
];

/** Where the capsule is, how fast, and how hard the air is pushing, from the entry interface to the sea. */
export interface EntryState {
  altKm: number;
  speedKms: number;
  g: number;
}

/**
 * Altitude, speed and load through the entry, as the key moments of Apollo 11's: the entry interface at
 * 121.9 km and 11.03 km/s (36,194 ft/s) at -6.5 degrees; a first load peak of about 6.5 g near 9.7 km/s
 * (the post-flight reconstruction gives 6.7 g, the plan 6.1 g); a lighter stretch while the capsule
 * lifts; a second peak of about 6 g near 3.8 km/s (12,390 ft/s); the drogues and mains; and the sea at
 * about 9 m/s. Between the keys the numbers are blended smoothly. Outside the entry they hold the
 * first or last value.
 */
const ENTRY_KEYS: [number, EntryState][] = [
  [T.REENTRY, { altKm: 121.9, speedKms: 11.03, g: 0 }],
  [entryAt(0.1), { altKm: 95, speedKms: 10.9, g: 1.4 }],
  [entryAt(0.1875), { altKm: 75, speedKms: 9.7, g: 6.5 }],
  [entryAt(0.3125), { altKm: 64, speedKms: 8.6, g: 3 }],
  [entryAt(0.5), { altKm: 58, speedKms: 7.4, g: 1.4 }],
  [entryAt(0.6875), { altKm: 42, speedKms: 5, g: 4.8 }],
  [entryAt(0.8125), { altKm: 28, speedKms: 3.8, g: 6 }],
  [entryAt(0.925), { altKm: 14, speedKms: 1.6, g: 3 }],
  [T.CHUTES, { altKm: 7.3, speedKms: 0.35, g: 1 }],
  [T.CHUTES + MAIN_DELAY, { altKm: 3, speedKms: 0.12, g: 1 }],
  [T.TOUCHDOWN, { altKm: 0, speedKms: 0.009, g: 1 }],
];

export function entryState(t: number): EntryState {
  const keys = ENTRY_KEYS;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    if (t <= t1) {
      const [t0, a] = keys[i - 1];
      const k = smooth((t - t0) / (t1 - t0));
      return { altKm: lerp(a.altKm, b.altKm, k), speedKms: lerp(a.speedKms, b.speedKms, k), g: lerp(a.g, b.g, k) };
    }
  }
  return keys[keys.length - 1][1];
}

/** Events on the way home, with the film time at which the film passes them and the Apollo 11 clock they carry. */
export type ReturnLogId = "tei" | "teiEnd" | "entry" | "peak" | "signal" | "drogue" | "main" | "splash";
/** `approx`: the moment is an estimate from the entry profile, not a logged time (shown with a ≈). */
export const RETURN_LOG: { id: ReturnLogId; t: number; get: string; approx?: boolean }[] = [
  { id: "tei", t: T.OUTBOUND_END, get: "135:23:42" },
  { id: "teiEnd", t: T.TEI_END - 1, get: "135:26:14" },
  { id: "entry", t: T.REENTRY, get: "195:03:25" },
  { id: "peak", t: entryAt(0.1875), get: "195:05:02", approx: true },
  { id: "signal", t: ENTRY_BLACKOUT[1], get: "195:06:56" },
  { id: "drogue", t: T.CHUTES, get: "195:12:04" },
  { id: "main", t: T.CHUTES + MAIN_DELAY, get: "195:12:52" },
  { id: "splash", t: T.TOUCHDOWN, get: "195:18:35" },
];
