import type { Dictionary } from "@/i18n";

/**
 * Flight playback for Scene 3: how fast mission time runs, the nominal event list, and DEMO
 * telemetry curves. Telemetry is interpolated from a small table, not computed from physics.
 */

/**
 * Real seconds -> mission seconds, written as a film timeline. The climb off the pad plays close to
 * real time, then each stage event gets its own slow stretch so it can be filmed from several
 * angles: stage 1 drops away (T+02:42), stage 2 lights (T+02:46), the escape tower is jettisoned
 * (T+03:20), stage 2 drops away (T+06:40), stage 3 lights (T+06:48), the spacecraft adapter opens
 * (T+07:20) and orbit follows at T+09:00. Between events time runs fast.
 */
const TIME_WARP: [real: number, mission: number][] = [
  [0, 0],
  [8, 6],
  [17, 162],
  [19, 166],
  [28, 200],
  [35, 400],
  [38.5, 408],
  [41, 440],
  [48.5, 540],
];

/** Scale of the early launch beats (hold-down, smoke); the whole launch runs about 48 s. */
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

/** Mission times the 3D rocket acts on. */
export const STAGING_SEC = 162;
export const STAGE2_IGNITION_SEC = 166;
export const LES_SEC = 200;
export const STAGE2_SEP_SEC = 400;
export const STAGE3_IGNITION_SEC = 408;
export const ADAPTER_SEC = 440;

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

