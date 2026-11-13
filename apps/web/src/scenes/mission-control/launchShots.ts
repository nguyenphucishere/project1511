import { ADAPTER_T, HOLD_DOWN, LES_T, SEP2_T, SEPARATION_T, STAGE2_T, STAGE3_T, detachedPose } from "./ascent";

/**
 * The launch as a film: a list of camera shots, each a hard cut from the last, chosen by the
 * time since ignition. Pure data and maths (no three.js), so the cut list can be tested.
 *
 * Every shot positions itself around the pad, and around the rocket itself (`rise` is how high
 * the stack's base is above the pad), so the same shot keeps working while the rocket climbs.
 * Every separation gets the same treatment: an orbiting macro on the ring, a very tight shot as the
 * bolts fire, a slow orbit while the petals unfold, a look up the throat of the next engine, then
 * a look down on the spent stage tumbling away.
 */
export type Vec = [number, number, number];

export interface ShotContext {
  /** Seconds since ignition. */
  t: number;
  /** Height of the stack's base above the pad, metres. */
  rise: number;
  speed: number;
  pad: Vec;
}

export interface ShotFrame {
  pos: Vec;
  aim: Vec;
  /** How quickly the aim catches up with its target (1/s). Higher feels handheld and snappy. */
  rate: number;
  /** Lowest zoom; the tracking lens may zoom in further as the rocket gets far away. */
  zoom: number;
  /** Engine rumble shaking the camera, metres of jitter. */
  shake: number;
}

export interface Shot {
  id: string;
  /** Seconds since ignition when this shot starts. */
  from: number;
  frame: (c: ShotContext) => ShotFrame;
}

const at = (pad: Vec, dx: number, dy: number, dz: number): Vec => [pad[0] + dx, pad[1] + dy, pad[2] + dz];

/** Height on the stack, above its base, that the long lenses aim at. */
const MID = 14;

/** Heights of the things the cameras look at, above the stack's base. */
const RING1 = 12.5;
const RING2 = 19.8;
const ADAPTER = 25.9;
const TOWER = 31.2;

/** The spent stages' poses, matching LaunchVehicle (the cameras follow them down). */
const spent1 = (t: number) => detachedPose(SEPARATION_T, t - SEPARATION_T, { fall: 2.2, drift: 0.3, tumble: 0.055 });
const spent2 = (t: number) => detachedPose(SEP2_T, t - SEP2_T, { fall: 1.8, drift: -0.3, tumble: -0.055 });

/** Where the escape tower is, relative to the capsule, after its motor lights (matches EscapeTower). */
const towerOffset = (t: number): [number, number] => {
  const go = Math.max(0, t - LES_T);
  return [0.6 * go * go, 7 * go + 1.2 * go * go];
};

/** An orbit round a height on the stack, starting at angle `a0` and turning `rate` rad/s. */
function orbit(from: number, y: number, radius: number, dy: number, a0: number, rate: number, zoom: number, shake: number, track = 16) {
  return ({ pad, rise, t }: ShotContext): ShotFrame => {
    const a = a0 + (t - from) * rate;
    return {
      pos: at(pad, Math.sin(a) * radius, rise + y + dy, Math.cos(a) * radius),
      aim: at(pad, 0, rise + y, 0),
      rate: track,
      zoom,
      shake,
    };
  };
}

export const SHOTS: Shot[] = [
  {
    // Hold-down: a low, close look at the engines building up, smoke rolling out.
    id: "engines",
    from: 0,
    frame: ({ pad }) => ({ pos: at(pad, 11, 6.5, 26), aim: at(pad, 0, 5, 0), rate: 30, zoom: 1.1, shake: 0.07 }),
  },
  {
    // The umbilical arms swing back from the stack, one after another.
    id: "arms",
    from: HOLD_DOWN - 2.2,
    frame: ({ pad }) => ({ pos: at(pad, 3.5, 16, -9), aim: at(pad, -2.5, 16, -1), rate: 22, zoom: 1.5, shake: 0.05 }),
  },
  {
    // Macro on a hold-down clamp as it lets go.
    id: "clamps",
    from: HOLD_DOWN - 1.2,
    frame: ({ pad }) => ({ pos: at(pad, 4.4, 3.4, 4.6), aim: at(pad, 1.7, 2.9, 1.7), rate: 24, zoom: 1.5, shake: 0.08 }),
  },
  {
    // Release: a low, wide angle from the far side of the tower as the stack clears the pad.
    id: "liftoff",
    from: HOLD_DOWN + 0.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, 16, 3.5, 34), aim: at(pad, 0, rise + 12, 0), rate: 6, zoom: 1, shake: 0.05 }),
  },
  {
    // Whip past the tower: the camera sits still, the rocket tears by.
    id: "tower",
    from: HOLD_DOWN + 3.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, 11, 4.5, 10), aim: at(pad, 0, rise + 8, 0), rate: 14, zoom: 1.25, shake: 0.03 }),
  },
  {
    // Chase: the camera climbs with the rocket, close and a little behind its shoulder.
    id: "chase",
    from: HOLD_DOWN + 6.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, 9, rise + 3, 12), aim: at(pad, 0, rise + MID, 0), rate: 16, zoom: 1.2, shake: 0.02 }),
  },
  {
    // From the ground, up the plume: the outer engines swinging on their gimbals.
    id: "gimbals",
    from: HOLD_DOWN + 8.6,
    frame: ({ pad, rise }) => ({ pos: at(pad, 6, 1.5, 8), aim: at(pad, 0, rise + 3, 0), rate: 12, zoom: 1.4, shake: 0.04 }),
  },
  {
    // The classic long lens from the viewing field.
    id: "tracking",
    from: SEPARATION_T - 4,
    frame: ({ pad, rise, speed }) => ({
      pos: at(pad, -24 - rise * 0.22, 5 + rise * 0.18, 43),
      aim: at(pad, 0, rise + speed / 5 + 17, 0),
      rate: 5,
      zoom: 1,
      shake: 0,
    }),
  },

  /* ---- first separation ---- */
  { id: "ring", from: SEPARATION_T - 2.2, frame: orbit(SEPARATION_T - 2.2, RING1, 5.2, 1.7, 0.6, 0.5, 1.7, 0.02, 20) },
  {
    // Staging: very tight on the ring as the bolts fire and the shock ring flashes out.
    id: "staging",
    from: SEPARATION_T - 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.6, rise + 13.4, 3.4), aim: at(pad, 0.4, rise + 11.9, 0), rate: 26, zoom: 1.9, shake: 0.04 }),
  },
  // The petals unfold: an orbit the other way, the spent stage sliding off underneath.
  { id: "petals", from: SEPARATION_T + 0.4, frame: orbit(SEPARATION_T + 0.4, RING1 + 0.3, 7, -2, 2.2, -0.7, 1.35, 0.02) },
  {
    // The five engines of stage 2, uncovered.
    id: "bells",
    from: SEPARATION_T + 0.95,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.4, rise + 9.5, 4.2), aim: at(pad, 0, rise + 13.2, 0), rate: 22, zoom: 1.6, shake: 0.015 }),
  },
  {
    // Ignition of stage 2 from the side, held a beat so the flame blooms.
    id: "ignite",
    from: STAGE2_T - 0.1,
    frame: ({ pad, rise }) => ({ pos: at(pad, 8, rise + 9, 11), aim: at(pad, 0, rise + 13, 0), rate: 14, zoom: 1.3, shake: 0.03 }),
  },
  {
    // Looking down on the spent first stage as it tumbles into the distance.
    id: "fall",
    from: STAGE2_T + 1.4,
    frame: ({ pad, rise, t }) => {
      const p = spent1(t);
      return { pos: at(pad, 7, rise + 11, 12), aim: at(pad, p.drift, p.rise + 8, 0), rate: 8, zoom: 1.1, shake: 0.01 };
    },
  },
  {
    // Stage 2 burns: low and looking up, the rocket shrinking against the sky.
    id: "second-stage",
    from: STAGE2_T + 3.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, -9, 2, 20), aim: at(pad, 0, rise + MID, 0), rate: 6, zoom: 1, shake: 0 }),
  },
  {
    // A far vista, the contrail drawing its arc.
    id: "vista",
    from: STAGE2_T + 5.6,
    frame: ({ pad, rise, speed }) => ({ pos: at(pad, -70, 12, 95), aim: at(pad, 0, rise + speed / 6 + MID, 0), rate: 4, zoom: 1, shake: 0 }),
  },

  /* ---- the escape tower ---- */
  {
    id: "tower-bolts",
    from: LES_T - 1.2,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.2, rise + TOWER + 1, 3.8), aim: at(pad, 0, rise + TOWER + 0.6, 0), rate: 24, zoom: 1.7, shake: 0.03 }),
  },
  {
    // Chase the tower as it tears away, pitching over on its own motor.
    id: "tower-away",
    from: LES_T + 0.45,
    frame: ({ pad, rise, t }) => {
      const [x, y] = towerOffset(t);
      return { pos: at(pad, -6, rise + TOWER - 1, 14), aim: at(pad, x, rise + TOWER + 3.5 + y, 0), rate: 12, zoom: 1.2, shake: 0.03 };
    },
  },
  {
    id: "tower-wide",
    from: LES_T + 2.4,
    frame: ({ pad, rise, t }) => {
      const [x, y] = towerOffset(t);
      return { pos: at(pad, -34, rise + 8, 52), aim: at(pad, x * 0.7, rise + TOWER + y * 0.7, 0), rate: 5, zoom: 1.1, shake: 0 };
    },
  },
  {
    id: "tracking-2",
    from: LES_T + 3.4,
    frame: ({ pad, rise, speed }) => ({
      pos: at(pad, 26 + rise * 0.2, 5 + rise * 0.18, 43),
      aim: at(pad, 0, rise + speed / 5 + 17, 0),
      rate: 5,
      zoom: 1,
      shake: 0,
    }),
  },

  /* ---- second separation ---- */
  { id: "ring-2", from: SEP2_T - 2.2, frame: orbit(SEP2_T - 2.2, RING2, 4.6, 1.6, 3.7, -0.5, 1.7, 0.02, 20) },
  {
    id: "staging-2",
    from: SEP2_T - 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.2, rise + 20.7, 3), aim: at(pad, 0.3, rise + 19.3, 0), rate: 26, zoom: 1.9, shake: 0.04 }),
  },
  { id: "petals-2", from: SEP2_T + 0.4, frame: orbit(SEP2_T + 0.4, RING2 + 0.2, 6, -1.6, 5, 0.7, 1.35, 0.02) },
  {
    // Up the throat of the third stage as its nozzle extension telescopes out.
    id: "nozzle",
    from: SEP2_T + 1.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3, rise + 16, 3.6), aim: at(pad, 0, rise + 19.4, 0), rate: 22, zoom: 1.7, shake: 0.015 }),
  },
  {
    id: "ignite-3",
    from: STAGE3_T - 0.3,
    frame: ({ pad, rise }) => ({ pos: at(pad, 7, rise + 15, 9), aim: at(pad, 0, rise + 19, 0), rate: 14, zoom: 1.3, shake: 0.03 }),
  },
  {
    // Looking down on the spent second stage.
    id: "fall-2",
    from: STAGE3_T + 0.6,
    frame: ({ pad, rise, t }) => {
      const p = spent2(t);
      return { pos: at(pad, 8, rise + 16, 10), aim: at(pad, p.drift, p.rise + 16, 0), rate: 8, zoom: 1.1, shake: 0.01 };
    },
  },

  /* ---- the adapter opens ---- */
  {
    id: "adapter-bolts",
    from: ADAPTER_T - 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.2, rise + 26.2, 3), aim: at(pad, 0.2, rise + 24.6, 0), rate: 26, zoom: 1.8, shake: 0.03 }),
  },
  { id: "adapter-open", from: ADAPTER_T + 0.4, frame: orbit(ADAPTER_T + 0.4, ADAPTER, 7.5, 1, 0.4, 0.55, 1.2, 0.015, 12) },
  {
    // Pull back and rise: the lander, and the panels spinning away from it.
    id: "lander",
    from: ADAPTER_T + 2.4,
    frame: ({ pad, rise, t }) => {
      const k = Math.min(1, (t - ADAPTER_T - 2.4) / 3);
      return { pos: at(pad, -10 - k * 18, rise + 24 + k * 10, 20 + k * 22), aim: at(pad, 0, rise + ADAPTER, 0), rate: 9, zoom: 1.1, shake: 0 };
    },
  },
  {
    // Final wide: far back and high, the contrail drawing its arc.
    id: "wide",
    from: ADAPTER_T + 5,
    frame: ({ pad, rise, speed }) => ({ pos: at(pad, -90, 40, 120), aim: at(pad, 0, rise + speed / 6 + MID, 0), rate: 4, zoom: 1, shake: 0 }),
  },
];

/** The shot playing `t` seconds after ignition. */
export function shotAt(t: number): Shot {
  let current = SHOTS[0]!;
  for (const s of SHOTS) if (t >= s.from) current = s;
  return current;
}
