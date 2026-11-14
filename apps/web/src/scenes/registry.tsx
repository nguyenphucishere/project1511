"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { SceneGate } from "@/components/hud/SceneGate";
import { SceneLoading } from "@/components/hud/SceneLoading";
import type { SceneId } from "@/game/flow";

export interface SceneProps {
  onComplete: () => void;
}

/**
 * Playable scenes by chapter, each loaded on demand so three.js stays out of the title,
 * briefing, and cutscene bundles. Every scene sits behind a gate with a loading screen and
 * progress bar; its code and assets are fetched ahead of time (see ./preload.ts), so the screen
 * is usually brief.
 */
function gated(scene: SceneId, load: () => Promise<ComponentType<SceneProps>>): ComponentType<SceneProps> {
  return dynamic(
    () =>
      load().then((Scene) =>
        function Gated({ onComplete }: SceneProps) {
          return (
            <SceneGate scene={scene}>
              <Scene onComplete={onComplete} />
            </SceneGate>
          );
        },
      ),
    { ssr: false, loading: () => <SceneLoading scene={scene} /> },
  );
}

export const SCENES: Record<SceneId, ComponentType<SceneProps>> = {
  medical: gated("medical", () => import("./medical/MedicalScene").then((m) => m.MedicalScene)),
  "mission-control": gated("mission-control", () => import("./mission-control/MissionControlScene").then((m) => m.MissionControlScene)),
  ascent: gated("ascent", () => import("./ascent/AscentScene").then((m) => m.AscentScene)),
  translunar: gated("translunar", () => import("./translunar/TranslunarScene").then((m) => m.TranslunarScene)),
  return: gated("return", () => import("./translunar/TranslunarScene").then((m) => m.ReturnScene)),
  "lunar-descent": gated("lunar-descent", () => import("./lunar-descent/LunarDescentScene").then((m) => m.LunarDescentScene)),
  // The hall has its own gate (WorkshopGate) so its loading copy and tips stay specific.
  workshop: dynamic(() => import("./workshop/WorkshopGate").then((m) => m.WorkshopGate), {
    ssr: false,
    loading: () => <SceneLoading scene="workshop" />,
  }),
};
