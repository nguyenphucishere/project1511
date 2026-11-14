"use client";

import { useEffect, useState } from "react";
import { LOADING_FADE_MS, SceneLoading, usePreloadProgress } from "@/components/hud/SceneLoading";
import { WorkshopScene } from "./WorkshopScene";

/** Frames and time the scene gets to draw behind the loading screen before it fades. */
const MIN_WARMUP_MS = 400;

/**
 * Gate in front of the assembly hall. The hall mounts only after the preload job (code, textures,
 * lighting) has finished, so its timers, voice lines and crane never start while the player is
 * still looking at a loading screen. The screen then stays up for a moment while the first
 * frames are drawn and shaders compile, and fades out.
 */
export function WorkshopGate({ onComplete }: { onComplete: () => void }) {
  const { done } = usePreloadProgress("workshop");
  const [warm, setWarm] = useState(true);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!done) return;
    let r1 = 0;
    let r2 = 0;
    let frames = false;
    let timer = false;
    const check = () => {
      if (frames && timer) setWarm(false);
    };
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
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
      cancelAnimationFrame(r2);
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
      {done && <WorkshopScene onComplete={onComplete} />}
      {!gone && <SceneLoading scene="workshop" fading={done && !warm} />}
    </>
  );
}
