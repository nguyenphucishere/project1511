"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Progress } from "@/components/ui/progress";
import { ParallaxCanvas } from "@/components/cutscene/ParallaxCanvas";
import { format } from "@/i18n";
import { useT } from "@/i18n/useT";
import type { SceneId } from "@/game/flow";
import { getPreloadState, getServerPreloadState, preloadScene, subscribePreload } from "@/scenes/preload";
import { cn } from "@/lib/utils";

/** Live preload progress for a scene (0..100, and whether the job has finished). */
export function usePreloadProgress(scene: SceneId) {
  return useSyncExternalStore(subscribePreload, () => getPreloadState(scene), getServerPreloadState);
}

export const LOADING_FADE_MS = 400;

/**
 * Full-screen loading screen for a heavy scene. It starts the scene's preload job if nothing has
 * yet (a no-op when the preload-ahead already ran), so it works both as the code-split fallback
 * and as the gate in front of the scene. `fading` plays the exit transition.
 */
export function SceneLoading({ scene, fading = false }: { scene: SceneId; fading?: boolean }) {
  const t = useT();
  const { progress, done } = usePreloadProgress(scene);
  const copy = t.sceneLoading;
  const [tip, setTip] = useState(0);

  useEffect(() => {
    void preloadScene(scene);
  }, [scene]);

  useEffect(() => {
    const id = window.setInterval(() => setTip((n) => (n + 1) % 3), 4500);
    return () => window.clearInterval(id);
  }, []);

  const tips = [copy.tip1, copy.tip2, copy.tip3];
  const stage = fading || done ? copy.stageWarmup : progress < 20 ? copy.stageCode : copy.stageAssets;
  const shown = done ? 100 : progress;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!fading}
      className={cn(
        "absolute inset-0 z-[60] overflow-hidden bg-space-deep transition-opacity ease-out",
        fading ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${LOADING_FADE_MS}ms` }}
      data-scene-loading={scene}
    >
      <ParallaxCanvas mode="rise" className="absolute inset-0 opacity-50" />
      <div className="absolute inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2 sm:inset-x-10">
        <div className="bezel bezel-gold bg-space-deep/95 px-6 py-6 sm:px-8">
          <p className="font-mono text-xs tracking-widest text-primary">{stage.toUpperCase()}</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{copy.workshopTitle}</h1>
          <p className="mt-1 text-sm text-foreground/75">{copy.workshopSubtitle}</p>

          <div className="mt-5 flex items-center gap-3">
            <Progress value={shown} aria-label={stage} className="h-3 flex-1" />
            <span className="w-12 text-right font-mono text-sm">{format(copy.percent, { n: shown })}</span>
          </div>

          <p className="mt-4 min-h-[2.5rem] text-xs italic text-foreground/60">{tips[tip]}</p>
        </div>
      </div>
    </div>
  );
}
