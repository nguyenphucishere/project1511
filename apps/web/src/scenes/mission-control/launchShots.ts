import { ADAPTER_T, CSM_SEP_T, CUTOFF_T, DOCK_T, FILM_END, FLIP_FROM, FLIP_TO, HOLD_DOWN, INTER_T, LES_T, SEP2_T, SEPARATION_T, STAGE2_T, STAGE3_T, TOW_T, detachedPose } from "./ascent";
import { GEAR_STATIONS, STATION } from "./separation";
import { CABIN_FROM, CSM_Y, cabinEyeY, csmPose, towOffset } from "./docking";

/** Where the cabin window is, along the eye's line of sight. */
const WINDOW_Z_AIM = 1.15;
import { BEACH_R, CROWD_BEACH, CROWD_FIELD, FIELD_R } from "./layout";

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


/* ---- cutaways: the people watching, wherever they are ---- */

/** Two worlds, so two kinds of position: absolute (the control room) and around the pad. */
const room = (x: number, y: number, z: number): Vec => [x, y, z];

/** From in front of a crowd, looking back at the faces tipped up toward the rocket. */
function crowdShot(centre: Vec, radius: number, from: number, id: string, zoom = 1.3) {
  return {
    id,
    from,
    frame: ({ t, pad }: ShotContext): ShotFrame => {
      const dx = pad[0] - centre[0];
      const dz = pad[2] - centre[2];
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d;
      const uz = dz / d;
      // Stand clear of the front row, creeping slowly toward them as a camera operator would.
      const k = radius + 2.6 - Math.min(1.5, (t - from) * 0.8);
      return {
        pos: [centre[0] + ux * k, centre[1] + 1.7, centre[2] + uz * k],
        aim: [centre[0] + ux * radius * 0.35, centre[1] + 1.6, centre[2] + uz * radius * 0.35],
        rate: 14,
        zoom,
        shake: 0.012,
      };
    },
  };
}

/** The faces of the controllers, from the window side; and their backs against the window and the rocket. */
const roomFaces = (id: string, from: number, x = 0): Shot => ({
  id,
  from,
  frame: ({ t }) => ({
    pos: room(x + 0.25 - Math.min(0.3, (t - from) * 0.3), 2.5, -2.9),
    aim: room(x, 1.2, -0.95),
    rate: 16,
    zoom: 1.5,
    shake: 0.008,
  }),
});
const roomBacks = (id: string, from: number, x = 0.9): Shot => ({
  id,
  from,
  frame: ({ t }) => ({
    pos: room(x, 1.42, 0.75 - Math.min(0.5, (t - from) * 0.4)),
    aim: room(x - 1, 1.9, -5),
    rate: 12,
    zoom: 1.3,
    shake: 0.006,
  }),
});

/* ---- the finale: a flycam chasing the capsule out of the atmosphere ---- */

/** Start of the long chase; every `fly-` shot picks the same path back up. */
const FLY0 = ADAPTER_T + 3.2;
const bump = (x: number) => 0.5 + 0.5 * x;

/** One continuous winding path round the capsule: diving close to the hull, swinging out wide, always climbing. */
function flyFrame({ pad, rise, speed, t }: ShotContext): ShotFrame {
  const tau = Math.max(0, t - FLY0);
  const swirl = 0.4 + tau * 1.15 + 0.5 * Math.sin(tau * 0.6);
  const pull = 0;
  const r = 6 + 9 * bump(Math.sin(tau * 0.8)) + 22 * bump(Math.sin(tau * 0.21 - 1)) ** 2 + pull * 70;
  const dy = 5 + 12 * Math.sin(tau * 0.5 + 0.5) + tau * 0.2 + pull * 30;
  return {
    pos: at(pad, Math.sin(swirl) * r, rise + 24 + dy, Math.cos(swirl) * r),
    aim: at(pad, 0, rise + 24 + speed * 0.12, 0),
    rate: 9,
    zoom: 1,
    shake: 0.012 * (1 - pull),
  };
}
const fly = (id: string, from: number): Shot => ({ id, from, frame: flyFrame });


/* ---- the separation sequence: from the gears inside the skirt out to the ring and beyond ---- */

const ease3 = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp3 = (a: Vec, b: Vec, k: number): Vec => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

interface Ring {
  /** Height of the cut above the stack base, and its radius. */
  y: number;
  r: number;
  /** +1 when the sequencer sits above the cut, -1 when below. */
  side: 1 | -1;
  /** Height of the burning engines being cut off. */
  flameY: number;
}
const RING_1: Ring = { y: 11.4, r: 1.6, side: 1, flameY: 4 };
const RING_2: Ring = { y: 20.6, r: 1.16, side: -1, flameY: 13 };

/** A point in a gear drive's own frame (x along the wall, y up, z inward), in world space. */
function drive(pad: Vec, rise: number, ring: Ring, a: number, x: number, y: number, z: number): Vec {
  const R = ring.r - 0.03;
  return [
    pad[0] + Math.sin(a) * R - Math.cos(a) * x - Math.sin(a) * z,
    pad[1] + rise + ring.y + ring.side * 0.5 + y,
    pad[2] + Math.cos(a) * R + Math.sin(a) * x - Math.cos(a) * z,
  ];
}

/** A point on the outside of the ring at angle `a`, `out` metres off the skin, `dy` above the cut. */
function outer(pad: Vec, rise: number, ring: Ring, a: number, out: number, dy: number): Vec {
  const R = ring.r + out;
  return [pad[0] + Math.sin(a) * R, pad[1] + rise + ring.y + dy, pad[2] + Math.cos(a) * R];
}

/**
 * One continuous move, inside to outside: it starts a hand's breadth from the gear train on the
 * inner wall, slides past it, goes out through the skin and keeps backing away while the view swings
 * round onto the ring and its hardware.
 */
function gearOut(from: number, ring: Ring) {
  const D = 3.4;
  const a = GEAR_STATIONS[0]!;
  return ({ pad, rise, t }: ShotContext): ShotFrame => {
    const u = clamp01((t - from) / D);
    const S = drive(pad, rise, ring, a, 0.02, 0.0, ring.r * 0.52);
    const X = drive(pad, rise, ring, a, 0.5, 0.05, -0.12);
    const E: Vec = [X[0] + Math.sin(a) * 5.5, X[1] + 1.6, X[2] + Math.cos(a) * 5.5];
    const pos = u < 0.55 ? lerp3(S, X, ease3(u / 0.55)) : lerp3(X, E, ease3((u - 0.55) / 0.45));
    const cluster = drive(pad, rise, ring, a, 0, 0, 0.12);
    const hardware = outer(pad, rise, ring, a + 0.5, 0.05, 0);
    const aim = lerp3(cluster, hardware, ease3(clamp01((u - 0.3) / 0.3)));
    return { pos, aim, rate: 200, zoom: u < 0.5 ? 1.25 : 1.3, shake: 0.012 };
  };
}

/** A close look at one piece of ring hardware from just off the skin. */
const hardwareShot = (id: string, from: number, ring: Ring, a: number, zoom = 1.7): Shot => ({
  id,
  from,
  frame: ({ pad, rise }) => ({
    pos: outer(pad, rise, ring, a - 0.55 / ring.r * 1.6, 1.9, 0.5),
    aim: outer(pad, rise, ring, a, 0.03, 0),
    rate: 200,
    zoom,
    shake: 0.02,
  }),
});

/** The shots of one separation, from the gear train out to the engines cutting off. */
function separationShots(prefix: string, T: number, ring: Ring): Shot[] {
  return [
    { id: `${prefix}-gears`, from: T - 7.3, frame: gearOut(T - 7.3, ring) },
    hardwareShot(`${prefix}-umbilical`, T - 3.9, ring, STATION.umbilical[0]),
    hardwareShot(`${prefix}-valve`, T - 3.5, ring, STATION.valve[0]),
    hardwareShot(`${prefix}-hook`, T - 3.1, ring, STATION.hook[0]),
    hardwareShot(`${prefix}-pins`, T - 2.7, ring, STATION.hook[0] + 0.2 / ring.r, 2.2),
    hardwareShot(`${prefix}-guide`, T - 2.3, ring, STATION.guidePin[0], 2.0),
    hardwareShot(`${prefix}-pushers`, T - 1.9, ring, STATION.pusher[0]),
    {
      // Looking up the plume as the engines cut off one after another.
      id: `${prefix}-cutoff`,
      from: T - 1.5,
      frame: ({ pad, rise }) => ({ pos: at(pad, 5.2, rise + ring.flameY + 3.5, 5.2), aim: at(pad, 0, rise + ring.flameY + 1, 0), rate: 30, zoom: 1.4, shake: 0.05 }),
    },
  ];
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
  roomFaces("room-faces", HOLD_DOWN - 0.25),
  {
    // Release: a low, wide angle from the far side of the tower as the stack clears the pad.
    id: "liftoff",
    from: HOLD_DOWN + 0.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, 16, 3.5, 34), aim: at(pad, 0, rise + 12, 0), rate: 6, zoom: 1, shake: 0.05 }),
  },
  crowdShot(CROWD_FIELD, FIELD_R, HOLD_DOWN + 2.0, "crowd-field", 2.3),
  {
    // Whip past the tower: the camera sits still, the rocket tears by.
    id: "tower",
    from: HOLD_DOWN + 3.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, 11, 4.5, 10), aim: at(pad, 0, rise + 8, 0), rate: 14, zoom: 1.25, shake: 0.03 }),
  },
  roomBacks("room-backs", HOLD_DOWN + 5.0),
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
    from: HOLD_DOWN + 11,
    frame: ({ pad, rise, speed }) => ({
      pos: at(pad, -24 - rise * 0.22, 5 + rise * 0.18, 43),
      aim: at(pad, 0, rise + speed / 5 + 17, 0),
      rate: 5,
      zoom: 1,
      shake: 0,
    }),
  },

  crowdShot(CROWD_BEACH, BEACH_R, HOLD_DOWN + 12.6, "crowd-beach", 2.0),

  /* ---- first separation: twenty operations, from the gears inside outward ---- */
  ...separationShots("sep1", SEPARATION_T, RING_1),
  {
    // Staging: very tight on the ring as the charge fires and the shock ring flashes out.
    id: "staging",
    from: SEPARATION_T - 0.7,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.6, rise + 13.4, 3.4), aim: at(pad, 0.4, rise + 11.9, 0), rate: 26, zoom: 1.9, shake: 0.04 }),
  },
  // The petals unfold: an orbit the other way, the spent stage sliding off underneath.
  {
    // Macro on the retro-rockets: eight small motors on the skirt, firing to push the stage back.
    id: "retros",
    from: SEPARATION_T + 0.4,
    frame: ({ pad, rise, t }) => {
      const p = spent1(t);
      return { pos: at(pad, 3.4, rise + 6.2, 3.4), aim: at(pad, 1.4, p.rise + 4.6, 0.6), rate: 24, zoom: 2.2, shake: 0.03 };
    },
  },
  {
    // The five engines of stage 2, uncovered.
    id: "ullage",
    from: SEPARATION_T + 0.95,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.2, rise + 11.8, 3.4), aim: at(pad, 1.1, rise + 13.3, 1.1), rate: 22, zoom: 2.0, shake: 0.02 }),
  },
  {
    // Ignition of stage 2 from the side, held a beat so the flame blooms.
    id: "ignite",
    from: STAGE2_T - 0.1,
    frame: ({ pad, rise }) => ({ pos: at(pad, 8, rise + 9, 11), aim: at(pad, 0, rise + 13, 0), rate: 14, zoom: 1.3, shake: 0.03 }),
  },
  roomFaces("room-faces-2", STAGE2_T + 0.9, -3.4),
  {
    // Looking down on the spent first stage as it tumbles into the distance.
    id: "fall",
    from: STAGE2_T + 1.8,
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
    from: STAGE2_T + 4.4,
    frame: ({ pad, rise, speed }) => ({ pos: at(pad, -70, 12, 95), aim: at(pad, 0, rise + speed / 6 + MID, 0), rate: 4, zoom: 1, shake: 0 }),
  },

  {
    // The interstage ring cuts: a shaped charge round the skin, then the skirt falls away.
    id: "inter-cut",
    from: INTER_T - 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.0, rise + 14.4, 2.6), aim: at(pad, 0.4, rise + 13.6, 0), rate: 26, zoom: 2.2, shake: 0.04 }),
  },
  {
    // Endoscope view from underneath: up inside the open skirt at the five J-2 bells.
    id: "inside-bells",
    from: INTER_T + 0.3,
    frame: ({ pad, rise, t }) => {
      const a = (t - INTER_T) * 0.8;
      return { pos: at(pad, Math.sin(a) * 1.0, rise + 11.6, Math.cos(a) * 1.0), aim: at(pad, 0, rise + 14.2, 0), rate: 30, zoom: 2.4, shake: 0.03 };
    },
  },

  crowdShot(CROWD_FIELD, FIELD_R, LES_T - 1.5, "crowd-field-2", 1.5),

  /* ---- the escape tower ---- */
  {
    id: "tower-bolts",
    from: LES_T - 1.0,
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
    from: LES_T + 3.0,
    frame: ({ pad, rise, speed }) => ({
      pos: at(pad, 26 + rise * 0.2, 5 + rise * 0.18, 43),
      aim: at(pad, 0, rise + speed / 5 + 17, 0),
      rate: 5,
      zoom: 1,
      shake: 0,
    }),
  },

  /* ---- second separation ---- */
  ...separationShots("sep2", SEP2_T, RING_2),
  {
    id: "staging-2",
    from: SEP2_T - 0.7,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.2, rise + 20.7, 3), aim: at(pad, 0.3, rise + 19.3, 0), rate: 26, zoom: 1.9, shake: 0.04 }),
  },
  {
    id: "retros-2",
    from: SEP2_T + 0.4,
    frame: ({ pad, rise, t }) => {
      const p = spent2(t);
      return { pos: at(pad, 3.2, rise + 20.6, 3.0), aim: at(pad, 1.1, p.rise + 18.5, 1.1), rate: 24, zoom: 2.2, shake: 0.03 };
    },
  },
  {
    // Up the throat of the third stage as its nozzle extension telescopes out.
    id: "s4b-bell",
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

  {
    // Instrument unit macro: a tight low orbit round the guidance ring, LEDs blinking, coolant lines.
    id: "iu-macro",
    from: STAGE3_T + 1.1,
    frame: ({ pad, rise, t }) => {
      const a = 0.6 + (t - STAGE3_T) * 0.9;
      return { pos: at(pad, Math.sin(a) * 1.9, rise + 24.0, Math.cos(a) * 1.9), aim: at(pad, 0, rise + 24.0, 0), rate: 30, zoom: 2.2, shake: 0.02 };
    },
  },

  /* ---- the adapter opens ---- */
  {
    id: "adapter-bolts",
    from: ADAPTER_T - 0.9,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3.2, rise + 26.2, 3), aim: at(pad, 0.2, rise + 24.6, 0), rate: 26, zoom: 1.8, shake: 0.03 }),
  },
  { id: "adapter-hinge", from: ADAPTER_T + 0.4, frame: orbit(ADAPTER_T + 0.4, ADAPTER, 7.5, 1, 0.4, 0.55, 1.2, 0.015, 12) },
  {
    // Pull back and rise: the lander, and the panels spinning away from it.
    id: "lander",
    from: ADAPTER_T + 2.4,
    frame: ({ pad, rise, t }) => {
      const k = Math.min(1, (t - ADAPTER_T - 2.4) / 3);
      return { pos: at(pad, -10 - k * 18, rise + 24 + k * 10, 20 + k * 22), aim: at(pad, 0, rise + ADAPTER, 0), rate: 9, zoom: 1.1, shake: 0 };
    },
  },
  /* ---- the long chase out of the atmosphere, cut with the people waiting for it ---- */
  fly("fly-1", FLY0),
  roomFaces("room-faces-3", FLY0 + 2.3, 3.4),
  fly("fly-2", FLY0 + 3.1),
  crowdShot(CROWD_BEACH, BEACH_R, FLY0 + 6.0, "crowd-beach-2", 1.5),
  fly("fly-3", FLY0 + 6.9),
  roomBacks("room-backs-3", CUTOFF_T - 1.6, 2.4),

  /* ---- engine off, then the transposition and docking ---- */
  {
    // The third stage falls silent: up the bell from below as the flame dies.
    id: "engine-off",
    from: CUTOFF_T - 1.0,
    frame: ({ pad, rise }) => ({ pos: at(pad, 4, rise + 14, 5.5), aim: at(pad, 0, rise + 20.5, 0), rate: 14, zoom: 1.4, shake: 0.01 }),
  },
  {
    // The bolts between the service module and the stage.
    id: "csm-bolts",
    from: CSM_SEP_T - 0.6,
    frame: ({ pad, rise }) => ({ pos: at(pad, 3, rise + 28.6, 3.5), aim: at(pad, 0, rise + 27.3, 0), rate: 26, zoom: 1.9, shake: 0.02 }),
  },
  {
    // The capsule pulls away, thrusters flickering.
    id: "csm-pull",
    from: CSM_SEP_T + 1.0,
    frame: ({ pad, rise, t }) => {
      const p = csmPose(t);
      return { pos: at(pad, -13, rise + CSM_Y + 4, 17), aim: at(pad, p.dx, rise + CSM_Y + p.dy, 0), rate: 10, zoom: 1.2, shake: 0 };
    },
  },
  {
    // The turn, from the side: the whole ship swinging end for end.
    id: "flip-1",
    from: FLIP_FROM,
    frame: ({ pad, rise, t }) => {
      const p = csmPose(t);
      const a = 0.8 + (t - FLIP_FROM) * 0.7;
      return { pos: at(pad, p.dx + Math.sin(a) * 13, rise + CSM_Y + p.dy + 2, Math.cos(a) * 13), aim: at(pad, p.dx, rise + CSM_Y + p.dy, 0), rate: 16, zoom: 1.3, shake: 0.008 };
    },
  },
  roomFaces("room-faces-4", FLIP_FROM + 1.7, -3.4),
  {
    // Low, from beside the stage, looking up past the lander at the ship turning against the Earth.
    id: "flip-2",
    from: FLIP_FROM + 2.4,
    frame: ({ pad, rise, t }) => {
      const p = csmPose(t);
      return { pos: at(pad, 7, rise + 16, 9), aim: at(pad, p.dx, rise + CSM_Y + p.dy, 0), rate: 12, zoom: 1.2, shake: 0.006 };
    },
  },
  crowdShot(CROWD_FIELD, FIELD_R, FLIP_TO - 0.9, "crowd-field-3", 1.6),
  {
    // Coming back nose first, the lander waiting below it.
    id: "approach",
    from: FLIP_TO - 0.2,
    frame: ({ pad, rise, t }) => {
      const p = csmPose(t);
      return { pos: at(pad, 6, rise + 20, 8), aim: at(pad, p.dx * 0.5, rise + (CSM_Y + p.dy + 27) / 2, 0), rate: 10, zoom: 1.3, shake: 0.006 };
    },
  },
  {
    // Contact: the probe, the latches, the ring.
    id: "dock-macro",
    from: DOCK_T - 1.4,
    frame: ({ pad, rise }) => ({ pos: at(pad, 2.6, rise + 28.1, 3.2), aim: at(pad, 0, rise + 27.4, 0), rate: 22, zoom: 2.0, shake: 0.008 }),
  },
  {
    id: "dock-wide",
    from: DOCK_T + 0.6,
    frame: ({ pad, rise, t }) => {
      const a = 2.5 - (t - DOCK_T) * 0.5;
      return { pos: at(pad, Math.sin(a) * 17, rise + 30, Math.cos(a) * 17), aim: at(pad, 0, rise + 27.4, 0), rate: 12, zoom: 1.2, shake: 0 };
    },
  },
  {
    // Towing the lander out of the spent stage.
    id: "tow",
    from: TOW_T + 0.6,
    frame: ({ pad, rise, t }) => {
      const k = towOffset(t);
      const a = 0.5 + (t - TOW_T) * 0.45;
      return { pos: at(pad, Math.sin(a) * 15, rise + 25 + k * 0.6, Math.cos(a) * 15), aim: at(pad, 0, rise + 27.4 + k, 0), rate: 12, zoom: 1.2, shake: 0 };
    },
  },
  roomFaces("room-cheer", FILM_END - 4.2, 0),
  crowdShot(CROWD_FIELD, FIELD_R, FILM_END - 3.2, "crowd-cheer", 1.4),
  {
    // Final wide: far back and high over the Earth, the ship small and silver against it all.
    id: "final-wide",
    from: FILM_END - 2.2,
    frame: ({ pad, rise, t }) => {
      const k = Math.min(1, (t - (FILM_END - 2.2)) / 3);
      return { pos: at(pad, -30 - k * 60, rise + 22 + k * 40, 40 + k * 60), aim: at(pad, 0, rise + 28 + towOffset(t), 0), rate: 6, zoom: 1, shake: 0 };
    },
  },

  /* ---- epilogue: the quiet after the last step, inside the capsule, the Earth in the window ---- */
  {
    // The window and the limb of the planet; the camera drifts like a floating head.
    id: "cabin-limb",
    from: CABIN_FROM,
    frame: ({ pad, rise, t }) => {
      const k = Math.min(1, (t - CABIN_FROM) / 5);
      const eye = rise + cabinEyeY(t);
      return {
        pos: at(pad, Math.sin(t * 0.37) * 0.04, eye + Math.sin(t * 0.29) * 0.025, -0.12 + k * 0.1),
        aim: at(pad, 0.05 - k * 0.05, eye - 0.16 - k * 0.1, WINDOW_Z_AIM),
        rate: 400, // the ship coasts upward at 30 m/s: a slow aim would trail it
        zoom: 1,
        shake: 0,
      };
    },
  },
  {
    // Leaning in to the glass: nothing but the Earth, slowly turning.
    id: "cabin-earth",
    from: FILM_END + 7.4,
    frame: ({ pad, rise, t }) => {
      const k = Math.min(1, (t - (FILM_END + 7.4)) / 6);
      const eye = rise + cabinEyeY(t);
      return {
        pos: at(pad, Math.sin(t * 0.31) * 0.03, eye + Math.sin(t * 0.23) * 0.02, -0.02 + k * 0.5),
        aim: at(pad, 0.12 * k, eye - 0.1 - 0.08 * k, WINDOW_Z_AIM),
        rate: 400, // the ship coasts upward at 30 m/s: a slow aim would trail it
        zoom: 1.1,
        shake: 0,
      };
    },
  },
];

/** The shot playing `t` seconds after ignition. */
export function shotAt(t: number): Shot {
  let current = SHOTS[0]!;
  for (const s of SHOTS) if (t >= s.from) current = s;
  return current;
}
