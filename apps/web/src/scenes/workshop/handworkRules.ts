/**
 * Pure rules for the two hands-on tasks: connecting the fuel lines in the fuel bay, and
 * torquing the interstage flange bolts in a star pattern.
 */

/* ------------------------------------------------------------------ fuel couplings */

export type FuelLine = "oxidizer" | "fuel";
export const FUEL_LINES: FuelLine[] = ["oxidizer", "fuel"];

export const COUPLING = {
  /** Half-width of the green zone, as a fraction of the track (the zone is centred on 0.5). */
  zone: 0.11,
  /** Sweeps of the whole track per second, per line: the second coupling is fiddlier. */
  speed: { oxidizer: 0.55, fuel: 0.85 } as Record<FuelLine, number>,
  /** Seconds the propellant takes to transfer once both lines are on. */
  fillSeconds: 4.5,
} as const;

export interface CouplingState {
  /** Position of the sliding marker, 0..1. */
  pos: number;
  dir: 1 | -1;
  locked: FuelLine[];
  /** Cross-threaded attempts so far. */
  slips: number;
}

export function createCoupling(): CouplingState {
  return { pos: 0.05, dir: 1, locked: [], slips: 0 };
}

/** The line the player is connecting now, or null when both are on. */
export function currentLine(s: CouplingState): FuelLine | null {
  return FUEL_LINES[s.locked.length] ?? null;
}

export function stepCoupling(s: CouplingState, dt: number): void {
  const line = currentLine(s);
  if (!line) return;
  s.pos += s.dir * COUPLING.speed[line] * dt;
  if (s.pos >= 1) {
    s.pos = 1;
    s.dir = -1;
  } else if (s.pos <= 0) {
    s.pos = 0;
    s.dir = 1;
  }
}

/** The player presses connect. Returns whether the coupling seated. */
export function lockCoupling(s: CouplingState): "hit" | "miss" | "none" {
  const line = currentLine(s);
  if (!line) return "none";
  if (Math.abs(s.pos - 0.5) <= COUPLING.zone) {
    s.locked.push(line);
    s.pos = 0.05;
    s.dir = 1;
    return "hit";
  }
  s.slips += 1;
  return "miss";
}

/* ------------------------------------------------------------------ flange bolts */

export const BOLT_COUNT = 5;
export const BOLT_LABEL = ["A", "B", "C", "D", "E"] as const;
/** Opposite-side tightening: never go round the ring, or the flange warps. */
export const STAR_ORDER = [0, 2, 4, 1, 3] as const;

export type BoltResult = { ok: true } | { ok: false; expected: number };

export function checkBolt(done: readonly number[], pressed: number): BoltResult {
  const expected = STAR_ORDER[done.length];
  if (expected === undefined) return { ok: false, expected: STAR_ORDER[STAR_ORDER.length - 1] };
  return pressed === expected ? { ok: true } : { ok: false, expected };
}

export const TORQUE = {
  /** Torque rises at a + b·torque per second while turning: it stiffens as the bolt seats. */
  a: 0.2,
  b: 0.4,
  /** The wrench clicks here; the player must let go before `strip`. */
  click: 0.7,
  strip: 1,
  /** Torque lost per second while the wrench is released before it clicked. */
  decay: 0.9,
} as const;

export interface WrenchState {
  torque: number;
  clicked: boolean;
  result: "idle" | "tight" | "stripped";
}

export function createWrench(): WrenchState {
  return { torque: 0, clicked: false, result: "idle" };
}

export function stepWrench(s: WrenchState, holding: boolean, dt: number): void {
  if (s.result !== "idle") return;
  if (holding) {
    s.torque += (TORQUE.a + TORQUE.b * s.torque) * dt;
    if (s.torque >= TORQUE.click) s.clicked = true;
    if (s.torque >= TORQUE.strip) {
      s.torque = TORQUE.strip;
      s.result = "stripped";
    }
  } else if (s.clicked) {
    s.result = "tight";
  } else {
    s.torque = Math.max(0, s.torque - TORQUE.decay * dt);
  }
}
