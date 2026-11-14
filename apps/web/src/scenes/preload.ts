import { FLOW, stepIndex, type SceneId } from "@/game/flow";
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
  "lunar-descent": assetJob("lunar-descent", () => import("./lunar-descent/LunarDescentScene")),
};

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

  const total = job.chunkWeight + job.files.reduce((n, f) => n + f.weight, 0);
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

  const promise = Promise.all([chunk, ...files])
    .then(() => job.fillCaches())
    .catch(() => undefined)
    .then(() => publish(scene, DONE));
  running.set(scene, promise);
  return promise;
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
    for (const s of scenes) chain = chain.then(() => preloadScene(s));
  };
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(start, { timeout: 2000 });
  else setTimeout(start, 300);
}

/** Overall progress (0..100) across every scene that will be played, for the title screen. */
export function overallProgress(): number {
  const all = Object.keys(JOBS) as SceneId[];
  return Math.round(all.reduce((n, s) => n + getPreloadState(s).progress, 0) / all.length);
}
