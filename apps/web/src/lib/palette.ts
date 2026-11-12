/**
 * The 5 core palette colours for the optional Retro Pixel Post-Process shader.
 * Must stay synced with the 5 base tokens in app/globals.css.
 */
export const PALETTE = {
  deep: "#0B192C",      // Deep NASA cosmic navy
  blue: "#0B3D91",      // Official NASA Insignia Blue
  mist: "#F8FAFC",      // Clean Spacecraft White
  gold: "#FFC72C",      // Radiant Solar Amber
  orange: "#FC3D21",    // Official NASA Insignia Red
} as const;

export const NASA_COLORS = {
  blue: "#0B3D91",
  blueLight: "#1A73E8",
  red: "#FC3D21",
  white: "#FFFFFF",
  gold: "#FFC72C",
  cyan: "#00E5FF",
  deep: "#0B192C",
} as const;

/**
 * Rich realistic material colors for full-color 3D scenes (Medical Bay, VAB Workshop,
 * Launch Control Room, Lunar Descent).
 */
export const SCENE_COLORS = {
  // Architectural & Cleanroom
  cleanroomWall: "#EDF2F7",
  cleanroomWallLower: "#CBD5E1",
  cleanroomCeiling: "#F8FAFC",
  cleanroomFloor: "#DCE4EE",
  medicalBlueMattress: "#1D4ED8",
  medicalGreenScreen: "#10B981",

  // Industrial Steel & Hangar
  steelDark: "#1E293B",
  steelMid: "#475569",
  steelLight: "#94A3B8",
  aluminum: "#CBD5E1",
  titanium: "#64748B",
  concreteFloor: "#B8C2CC",
  concreteDark: "#64748B",
  asphalt: "#334155",
  safetyYellow: "#FACC15",

  // NASA Branding & Spacecraft
  nasaBlue: "#0B3D91",
  nasaBlueBright: "#1D63DC",
  nasaRed: "#FC3D21",
  spaceWhite: "#F8FAFC",
  kaptonGold: "#F59E0B",
  solarGold: "#FFC72C",

  // Monitors & Telemetry
  screenGlass: "#091526",
  screenCyan: "#00E5FF",
  screenGreen: "#10B981",
  screenAmber: "#FBBF24",
  screenRed: "#EF4444",

  // Outdoor Cape Canaveral Launch Complex
  grass: "#2D5A3F",
  grassLight: "#3B7A57",
  skyUpper: "#0F294A",
  skyMid: "#1E60A8",
  skyHorizon: "#7DD3FC",
  dawnGlow: "#FDBA74",
  sunCore: "#FEF08A",
  cloud: "#F1F5F9",
  flameOuter: "#F97316",
  flameCore: "#FEF08A",

  // Lunar Surface & Space
  lunarLight: "#CBD5E1",
  lunarMid: "#94A3B8",
  lunarDark: "#475569",
  lunarShadow: "#1E293B",
  earthBlue: "#2563EB",
  earthCloud: "#F8FAFC",
} as const;
