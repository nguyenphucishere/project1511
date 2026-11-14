import { simulateAscent, type AscentProfile, type AscentSample } from "@/lib/simulation/trajectory.physics";

/**
 * The crewed ascent as data: what the flight looks and feels like at each mission elapsed time
 * (MET, seconds). Altitude, speed, felt g-load, dynamic pressure and the event times are the
 * engine's Saturn V AS-506 profile (sim-core `simulate_ascent`: stage-by-stage thrust, Isp and
 * mass from the telemetry catalogue, a = (F_vac − P_amb·A_e − D)/m − g, q = ½ρv²). The scene
 * installs the engine's own result on load; until then the identical TypeScript port is used.
 * Pure functions, no React or three.js, so the 3D scene, the HUD and the tests share one source.
 */

/** Mission seconds that pass per real second while riding up (a 12-minute climb plays in 2 min). */
export const COMPRESS = 6;
/** The parking orbit used when a caller does not say. */
const DEFAULT_ORBIT_KM = 185;

const profiles = new Map<number, AscentProfile>();

/** The engine's ascent profile to `orbitKm` (cached; the port computes it until the engine's arrives). */
export function ascentProfile(orbitKm = DEFAULT_ORBIT_KM): AscentProfile {
  let p = profiles.get(orbitKm);
  if (!p) {
    p = simulateAscent({ parking_orbit_km: orbitKm });
    profiles.set(orbitKm, p);
  }
  return p;
}

/** Replaces the cached profile with the engine's answer (WASM worker or server). */
export function installAscentProfile(orbitKm: number, profile: AscentProfile): void {
  if (profile?.reached_orbit && Array.isArray(profile.samples) && profile.samples.length > 1) profiles.set(orbitKm, profile);
}

/** MET of parking-orbit insertion (S-IVB first cutoff): the ride ends and weightlessness begins. */
export function insertionMet(orbitKm = DEFAULT_ORBIT_KM): number {
  return ascentProfile(orbitKm).events.insertion_s ?? ascentProfile(orbitKm).samples.at(-1)!.met_s;
}
export const INSERTION_MET = insertionMet();

/** Linear interpolation between the per-second samples; clamps to the first / last sample. */
function at(orbitKm: number, met: number, pick: (s: AscentSample) => number): number {
  const s = ascentProfile(orbitKm).samples;
  if (met <= s[0]!.met_s) return pick(s[0]!);
  const last = s[s.length - 1]!;
  if (met >= last.met_s) return pick(last);
  const i = Math.min(s.length - 2, Math.floor(met - s[0]!.met_s));
  let a = s[i]!;
  let b = s[i + 1]!;
  if (met < a.met_s || met > b.met_s) {
    const k = s.findIndex((x, n) => n < s.length - 1 && met >= x.met_s && met <= s[n + 1]!.met_s);
    a = s[k]!;
    b = s[k + 1]!;
  }
  const f = b.met_s > a.met_s ? (met - a.met_s) / (b.met_s - a.met_s) : 0;
  return pick(a) + (pick(b) - pick(a)) * f;
}

/** Altitude in km above the pad, for the player's chosen parking orbit. */
export function altitudeKm(met: number, orbitKm = DEFAULT_ORBIT_KM): number {
  return Math.max(0, at(orbitKm, met, (x) => x.altitude_km));
}
/** Speed relative to the ground (Earth-fixed), km/s. */
export const speedKms = (met: number, orbitKm = DEFAULT_ORBIT_KM) =>
  met <= 0 ? 0 : at(orbitKm, met, (x) => x.relative_velocity_mps) / 1000;
/** Inertial speed (what the guidance computer shows), km/s. */
export const inertialSpeedKms = (met: number, orbitKm = DEFAULT_ORBIT_KM) => at(orbitKm, met, (x) => x.inertial_velocity_mps) / 1000;
/** Felt (non-gravitational) acceleration in g: thrust minus drag over mass. Zero once in orbit. */
export const gForce = (met: number, orbitKm = DEFAULT_ORBIT_KM) =>
  met > insertionMet(orbitKm) ? 0 : at(orbitKm, met, (x) => x.sensed_accel_g);
/** Dynamic pressure, kPa. */
export const dynamicPressureKpa = (met: number, orbitKm = DEFAULT_ORBIT_KM) => at(orbitKm, met, (x) => x.dynamic_pressure_kpa);

const engineBurning = (met: number, orbitKm: number) => at(orbitKm, met, (x) => (x.stage === 0 ? 0 : 1)) > 0.5;

/**
 * How hard the cabin shakes, 0..1: the liftoff rumble, then aerodynamic buffet that follows
 * dynamic pressure; a quiet coast between stages; still in orbit.
 */
export function vibration(met: number, orbitKm = DEFAULT_ORBIT_KM): number {
  if (met > insertionMet(orbitKm)) return 0;
  if (!engineBurning(met, orbitKm)) return 0.05;
  const qMax = ascentProfile(orbitKm).events.max_q_kpa;
  const liftoff = met < 10 ? 0.7 * (1 - met / 10) : 0;
  return Math.min(1, 0.18 + 0.8 * (dynamicPressureKpa(met, orbitKm) / qMax) + liftoff);
}

type Row = readonly [met: number, value: number];
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

/** Pitch-over of the view: how far the Earth swings into the window (radians). Camera framing only. */
const TILT: Row[] = [[0, 0.3], [12, 0.3], [60, 0.3], [130, 0.28], [300, 0.3], [INSERTION_MET, 0.36]];
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

/** The S-IC pitch-and-roll program starts after the vertical rise (engine: 12 s). */
const PITCH_PROGRAM_START_S = 12;

/** Call-outs at the engine's event times for this parking orbit. */
export function ascentEvents(orbitKm = DEFAULT_ORBIT_KM): AscentEvent[] {
  const p = ascentProfile(orbitKm);
  const e = p.events;
  // "Through max Q": the first second after max Q at which the air load is back under half.
  const past = p.samples.find((s) => s.met_s > e.max_q_s && s.dynamic_pressure_kpa < e.max_q_kpa / 2)?.met_s ?? e.max_q_s + 20;
  const list: AscentEvent[] = [
    { id: "liftoff", met: 0, kick: 0.6 },
    { id: "towerClear", met: e.tower_clear_s ?? 10 },
    { id: "rollProgram", met: PITCH_PROGRAM_START_S },
    { id: "mach1", met: e.mach1_s ?? 70, kick: 0.25 },
    { id: "maxQ", met: e.max_q_s, caution: true, kick: 0.3 },
    { id: "throttleUp", met: past },
    { id: "stageSep", met: e.s_ic_oeco_s ?? 161, caution: true, kick: 0.9, bang: true },
    { id: "stage2Ignition", met: e.s_ii_ignition_s ?? 163, kick: 0.4 },
    { id: "towerJettison", met: e.les_jettison_s ?? 198, kick: 0.35, bang: true },
    { id: "space", met: e.space_100km_s ?? 186 },
    { id: "meco", met: insertionMet(orbitKm), kick: 0.3 },
  ];
  return list.sort((a, b) => a.met - b.met);
}
export const EVENTS: AscentEvent[] = ascentEvents();

/** Events whose time falls in (from, to]. Used to fire each one exactly once as the clock advances. */
export function eventsBetween(from: number, to: number, orbitKm = DEFAULT_ORBIT_KM): AscentEvent[] {
  return ascentEvents(orbitKm).filter((e) => e.met > from && e.met <= to);
}

/** Air friction heating at the window, 0..1: dynamic pressure as a fraction of max Q. */
export const heating = (met: number, orbitKm = DEFAULT_ORBIT_KM) =>
  Math.min(1, Math.max(0, dynamicPressureKpa(met, orbitKm) / ascentProfile(orbitKm).events.max_q_kpa));

/** Mission seconds of warning before a failure, played at near real time so the dread has room. */
export const TROUBLE_LEAD = 24;
/** Mission seconds before the failure at which the situation turns critical (master alarm). */
export const CRITICAL_LEAD = 12;
/** Real seconds after the engines fail: the abort call, then the vehicle is lost. */
export const FAIL_ABORT_AT = 3;
export const FAIL_BOOM_AT = 16;
export const FAIL_END_AT = 19;

/** What went wrong, so the scene can say the right thing. */
export type FailureCode = "slow-climb" | "fuel-depleted" | "wind-shear" | "lightning" | "structural";
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
