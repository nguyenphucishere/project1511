/**
 * Live post-processing knobs that scenes can turn up for a moment (a plain mutable object, read
 * every frame by PostFX; nothing re-renders on it).
 */
export const fx = {
  /** Chromatic aberration strength: colour fringing at the edges. 0 = none, ~0.002 = violent shake. */
  aberration: 0,
};
