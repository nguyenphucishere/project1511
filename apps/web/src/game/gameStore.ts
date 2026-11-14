import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocalizedText } from "@/i18n";
import { safeLocalStorage } from "@/lib/safeStorage";
import type { LaunchConfig } from "@/lib/simulation/launch.types";
import { ORBITS, PAYLOADS, VEHICLES, WINDOWS } from "@/mocks/launch-options";
import { isLoadout, type Loadout } from "@/scenes/workshop/loadout";
import { FIRST_STEP_ID, FLOW, chapterStartId, getNextStepId, getStep, type ChapterId } from "./flow";
import { hoverMarginSeconds, resolveLanding } from "./consequences";
import { ENDINGS, getEnding, type EndingDefinition, type EndingId } from "./endings";
import type { DecisionPointId } from "./decisions";

/** What the END screen summarises. Kept with the checkpoint so a reload doesn't lose it. */
export interface MissionLog {
  /** Launches flown in Scene 3, the successful one included. */
  launchAttempts: number;
  /** The configuration that reached orbit. */
  launchConfig: LaunchConfig | null;
  /** Rocket parts inspected in Scene 2 (0 if that chapter was skipped). */
  partsInspected: number;
  /** Engines and tanks chosen in Scene 2; the launch console starts from them. Null if skipped. */
  loadout: Loadout | null;
  /** Scene 4 touchdown readings, null until the lander is down. */
  landing: LandingRecord | null;
}

export interface LandingRecord {
  /** Vertical speed at contact, m/s (positive number). */
  touchdownMs: number;
  fuelLeftPct: number;
}

export interface NarrativeFlags {
  loxValveInspected?: boolean;
  uninspectedMicroleak?: boolean;
  passiveAbortAvailable?: boolean;
  [key: string]: boolean | undefined;
}

export interface NarrativePenalties {
  fuelPenaltyPct: number;
  deltaVPenaltyPct: number;
}

export interface NarrativeDebrief {
  title?: string | LocalizedText;
  subtitle?: string | LocalizedText;
  badgeText?: LocalizedText;
  quote?: string;
  quoteAttribution?: string;
  status?: "success" | "partial" | "fatal";
  score?: number;
  failureReason?: string;
  contingencyAddress?: string;
  contingencySpeechText?: LocalizedText;
  telemetry?: any;
  debriefReport?: LocalizedText[];
  [key: string]: any;
}

export interface NarrativeState {
  decisions: Record<string, string>;
  flags: NarrativeFlags;
  penalties: NarrativePenalties;
  delayCostM: number;
  activeAlarm: string | null;
  ending: EndingId | string | null;
  score: number;
  failureReason?: string;
  /** Seconds of hover fuel left at the final approach, after earlier shortcuts. Absent in old saves. */
  hoverMarginS?: number;
  debrief: NarrativeDebrief;
}

const EMPTY_LOG: MissionLog = {
  launchAttempts: 0,
  launchConfig: null,
  partsInspected: 0,
  loadout: null,
  landing: null,
};

const createInitialNarrative = (): NarrativeState => ({
  decisions: {},
  flags: {},
  penalties: { fuelPenaltyPct: 0, deltaVPenaltyPct: 0 },
  delayCostM: 0,
  activeAlarm: null,
  ending: null,
  score: 0,
  failureReason: undefined,
  debrief: {},
});

function toDebriefPayload(def: EndingDefinition) {
  const titleStr = typeof def.title === "object" ? def.title.en : String(def.title);
  const subtitleStr = typeof def.subtitle === "object" ? def.subtitle.en : String(def.subtitle);
  const contingencyAddress =
    def.contingencyAddress ??
    (typeof def.contingencySpeechText === "object" ? def.contingencySpeechText.en : def.contingencySpeechText);

  return {
    ...def,
    title: titleStr,
    titleLocalized: def.title,
    subtitle: subtitleStr,
    subtitleLocalized: def.subtitle,
    contingencyAddress,
  };
}

export interface GameState {
  /** Current step in FLOW, or null before the player presses Start. This is the checkpoint. */
  stepId: string | null;
  /** True once the saved checkpoint has been read; the game waits for it to avoid a flash. */
  hydrated: boolean;
  narrative: NarrativeState;
  decisions: Record<string, string>;
  endingId: EndingId | string | null;
  log: MissionLog;

  newGame: () => void;
  /**
   * Moves to the next step according to the dynamic state machine branching.
   */
  advanceFrom: (fromStepId: string) => void;
  jumpToChapter: (chapter: ChapterId) => void;
  makeDecision: (point: DecisionPointId, choice: string) => boolean;
  recordDecision: (point: DecisionPointId, choice: string) => boolean;
  triggerAlarm: (code: string) => void;
  setEnding: (endingId: EndingId | string) => void;
  recordLaunch: (config: LaunchConfig, success: boolean) => void;
  recordParts: (count: number) => void;
  recordLoadout: (loadout: Loadout) => void;
  recordLanding: (landing: LandingRecord) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      stepId: null,
      hydrated: false,
      narrative: createInitialNarrative(),
      decisions: {},
      endingId: null,
      log: EMPTY_LOG,

      newGame: () => {
        const narrative = createInitialNarrative();
        set({
          stepId: FIRST_STEP_ID,
          log: EMPTY_LOG,
          narrative,
          decisions: narrative.decisions,
          endingId: null,
        });
      },

      advanceFrom: (fromStepId) => {
        const state = get();
        if (!state.stepId || state.stepId !== fromStepId) return;
        const nextId = getNextStepId(state.stepId, state);
        if (nextId) set({ stepId: nextId });
      },

      jumpToChapter: (chapter) =>
        set({
          stepId: chapterStartId(chapter),
          log: EMPTY_LOG,
          narrative: createInitialNarrative(),
          decisions: {},
          endingId: null,
        }),

      triggerAlarm: (code) => {
        set((s) => ({
          narrative: {
            ...s.narrative,
            activeAlarm: code,
          },
        }));
      },

      setEnding: (endingId) => {
        const endingDef = getEnding(endingId);
        set((s) => ({
          endingId,
          narrative: {
            ...s.narrative,
            ending: endingId,
            score: endingDef?.score ?? s.narrative.score,
            debrief: endingDef ? toDebriefPayload(endingDef) : s.narrative.debrief,
            failureReason: endingDef?.failureReason ?? s.narrative.failureReason,
          },
        }));
      },

      makeDecision: (point, choice) => {
        const validPoints = [
          "inspection",
          "weather",
          "trajectory",
          "agc_alarm",
          "agcAlarm",
          "landing_approach",
          "landing",
        ];
        if (!validPoints.includes(point)) {
          throw new Error(`Invalid decision point: ${point}`);
        }

        const state = get();
        // Terminal state lock: cannot transition decisions after reaching a terminal ending
        if (state.narrative.ending !== null) {
          return false;
        }

        const narrative: NarrativeState = {
          ...state.narrative,
          decisions: { ...state.narrative.decisions, [point]: choice },
          flags: { ...state.narrative.flags },
          penalties: { ...state.narrative.penalties },
        };

        // Decision 1: Workshop LOX Inspection Rigor
        if (point === "inspection") {
          if (choice === "thorough") {
            narrative.flags.loxValveInspected = true;
            narrative.penalties.fuelPenaltyPct = 0;
          } else if (choice === "rushed") {
            narrative.flags.uninspectedMicroleak = true;
            narrative.penalties.fuelPenaltyPct = 5;
          }
        }

        // Decision 2: Launch Window & Weather Call
        else if (point === "weather") {
          if (choice === "go" || choice === "nominal") {
            narrative.ending = null;
          } else if (choice === "hold") {
            narrative.delayCostM = 60;
            narrative.ending = null;
          } else if (choice === "severe_wind" || choice === "severe-wind") {
            narrative.ending = "ending-5";
            const def = ENDINGS["ending-5"];
            narrative.score = def.score;
            narrative.failureReason = def.failureReason;
            narrative.debrief = toDebriefPayload(def);
          }
        }

        // Decision 3: Translunar Trajectory Call
        else if (point === "trajectory") {
          if (choice === "free_return" || choice === "free-return") {
            narrative.flags.passiveAbortAvailable = true;
          } else if (choice === "direct") {
            narrative.flags.passiveAbortAvailable = false;
            narrative.penalties.deltaVPenaltyPct = 8;
          }
        }

        // Decision 4: AGC 1201/1202 Alarm Call
        else if (point === "agc_alarm" || point === "agcAlarm") {
          if (choice === "go") {
            narrative.ending = null;
          } else if (choice === "abort_stage" || choice === "abort") {
            narrative.ending = "ending-2";
            const def = ENDINGS["ending-2"];
            narrative.score = def.score;
            narrative.debrief = toDebriefPayload(def);
          }
        }

        // Decision 5: Final Approach & Landing Call
        else if (point === "landing_approach" || point === "landing") {
          // Earlier shortcuts can turn the historic P66 landing into a forced wave-off.
          const endingId = resolveLanding(narrative, choice);
          if (endingId) {
            narrative.ending = endingId;
            const def = ENDINGS[endingId];
            narrative.score = def.score;
            narrative.debrief = toDebriefPayload(def);
          }
        }

        narrative.hoverMarginS = hoverMarginSeconds(narrative);

        set({
          narrative,
          decisions: narrative.decisions,
          endingId: narrative.ending,
        });

        return true;
      },

      recordDecision: (point, choice) => {
        return get().makeDecision(point, choice);
      },

      recordLaunch: (config, success) =>
        set((s) => ({
          log: {
            ...s.log,
            launchAttempts: s.log.launchAttempts + 1,
            launchConfig: success ? config : s.log.launchConfig,
          },
        })),
      recordParts: (count) => set((s) => ({ log: { ...s.log, partsInspected: count } })),
      recordLoadout: (loadout) => set((s) => ({ log: { ...s.log, loadout } })),
      recordLanding: (landing) => set((s) => ({ log: { ...s.log, landing } })),
    }),
    {
      name: "moonbound.progress",
      version: 1,
      storage: safeLocalStorage,
      skipHydration: true,
      partialize: (s) => {
        const base: Record<string, unknown> = { stepId: s.stepId, log: s.log };
        const hasDecisions =
          s.narrative && (Object.keys(s.narrative.decisions).length > 0 || s.narrative.ending !== null);
        if (hasDecisions) {
          base.narrative = s.narrative;
        }
        return base;
      },
      merge: (persisted, current) => {
        const saved = persisted as any;
        const id = saved?.stepId;
        const attempts = saved?.log?.launchAttempts;
        const parts = saved?.log?.partsInspected;
        const landing = saved?.log?.landing;
        const savedNarrative = saved?.narrative;

        const narrative = savedNarrative
          ? {
              ...current.narrative,
              ...savedNarrative,
              decisions: savedNarrative.decisions ?? {},
              flags: savedNarrative.flags ?? {},
              penalties: savedNarrative.penalties ?? { fuelPenaltyPct: 0, deltaVPenaltyPct: 0 },
            }
          : current.narrative;

        return {
          ...current,
          stepId: typeof id === "string" && getStep(id) ? id : null,
          log: {
            launchAttempts: typeof attempts === "number" ? attempts : 0,
            launchConfig: isLaunchConfig(saved?.log?.launchConfig) ? saved.log.launchConfig : null,
            partsInspected: typeof parts === "number" ? parts : 0,
            loadout: isLoadout(saved?.log?.loadout) ? saved.log.loadout : null,
            landing:
              landing && typeof landing.touchdownMs === "number" && typeof landing.fuelLeftPct === "number" ? landing : null,
          },
          narrative,
          decisions: narrative.decisions,
          endingId: narrative.ending,
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
