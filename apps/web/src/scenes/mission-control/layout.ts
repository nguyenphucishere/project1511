import type { Viewpoint, Vec3 } from "@/game/sceneStore";

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
export const ROCKET_HEIGHT = 30;

const EYE: Vec3 = [0, EYE_Y, 2.4];

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
  },
];
