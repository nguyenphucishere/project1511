import type { Viewpoint, Vec3 } from "@/game/sceneStore";
import { DESCENT_STEPS, KEYFRAMES, missionTimeAt } from "@/mocks/descent";
import type { SiteId } from "./flight";

/**
 * Scene 4 metrics, in metres. The astronaut stands (as lander crews did) at a small window with
 * the descent console below it. Outside is not to scale: real altitude is mapped onto a short
 * visual drop (log scale), so 15 km and the last 2 m are both readable through the window.
 */
export const EYE: Vec3 = [0, 1.6, 0.3];
export const CABIN = { minX: -1.6, maxX: 1.6, front: -1.2, back: 1.4, height: 2.6 } as const;
export const WINDOW = { minX: -1.15, maxX: 1.15, bottom: 1.0, top: 2.4 } as const;

/** Console: a sloped panel under the window holding the four descent switches. */
export const CONSOLE = { y: 0.75, z: -0.8, tilt: -0.75, width: 1.9, depth: 0.55 } as const;

const SWITCH_SPACING = 0.42;
export function switchPosition(i: number): Vec3 {
  const x = (i - (DESCENT_STEPS.length - 1) / 2) * SWITCH_SPACING;
  return [x, CONSOLE.y + 0.07, CONSOLE.z + 0.04];
}

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: "window",
    label: { en: "the lander window", vi: "cửa sổ tàu đổ bộ" },
    position: EYE,
    yaw: 0,
    pitch: -0.22,
    yawRange: 0.5,
    pitchRange: 0.35,
  },
];

/** Visual height of the eye above the ground for a real altitude (m). Touchdown leaves the legs. */
export function visualAltitude(altM: number): number {
  return 3 + (45 * Math.log10(1 + altM / 20)) / Math.log10(1 + KEYFRAMES[0].altM / 20);
}

/** Visual distance (ahead of the lander) to the landing site, shrinking with altitude. */
export function visualRange(altM: number): number {
  // Shallow enough that the aim point stays above the window sill until the last metres.
  return 3.4 * (visualAltitude(altM) - 3);
}

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Before the pitch-over the lander leans back: the window shows the horizon, not the ground. */
export function tiltAt(t: number): number {
  return -0.15 * (1 - smooth(KEYFRAMES[1].t, KEYFRAMES[1].t + 60, t));
}

/**
 * The descent clock for the scripted part (steps 0 and 1). `stepsDone` controls pressed so far;
 * the segment that the last press started began at `segmentStart` (performance.now()).
 */
export interface DescentClock {
  stepsDone: number;
  segmentStart: number | null;
}

export function missionTimeNow(clock: DescentClock, now = performance.now()): number {
  if (clock.stepsDone === 0 || clock.segmentStart === null) return 0;
  return missionTimeAt(clock.stepsDone - 1, (now - clock.segmentStart) / 1000);
}

/**
 * What the 3D world draws this frame. A plain mutable object written by the scene every frame
 * (scripted profile, then the flight model) and only read by the world: it changes 60 times a
 * second and nothing re-renders on it.
 */
export interface FlightView {
  /** Mission time, s since powered descent. */
  t: number;
  altM: number;
  vsMs: number;
  /** Sideways position of the lander relative to the aim point, m. */
  xM: number;
  hsMs: number;
  throttle: number;
  rcs: -1 | 0 | 1;
  /** Backward lean of the lander before the pitch-over, rad. */
  tilt: number;
  fuelPct: number;
  engineOn: boolean;
  /** Controls already thrown (0-3). */
  stepsDone: number;
  contact: boolean;
  /** The pilot is flying the final descent. */
  manual: boolean;
  /** Candidate sites are marked on the ground (from the low gate on). */
  showSites: boolean;
  /** The site the pilot picked (highlighted on the ground). */
  siteId: SiteId | null;
  /** performance.now() of the touchdown, or null in flight. */
  touchdownAt: number | null;
  crashed: boolean;
}

export function initialView(): FlightView {
  return {
    t: 0,
    altM: KEYFRAMES[0].altM,
    vsMs: 0,
    xM: 0,
    hsMs: 0,
    throttle: 0,
    rcs: 0,
    tilt: tiltAt(0),
    fuelPct: KEYFRAMES[0].fuelPct,
    engineOn: false,
    stepsDone: 0,
    contact: false,
    manual: false,
    showSites: false,
    siteId: null,
    touchdownAt: null,
    crashed: false,
  };
}
