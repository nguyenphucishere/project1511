/**
 * Deterministic pseudo-random numbers in [0, 1) (Lehmer / Park–Miller), so scattered scenery
 * (stars, craters, rocks) is the same on every mount instead of reshuffling.
 */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
