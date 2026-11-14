"use client";

import { useEffect, useState } from "react";
import type { SceneId } from "@/game/flow";
import { LOADING_FADE_MS, SceneLoading, usePreloadProgress } from "./SceneLoading";

/** Time the scene gets to draw behind the loading screen (shaders compile) before it fades. */
const MIN_WARMUP_MS = 400;

/**
 * Gate in front of a heavy scene. The scene mounts only after its preload job (code, textures,
 * lighting) has finished, so its timers, voices and animations never start while the player is
 * still looking at a loading screen. The screen then stays up while the first frames are drawn
 * and shaders compile, and fades out.
 */
export function SceneGate({ scene, children }: { scene: SceneId; children: React.ReactNode }) {
  const { done } = usePreloadProgress(scene);
  const [warm, setWarm] = useState(true);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!done) return;
    let frames = false;
    let timer = false;
    const check = () => {
      if (frames && timer) setWarm(false);
    };
    const r1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        frames = true;
        check();
      });
    });
    const id = window.setTimeout(() => {
      timer = true;
      check();
    }, MIN_WARMUP_MS);
    return () => {
      cancelAnimationFrame(r1);
      window.clearTimeout(id);
    };
  }, [done]);

  useEffect(() => {
    if (warm) return;
    const id = window.setTimeout(() => setGone(true), LOADING_FADE_MS);
    return () => window.clearTimeout(id);
  }, [warm]);

  return (
    <>
      {done && children}
      {!gone && <SceneLoading scene={scene} fading={done && !warm} />}
    </>
  );
}
