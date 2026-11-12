import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/safeStorage";
import type { LaunchConfig } from "@/lib/simulation/launch.types";
import { FIRST_STEP_ID, FLOW, chapterStartId, getStep, stepIndex, type ChapterId } from "./flow";

/** What the END screen summarises. Kept with the checkpoint so a reload doesn't lose it. */
export interface MissionLog {
  /** Launches flown in Scene 3, the successful one included. */
  launchAttempts: number;
  /** The configuration that reached orbit. */
  launchConfig: LaunchConfig | null;
}

const EMPTY_LOG: MissionLog = { launchAttempts: 0, launchConfig: null };

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
  log: MissionLog;
  recordLaunch: (config: LaunchConfig, success: boolean) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      stepId: null,
      hydrated: false,
      newGame: () => set({ stepId: FIRST_STEP_ID, log: EMPTY_LOG }),
      advanceFrom: (fromStepId) => {
        const { stepId } = get();
        if (!stepId || stepId !== fromStepId) return;
        const next = FLOW[stepIndex(stepId) + 1];
        if (next) set({ stepId: next.id });
      },
      jumpToChapter: (chapter) => set({ stepId: chapterStartId(chapter) }),
      reset: () => set({ stepId: null, log: EMPTY_LOG }),
      log: EMPTY_LOG,
      recordLaunch: (config, success) =>
        set((s) => ({
          log: {
            launchAttempts: s.log.launchAttempts + 1,
            launchConfig: success ? config : s.log.launchConfig,
          },
        })),
    }),
    {
      name: "moonbound.progress",
      version: 1,
      storage: safeLocalStorage,
      skipHydration: true,
      partialize: ({ stepId, log }) => ({ stepId, log }),
      merge: (persisted, current) => {
        const saved = persisted as { stepId?: unknown; log?: Partial<MissionLog> } | undefined;
        const id = saved?.stepId;
        const attempts = saved?.log?.launchAttempts;
        return {
          ...current,
          // Drop checkpoints that no longer exist after a flow change.
          stepId: typeof id === "string" && getStep(id) ? id : null,
          log: {
            launchAttempts: typeof attempts === "number" ? attempts : 0,
            launchConfig: saved?.log?.launchConfig ?? null,
          },
        };
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
