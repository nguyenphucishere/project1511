import { STAGE2_IGNITION_SEC, STAGING_SEC, STRETCH, realSecondsAt } from "./flight";

/**
 * Visual ascent of the 3D rocket, in real seconds after ignition and metres above the pad.
 * Not physics: tuned so the stack reads as heavy at liftoff, staging is easy to see, and the
 * upper stage stays inside the sky dome until orbit insertion.
 */

/** Engines build up on the clamps before release. */
export const HOLD_DOWN = 1.2 * STRETCH;
/** Stage 1 climb acceleration (m/s²). */
// Accelerations scale with 1/STRETCH² so the heights reached stay the same over the longer time.
const CLIMB = 3.5 / (STRETCH * STRETCH);
/** Upper stage acceleration once its engine lights (m/s²): lighter, but a smaller engine. */
const STAGE2_ACCEL = 2.2 / (STRETCH * STRETCH);

/** Real seconds after ignition when stage 1 drops away and when stage 2 lights. */
export const SEPARATION_T = realSecondsAt(STAGING_SEC);
export const STAGE2_T = realSecondsAt(STAGE2_IGNITION_SEC);

const SEP_CLIMB = SEPARATION_T - HOLD_DOWN;
const SEP_RISE = 0.5 * CLIMB * SEP_CLIMB * SEP_CLIMB;
const SEP_SPEED = CLIMB * SEP_CLIMB;
const IGN2_RISE = SEP_RISE + SEP_SPEED * (STAGE2_T - SEPARATION_T);

/** Height (m) of the stack's base above the pad, `t` real seconds after ignition. */
export function rocketRise(t: number): number {
  if (t <= HOLD_DOWN) return 0;
  if (t <= SEPARATION_T) {
    const c = t - HOLD_DOWN;
    return 0.5 * CLIMB * c * c;
  }
  if (t <= STAGE2_T) return SEP_RISE + SEP_SPEED * (t - SEPARATION_T);
  const b = t - STAGE2_T;
  return IGN2_RISE + SEP_SPEED * b + 0.5 * STAGE2_ACCEL * b * b;
}

/** Upward speed (m/s) at `t`. */
export function rocketSpeed(t: number): number {
  if (t <= HOLD_DOWN) return 0;
  if (t <= SEPARATION_T) return CLIMB * (t - HOLD_DOWN);
  if (t <= STAGE2_T) return SEP_SPEED;
  return SEP_SPEED + STAGE2_ACCEL * (t - STAGE2_T);
}

/** Pull of "gravity plus drag" on the spent stage once it's free (m/s²). */
const SPENT_FALL = 11 / (STRETCH * STRETCH);

/**
 * The spent first stage after separation: keeps its upward speed, slows, and falls back,
 * drifting sideways and tumbling. `tau` is seconds since separation.
 */
export function spentStagePose(tau: number): { rise: number; drift: number; tumble: number } {
  return {
    rise: SEP_RISE + SEP_SPEED * tau - 0.5 * SPENT_FALL * tau * tau,
    drift: (0.9 * tau * tau) / (STRETCH * STRETCH),
    tumble: (0.22 * tau * tau) / (STRETCH * STRETCH),
  };
}
