/**
 * English UI strings. This file defines the dictionary shape; vi.ts must match it.
 * Scene scripts (briefings, part descriptions) live with their data as LocalizedText, not here.
 */
export const en = {
  meta: {
    title: "Moonbound: Mission Control",
    description: "Prepare, launch, and land a crewed mission on the Moon.",
  },
  common: {
    close: "Close",
    next: "Next",
    skip: "Skip",
    back: "Back",
    demoData: "Demo data",
    language: "Language",
  },
  settings: {
    pixelEffect: "Pixel effect",
    reducedMotion: "Reduce motion",
    on: "On",
    off: "Off",
  },
  home: {
    title: "Moonbound",
    subtitle: "Four crew members, one rocket, and the long way to the Moon.",
    comingSoon: "The start screen is being built. This page checks the foundation.",
    openUiKit: "Open the UI kit",
  },
} as const;

type Widen<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dictionary = Widen<typeof en>;
