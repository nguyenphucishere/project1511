import type { Dictionary } from "@/i18n";

/**
 * Flight playback for Scene 3: how fast mission time runs, the nominal event list, and DEMO
 * telemetry curves. Telemetry is interpolated from a small table, not computed from physics.
 */

/** Real seconds shown at 1× so the liftoff can be watched before time is sped up. */
const REALTIME_SPAN = 6;
/** Mission seconds per real second after that: ~9 min of ascent in ~13 s total. */
const WARP = 75;

export function missionSecondsAt(realSec: number): number {
  if (realSec <= REALTIME_SPAN) return Math.max(0, realSec);
  return REALTIME_SPAN + (realSec - REALTIME_SPAN) * WARP;
}

export interface FlightEvent {
  t: number;
  label: keyof Dictionary["missionControl"];
}

export const NOMINAL_EVENTS: FlightEvent[] = [
  { t: 1, label: "eventLiftoff" },
  { t: 72, label: "eventMaxQ" },
  { t: 162, label: "eventStaging" },
  { t: 166, label: "eventStage2" },
  { t: 540, label: "eventOrbit" },
];

const ALTITUDE_KM: [number, number][] = [
  [0, 0],
  [72, 12],
  [162, 68],
  [300, 140],
  [540, 185],
];
const SPEED_KMS: [number, number][] = [
  [0, 0],
  [72, 0.5],
  [162, 2.4],
  [300, 4.6],
  [540, 7.8],
];

function lerpTable(table: [number, number][], t: number): number {
  if (t <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [t1, v1] = table[i]!;
    const [t0, v0] = table[i - 1]!;
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return table[table.length - 1]![1];
}

/** DEMO altitude, scaled so a nominal flight ends exactly at the chosen parking orbit. */
export function altitudeKm(t: number, orbitKm: number): number {
  return lerpTable(ALTITUDE_KM, t) * (orbitKm / 185);
}

export function speedKms(t: number): number {
  return lerpTable(SPEED_KMS, t);
}

