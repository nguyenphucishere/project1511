import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/safeStorage";
import { FIRST_STEP_ID, FLOW, chapterStartId, getStep, stepIndex, type ChapterId } from "./flow";

export interface GameState {
  /** Current step in FLOW, or null before the player presses Start. This is the checkpoint. */
  stepId: string | null;
  /** True once the saved checkpoint has been read; the game waits for it to avoid a flash. */
  hydrated: boolean;
  newGame: () => void;
  /**
   * Moves to the step after `fromStepId`, only if that is still the current step. Screens pass
   * their own id, so a double fire (video ends while Skip is pressed) cannot skip a step.
   */
  advanceFrom: (fromStepId: string) => void;
  jumpToChapter: (chapter: ChapterId) => void;
  /** Clears progress (title screen "New game" also calls newGame afterwards). */
  reset: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      stepId: null,
      hydrated: false,
      newGame: () => set({ stepId: FIRST_STEP_ID }),
      advanceFrom: (fromStepId) => {
        const { stepId } = get();
        if (!stepId || stepId !== fromStepId) return;
        const next = FLOW[stepIndex(stepId) + 1];
        if (next) set({ stepId: next.id });
      },
      jumpToChapter: (chapter) => set({ stepId: chapterStartId(chapter) }),
      reset: () => set({ stepId: null }),
    }),
    {
      name: "moonbound.progress",
      version: 1,
      storage: safeLocalStorage,
      skipHydration: true,
      partialize: ({ stepId }) => ({ stepId }),
      merge: (persisted, current) => {
        const id = (persisted as { stepId?: unknown } | undefined)?.stepId;
        // Drop checkpoints that no longer exist after a flow change.
        return { ...current, stepId: typeof id === "string" && getStep(id) ? id : null };
      },
      onRehydrateStorage: () => () => {
        useGameStore.setState({ hydrated: true });
      },
    },
  ),
);

/** A finished game is not something to "continue". */
export function hasContinuableProgress(stepId: string | null): boolean {
  return stepId !== null && getStep(stepId)?.kind !== "end";
}
