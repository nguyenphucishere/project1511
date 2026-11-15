/**
 * Files the 3D scenes other than the assembly hall load, as plain data (no three.js) so the
 * preloader can fetch them before a scene mounts. Weights are rough relative sizes for the
 * progress bar. `GROUPS` mirror how each scene asks drei's useTexture for them: it caches by
 * the exact URL (or URL list), so a preload only helps when the group matches.
 */
import { STUDIO_HDR } from "./workshop/assets";

export const SKY_HDR = "/assets/env/sky_day.hdr";
const EARTH_DAY = "/assets/textures/earth_day_6k.jpg";
const EARTH_NIGHT = "/assets/textures/earth_night_4k.jpg";
const EARTH_CLOUDS = "/assets/textures/earth_clouds_4k.jpg";
const MILKY_WAY = "/assets/textures/milky_way_4k.jpg";
/** The older shaded Moon map: still the tiled ground of the landing scene (its baked shading doubles as the bump). */
const MOON = "/assets/textures/moon_4k.jpg";
/** The Moon globe: LRO colour mosaic and a normal map from the LOLA elevation model (NASA CGI Moon Kit). */
export const MOON_COLOR = "/assets/textures/moon_lroc_4k.jpg";
export const MOON_NORMAL = "/assets/textures/moon_normal_4k.webp";
/** The three crew drawn in the cabin (see translunar/Cabin.tsx), loaded one by one. */
const CREW = ["orange", "navy", "pink"].map((n) => `/assets/characters/viewers/${n}.webp`);
const CROWD = ["/assets/audio/crowd-murmur.mp3", "/assets/audio/crowd-awe.mp3", "/assets/audio/crowd-cheer.mp3"];
const DOCTOR_FRAMES = ["/assets/characters/doctor/idle.webp", "/assets/characters/doctor/wave.webp"];

export interface SceneAssets {
  files: { url: string; weight: number }[];
  /** useTexture cache keys. */
  textures: (string | string[])[];
  /** Environment maps (useEnvironment cache keys). */
  hdr: string[];
}

const studio = { url: STUDIO_HDR, weight: 2 };
const earthPair = [EARTH_DAY, EARTH_CLOUDS];

export const SCENE_ASSETS: Record<string, SceneAssets> = {
  medical: {
    files: [studio, ...DOCTOR_FRAMES.map((url) => ({ url, weight: 0.5 }))],
    textures: [DOCTOR_FRAMES],
    hdr: [STUDIO_HDR],
  },
  "mission-control": {
    files: [studio, { url: SKY_HDR, weight: 6 }, ...CROWD.map((url) => ({ url, weight: 0.5 }))],
    textures: [],
    hdr: [STUDIO_HDR, SKY_HDR],
  },
  ascent: {
    files: [studio, { url: EARTH_DAY, weight: 4 }, { url: EARTH_NIGHT, weight: 1 }, { url: EARTH_CLOUDS, weight: 5 }, { url: MILKY_WAY, weight: 1 }],
    textures: [[EARTH_DAY, EARTH_NIGHT, EARTH_CLOUDS, MILKY_WAY]],
    hdr: [STUDIO_HDR],
  },
  translunar: {
    files: [studio, { url: EARTH_DAY, weight: 4 }, { url: EARTH_CLOUDS, weight: 5 }, { url: MILKY_WAY, weight: 1 }, { url: MOON_COLOR, weight: 3 }, { url: MOON_NORMAL, weight: 4 }, ...CREW.map((url) => ({ url, weight: 0.3 })), { url: "/assets/audio/apollo8-genesis.mp3", weight: 1 }],
    textures: [earthPair, MILKY_WAY, MOON_COLOR, MOON_NORMAL, ...CREW.map((url) => [url])],
    hdr: [STUDIO_HDR],
  },
  "lunar-descent": {
    files: [studio, { url: MILKY_WAY, weight: 1 }, { url: MOON, weight: 6 }, { url: MOON_COLOR, weight: 3 }, { url: MOON_NORMAL, weight: 4 }, { url: EARTH_DAY, weight: 4 }, { url: EARTH_CLOUDS, weight: 5 }],
    textures: [MILKY_WAY, MOON, MOON_COLOR, MOON_NORMAL, earthPair],
    hdr: [STUDIO_HDR],
  },
};
SCENE_ASSETS.return = SCENE_ASSETS.translunar!;
