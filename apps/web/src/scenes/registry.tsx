"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { SceneLoading } from "@/components/hud/SceneLoading";
import type { SceneId } from "@/game/flow";

export interface SceneProps {
  onComplete: () => void;
}

const loading = () => <div className="h-dvh w-full bg-space-deep" aria-hidden />;

/**
 * Playable scenes by chapter, each loaded on demand so three.js stays out of the title,
 * briefing, and cutscene bundles.
 */
export const SCENES: Record<SceneId, ComponentType<SceneProps>> = {
  medical: dynamic(() => import("./medical/MedicalScene").then((m) => m.MedicalScene), { ssr: false, loading }),
  "mission-control": dynamic(() => import("./mission-control/MissionControlScene").then((m) => m.MissionControlScene), {
    ssr: false,
    loading,
  }),
  ascent: dynamic(() => import("./ascent/AscentScene").then((m) => m.AscentScene), { ssr: false, loading }),
  translunar: dynamic(() => import("./translunar/TranslunarScene").then((m) => m.TranslunarScene), { ssr: false, loading }),
  return: dynamic(() => import("./translunar/TranslunarScene").then((m) => m.ReturnScene), { ssr: false, loading }),
  "lunar-descent": dynamic(() => import("./lunar-descent/LunarDescentScene").then((m) => m.LunarDescentScene), {
    ssr: false,
    loading,
  }),
  // The hall is the heaviest scene: it has a loading screen, and its assets are preloaded ahead
  // of time (see ./preload.ts), so the screen is usually brief or skipped.
  workshop: dynamic(() => import("./workshop/WorkshopGate").then((m) => m.WorkshopGate), {
    ssr: false,
    loading: () => <SceneLoading scene="workshop" />,
  }),
};
