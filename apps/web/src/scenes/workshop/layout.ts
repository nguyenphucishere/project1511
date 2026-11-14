import type { Viewpoint, Vec3, WalkArea } from "@/game/sceneStore";
import type { LevelId, PartId } from "@/mocks/rocket-parts";

/**
 * Scene 2 metrics, in metres. The rocket stands on the origin; the player inspects it from the
 * hall floor and from two gantry balconies. Each balcony faces the rocket from about 6 m, so
 * the parts of that level fill the view at rest and nothing has to be hunted for.
 */
export const EYE = 1.65;
export const HALL = { minX: -20, maxX: 20, minZ: -16, maxZ: 18, height: 42 } as const;

/** Bottom and top (y) of each section of the stack, plus its radius at bottom and top. */
export const STACK = {
  mount: { y0: 0, y1: 1.05 },
  engines: { y0: 1.15, y1: 3.3, r: 1.75 },
  stage1: { y0: 3.3, y1: 12, r: 1.6 },
  interstage: { y0: 12, y1: 13.6, r0: 1.6, r1: 1.3 },
  stage2: { y0: 13.6, y1: 19.2, r: 1.3 },
  adapter: { y0: 19.2, y1: 22.2, r0: 1.3, r1: 1.0 },
  serviceModule: { y0: 22.2, y1: 24.2, r: 1.0 },
  capsule: { y0: 24.2, y1: 25.6, r0: 1.0, r1: 0.3 },
  tower: { y0: 25.6, y1: 29.6 },
} as const;

/** Yaw/pitch that look from one point at another (yaw 0 looks down -Z, positive turns left). */
function aim(from: Vec3, to: Vec3) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(to[1] - from[1], Math.hypot(dx, dz)) };
}

const FLOOR_EYE: Vec3 = [0, EYE, 13];
// Balconies sit on the 0.8/0.6 diagonals: 6.6 m out at level 2, 7.5 m at level 3 so the
// four spacecraft parts, lander to tower tip, all fit the resting view.
const L2_EYE: Vec3 = [-5.28, 13.95, 3.96];
const L3_EYE: Vec3 = [6.0, 22.9, 4.5];

/** Hall floor: free walking everywhere except the rocket mount and the two gantry tower bases. */
let floorWalkCache: WalkArea | undefined;
function floorWalk(): WalkArea {
  const tower = (level: "level2" | "level3") => {
    const [x, z] = towerCentre(level);
    return { minX: x - 1.5, maxX: x + 1.5, minZ: z - 1.5, maxZ: z + 1.5 };
  };
  return {
    bounds: { minX: HALL.minX + 1, maxX: HALL.maxX - 1, minZ: HALL.minZ + 1, maxZ: HALL.maxZ - 1 },
    blockers: [{ minX: -3.4, maxX: 3.4, minZ: -3.4, maxZ: 3.4 }, tower("level2"), tower("level3"), ...BAY.tanks],
    eyeHeight: () => EYE,
    speed: 3.2,
  };
}

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: "floor",
    label: { en: "the hall floor", vi: "sàn xưởng" },
    position: FLOOR_EYE,
    ...aim(FLOOR_EYE, [0, 6, 0]),
    yawRange: 0.75,
    pitchRange: 0.5,
    get walk() {
      return (floorWalkCache ??= floorWalk());
    },
  },
  {
    id: "level2",
    label: { en: "gantry level 2", vi: "tầng giàn 2" },
    position: L2_EYE,
    ...aim(L2_EYE, [0, 15.4, 0]),
    yawRange: 0.85,
    pitchRange: 0.55,
  },
  {
    id: "level3",
    label: { en: "gantry level 3", vi: "tầng giàn 3" },
    position: L3_EYE,
    ...aim(L3_EYE, [0, 24.3, 0]),
    yawRange: 0.85,
    pitchRange: 0.6,
  },
];

export const VIEWPOINT_BY_LEVEL = Object.fromEntries(VIEWPOINTS.map((v) => [v.id, v])) as Record<LevelId, Viewpoint>;

/* ------------------------------------------------------------------ crane stacking */

export type CraneViewId = "crane1" | "crane2" | "crane3";

/** The three lifts that build the rocket: bottom-to-top sections stacked on the first stage. */
export interface CraneLift {
  index: 0 | 1 | 2;
  view: CraneViewId;
  parts: PartId[];
  /** Underside of the section once it is seated. */
  seatY: number;
  /** Section height, so the crane knows how far below the hook the load hangs. */
  height: number;
  start: { x: number; z: number; y: number };
}

export const CRANE_LIFTS: CraneLift[] = [
  { index: 0, view: "crane1", parts: ["interstage", "stage2"], seatY: 12, height: 7.2, start: { x: -6.2, z: 3.8, y: 14.6 } },
  { index: 1, view: "crane2", parts: ["lander", "service-module"], seatY: 19.2, height: 5, start: { x: 6.4, z: -3.2, y: 21.8 } },
  { index: 2, view: "crane3", parts: ["crew-capsule", "escape-tower"], seatY: 24.2, height: 5.4, start: { x: -5.4, z: -3.6, y: 26.8 } },
];

const CRANE_EYE: Vec3 = [0, EYE, 16.8];
const CRANE_AIM = [14, 19.5, 24];

/** Fixed viewpoints that frame each lift from the hall floor; WASD drives the crane there, not the head. */
export const CRANE_VIEWPOINTS: Viewpoint[] = CRANE_LIFTS.map((l) => ({
  id: l.view,
  label: { en: "the crane control point", vi: "vị trí điều khiển cầu trục" },
  position: CRANE_EYE,
  ...aim(CRANE_EYE, [0, CRANE_AIM[l.index], 0]),
  yawRange: 0.1,
  pitchRange: 0.1,
}));

/** Standing just inside the fuel bay, facing the panel: the target of the "go to the fuel bay" hotspot. */
const BAY_EYE: Vec3 = [12.4, EYE, -7.6];
export const BAY_VIEWPOINT: Viewpoint = {
  id: "bay",
  label: { en: "the fuel bay", vi: "khu nhiên liệu" },
  position: BAY_EYE,
  ...aim(BAY_EYE, [16.5, 2.2, -7.6]),
  yawRange: 0.75,
  pitchRange: 0.5,
  get walk() {
    return VIEWPOINTS[0].walk;
  },
};

export const ALL_VIEWPOINTS: Viewpoint[] = [...VIEWPOINTS, ...CRANE_VIEWPOINTS, BAY_VIEWPOINT];

/* ------------------------------------------------------------------ checklist stations */

export interface StationSpot {
  id: "fuel" | "electrical" | "pressure";
  position: Vec3;
  rotationY: number;
}

/**
 * The fuel bay: a fenced zone against the east wall with the cryogenic tanks and the fuel panel.
 * `zone` is where the player counts as "inside"; `tanks` are footprints that block walking.
 */
export const BAY = {
  centre: [15.8, -7.6] as [number, number],
  zone: { minX: 11.8, maxX: 19, minZ: -13, maxZ: -2.2 },
  tanks: [
    { minX: 16.9, maxX: 19.1, minZ: -11.1, maxZ: -8.9 },
    { minX: 16.9, maxX: 19.1, minZ: -6.3, maxZ: -4.1 },
  ],
  /** How close (m) the player must stand to the fuel panel to use it. */
  reach: 7.5,
};

/** The torque bench and the interstage flange bolts of the tightening task. */
export const BENCH = { x: 2.6, z: 9.2 };
export const FLANGE = { y: 12.22, r: 1.74, count: 5, spread: 0.5 } as const;

/** Three consoles around the pad. Each faces the rocket. */
export const STATIONS: StationSpot[] = [
  { id: "fuel", position: [14.6, 0, -7.4], rotationY: -Math.PI / 2 },
  { id: "electrical", position: [-6.4, 0, 0.8], rotationY: Math.PI / 2 },
  { id: "pressure", position: [-6.2, 0, -6.0], rotationY: Math.PI / 4 },
];

/** Local (viewpoint-relative, yaw-rotated) offset to world. Local -Z is the resting view direction. */
export function toWorld(v: Viewpoint, local: Vec3): Vec3 {
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const [x, y, z] = local;
  return [v.position[0] + x * c + z * s, v.position[1] + y, v.position[2] - x * s + z * c];
}

/** Unit vector (x, z) from the rocket axis toward a level's eye: markers sit on that side. */
function facing(level: LevelId): [number, number] {
  const [x, , z] = VIEWPOINT_BY_LEVEL[level].position;
  const n = Math.hypot(x, z);
  return [x / n, z / n];
}

/** Angle around the axis (three.js cylinder theta) that faces a level's eye. */
export function facingTheta(level: LevelId): number {
  const [x, z] = facing(level);
  return Math.atan2(x, z);
}

/** Where each part's marker floats: just outside the hull, on the side the player sees. */
// `turn` swings a marker around the axis (radians) so it never sits dead centre on a part with
// windows: a centred diamond between two dark squares reads as a face.
const MARKER_AT: Record<PartId, { y: number; out: number; level: LevelId; turn?: number }> = {
  "stage1-engines": { y: 2.3, out: 2.15, level: "floor" },
  "stage1-tanks": { y: 8.2, out: 2.0, level: "floor" },
  interstage: { y: 12.8, out: 1.95, level: "level2" },
  stage2: { y: 16.6, out: 1.7, level: "level2" },
  lander: { y: 20.7, out: 1.6, level: "level3" },
  "service-module": { y: 23.2, out: 1.4, level: "level3" },
  "crew-capsule": { y: 24.9, out: 0.95, level: "level3", turn: -0.75 },
  "escape-tower": { y: 28.2, out: 0.6, level: "level3" },
};

export function markerFor(id: PartId): Vec3 {
  const m = MARKER_AT[id];
  const theta = facingTheta(m.level) + (m.turn ?? 0);
  return [Math.sin(theta) * m.out, m.y, Math.cos(theta) * m.out];
}

/** Lift call panels: where each one stands and which level it goes to. */
export interface LiftStop {
  id: string;
  from: LevelId;
  to: LevelId;
  position: Vec3;
  rotationY: number;
  /** +1 if the lift goes up from here, -1 if down. */
  direction: 1 | -1;
}

const LEVEL_ORDER: LevelId[] = ["floor", "level2", "level3"];

/** Gantry tower footprint centre (x, z), 1.7 m behind a balcony's eye. */
export function towerCentre(level: "level2" | "level3"): [number, number] {
  const [x, , z] = toWorld(VIEWPOINT_BY_LEVEL[level], [0, 0, 1.7]);
  return [x, z];
}

function facePoint(from: Vec3, to: Vec3) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

function buildLifts(): LiftStop[] {
  const stops: LiftStop[] = [];
  const floor = VIEWPOINT_BY_LEVEL.floor;
  // Hall floor: one kiosk at the foot of each tower, on the side facing the player.
  for (const level of ["level2", "level3"] as const) {
    const [tx, tz] = towerCentre(level);
    const dx = floor.position[0] - tx;
    const dz = floor.position[2] - tz;
    const n = Math.hypot(dx, dz);
    const position: Vec3 = [tx + (dx / n) * 1.7, 0, tz + (dz / n) * 1.7];
    stops.push({ id: `lift-floor-${level}`, from: "floor", to: level, position, rotationY: facePoint(position, floor.position), direction: 1 });
  }
  // Balconies: a panel at each front corner, one per other level.
  for (const level of ["level2", "level3"] as const) {
    const v = VIEWPOINT_BY_LEVEL[level];
    const others = LEVEL_ORDER.filter((l) => l !== level);
    others.forEach((to, i) => {
      const position = toWorld(v, [i === 0 ? -1.15 : 1.15, -EYE, -1.25]);
      stops.push({
        id: `lift-${level}-${to}`,
        from: level,
        to,
        position,
        rotationY: facePoint(position, v.position),
        direction: LEVEL_ORDER.indexOf(to) > LEVEL_ORDER.indexOf(level) ? 1 : -1,
      });
    });
  }
  return stops;
}

export const LIFTS = buildLifts();
