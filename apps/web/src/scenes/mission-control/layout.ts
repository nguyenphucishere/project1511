import type { Viewpoint, Vec3, WalkArea } from "@/game/sceneStore";

/**
 * Scene 3 metrics, in metres. The flight director sits on the raised back tier of the control
 * room; the room is on a high floor, so the pad (kilometres away in story, 85 m here) sits below the
 * horizon line, framed by the big window above the front row of consoles.
 */
const EYE_Y = 2.6;
export const TIER = { y: 1.4, frontZ: 1.0 } as const;
export const ROOM = { minX: -6.5, maxX: 6.5, minZ: -4, maxZ: 5, height: 4.8 } as const;
export const WINDOW = { minX: -5.5, maxX: 5.5, bottom: 0.6, top: 4.3 } as const;

/** Outside: ground level relative to the room floor, and the pad position. */
export const GROUND_Y = -14;
export const PAD: Vec3 = [5, GROUND_Y, -85];
export const ROCKET_HEIGHT = 38;

/**
 * Launch view: outside on the grass, ~50 m from the pad and a few metres up, so the whole stack
 * and the umbilical tower beside it fill the frame from a low, heroic angle.
 */
export const LAUNCH_VANTAGE: Vec3 = [-24, GROUND_Y + 5, -42];

/** Where the onlookers stand: the public viewing field, and the beach down the coast. */
export const CROWD_FIELD: Vec3 = [-27, GROUND_Y, -38];
export const CROWD_BEACH: Vec3 = [-46, GROUND_Y + 0.02, -150];
export const FIELD_R = 7;
export const BEACH_R = 9;

const EYE: Vec3 = [0, EYE_Y, 2.4];

/** Standing eye height above whichever floor the player is on: main floor or the raised back tier. */
const STAND = 1.65;
const CONTROL_ROOM_WALK: WalkArea = {
  bounds: { minX: ROOM.minX + 0.4, maxX: ROOM.maxX - 0.4, minZ: ROOM.minZ + 0.9, maxZ: ROOM.maxZ - 0.4 },
  // The three console desks (and the seated controllers behind them): gaps between them are walkable.
  blockers: [
    { minX: -4.9, maxX: -1.9, minZ: -2.2, maxZ: -0.35 },
    { minX: -1.5, maxX: 1.5, minZ: -2.2, maxZ: -0.35 },
    { minX: 1.9, maxX: 4.9, minZ: -2.2, maxZ: -0.35 },
  ],
  eyeHeight: (_x, z) => (z > TIER.frontZ ? TIER.y + STAND : STAND),
  speed: 2.6,
};

export const VIEWPOINTS: Viewpoint[] = [
  {
    id: "console",
    label: { en: "the flight director's console", vi: "bàn điều khiển của chỉ huy bay" },
    position: EYE,
    // Rest on the rocket's middle so it sits in the window at the start.
    yaw: Math.atan2(-(PAD[0] - EYE[0]), -(PAD[2] - EYE[2])),
    pitch: Math.atan2(PAD[1] + ROCKET_HEIGHT * 0.45 - EYE[1], Math.hypot(PAD[0] - EYE[0], PAD[2] - EYE[2])),
    yawRange: 0.6,
    pitchRange: 0.4,
    walk: CONTROL_ROOM_WALK,
  },
];
