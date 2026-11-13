import { MathUtils } from "three";

/**
 * Gantry-crane physics for the stacking minigame, kept free of React and three.js objects so it can
 * be tested. The crane drives the hook over the pad; the load swings under it like a pendulum, and
 * has to be settled over the rocket and eased down, not dropped.
 *
 * `y` is the height of the load's underside. Horizontal position of the load is the hook plus its swing.
 */
export interface CraneState {
  /** Hook (bridge x, trolley z) and its velocity. */
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Load offset under the hook (pendulum swing) and its rate. */
  sx: number;
  sz: number;
  svx: number;
  svz: number;
  /** Load underside height and its vertical speed (negative = going down). */
  y: number;
  vy: number;
  seated: boolean;
  /** Set while the load is held off the stack by a misalignment. */
  blocked: boolean;
}

export interface CraneInput {
  /** -1, 0, 1: bridge left/right and trolley back/forward. */
  moveX: number;
  moveZ: number;
  /** -1 lowers, 1 raises. */
  hoist: number;
}

export interface LiftSpec {
  id: string;
  /** Height of the load's underside once it sits on the stack. */
  seatY: number;
  /** Where the load starts, hovering high above the hall floor. */
  start: { x: number; z: number; y: number };
}

export type CraneEvent = "seated" | "hard-landing" | "blocked" | "unblocked";

export const CRANE = {
  maxSpeed: 2.4,
  accel: 3.2,
  brake: 4.2,
  /** Radius the load's centre must be within to enter the final approach. */
  tolerance: 0.4,
  /** Height above the seat where the load must already be aligned. */
  approach: 0.7,
  /** Descent speed above which touching down counts as a hard landing. */
  softLanding: 0.8,
  lowerAccel: 1.5,
  lowerMax: 2.0,
  raiseSpeed: 2.2,
  /** Cable length used for the swing period. */
  cable: 9,
  gravity: 9.81,
  swingDamping: 0.55,
  maxSwing: 1.4,
  ceiling: 31.5,
} as const;

export function createCrane(lift: LiftSpec): CraneState {
  return {
    x: lift.start.x,
    z: lift.start.z,
    vx: 0,
    vz: 0,
    sx: 0,
    sz: 0,
    svx: 0,
    svz: 0,
    y: lift.start.y,
    vy: 0,
    seated: false,
    blocked: false,
  };
}

/** Horizontal distance from the load's centre to the rocket axis. */
export function loadOffset(s: CraneState): number {
  return Math.hypot(s.x + s.sx, s.z + s.sz);
}

export function approachSpeed(s: CraneState): number {
  return Math.max(0, -s.vy);
}

/** Advances the crane by dt seconds. Mutates and returns the events that happened this step. */
export function stepCrane(s: CraneState, input: CraneInput, dt: number, lift: LiftSpec): CraneEvent[] {
  const events: CraneEvent[] = [];
  if (s.seated) return events;

  // Bridge and trolley: accelerate toward the input, brake when released.
  const target = (axis: number) => axis * CRANE.maxSpeed;
  const ax0 = s.vx;
  const az0 = s.vz;
  s.vx = chase(s.vx, target(input.moveX), input.moveX ? CRANE.accel : CRANE.brake, dt);
  s.vz = chase(s.vz, target(input.moveZ), input.moveZ ? CRANE.accel : CRANE.brake, dt);
  const ax = (s.vx - ax0) / Math.max(dt, 1e-4);
  const az = (s.vz - az0) / Math.max(dt, 1e-4);
  s.x = MathUtils.clamp(s.x + s.vx * dt, -9, 9);
  s.z = MathUtils.clamp(s.z + s.vz * dt, -7, 7);

  // Pendulum: the load lags behind the hook, then swings back and settles.
  const w2 = CRANE.gravity / CRANE.cable;
  s.svx += (-w2 * s.sx - CRANE.swingDamping * s.svx - ax) * dt;
  s.svz += (-w2 * s.sz - CRANE.swingDamping * s.svz - az) * dt;
  s.sx = MathUtils.clamp(s.sx + s.svx * dt, -CRANE.maxSwing, CRANE.maxSwing);
  s.sz = MathUtils.clamp(s.sz + s.svz * dt, -CRANE.maxSwing, CRANE.maxSwing);

  // Hoist: lowering speeds up the longer the key is held, so a tap is gentle and a hold is not.
  if (input.hoist < 0) s.vy = Math.max(s.vy - CRANE.lowerAccel * dt, -CRANE.lowerMax);
  else if (input.hoist > 0) s.vy = CRANE.raiseSpeed;
  else s.vy = s.vy < 0 ? Math.min(0, s.vy + 6 * dt) : Math.max(0, s.vy - 6 * dt);
  const descentSpeed = approachSpeed(s);
  s.y = Math.min(s.y + s.vy * dt, CRANE.ceiling);

  const aligned = loadOffset(s) <= CRANE.tolerance;
  const gate = lift.seatY + CRANE.approach;

  // Held above the stack until the load is lined up: the underside rests on top of the rocket.
  if (!aligned && s.y < gate) {
    s.y = gate;
    if (s.vy < 0) s.vy = 0;
    if (!s.blocked) {
      s.blocked = true;
      events.push("blocked");
    }
    return events;
  }
  if (s.blocked && aligned) {
    s.blocked = false;
    events.push("unblocked");
  }

  if (s.y <= lift.seatY) {
    if (descentSpeed > CRANE.softLanding) {
      // Too fast: it slams, bounces up and the player must try again.
      s.y = lift.seatY + 0.9;
      s.vy = 0;
      events.push("hard-landing");
    } else {
      s.y = lift.seatY;
      s.vy = 0;
      s.seated = true;
      s.x = -s.sx;
      s.z = -s.sz;
      events.push("seated");
    }
  }
  return events;
}

function chase(v: number, goal: number, rate: number, dt: number): number {
  const d = goal - v;
  const step = rate * dt;
  return Math.abs(d) <= step ? goal : v + Math.sign(d) * step;
}
