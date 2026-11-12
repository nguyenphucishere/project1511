import type { Viewpoint, Vec3, WalkArea } from "@/game/sceneStore";
import type { StationId } from "@/mocks/vitals";

/**
 * Scene 1 metrics, in metres. Eye height and the room are sized so that from the "inside"
 * viewpoint all three stations sit within the allowed look range: nothing to hunt for.
 */
export const EYE = 1.65;
export const ROOM = { width: 6.4, depth: 7, height: 2.9, frontZ: 2.5 } as const;
export const DOOR = { width: 1.6, height: 2.3 } as const;
export const BACK_Z = ROOM.frontZ - ROOM.depth; // -4.5

/** WASD walkable floor. The door is at frontZ, so the corridor stops short of it. */
const CORRIDOR_WALK: WalkArea = { bounds: { minX: -1.4, maxX: 1.4, minZ: ROOM.frontZ + 0.7, maxZ: ROOM.frontZ + 4.8 } };
const BAY_WALK: WalkArea = {
  bounds: { minX: -ROOM.width / 2 + 0.1, maxX: ROOM.width / 2 - 0.1, minZ: BACK_Z + 0.2, maxZ: ROOM.frontZ - 0.35 },
  blockers: [
    { minX: -2.35, maxX: -1.45, minZ: BACK_Z + 0.45, maxZ: BACK_Z + 2.4 }, // exam bed
    { minX: -2.9, maxX: -1.7, minZ: -1.8, maxZ: -0.6 }, // heart station
    { minX: 1.7, maxX: 2.9, minZ: -2.0, maxZ: -0.8 }, // pressure station
    { minX: -0.8, maxX: 0.8, minZ: BACK_Z, maxZ: BACK_Z + 0.9 }, // vision chart
  ],
};

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: "corridor",
    label: { en: "the corridor", vi: "hành lang" },
    position: [0.2, EYE, 5.6],
    yaw: 0,
    pitch: -0.05,
    yawRange: 0.7,
    pitchRange: 0.45,
    walk: CORRIDOR_WALK,
  },
  {
    id: "inside",
    label: { en: "the medical bay", vi: "phòng y tế" },
    position: [0, EYE, 1.1],
    yaw: 0,
    pitch: -0.12,
    yawRange: 1.25,
    pitchRange: 0.6,
    walk: BAY_WALK,
  },
];

/** Where each station stands (floor position) and how high its marker floats. */
export const STATIONS: Record<StationId, { position: Vec3; rotationY: number; marker: number }> = {
  heart: { position: [-2.3, 0, -1.2], rotationY: Math.PI / 2.6, marker: 1.95 },
  pressure: { position: [2.3, 0, -1.4], rotationY: -Math.PI / 2.6, marker: 1.6 },
  vision: { position: [0, 0, BACK_Z + 0.05], rotationY: 0, marker: 2.45 },
};

export const DOOR_PANEL: Vec3 = [1.08, 1.25, ROOM.frontZ + 0.08];
export const CORRIDOR_LENGTH = 5;
