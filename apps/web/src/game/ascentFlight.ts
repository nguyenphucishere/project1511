/**
 * The crewed ascent as data: what the flight looks and feels like at each mission elapsed time
 * (MET, seconds). Pure functions, no React or three.js, so the 3D scene, the HUD and the tests all
 * read one source of truth. Numbers follow a typical heavy-lift launch to a low parking orbit.
 */

/** Mission seconds that pass per real second while riding up (a 9-minute climb plays in 90 s). */
export const COMPRESS = 6;
/** MET of main engine cutoff: the moment the ride ends and weightlessness begins. */
export const INSERTION_MET = 540;
/** Orbit altitude the table below was authored for; other altitudes scale it. */
const BASE_ORBIT_KM = 188;

type Row = readonly [met: number, value: number];

const ALTITUDE_KM: Row[] = [
  [0, 0], [10, 0.25], [20, 1.2], [40, 5], [60, 10.5], [80, 17], [100, 26], [120, 37], [140, 50],
  [170, 68], [200, 86], [240, 106], [300, 130], [380, 158], [460, 178], [520, 187], [540, BASE_ORBIT_KM],
];

const SPEED_KMS: Row[] = [
  [0, 0], [10, 0.05], [30, 0.25], [60, 0.5], [80, 0.65], [130, 1.5], [200, 3], [300, 4.8], [400, 6.3],
  [480, 7.4], [540, 7.8],
];

/** Felt acceleration in g. Drops to nearly nothing at stage separation, peaks just before cutoff. */
const G_FORCE: Row[] = [
  [0, 1], [5, 1.25], [40, 1.8], [75, 2.3], [125, 3.4], [129, 3.4], [131, 0.2], [138, 1.2], [200, 1.7],
  [300, 2.4], [400, 3], [520, 3.7], [538, 3.9], [541, 0],
];

/** How hard the cabin shakes, 0..1. Peaks at liftoff and max dynamic pressure, then eases. */
const VIBRATION: Row[] = [
  [0, 0.25], [1.5, 0.95], [10, 0.55], [40, 0.7], [70, 0.9], [80, 1], [95, 0.5], [125, 0.45],
  [129, 0.4], [131, 0.05], [133, 0.85], [142, 0.3], [200, 0.2], [400, 0.18], [520, 0.2], [538, 0.1], [541, 0],
];

/** Pitch-over of the view: how far the Earth swings into the window (radians). */
const TILT: Row[] = [[0, 0.3], [12, 0.3], [60, 0.3], [130, 0.28], [300, 0.3], [540, 0.36]];

function sample(table: Row[], met: number): number {
  if (met <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [t1, v1] = table[i];
    if (met <= t1) {
      const [t0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (met - t0)) / (t1 - t0);
    }
  }
  return table[table.length - 1][1];
}

/** Altitude in km. `orbitKm` is the player's chosen parking orbit; the climb scales to reach it. */
export function altitudeKm(met: number, orbitKm = BASE_ORBIT_KM): number {
  return sample(ALTITUDE_KM, met) * (orbitKm / BASE_ORBIT_KM);
}
export const speedKms = (met: number) => sample(SPEED_KMS, met);
export const gForce = (met: number) => sample(G_FORCE, met);
export const vibration = (met: number) => sample(VIBRATION, met);
export const tilt = (met: number) => sample(TILT, met);

export type AscentEventId =
  | "warn"
  | "warnCritical"
  | "engineFail"
  | "abort"
  | "boom"
  | "liftoff"
  | "towerClear"
  | "rollProgram"
  | "mach1"
  | "maxQ"
  | "throttleUp"
  | "stageSep"
  | "stage2Ignition"
  | "towerJettison"
  | "space"
  | "meco";

export interface AscentEvent {
  id: AscentEventId;
  met: number;
  /** A master-caution style event (two-tone alert) instead of a plain call-out chime. */
  caution?: boolean;
  /** One-off camera kick (trauma, 0..1). */
  kick?: number;
  /** Plays a mechanical bang (separation, pyros). */
  bang?: boolean;
}

export const EVENTS: AscentEvent[] = [
  { id: "liftoff", met: 0, kick: 0.6 },
  { id: "towerClear", met: 8 },
  { id: "rollProgram", met: 20 },
  { id: "mach1", met: 45, kick: 0.25 },
  { id: "maxQ", met: 80, caution: true, kick: 0.3 },
  { id: "throttleUp", met: 100 },
  { id: "stageSep", met: 130, caution: true, kick: 0.9, bang: true },
  { id: "stage2Ignition", met: 135, kick: 0.4 },
  { id: "towerJettison", met: 150, kick: 0.35, bang: true },
  { id: "space", met: 232 },
  { id: "meco", met: INSERTION_MET, kick: 0.3 },
];

/** Events whose time falls in (from, to]. Used to fire each one exactly once as the clock advances. */
export function eventsBetween(from: number, to: number): AscentEvent[] {
  return EVENTS.filter((e) => e.met > from && e.met <= to);
}

/** Air friction heating at the window, 0..1: builds toward max dynamic pressure, gone after staging. */
const HEAT: Row[] = [[0, 0], [40, 0.12], [70, 0.7], [85, 1], [100, 0.6], [125, 0.5], [132, 0], [540, 0]];
export const heating = (met: number) => sample(HEAT, met);

/** Mission seconds of warning before a failure, played at near real time so the dread has room. */
export const TROUBLE_LEAD = 30;
/** Mission seconds before the failure at which the situation turns critical (master alarm). */
export const CRITICAL_LEAD = 12;
/** Real seconds after the engines fail: the abort call, then the vehicle is lost. */
export const FAIL_ABORT_AT = 2.4;
export const FAIL_BOOM_AT = 6.8;
export const FAIL_END_AT = 9.6;

/** What went wrong, so the scene can say the right thing. */
export type FailureCode = "slow-climb" | "fuel-depleted";
export interface AscentFailure {
  /** Mission time (s) at which the engines quit. */
  met: number;
  code: FailureCode;
}

/** Sky colour mix: 1 = daytime blue, 0 = black space. */
export function skyBlend(altKm: number): number {
  const x = Math.min(1, Math.max(0, (altKm - 18) / 80));
  return 1 - x * x * (3 - 2 * x);
}

export const formatMet = (met: number) => {
  const s = Math.max(0, Math.floor(met));
  return `T+${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
