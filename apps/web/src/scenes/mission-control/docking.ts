import { CSM_SEP_T, DOCK_T, FILM_END, FLIP_FROM, FLIP_TO, TOW_T } from "./ascent";

/**
 * The transposition and docking manoeuvre, as pure maths so it can be tested and filmed.
 * The command and service modules pull ahead of the spent third stage, turn the whole ship end
 * for end while rolling and swinging out wide, come back nose first and dock with the lander that
 * has been sitting inside the adapter, then tow it out of the stage. Offsets are relative to where
 * the capsule sat on the stack; metres and radians.
 */

/** Height of the capsule's centre on the stack, and the lander's centre. */
export const CSM_Y = 29.4;
export const LM_Y = 25.6;

/** How far ahead the capsule pulls before it turns. */
const AHEAD = 15;
/** Where it ends up once docked: a hair below its starting height, nose on the lander's drogue. */
const DOCKED = -0.7;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (k: number) => k * k * (3 - 2 * k);

export interface CsmPose {
  /** Along the stack (up is away from the stage) and sideways. */
  dy: number;
  dx: number;
  /** Turn end for end, and roll about its own axis. */
  pitch: number;
  roll: number;
  /** 0..1: thrusters firing (separation, braking, towing). */
  thrust: number;
}

export function csmPose(t: number): CsmPose {
  const sep = ease(clamp01((t - CSM_SEP_T) / (FLIP_FROM - CSM_SEP_T)));
  const flip = ease(clamp01((t - FLIP_FROM) / (FLIP_TO - FLIP_FROM)));
  const back = ease(clamp01((t - FLIP_TO) / (DOCK_T - FLIP_TO)));
  const dy = AHEAD * sep * (1 - back) + DOCKED * back + towOffset(t);
  const dx = 5 * Math.sin(Math.PI * flip) * (1 - back);
  const firing =
    (t > CSM_SEP_T && t < CSM_SEP_T + 0.7) ||
    (t > FLIP_FROM && t < FLIP_TO && Math.sin((t - FLIP_FROM) * 9) > 0.2) ||
    (t > DOCK_T - 1.4 && t < DOCK_T - 0.6) ||
    (t > TOW_T && t < TOW_T + 1.2);
  return { dy, dx, pitch: Math.PI * flip, roll: Math.PI * 2 * flip, thrust: firing ? 1 : 0 };
}

/** How far the docked pair has been towed out of the stage. */
export function towOffset(t: number): number {
  const k = Math.max(0, t - TOW_T);
  return Math.min(22, 0.5 * 1.1 * k * k);
}

/** When the cabin is built into the scene (the film has left the outside views). */
export const CABIN_FROM = FILM_END + 2.2;

/** The cabin eye's height on the stack at film time `t` (the command module's centre, flipped). */
export const cabinEyeY = (t: number) => CSM_Y + csmPose(t).dy - 1.0;
