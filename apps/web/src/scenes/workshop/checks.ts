/**
 * Pure rules for the pre-flight checklist and the pressure-gauge minigame.
 */
export type StationId = "fuel" | "electrical" | "pressure";

/** The order Kai reads the checklist in, and the only order that is accepted. */
export const CHECKLIST_ORDER: StationId[] = ["fuel", "electrical", "pressure"];

export type StationResult = { ok: true } | { ok: false; expected: StationId };

/** Is `pressed` the next station in the checklist, given what is already done? */
export function checkStation(done: readonly StationId[], pressed: StationId): StationResult {
  const expected = CHECKLIST_ORDER[done.length];
  if (expected === undefined) return { ok: false, expected: CHECKLIST_ORDER[CHECKLIST_ORDER.length - 1] };
  return pressed === expected ? { ok: true } : { ok: false, expected };
}

/** Tank pressure window the manifold must be held in, bar. */
export const PRESSURE = {
  min: 2.9,
  max: 3.3,
  /** Bar per second while the pump button is held / released. */
  rise: 0.85,
  fall: 0.55,
  ceiling: 4.5,
  /** Seconds the needle must stay in the window. */
  hold: 2.2,
} as const;

export interface PressureState {
  bar: number;
  /** Seconds spent continuously inside the window. */
  stable: number;
  done: boolean;
}

export function createPressure(): PressureState {
  return { bar: 0.8, stable: 0, done: false };
}

export function inWindow(bar: number): boolean {
  return bar >= PRESSURE.min && bar <= PRESSURE.max;
}

export function stepPressure(s: PressureState, pumping: boolean, dt: number): void {
  if (s.done) return;
  const rate = pumping ? PRESSURE.rise : -PRESSURE.fall;
  s.bar = Math.min(PRESSURE.ceiling, Math.max(0.4, s.bar + rate * dt));
  s.stable = inWindow(s.bar) ? s.stable + dt : 0;
  if (s.stable >= PRESSURE.hold) s.done = true;
}
