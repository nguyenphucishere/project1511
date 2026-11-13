import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LaunchConfig } from "@/lib/simulation/launch.types";
import { FIRST_STEP_ID, FLOW, chapterStartId } from "./flow";
import { hasContinuableProgress, useGameStore } from "./gameStore";

const KEY = "moonbound.progress";
const memory = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  },
});

const CONFIG: LaunchConfig = { vehicle: "saros", payload: "standard", fuelPct: 100, orbitKm: 185, window: "w2" };
const store = () => useGameStore.getState();

const EMPTY = { launchAttempts: 0, launchConfig: null, partsInspected: 0, landing: null };

beforeEach(() => {
  memory.clear();
  useGameStore.setState({ stepId: null, log: EMPTY });
});

describe("flow transitions", () => {
  it("starts a new game at the first step", () => {
    store().newGame();
    expect(store().stepId).toBe(FIRST_STEP_ID);
  });

  it("advances only from the current step, so a double fire cannot skip one", () => {
    store().newGame();
    store().advanceFrom(FIRST_STEP_ID);
    expect(store().stepId).toBe(FLOW[1].id);
    store().advanceFrom(FIRST_STEP_ID); // stale: the video ended after Skip was pressed
    expect(store().stepId).toBe(FLOW[1].id);
  });

  it("does nothing before Start and stays on the last step", () => {
    store().advanceFrom(FIRST_STEP_ID);
    expect(store().stepId).toBeNull();
    useGameStore.setState({ stepId: "end" });
    store().advanceFrom("end");
    expect(store().stepId).toBe("end");
  });

  it("jumps to a chapter's briefing", () => {
    store().jumpToChapter("lunar-descent");
    expect(store().stepId).toBe(chapterStartId("lunar-descent"));
    expect(store().stepId).toBe("lunar-descent-briefing");
  });

  it("does not offer a finished game as Continue", () => {
    expect(hasContinuableProgress(null)).toBe(false);
    expect(hasContinuableProgress("workshop-scene")).toBe(true);
    expect(hasContinuableProgress("end")).toBe(false);
  });
});

describe("mission log", () => {
  it("counts every launch but keeps only the configuration that reached orbit", () => {
    store().recordLaunch({ ...CONFIG, fuelPct: 90 }, false);
    expect(store().log).toMatchObject({ launchAttempts: 1, launchConfig: null });
    store().recordLaunch(CONFIG, true);
    expect(store().log).toMatchObject({ launchAttempts: 2, launchConfig: CONFIG });
  });

  it("records parts and landing without touching the launch entries", () => {
    store().recordLaunch(CONFIG, true);
    store().recordParts(8);
    store().recordLanding({ touchdownMs: 0.5, fuelLeftPct: 5 });
    expect(store().log).toEqual({
      launchAttempts: 1,
      launchConfig: CONFIG,
      partsInspected: 8,
      landing: { touchdownMs: 0.5, fuelLeftPct: 5 },
    });
  });

  it("starts fresh on a chapter jump, so the END screen never shows an earlier run", () => {
    store().recordLaunch(CONFIG, true);
    store().recordParts(8);
    store().jumpToChapter("lunar-descent");
    expect(store().log).toEqual(EMPTY);
  });

  it("is cleared by New game", () => {
    store().recordParts(8);
    store().newGame();
    expect(store().log).toEqual(EMPTY);
  });
});

describe("saved progress", () => {
  it("persists the checkpoint and log", () => {
    store().newGame();
    store().recordParts(8);
    const saved = JSON.parse(memory.get(KEY)!);
    expect(saved.state).toEqual({ stepId: FIRST_STEP_ID, log: store().log });
  });

  it("drops unknown checkpoints and malformed log fields on load", async () => {
    memory.set(
      KEY,
      JSON.stringify({
        state: {
          stepId: "removed-step",
          log: { launchAttempts: "2", launchConfig: { vehicle: "falcon" }, partsInspected: 8, landing: { touchdownMs: "x" } },
        },
        version: 1,
      }),
    );
    await useGameStore.persist.rehydrate();
    expect(store().hydrated).toBe(true);
    expect(store().stepId).toBeNull();
    expect(store().log).toEqual({ launchAttempts: 0, launchConfig: null, partsInspected: 8, landing: null });
  });

  it("loads a saved log written before parts and landing existed", async () => {
    memory.set(KEY, JSON.stringify({ state: { stepId: "launch-video", log: { launchAttempts: 2, launchConfig: CONFIG } }, version: 1 }));
    await useGameStore.persist.rehydrate();
    expect(store().stepId).toBe("launch-video");
    expect(store().log).toEqual({ launchAttempts: 2, launchConfig: CONFIG, partsInspected: 0, landing: null });
  });
});
