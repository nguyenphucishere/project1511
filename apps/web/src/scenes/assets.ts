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
const MOON = "/assets/textures/moon_4k.jpg";
const CROWD = ["/assets/audio/crowd-murmur.mp3", "/assets/audio/crowd-awe.mp3", "/assets/audio/crowd-cheer.mp3"];

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
  medical: { files: [studio], textures: [], hdr: [STUDIO_HDR] },
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
    files: [studio, { url: EARTH_DAY, weight: 4 }, { url: EARTH_CLOUDS, weight: 5 }, { url: MILKY_WAY, weight: 1 }, { url: MOON, weight: 6 }],
    textures: [earthPair, MILKY_WAY, MOON],
    hdr: [STUDIO_HDR],
  },
  "lunar-descent": {
    files: [studio, { url: MILKY_WAY, weight: 1 }, { url: MOON, weight: 6 }, { url: EARTH_DAY, weight: 4 }, { url: EARTH_CLOUDS, weight: 5 }],
    textures: [MILKY_WAY, MOON, earthPair],
    hdr: [STUDIO_HDR],
  },
};
SCENE_ASSETS.return = SCENE_ASSETS.translunar!;
