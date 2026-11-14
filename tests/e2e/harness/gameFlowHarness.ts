import "./env.ts";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { WEB_DIR } from "./env.ts";

export interface GameStep {
  id: string;
  kind: string;
  [key: string]: any;
}

export interface GameStoreState {
  stepId: string | null;
  hydrated: boolean;
  narrative?: any;
  decisions?: Record<string, string>;
  endingId?: string | null;
  log: any;
  newGame: () => void;
  advanceFrom: (fromStepId: string) => void;
  jumpToChapter: (chapter: any) => void;
  makeDecision?: (point: string, choice: string) => boolean;
  recordDecision?: (point: string, choice: string) => boolean;
  triggerAlarm?: (code: string) => void;
  setEnding?: (endingId: string) => void;
  recordLaunch: (config: any, success: boolean) => void;
  recordParts: (count: number) => void;
  recordLoadout: (loadout: any) => void;
  recordLanding: (landing: any) => void;
}

export interface GameModules {
  useGameStore: any;
  FLOW: GameStep[];
  FIRST_STEP_ID: string;
  getStep: (id: string) => GameStep | undefined;
  stepIndex: (id: string) => number;
  chapterStartId: (chapter: string) => string;
  DECISIONS?: Record<string, any>;
  ENDINGS_CATALOG?: Record<string, any>;
}

let cachedModulesPromise: Promise<GameModules> | null = null;

export async function loadGameModules(): Promise<GameModules> {
  if (!cachedModulesPromise) {
    cachedModulesPromise = (async () => {
      const gameStoreMod = await import(pathToFileURL(path.join(WEB_DIR, "src/game/gameStore.ts")).href);
      const flowMod = await import(pathToFileURL(path.join(WEB_DIR, "src/game/flow.ts")).href);
      let decisionsMod: any = {};
      let endingsMod: any = {};
      try {
        decisionsMod = await import(pathToFileURL(path.join(WEB_DIR, "src/game/decisions.ts")).href);
      } catch {
        // optional if not yet implemented
      }
      try {
        endingsMod = await import(pathToFileURL(path.join(WEB_DIR, "src/game/endings.ts")).href);
      } catch {
        // optional if not yet implemented
      }

      return {
        useGameStore: gameStoreMod.useGameStore,
        FLOW: flowMod.FLOW,
        FIRST_STEP_ID: flowMod.FIRST_STEP_ID,
        getStep: flowMod.getStep,
        stepIndex: flowMod.stepIndex,
        chapterStartId: flowMod.chapterStartId,
        DECISIONS: decisionsMod.DECISIONS,
        ENDINGS_CATALOG: endingsMod.ENDINGS_CATALOG,
      };
    })();
  }
  return cachedModulesPromise;
}

/**
 * Headless driver for Apollo 11 interactive narrative and mission state machine.
 */
export class GameFlowSession {
  private mods: GameModules;

  constructor(mods: GameModules) {
    this.mods = mods;
  }

  /**
   * Resets the store and starts a clean game at the initial step.
   */
  public reset(): void {
    const store = this.mods.useGameStore;
    store.getState().newGame();
  }

  /**
   * Returns the raw state from useGameStore.
   */
  public getState(): GameStoreState {
    return this.mods.useGameStore.getState();
  }

  /**
   * Returns current active step ID (e.g. 'intro-video', 'workshop-decision', etc.).
   */
  public getCurrentStepId(): string | null {
    return this.getState().stepId;
  }

  /**
   * Returns the full step object for the current step.
   */
  public getCurrentStep(): GameStep | undefined {
    const id = this.getCurrentStepId();
    if (!id) return undefined;
    return this.mods.getStep(id);
  }

  /**
   * Advances from the current step to the next step.
   */
  public advance(fromStepId?: string): string | null {
    const current = this.getCurrentStepId();
    if (!current) throw new Error("Cannot advance: game has not started (stepId is null)");
    const stepToAdvance = fromStepId ?? current;
    this.mods.useGameStore.getState().advanceFrom(stepToAdvance);
    return this.getCurrentStepId();
  }

  /**
   * Repeatedly advances through the flow until reaching targetStepId.
   */
  public advanceTo(targetStepId: string, maxSteps = 50): string | null {
    let stepsTaken = 0;
    while (this.getCurrentStepId() !== targetStepId) {
      if (stepsTaken >= maxSteps) {
        throw new Error(
          `advanceTo('${targetStepId}') exceeded max steps (${maxSteps}). Currently at '${this.getCurrentStepId()}'.`
        );
      }
      const prev = this.getCurrentStepId();
      this.advance();
      const next = this.getCurrentStepId();
      if (prev === next) {
        throw new Error(`State machine stalled at '${prev}' while advancing towards '${targetStepId}'.`);
      }
      stepsTaken++;
    }
    return this.getCurrentStepId();
  }

  /**
   * Jumps to the briefing of a given chapter.
   */
  public jumpToChapter(chapter: string): string | null {
    this.mods.useGameStore.getState().jumpToChapter(chapter);
    return this.getCurrentStepId();
  }

  /**
   * Records or makes a branching decision at a decision point.
   */
  public makeDecision(point: string, choice: string): boolean {
    const state = this.mods.useGameStore.getState();
    if (typeof state.makeDecision === "function") {
      return state.makeDecision(point, choice);
    }
    if (typeof state.recordDecision === "function") {
      return state.recordDecision(point, choice);
    }
    // Fallback store modification if helpers absent
    this.mods.useGameStore.setState((s: any) => ({
      decisions: { ...(s.decisions ?? {}), [point]: choice },
    }));
    return true;
  }

  /**
   * Triggers an AGC alarm code (e.g. '1201', '1202').
   */
  public triggerAlarm(code: string): void {
    const state = this.mods.useGameStore.getState();
    if (typeof state.triggerAlarm === "function") {
      state.triggerAlarm(code);
    }
  }

  /**
   * Sets or transitions into a reachable ending state.
   */
  public setEnding(endingId: string): void {
    const state = this.mods.useGameStore.getState();
    if (typeof state.setEnding === "function") {
      state.setEnding(endingId);
    } else {
      this.mods.useGameStore.setState({ endingId });
    }
  }

  /**
   * Records launch attempt configuration and success flag.
   */
  public recordLaunch(config: any, success: boolean): void {
    this.mods.useGameStore.getState().recordLaunch(config, success);
  }

  /**
   * Records parts inspected in workshop.
   */
  public recordParts(count: number): void {
    this.mods.useGameStore.getState().recordParts(count);
  }

  /**
   * Records workshop loadout.
   */
  public recordLoadout(loadout: any): void {
    this.mods.useGameStore.getState().recordLoadout(loadout);
  }

  /**
   * Records lunar touchdown readings.
   */
  public recordLanding(landing: any): void {
    this.mods.useGameStore.getState().recordLanding(landing);
  }

  /**
   * Returns all decisions made in the current session.
   */
  public getDecisions(): Record<string, string> {
    const state = this.getState();
    return state.decisions ?? state.narrative?.decisions ?? {};
  }

  /**
   * Returns current active ending ID.
   */
  public getEndingId(): string | null {
    const state = this.getState();
    return state.endingId ?? state.narrative?.ending ?? null;
  }

  /**
   * Returns mission log.
   */
  public getMissionLog(): any {
    return this.getState().log;
  }

  /**
   * Access to raw FLOW definition.
   */
  public get flow(): GameStep[] {
    return this.mods.FLOW;
  }
}

/**
 * Factory function creating an initialized headless game flow session.
 */
export async function createGameFlowSession(): Promise<GameFlowSession> {
  const mods = await loadGameModules();
  const session = new GameFlowSession(mods);
  session.reset();
  return session;
}
