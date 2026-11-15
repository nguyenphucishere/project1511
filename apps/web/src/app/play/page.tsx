"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/hud/TopBar";
import { SceneRouter } from "@/game/SceneRouter";
import { voiceTracer } from "@/game/sfx";
import { useGameStore } from "@/game/gameStore";
import { useT } from "@/i18n/useT";

/** The game. Without a started game (no checkpoint), the player goes back to the title screen. */
export default function PlayPage() {
  const t = useT();
  const router = useRouter();
  const stepId = useGameStore((s) => s.stepId);
  const hydrated = useGameStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && !stepId) router.replace("/");
  }, [hydrated, stepId, router]);

  // The independent voice watcher needs to know where the scenes change, to tell a line that outlives its scene.
  useEffect(() => {
    if (stepId) voiceTracer.scene(stepId);
  }, [stepId]);

  if (!hydrated || !stepId) {
    return (
      <main className="flex h-dvh items-center justify-center bg-space-deep">
        <p className="text-sm text-foreground/60" role="status">
          {t.play.loading}
        </p>
      </main>
    );
  }

  return (
    <main className="relative">
      <TopBar />
      <SceneRouter stepId={stepId} />
    </main>
  );
}
