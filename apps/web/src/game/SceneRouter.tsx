"use client";

import { useEffect, useRef, useState } from "react";
import { CutscenePlayer } from "@/components/cutscene/CutscenePlayer";
import { DialogueOverlay } from "@/components/cutscene/DialogueOverlay";
import { ScenePlaceholder } from "@/components/cutscene/ScenePlaceholder";
import { EndScreen } from "@/components/cutscene/EndScreen";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENES } from "@/scenes/registry";
import { cn } from "@/lib/utils";
import { getStep, type Step, type Transition } from "./flow";
import { useGameStore } from "./gameStore";

const FADE_MS = 350;
const HOLD_MS: Record<Transition, number> = { none: 0, fade: 80, "black-hold": 900 };

/**
 * Renders the current step and runs the transition into it: fade the screen to black,
 * swap content while covered, hold (the story's "screen goes dark" beat), fade back in.
 */
export function SceneRouter({ stepId }: { stepId: string }) {
  const advanceFrom = useGameStore((s) => s.advanceFrom);
  const reduced = useReducedMotion();
  const [shownId, setShownId] = useState(stepId);
  const [covered, setCovered] = useState(false);
  // Read through a ref: depending on shownId would re-run this effect at the swap and
  // cancel the pending reveal, leaving the screen black.
  const shownRef = useRef(stepId);

  useEffect(() => {
    if (stepId === shownRef.current) {
      setCovered(false);
      return;
    }
    const show = () => {
      shownRef.current = stepId;
      setShownId(stepId);
    };
    const enter = getStep(stepId)?.enter ?? "fade";
    if (enter === "none" || reduced) {
      show();
      setCovered(false);
      return;
    }
    setCovered(true);
    const swap = window.setTimeout(show, FADE_MS);
    const reveal = window.setTimeout(() => setCovered(false), FADE_MS + HOLD_MS[enter]);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(reveal);
    };
  }, [stepId, reduced]);

  const step = getStep(shownId);
  const done = () => advanceFrom(shownId);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-space-deep">
      {step && <StepView key={step.id} step={step} onDone={done} />}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 z-40 bg-space-deep transition-opacity ease-in-out",
          covered ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      />
    </div>
  );
}

function StepView({ step, onDone }: { step: Step; onDone: () => void }) {
  switch (step.kind) {
    case "cutscene":
      return <CutscenePlayer video={step.video} onComplete={onDone} />;
    case "briefing":
      return <DialogueOverlay briefing={step.briefing} chapter={step.chapter} onDone={onDone} />;
    case "scene": {
      const Scene = SCENES[step.scene];
      return Scene ? <Scene onComplete={onDone} /> : <ScenePlaceholder scene={step.scene} onComplete={onDone} />;
    }
    case "end":
      return <EndScreen />;
  }
}
