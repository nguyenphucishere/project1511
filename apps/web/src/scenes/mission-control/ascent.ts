import {
  ADAPTER_SEC,
  LES_SEC,
  STAGE2_IGNITION_SEC,
  STAGE2_SEP_SEC,
  STAGE3_IGNITION_SEC,
  STAGING_SEC,
  STRETCH,
  realSecondsAt,
} from "./flight";

/**
 * Visual ascent of the 3D rocket, in real seconds after ignition and metres above the pad.
 * Not physics: tuned so the stack reads as heavy at liftoff, every separation is easy to see, and
 * the upper stage stays inside the sky dome until orbit insertion.
 *
 * Three stages: stage 1 burns to SEPARATION_T, stage 2 lights at STAGE2_T, the escape tower leaves
 * at LES_T, stage 2 drops away at SEP2_T, stage 3 lights at STAGE3_T and the spacecraft adapter
 * panels open at ADAPTER_T.
 */

/** Engines build up on the clamps before release. */
export const HOLD_DOWN = 1.2 * STRETCH;

export const SEPARATION_T = realSecondsAt(STAGING_SEC);
export const STAGE2_T = realSecondsAt(STAGE2_IGNITION_SEC);
export const LES_T = realSecondsAt(LES_SEC);
export const SEP2_T = realSecondsAt(STAGE2_SEP_SEC);
export const STAGE3_T = realSecondsAt(STAGE3_IGNITION_SEC);
export const ADAPTER_T = realSecondsAt(ADAPTER_SEC);

/** Accelerations (m/s²) while each stage burns: slow and heavy, like a film. */
const A1 = 1.0;
const A2 = 0.45;
const A3 = 0.4;

/** Phases of the climb, each starting at the speed and height the last one ended with. */
const SEGMENTS = (() => {
  const list: { t0: number; accel: number; rise: number; speed: number }[] = [];
  const phases: [number, number][] = [
    [HOLD_DOWN, A1],
    [SEPARATION_T, 0], // coasting between the stages
    [STAGE2_T, A2],
    [SEP2_T, 0],
    [STAGE3_T, A3],
  ];
  let rise = 0;
  let speed = 0;
  for (let i = 0; i < phases.length; i++) {
    const [t0, accel] = phases[i]!;
    list.push({ t0, accel, rise, speed });
    const dt = (phases[i + 1]?.[0] ?? t0) - t0;
    rise += speed * dt + 0.5 * accel * dt * dt;
    speed += accel * dt;
  }
  return list;
})();

function segmentAt(t: number) {
  let seg = SEGMENTS[0]!;
  for (const s of SEGMENTS) if (t >= s.t0) seg = s;
  return seg;
}

/** Height (m) of the stack's base above the pad, `t` real seconds after ignition. */
export function rocketRise(t: number): number {
  if (t <= HOLD_DOWN) return 0;
  const s = segmentAt(t);
  const dt = t - s.t0;
  return s.rise + s.speed * dt + 0.5 * s.accel * dt * dt;
}

/** Upward speed (m/s) at `t`. */
export function rocketSpeed(t: number): number {
  if (t <= HOLD_DOWN) return 0;
  const s = segmentAt(t);
  return s.speed + s.accel * (t - s.t0);
}

export interface DetachedPose {
  rise: number;
  drift: number;
  tumble: number;
}

/**
 * A spent stage after it separates at `sepT`: keeps its upward speed, slows and falls back,
 * drifting sideways and tumbling. `tau` is seconds since separation.
 */
export function detachedPose(sepT: number, tau: number, { fall = 2, drift = 0.25, tumble = 0.05 } = {}): DetachedPose {
  return {
    rise: rocketRise(sepT) + rocketSpeed(sepT) * tau - 0.5 * fall * tau * tau,
    drift: drift * tau * tau,
    tumble: tumble * tau * tau,
  };
}

/** The spent first stage (kept for callers that predate the later stages). */
export const spentStagePose = (tau: number) => detachedPose(SEPARATION_T, tau);

/** How long the first and second stages stay drawn after they separate. */
export const SPENT_VISIBLE = 12;
