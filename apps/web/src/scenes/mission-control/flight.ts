import type { Dictionary } from "@/i18n";
import { altitudeKm as engineAltitudeKm, ascentProfile, speedKms as engineSpeedKms } from "@/game/ascentFlight";

/**
 * Flight playback for Scene 3: how fast mission time runs, the nominal event list and the
 * telemetry. Every mission time and every number is the simulation engine's Saturn V ascent
 * (sim-core `simulate_ascent`, the same profile Scene 4 rides): S-IC cutoff, S-II ignition, LES
 * jettison, S-II cutoff, S-IVB ignition and parking-orbit insertion. Only the film pacing (how many
 * real seconds each stretch takes on screen) is authored, so every separation can be filmed.
 */

/** The film shows the nominal Apollo 11 parking orbit; the HUD scales to the player's orbit. */
const FILM_ORBIT_KM = 185;
const events = ascentProfile(FILM_ORBIT_KM).events;

/** Mission times the 3D rocket acts on (engine events, seconds after liftoff). */
export const STAGING_SEC = events.s_ic_oeco_s ?? 161.1;
export const STAGE2_IGNITION_SEC = events.s_ii_ignition_s ?? STAGING_SEC + 1.4;
export const LES_SEC = events.les_jettison_s ?? 197.9;
export const STAGE2_SEP_SEC = events.s_ii_cutoff_s ?? 535;
export const STAGE3_IGNITION_SEC = events.s_ivb_ignition_s ?? STAGE2_SEP_SEC + 1;
/** S-IVB first cutoff = parking-orbit insertion. */
export const S3_CUTOFF_SEC = events.insertion_s ?? 714;
export const ORBIT_SEC = S3_CUTOFF_SEC;
export const MAX_Q_SEC = events.max_q_s;
/**
 * Film beat, not a flight event: the spacecraft adapter panels are shown opening during the S-IVB
 * burn so the docking can be filmed before the film ends (on Apollo 11 this followed TLI).
 */
export const ADAPTER_SEC = STAGE3_IGNITION_SEC + 0.35 * (S3_CUTOFF_SEC - STAGE3_IGNITION_SEC);
/** The film keeps rolling in orbit while the capsule turns round and docks. */
export const FILM_END_SEC = S3_CUTOFF_SEC + 40;

/**
 * Real seconds -> mission seconds. The climb off the pad plays close to real time, then each stage
 * event gets its own slow stretch so it can be filmed from several angles; between events time runs
 * fast. The real-second keys are the film's; the mission-second keys are the engine's events.
 */
const TIME_WARP: [real: number, mission: number][] = [
  [0, 0],
  [8, 6],
  [24, STAGING_SEC],
  [28, STAGE2_IGNITION_SEC],
  [38, LES_SEC],
  [50, STAGE2_SEP_SEC],
  [55, STAGE3_IGNITION_SEC],
  [60, ADAPTER_SEC],
  [76, S3_CUTOFF_SEC],
  [96, FILM_END_SEC],
];

/** Scale of the early launch beats (hold-down, smoke); the whole launch runs about a minute and a half. */
export const STRETCH = 2.7;

function interpolate(table: [number, number][], x: number, from: 0 | 1): number {
  const to = from === 0 ? 1 : 0;
  if (x <= 0) return Math.max(0, x);
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1]!;
    const b = table[i]!;
    if (x <= b[from]) return a[to] + ((b[to] - a[to]) * (x - a[from])) / (b[from] - a[from]);
  }
  const a = table[table.length - 2]!;
  const b = table[table.length - 1]!;
  return b[to] + ((b[to] - a[to]) * (x - b[from])) / (b[from] - a[from]);
}

export function missionSecondsAt(realSec: number): number {
  return interpolate(TIME_WARP, realSec, 0);
}

/** Inverse of missionSecondsAt: when (real seconds after ignition) a mission time is shown. */
export function realSecondsAt(missionSec: number): number {
  return interpolate(TIME_WARP, missionSec, 1);
}

export interface FlightEvent {
  t: number;
  label: keyof Dictionary["missionControl"];
}

/** The engine's events, in order (liftoff is called as the hold-down arms release). */
export const NOMINAL_EVENTS: FlightEvent[] = [
  { t: 1, label: "eventLiftoff" },
  { t: MAX_Q_SEC, label: "eventMaxQ" },
  { t: STAGING_SEC, label: "eventStaging" },
  { t: STAGE2_IGNITION_SEC, label: "eventStage2" },
  { t: LES_SEC, label: "eventTower" },
  { t: STAGE2_SEP_SEC, label: "eventStage2Off" },
  { t: STAGE3_IGNITION_SEC, label: "eventStage3" },
  { t: ORBIT_SEC, label: "eventOrbit" },
];

/** Nominal altitude (km) `realSec` seconds after ignition (the film's 185 km orbit). */
export function nominalAltitudeKm(realSec: number): number {
  return engineAltitudeKm(missionSecondsAt(realSec), FILM_ORBIT_KM);
}

/** Altitude (km) at mission time `t` on the engine's ascent to the chosen parking orbit. */
export function altitudeKm(t: number, orbitKm: number): number {
  return engineAltitudeKm(t, orbitKm);
}

/** Ground-relative speed (km/s) at mission time `t`. */
export function speedKms(t: number, orbitKm = FILM_ORBIT_KM): number {
  return engineSpeedKms(t, orbitKm);
}
