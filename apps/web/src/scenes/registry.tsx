"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SceneId } from "@/game/flow";

export interface SceneProps {
  onComplete: () => void;
}

const loading = () => <div className="h-dvh w-full bg-space-deep" aria-hidden />;

/**
 * Playable scenes by chapter, each loaded on demand so three.js stays out of the title,
 * briefing, and cutscene bundles. A chapter without an entry falls back to ScenePlaceholder,
 * so the full flow stays walkable while scenes are built one phase at a time.
 */
export const SCENES: Partial<Record<SceneId, ComponentType<SceneProps>>> = {
  medical: dynamic(() => import("./medical/MedicalScene").then((m) => m.MedicalScene), { ssr: false, loading }),
  "mission-control": dynamic(() => import("./mission-control/MissionControlScene").then((m) => m.MissionControlScene), {
    ssr: false,
    loading,
  }),
  workshop: dynamic(() => import("./workshop/WorkshopScene").then((m) => m.WorkshopScene), { ssr: false, loading }),
};
