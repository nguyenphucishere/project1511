/**
 * The five palette colours for code that cannot read CSS variables (three.js materials,
 * lights, shader uniforms). Must stay in sync with the tokens in app/globals.css.
 */
export const PALETTE = {
  deep: "#112936",
  blue: "#20556A",
  mist: "#D0E0D5",
  gold: "#E9BC54",
  orange: "#CB6944",
} as const;

export type PaletteName = keyof typeof PALETTE;
