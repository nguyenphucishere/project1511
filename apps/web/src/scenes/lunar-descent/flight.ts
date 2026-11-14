import { KEYFRAMES, SAFE_TOUCHDOWN_MS } from "@/mocks/descent";

/**
 * Final descent flight model (Scene 5). Pure and framework-free so it can be unit-tested.
 *
 * Two axes are simulated, as seen from the lander window: altitude and sideways position `x`
 * (metres, 0 = the boulder field the lander was aimed at). The numbers follow a real Lunar Module
 * descent from the low gate (150 m): lunar gravity, a descent engine that cannot out-thrust the
 * mass it carries, a finite fuel supply, and RCS thrusters for sideways translation. The vertical
 * axis is flown the way Apollo crews flew it in program P66: the computer holds a commanded rate
 * of descent and the pilot nudges that rate up or down.
 */

/** Lunar surface gravity, m/s². */
export const LUNAR_G = 1.62;
/** Vertical acceleration at full throttle for the lander's mass near touchdown, m/s². */
export const MAX_ACCEL = 4.4;
/** Throttle changes at most this fast (fraction per second): a real engine takes time to respond. */
export const THROTTLE_SLEW = 1.2;
/** Sideways acceleration while an RCS translation thruster fires, m/s². */
export const RCS_ACCEL = 0.6;
/** Fuel burned per second at full throttle, % of the tank. */
export const FUEL_BURN_FULL = 0.4;
/** Fuel burned per second while RCS fires, % of the tank. */
export const FUEL_BURN_RCS = 0.06;
/**
 * Height of the contact probes under the footpads, m. The contact light comes on here and the
 * pilot must cut the engine: the lander then drops the last metre under lunar gravity.
 */
export const CONTACT_HEIGHT = 1;
/** Rate-of-descent commands the pilot may select, m/s (negative is down), in this step. */
export const ROD_STEP = 0.5;
export const ROD_MIN = -6;
export const ROD_MAX = 0.5;
/** Autopilot gain for holding the commanded rate (1/s). */
const ROD_GAIN = 1.5;
/** Integration step; longer frames are split so the result never depends on frame rate. */
const MAX_DT = 1 / 60;

/** Tipping and dust limits at touchdown. */
export const MAX_TOUCHDOWN_HS = 1;
export const GREAT_TOUCHDOWN_VS = 2;
export const GREAT_TOUCHDOWN_HS = 0.5;
/** Within this many metres of the chosen site counts as a precision landing. */
export const PRECISION_M = 3;
/** Fuel left (%) that counts as a comfortable margin. */
export const COMFORT_FUEL_PCT = 3;
export const LOW_FUEL_PCT = 5;

/** The playable strip, metres either side of the aim point. */
export const STRIP_HALF_WIDTH = 32;

export type SiteId = "A" | "B" | "C";
export type Terrain = "clear" | "boulders" | "crater";

export interface LandingSite {
  id: SiteId;
  /** Sideways position of the site centre, m. */
  x: number;
  terrain: Terrain;
}

/**
 * Three candidate landing spots on the same line. B is straight ahead and is a boulder field;
 * A is the clear patch beside it; C is farther away, beside a crater rim, so it asks for a long
 * move and a precise stop.
 */
export const SITES: readonly LandingSite[] = [
  { id: "A", x: 8, terrain: "clear" },
  { id: "B", x: 0, terrain: "boulders" },
  { id: "C", x: -14, terrain: "clear" },
];

/** Boulders cover this half-width around x = 0. */
export const BOULDER_HALF_WIDTH = 4.4;
/** The crater rim begins here (and everything beyond is the slope down into it). */
export const CRATER_EDGE_X = -20;
export const CRATER_CENTER_X = -27;
export const CRATER_RADIUS = 7;

export function siteById(id: SiteId): LandingSite {
  return SITES.find((s) => s.id === id) ?? SITES[0];
}

/** What the lander would touch if it came down at sideways position `x`. */
export function terrainAt(x: number): Terrain {
  if (Math.abs(x) <= BOULDER_HALF_WIDTH) return "boulders";
  if (x <= CRATER_EDGE_X) return "crater";
  return "clear";
}

export type FlightStatus = "flying" | "landed" | "crashed";
export type CrashReason = "boulders" | "crater" | "engine" | "hard" | "tipover";

export interface Touchdown {
  /** Downward speed at contact, m/s (positive). */
  vsMs: number;
  /** Sideways speed at contact, m/s (positive). */
  hsMs: number;
  xM: number;
  fuelPct: number;
  /** Distance from the chosen site, m. */
  offsetM: number;
  engineOn: boolean;
  success: boolean;
  /** Why it failed; null on success. */
  reason: CrashReason | null;
  /** 1-3 on success, 0 on failure. */
  stars: 0 | 1 | 2 | 3;
}

export interface FlightState {
  /** Seconds since the manual phase began. */
  elapsed: number;
  altM: number;
  /** Vertical speed, m/s; negative is down. */
  vsMs: number;
  xM: number;
  /** Sideways speed, m/s; positive is to the right. */
  hsMs: number;
  fuelPct: number;
  /** Actual throttle, 0..1. */
  throttle: number;
  /** Rate of descent the autopilot holds, m/s. */
  targetVs: number;
  engineOn: boolean;
  /** RCS direction fired on the last step: -1 left, 1 right, 0 none. */
  rcs: -1 | 0 | 1;
  /** Contact light: the probes touch the ground. */
  contact: boolean;
  /** The pilot cut the engine (it will not restart). */
  engineCut: boolean;
  status: FlightStatus;
  siteId: SiteId;
  touchdown: Touchdown | null;
}

export interface FlightInput {
  /** Held translation command: -1 left, 1 right, 0 none. */
  rcs: -1 | 0 | 1;
  /** Hold: the computer fires RCS to kill the sideways drift. */
  nullDrift: boolean;
}

export const NO_INPUT: FlightInput = { rcs: 0, nullDrift: false };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Throttle that exactly cancels gravity. */
export const HOVER_THROTTLE = LUNAR_G / MAX_ACCEL;

/**
 * Where the manual phase starts: the low gate, straight from the scripted profile, with a small
 * leftover drift that changes with each attempt so a retry is not an identical replay.
 */
export function createFlight(siteId: SiteId, attempt = 0): FlightState {
  const gate = KEYFRAMES[2];
  const drifts = [0.4, -0.3, 0.5, -0.45];
  return {
    elapsed: 0,
    altM: gate.altM,
    vsMs: gate.vsMs,
    xM: 0,
    hsMs: drifts[attempt % drifts.length],
    fuelPct: gate.fuelPct,
    throttle: HOVER_THROTTLE,
    targetVs: gate.vsMs,
    engineOn: true,
    rcs: 0,
    contact: false,
    engineCut: false,
    status: "flying",
    siteId,
    touchdown: null,
  };
}

/** The slowest descent the crew would like to see at this height: a braking envelope, m/s (negative). */
export function recommendedVs(altM: number): number {
  return -Math.min(3, 0.4 + altM * 0.05);
}

/** Moves the commanded rate of descent one notch. Positive `dir` = slower descent (more thrust). */
export function nudgeTargetVs(s: FlightState, dir: 1 | -1): void {
  if (s.status !== "flying" || !s.engineOn) return;
  s.targetVs = clamp(Math.round((s.targetVs + dir * ROD_STEP) / ROD_STEP) * ROD_STEP, ROD_MIN, ROD_MAX);
}

/** Engine stop. Only meaningful while flying. */
export function cutEngine(s: FlightState): void {
  if (s.status !== "flying") return;
  s.engineOn = false;
  s.engineCut = true;
}

/** Fuel-seconds left at the current burn (hover burn when throttle is below hover), capped for display. */
export function fuelSecondsLeft(s: FlightState): number {
  const burn = FUEL_BURN_FULL * Math.max(s.throttle, HOVER_THROTTLE);
  return Math.min(999, s.fuelPct / burn);
}

/** Advances the flight by `dt` seconds (any length; split into fixed steps). */
export function stepFlight(s: FlightState, input: FlightInput, dt: number): void {
  let left = Math.max(0, dt);
  while (left > 1e-9 && s.status === "flying") {
    const h = Math.min(MAX_DT, left);
    left -= h;
    integrate(s, input, h);
  }
}

function integrate(s: FlightState, input: FlightInput, dt: number): void {
  s.elapsed += dt;

  // Fuel gone: the engine flames out and cannot be restarted.
  if (s.fuelPct <= 0) {
    s.fuelPct = 0;
    s.engineOn = false;
  }

  // Autopilot holds the commanded descent rate; the engine follows with a finite response.
  const demand = s.engineOn ? clamp((LUNAR_G + ROD_GAIN * (s.targetVs - s.vsMs)) / MAX_ACCEL, 0, 1) : 0;
  if (!s.engineOn) {
    s.throttle = 0;
  } else {
    const dThr = clamp(demand - s.throttle, -THROTTLE_SLEW * dt, THROTTLE_SLEW * dt);
    s.throttle = clamp(s.throttle + dThr, 0, 1);
  }

  // Sideways: RCS only. Drift continues untouched until the pilot (or the null-drift hold) stops it.
  let rcs: -1 | 0 | 1 = 0;
  if (s.fuelPct > 0) {
    if (input.rcs !== 0) rcs = input.rcs;
    else if (input.nullDrift && Math.abs(s.hsMs) > 1e-6) rcs = s.hsMs > 0 ? -1 : 1;
  }
  s.rcs = rcs;
  if (rcs !== 0) {
    const dv = RCS_ACCEL * dt;
    if (input.rcs === 0 && Math.abs(s.hsMs) <= dv) s.hsMs = 0;
    else s.hsMs += rcs * dv;
  }

  s.fuelPct = Math.max(0, s.fuelPct - (FUEL_BURN_FULL * s.throttle + (rcs !== 0 ? FUEL_BURN_RCS : 0)) * dt);

  // Vertical: thrust against gravity.
  // Trapezoid rule: exact for the constant acceleration inside one step.
  const vsBefore = s.vsMs;
  s.vsMs += (MAX_ACCEL * s.throttle - LUNAR_G) * dt;
  s.altM += ((vsBefore + s.vsMs) / 2) * dt;
  s.xM += s.hsMs * dt;

  if (s.engineOn && s.altM <= CONTACT_HEIGHT) s.contact = true;
  if (s.altM <= 0) {
    s.altM = 0;
    s.touchdown = evaluateTouchdown(s);
    s.status = s.touchdown.success ? "landed" : "crashed";
    s.contact = true;
    s.engineOn = false;
    s.throttle = 0;
    s.rcs = 0;
  }
}

/**
 * Judges the contact: the ground first, then the engine, then how hard and how sideways it was.
 * An engine still burning at touchdown is a failure: the exhaust has nowhere to go and flips the lander.
 */
export function evaluateTouchdown(s: FlightState): Touchdown {
  const vsMs = Math.max(0, -s.vsMs);
  const hsMs = Math.abs(s.hsMs);
  const terrain = terrainAt(s.xM);
  const site = siteById(s.siteId);
  const offsetM = Math.abs(s.xM - site.x);
  const engineOn = s.engineOn;

  let reason: CrashReason | null = null;
  if (terrain === "boulders") reason = "boulders";
  else if (terrain === "crater") reason = "crater";
  else if (engineOn) reason = "engine";
  else if (vsMs > SAFE_TOUCHDOWN_MS) reason = "hard";
  else if (hsMs > MAX_TOUCHDOWN_HS) reason = "tipover";

  let stars: Touchdown["stars"] = 0;
  if (reason === null) {
    const smooth = vsMs <= GREAT_TOUCHDOWN_VS && hsMs <= GREAT_TOUCHDOWN_HS;
    const precise = offsetM <= PRECISION_M && s.fuelPct >= COMFORT_FUEL_PCT;
    stars = (1 + (smooth ? 1 : 0) + (precise ? 1 : 0)) as 1 | 2 | 3;
  }

  return { vsMs, hsMs, xM: s.xM, fuelPct: s.fuelPct, offsetM, engineOn, success: reason === null, reason, stars };
}

export type CalloutId =
  | "fuelOut"
  | "lowFuel"
  | "contact"
  | "tooFast"
  | "driftLeft"
  | "driftRight"
  | "boulders"
  | "craterEdge"
  | "dust"
  | "approach";
export type CalloutTone = "info" | "caution" | "alert";

export interface Callout {
  id: CalloutId;
  tone: CalloutTone;
}

/** The crew's most urgent call right now, or null when everything is nominal. */
export function calloutFor(s: FlightState): Callout | null {
  if (s.status !== "flying") return null;
  if (s.fuelPct <= 0) return { id: "fuelOut", tone: "alert" };
  if (s.contact && s.engineOn) return { id: "contact", tone: "caution" };
  if (s.altM < 80 && -s.vsMs > Math.max(1.2, -recommendedVs(s.altM) + 1.2)) return { id: "tooFast", tone: "alert" };
  if (s.fuelPct < LOW_FUEL_PCT) return { id: "lowFuel", tone: "caution" };
  if (Math.abs(s.hsMs) > MAX_TOUCHDOWN_HS && s.altM < 60) {
    return { id: s.hsMs > 0 ? "driftRight" : "driftLeft", tone: "caution" };
  }
  if (s.altM < 45) {
    const terrain = terrainAt(s.xM + s.hsMs * (s.altM / Math.max(0.5, -s.vsMs)));
    if (terrain === "boulders") return { id: "boulders", tone: "alert" };
    if (terrain === "crater") return { id: "craterEdge", tone: "alert" };
  }
  if (s.altM < 20) return { id: "dust", tone: "info" };
  return { id: "approach", tone: "info" };
}
