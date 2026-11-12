import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/safeStorage";
import type { LaunchConfig } from "@/lib/simulation/launch.types";
import { ORBITS, PAYLOADS, VEHICLES, WINDOWS } from "@/mocks/launch-options";
import { FIRST_STEP_ID, FLOW, chapterStartId, getStep, stepIndex, type ChapterId } from "./flow";

/** What the END screen summarises. Kept with the checkpoint so a reload doesn't lose it. */
export interface MissionLog {
  /** Launches flown in Scene 3, the successful one included. */
  launchAttempts: number;
  /** The configuration that reached orbit. */
  launchConfig: LaunchConfig | null;
  /** Rocket parts inspected in Scene 2 (0 if that chapter was skipped). */
  partsInspected: number;
  /** Scene 4 touchdown readings, null until the lander is down. */
  landing: LandingRecord | null;
}

export interface LandingRecord {
  /** Vertical speed at contact, m/s (positive number). */
  touchdownMs: number;
  fuelLeftPct: number;
}

const EMPTY_LOG: MissionLog = { launchAttempts: 0, launchConfig: null, partsInspected: 0, landing: null };

/** Every run starts with an empty mission log, wherever it starts. */
const startRun = (stepId: string) => ({ stepId, log: EMPTY_LOG });

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
  log: MissionLog;
  recordLaunch: (config: LaunchConfig, success: boolean) => void;
  recordParts: (count: number) => void;
  recordLanding: (landing: LandingRecord) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      stepId: null,
      hydrated: false,
      newGame: () => set(startRun(FIRST_STEP_ID)),
      advanceFrom: (fromStepId) => {
        const { stepId } = get();
        if (!stepId || stepId !== fromStepId) return;
        const next = FLOW[stepIndex(stepId) + 1];
        if (next) set({ stepId: next.id });
      },
      // A chapter jump starts a new run too: skipped chapters read "not played" on the END screen.
      jumpToChapter: (chapter) => set(startRun(chapterStartId(chapter))),
      log: EMPTY_LOG,
      recordLaunch: (config, success) =>
        set((s) => ({
          log: {
            ...s.log,
            launchAttempts: s.log.launchAttempts + 1,
            launchConfig: success ? config : s.log.launchConfig,
          },
        })),
      recordParts: (count) => set((s) => ({ log: { ...s.log, partsInspected: count } })),
      recordLanding: (landing) => set((s) => ({ log: { ...s.log, landing } })),
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
        const parts = saved?.log?.partsInspected;
        const landing = saved?.log?.landing;
        return {
          ...current,
          // Drop checkpoints that no longer exist after a flow change.
          stepId: typeof id === "string" && getStep(id) ? id : null,
          log: {
            launchAttempts: typeof attempts === "number" ? attempts : 0,
            launchConfig: isLaunchConfig(saved?.log?.launchConfig) ? saved.log.launchConfig : null,
            partsInspected: typeof parts === "number" ? parts : 0,
            landing:
              landing && typeof landing.touchdownMs === "number" && typeof landing.fuelLeftPct === "number" ? landing : null,
          },
        };
      },
      onRehydrateStorage: () => () => {
        useGameStore.setState({ hydrated: true });
      },
    },
  ),
);

/** A saved config is only trusted if every field names an option that still exists. */
function isLaunchConfig(c: unknown): c is LaunchConfig {
  const x = c as Partial<LaunchConfig> | null | undefined;
  return (
    !!x &&
    VEHICLES.some((v) => v.id === x.vehicle) &&
    PAYLOADS.some((p) => p.id === x.payload) &&
    ORBITS.some((o) => o.km === x.orbitKm) &&
    WINDOWS.some((w) => w.id === x.window) &&
    typeof x.fuelPct === "number"
  );
}

/** A finished game is not something to "continue". */
export function hasContinuableProgress(stepId: string | null): boolean {
  return stepId !== null && getStep(stepId)?.kind !== "end";
}
