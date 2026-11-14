import { FLOW, stepIndex, type SceneId } from "@/game/flow";
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

const JOBS: Partial<Record<SceneId, Job>> = {
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

/** Scenes with a preload job that sit within `lookahead` steps from (and including) `stepId`. */
export function scenesToPreload(stepId: string, lookahead = 4): SceneId[] {
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

/**
 * Called as the player moves through the flow: quietly warms the heavy scenes that are about to
 * come up. Waits for an idle moment so it does not stutter the current scene, and skips on
 * data-saver connections (the loading screen then does the work on arrival).
 */
export function preloadUpcoming(stepId: string): void {
  if (typeof window === "undefined") return;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData) return;
  const scenes = scenesToPreload(stepId);
  if (scenes.length === 0) return;
  const start = () => scenes.forEach((s) => void preloadScene(s));
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(start, { timeout: 2000 });
  else setTimeout(start, 300);
}
