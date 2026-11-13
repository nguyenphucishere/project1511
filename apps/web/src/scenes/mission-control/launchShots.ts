import { HOLD_DOWN, SEPARATION_T, STAGE2_T } from "./ascent";

/**
 * The launch as a film: a list of camera shots, each a hard cut from the last, chosen by the
 * time since ignition. Pure data and maths (no three.js), so the cut list can be tested.
 *
 * Every shot positions itself around the pad, and around the rocket itself (`rise` is how high
 * the stack's base is above the pad), so the same shot keeps working while the rocket climbs.
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

export const SHOTS: Shot[] = [
  {
    // Hold-down: a low, close look at the engines building up, smoke rolling out.
    id: "engines",
    from: 0,
    frame: ({ pad }) => ({ pos: at(pad, 11, 6.5, 26), aim: at(pad, 0, 5, 0), rate: 30, zoom: 1.1, shake: 0.07 }),
  },
  {
    // Macro on a hold-down clamp and the swing arm beside it as they let go.
    id: "clamps",
    from: HOLD_DOWN - 1.0,
    frame: ({ pad }) => ({ pos: at(pad, 4.4, 3.4, 4.6), aim: at(pad, 1.7, 2.9, 1.7), rate: 24, zoom: 1.5, shake: 0.08 }),
  },
  {
    // Release: a low, wide angle from the far side of the tower as the stack clears the pad.
    id: "liftoff",
    from: HOLD_DOWN + 0.7,
    frame: ({ pad, rise }) => ({ pos: at(pad, 16, 3.5, 34), aim: at(pad, 0, rise + 12, 0), rate: 6, zoom: 1, shake: 0.05 }),
  },
  {
    // Whip past the tower: the camera sits still, the rocket tears by.
    id: "tower",
    from: HOLD_DOWN + 3.6,
    frame: ({ pad, rise }) => ({ pos: at(pad, 11, 4.5, 10), aim: at(pad, 0, rise + 8, 0), rate: 14, zoom: 1.25, shake: 0.03 }),
  },
  {
    // Chase: the camera climbs with the rocket, close and a little behind its shoulder.
    id: "chase",
    from: HOLD_DOWN + 6.2,
    frame: ({ pad, rise }) => ({ pos: at(pad, 9, rise + 3, 12), aim: at(pad, 0, rise + MID, 0), rate: 16, zoom: 1.2, shake: 0.02 }),
  },
  {
    // The classic long lens from the viewing field.
    id: "tracking",
    from: SEPARATION_T - 4.4,
    frame: ({ pad, rise, speed }) => ({
      pos: at(pad, -24 - rise * 0.22, 5 + rise * 0.18, 43),
      aim: at(pad, 0, rise + speed / 5 + 17, 0),
      rate: 5,
      zoom: 1,
      shake: 0,
    }),
  },
  {
    // Macro orbit round the interstage ring in the last seconds before the bolts fire.
    id: "ring",
    from: SEPARATION_T - 2.2,
    frame: ({ pad, rise, t }) => {
      const a = 0.6 + (t - (SEPARATION_T - 2.2)) * 0.5;
      return { pos: at(pad, Math.sin(a) * 5.2, rise + 14.2, Math.cos(a) * 5.2), aim: at(pad, 0, rise + 12.8, 0), rate: 20, zoom: 1.7, shake: 0.02 };
    },
  },
  {
    // Staging: very tight on the ring as the bolts fire and the shock ring flashes out.
    id: "staging",
    from: SEPARATION_T - 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.6, rise + 13.4, 3.4), aim: at(pad, 0.4, rise + 12.4, 0), rate: 26, zoom: 1.9, shake: 0.04 }),
  },
  {
    // The petals unfold: an orbiting side view with the spent stage sliding away underneath.
    id: "petals",
    from: SEPARATION_T + 0.4,
    frame: ({ pad, rise, t }) => {
      const a = 2.2 - (t - (SEPARATION_T + 0.4)) * 0.7;
      return { pos: at(pad, Math.sin(a) * 7, rise + 10.5, Math.cos(a) * 7), aim: at(pad, 0, rise + 12.4, 0), rate: 16, zoom: 1.35, shake: 0.02 };
    },
  },
  {
    // From below, looking up the throat of the upper engine as its nozzle telescopes out.
    id: "nozzle",
    from: SEPARATION_T + 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.4, rise + 8.4, 4.2), aim: at(pad, 0, rise + 12.6, 0), rate: 22, zoom: 1.6, shake: 0.015 }),
  },
  {
    // Ignition of stage 2 from the side, held a beat so the flame blooms.
    id: "ignite",
    from: STAGE2_T - 0.1,
    frame: ({ pad, rise }) => ({ pos: at(pad, 8, rise + 9, 11), aim: at(pad, 0, rise + 12, 0), rate: 14, zoom: 1.3, shake: 0.03 }),
  },
  {
    // Stage 2 lights: low and looking up, the rocket shrinking against the sky.
    id: "second-stage",
    from: STAGE2_T + 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, -8, 2, 22), aim: at(pad, 0, rise + MID, 0), rate: 6, zoom: 1, shake: 0 }),
  },
  {
    // Final wide: far back and high, the contrail drawing its arc.
    id: "wide",
    from: STAGE2_T + 4.6,
    frame: ({ pad, rise, speed }) => ({
      pos: at(pad, -70, 12, 95),
      aim: at(pad, 0, rise + speed / 6 + MID, 0),
      rate: 4,
      zoom: 1,
      shake: 0,
    }),
  },
];

/** The shot playing `t` seconds after ignition. */
export function shotAt(t: number): Shot {
  let current = SHOTS[0]!;
  for (const s of SHOTS) if (t >= s.from) current = s;
  return current;
}
