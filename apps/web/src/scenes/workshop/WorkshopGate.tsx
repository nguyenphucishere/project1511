"use client";

import { SceneGate } from "@/components/hud/SceneGate";
import { WorkshopScene } from "./WorkshopScene";

/** Gate in front of the assembly hall: it mounts once the hall's assets are preloaded. */
export function WorkshopGate({ onComplete }: { onComplete: () => void }) {
  return (
    <SceneGate scene="workshop">
      <WorkshopScene onComplete={onComplete} />
    </SceneGate>
  );
}
