/**
 * Every file the assembly hall loads, as plain data (no three.js), so the preloader can fetch
 * them before the scene mounts. The groups mirror how the scene asks for them: drei's useTexture
 * caches by the exact URL list, so a preload only helps if the list matches.
 */
export const PH_DIR = "/assets/textures/ph";

/** Poly Haven PBR sets used by the hall (see textures.ts). */
export const HALL_TEXTURE_SETS = ["concrete_floor_02", "concrete_wall_008", "metal_plate_02", "corrugated_iron"] as const;

/** URLs of one PBR set in the order useTexture reads them: colour, normal, roughness. */
export function hallTextureUrls(name: string): [string, string, string] {
  return [`${PH_DIR}/${name}_diff.jpg`, `${PH_DIR}/${name}_nor_gl.jpg`, `${PH_DIR}/${name}_rough.jpg`];
}

export const MURAL_FLAG = "/assets/murals/us_flag.png";
export const MURAL_INSIGNIA = "/assets/murals/nasa_insignia.png";
/** Studio image-based light mounted by every WorldCanvas. */
export const STUDIO_HDR = "/assets/env/studio.hdr";

/** useTexture calls made by the hall: each entry is one cache key. */
export const WORKSHOP_TEXTURE_GROUPS: (string | string[])[] = [
  ...HALL_TEXTURE_SETS.map((n) => hallTextureUrls(n) as string[]),
  [MURAL_FLAG, MURAL_INSIGNIA], // Hall.tsx
  MURAL_FLAG, // RocketModel.tsx
];

/** Distinct files to download, with a rough weight (relative size) for the progress bar. */
export const WORKSHOP_FILES: { url: string; weight: number }[] = [
  ...HALL_TEXTURE_SETS.flatMap((n) => hallTextureUrls(n)).map((url) => ({
    url,
    weight: url.includes("concrete_floor_02_diff") ? 3 : 1,
  })),
  { url: MURAL_FLAG, weight: 1 },
  { url: MURAL_INSIGNIA, weight: 1 },
  { url: STUDIO_HDR, weight: 2 },
];
