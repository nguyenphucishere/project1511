import { FLOW, stepIndex, type SceneId } from "@/game/flow";
import { useSettingsStore } from "@/game/settingsStore";
import { warmAllVoices } from "@/game/sfx";
import { SCENE_ASSETS } from "./assets";
import { WORKSHOP_FILES, WORKSHOP_TEXTURE_GROUPS, STUDIO_HDR } from "./workshop/assets";

/**
 * Scene preloading. A heavy scene is code-split and loads textures and lighting; this warms
 * all of it while the player is still in an earlier step, and reports progress for the loading
 * screen. Kept free of three.js imports so it can live in the always-loaded bundle (the heavy
 * parts are dynamic imports inside the jobs).
 */

export interface PreloadState {
  /** 0..100. */
  progress: number;
  done: boolean;
}

const IDLE: PreloadState = { progress: 0, done: false };
const DONE: PreloadState = { progress: 100, done: true };

interface Job {
  files: { url: string; weight: number }[];
  /** Weight of the code chunk in the progress bar. */
  chunkWeight: number;
  loadChunk: () => Promise<unknown>;
  /** Fills the 3D loaders' caches from the warm HTTP cache so the scene mounts without suspending. */
  fillCaches: () => Promise<void>;
}

/** The preload job for a scene that has only plain data (see ./assets.ts) and a code chunk. */
function assetJob(scene: keyof typeof SCENE_ASSETS, loadChunk: () => Promise<unknown>): Job {
  const a = SCENE_ASSETS[scene]!;
  return {
    files: a.files,
    chunkWeight: 4,
    loadChunk,
    fillCaches: async () => {
      const { useTexture, useEnvironment } = await import("@react-three/drei");
      for (const group of a.textures) useTexture.preload(group as string[]);
      for (const files of a.hdr) useEnvironment.preload({ files });
    },
  };
}

const JOBS: Record<SceneId, Job> = {
  medical: assetJob("medical", () => import("./medical/MedicalScene")),
  workshop: {
    files: WORKSHOP_FILES,
    chunkWeight: 4,
    loadChunk: () => import("./workshop/WorkshopGate"),
    fillCaches: async () => {
      const { useTexture, useEnvironment } = await import("@react-three/drei");
      for (const group of WORKSHOP_TEXTURE_GROUPS) useTexture.preload(group as string[]);
      useEnvironment.preload({ files: STUDIO_HDR });
    },
  },
  "mission-control": assetJob("mission-control", () => import("./mission-control/MissionControlScene")),
  ascent: assetJob("ascent", () => import("./ascent/AscentScene")),
  translunar: assetJob("translunar", () => import("./translunar/TranslunarScene")),
  return: assetJob("return", () => import("./translunar/TranslunarScene")),
  liftoff: assetJob("liftoff", () => import("./homeward/HomewardScenes")),
  "lunar-descent": assetJob("lunar-descent", () => import("./lunar-descent/LunarDescentScene")),
};

/* ---------------------------------------------------------------- the voices */

/** The share of a scene's loading bar that is the voice recordings. */
const VOICE_WEIGHT = 10;
/** The longest a scene waits for the recordings: past it the scene starts and the rest arrive as they can. */
const VOICE_WAIT_MS = 30_000;
const voiceWarm = new Map<string, Promise<unknown>>();

/**
 * Downloads every voice recording of the player's language into memory (once), so no line is fetched
 * while a scene is running: a download in the way is what made voices start late against the picture.
 * Starts on the title screen; a scene's loading screen waits for it.
 */
export function ensureVoicesWarm(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.resolve();
  const locale = useSettingsStore.getState().locale;
  let p = voiceWarm.get(locale);
  if (!p) {
    p = warmAllVoices(locale).catch(() => undefined);
    voiceWarm.set(locale, p);
  }
  return p;
}

const states = new Map<SceneId, PreloadState>();
const running = new Map<SceneId, Promise<void>>();
const listeners = new Set<() => void>();

function publish(scene: SceneId, next: PreloadState) {
  states.set(scene, next);
  for (const l of listeners) l();
}

export function subscribePreload(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPreloadState(scene: SceneId): PreloadState {
  return states.get(scene) ?? IDLE;
}

export const getServerPreloadState = (): PreloadState => IDLE;

/** Scenes that sit within `lookahead` steps from (and including) `stepId`, in the order they come up. */
export function scenesToPreload(stepId: string, lookahead = FLOW.length): SceneId[] {
  const from = stepIndex(stepId);
  if (from < 0) return [];
  const out: SceneId[] = [];
  for (let i = from; i < FLOW.length && i <= from + lookahead; i++) {
    const step = FLOW[i];
    if (step.kind === "scene" && JOBS[step.scene] && !out.includes(step.scene)) out.push(step.scene);
  }
  return out;
}

/** Starts (once) and returns the preload job for a scene. Failures never block the scene. */
export function preloadScene(scene: SceneId): Promise<void> {
  const existing = running.get(scene);
  if (existing) return existing;
  const job = JOBS[scene];
  if (!job) return Promise.resolve();

  const total = job.chunkWeight + VOICE_WEIGHT + job.files.reduce((n, f) => n + f.weight, 0);
  let loaded = 0;
  const advance = (weight: number) => {
    loaded += weight;
    // Cap below 100: the last slice is the cache fill, which completes the job.
    publish(scene, { progress: Math.min(97, Math.round((loaded / total) * 100)), done: false });
  };
  publish(scene, IDLE);

  const chunk = job.loadChunk().catch(() => undefined).then(() => advance(job.chunkWeight));
  const files = job.files.map((f) =>
    fetch(f.url)
      .then((r) => r.blob())
      .catch(() => undefined)
      .then(() => advance(f.weight)),
  );

  const voices = Promise.race([ensureVoicesWarm(), new Promise((r) => window.setTimeout(r, VOICE_WAIT_MS))]).then(() => advance(VOICE_WEIGHT));

  const promise = Promise.all([chunk, voices, ...files])
    .then(() => job.fillCaches())
    .catch(() => undefined)
    .then(() => publish(scene, DONE));
  running.set(scene, promise);
  return promise;
}

/** Waits a moment and then for an idle frame, so the preload never starts in the middle of an animation. */
function breather(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 1500 });
      else resolve();
    }, 700);
  });
}

/** The scenes still to warm, one after another so they never fight over the connection. */
let chain: Promise<void> = Promise.resolve();
const queued = new Set<SceneId>();

/**
 * Called as the player moves through the flow (and from the title screen): quietly warms every
 * scene still ahead, nearest first, one at a time. Waits for an idle moment so it does not
 * stutter the current scene, and skips on data-saver connections (the loading screen then does
 * the work on arrival).
 */
export function preloadUpcoming(stepId: string): void {
  if (typeof window === "undefined") return;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData) return;
  const scenes = scenesToPreload(stepId).filter((s) => !queued.has(s));
  if (scenes.length === 0) return;
  for (const s of scenes) queued.add(s);
  const start = () => {
    // One scene at a time, with a breather before each: evaluating a scene's code and decoding its
    // textures is heavy, and without the gaps the animation on screen (the title) stutters.
    for (const s of scenes) chain = chain.then(() => breather()).then(() => preloadScene(s));
  };
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(start, { timeout: 2000 });
  else setTimeout(start, 300);
}

/* ---------------------------------------------------------------- title-screen warm-up */

const warmed = new Map<SceneId, number>();
const warmQueued = new Set<SceneId>();

/**
 * The gentle warm-up used on the title screen: it only downloads the scenes' files into the HTTP
 * cache (network work, no main-thread cost). It deliberately does NOT evaluate any scene code or
 * decode any texture or HDR environment: that is heavy synchronous work that stutters the title's
 * animation, so it waits until the player has pressed start (see preloadUpcoming).
 */
export function warmUpcoming(stepId: string): void {
  if (typeof window === "undefined") return;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData) return;
  void ensureVoicesWarm();
  const scenes = scenesToPreload(stepId).filter((s) => !warmQueued.has(s));
  for (const s of scenes) warmQueued.add(s);
  let chainWarm: Promise<void> = Promise.resolve();
  for (const scene of scenes) {
    chainWarm = chainWarm
      .then(() => breather())
      .then(async () => {
        const files = JOBS[scene]?.files ?? [];
        const total = files.reduce((n, f) => n + f.weight, 0) || 1;
        let got = 0;
        warmed.set(scene, 0);
        for (const f of files) {
          try {
            const r = await fetch(f.url);
            await r.arrayBuffer();
          } catch {
            /* a missing file never blocks the title */
          }
          got += f.weight;
          warmed.set(scene, Math.round((got / total) * 100));
          for (const l of listeners) l();
        }
        warmed.set(scene, 100);
        for (const l of listeners) l();
      });
  }
}

/** 0..100 across every scene, for the title screen's loading bar (files downloaded so far). */
export function warmProgress(): number {
  const all = Object.keys(JOBS) as SceneId[];
  return Math.round(all.reduce((n, s) => n + (warmed.get(s) ?? 0), 0) / all.length);
}

/** Overall progress (0..100) across every scene that will be played, for the title screen. */
export function overallProgress(): number {
  const all = Object.keys(JOBS) as SceneId[];
  return Math.round(all.reduce((n, s) => n + getPreloadState(s).progress, 0) / all.length);
}
