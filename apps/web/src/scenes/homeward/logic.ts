/**
 * The maths and facts of liftoff from Tranquility Base. Pure functions, so they are tested without a screen.
 *
 * Sourced (NASA Apollo 11 Flight Journal): liftoff 124:22 MET, ascent engine burn about 435 s.
 */

export const ASCENT_BURN_S = 435;
export const LIFTOFF_MET = { h: 124, m: 22, s: 0 };

/** The burn is shown compressed: this many real seconds of film per second of play. */
export const BURN_TIME_SCALE = 29; // 435 s plays in 15 s

export interface BurnState {
  /** 0..1 of the burn done. */
  fraction: number;
  /** Altitude above the surface, km (ends near 18 km at orbit insertion, 11 x 55 nmi). */
  altKm: number;
  /** Speed, m/s (ends near 1,690 m/s horizontal, the ascent stage's orbital speed). */
  speed: number;
}

export function burnState(elapsedS: number): BurnState {
  const f = Math.min(1, Math.max(0, elapsedS / ASCENT_BURN_S));
  // Climbs steeply first, then pitches over and builds speed sideways.
  const altKm = 18.2 * (1 - Math.pow(1 - f, 2.2));
  const speed = 1690 * Math.pow(f, 1.15);
  return { fraction: f, altKm, speed };
}

export function formatClock({ h, m, s }: { h: number; m: number; s: number }): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}
