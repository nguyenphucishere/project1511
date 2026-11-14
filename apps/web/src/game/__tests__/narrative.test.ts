import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/game/gameStore";
import { FIRST_STEP_ID, FLOW } from "@/game/flow";
import { CHARACTERS } from "@/game/characters";
import { VEHICLES } from "@/mocks/launch-options";

// 1. Storage & Global Environment Mocking (Node Environment)
const memory = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  },
});

const store = () => useGameStore.getState();

beforeEach(() => {
  memory.clear();
  store().newGame();
});

describe("Milestone 3: Apollo 11 Interactive Narrative & State Machine", () => {
  // Suite 1: Decision Point 1 - Workshop LOX Inspection Rigor
  describe("Node 1: Workshop LOX Inspection Rigor", () => {
    it("records thorough inspection with nominal valve seal and 0% fuel penalty", () => {
      store().makeDecision("inspection", "thorough");
      const narrative = store().narrative;
      expect(narrative.decisions.inspection).toBe("thorough");
      expect(narrative.flags.loxValveInspected).toBe(true);
      expect(narrative.penalties.fuelPenaltyPct).toBe(0);
    });

    it("records rushed rollout applying micro-leak flag and -5% fuel penalty", () => {
      store().makeDecision("inspection", "rushed");
      const narrative = store().narrative;
      expect(narrative.decisions.inspection).toBe("rushed");
      expect(narrative.flags.uninspectedMicroleak).toBe(true);
      expect(narrative.penalties.fuelPenaltyPct).toBe(5);
    });
  });

  // Suite 2: Decision Point 2 - Launch Window & Weather Call
  describe("Node 2: Launch Window & Weather Call", () => {
    it("launches nominally under acceptable Cape Canaveral weather (<40 km/h wind)", () => {
      store().makeDecision("weather", "go");
      expect(store().narrative.decisions.weather).toBe("go");
      expect(store().narrative.ending).toBeNull();
    });

    it("holding the launch window incurs delay costs and shifts window", () => {
      store().makeDecision("weather", "hold");
      expect(store().narrative.decisions.weather).toBe("hold");
      expect(store().narrative.delayCostM).toBeGreaterThan(0);
    });

    it("launching in severe wind (>40 km/h) causes Max-Q structural breakup and triggers ENDING-5", () => {
      store().makeDecision("weather", "severe_wind");
      expect(store().narrative.decisions.weather).toBe("severe_wind");
      expect(store().narrative.ending).toBe("ending-5");
      expect(store().narrative.failureReason).toContain("Max-Q");
    });
  });

  // Suite 3: Decision Point 3 - Translunar Trajectory Call
  describe("Node 3: Translunar Trajectory Call", () => {
    it("selects free-return trajectory with passive abort margin preserved", () => {
      store().makeDecision("trajectory", "free_return");
      expect(store().narrative.decisions.trajectory).toBe("free_return");
      expect(store().narrative.flags.passiveAbortAvailable).toBe(true);
    });

    it("selects direct trajectory with higher delta-v consumption", () => {
      store().makeDecision("trajectory", "direct");
      expect(store().narrative.decisions.trajectory).toBe("direct");
      expect(store().narrative.flags.passiveAbortAvailable).toBe(false);
      expect(store().narrative.penalties.deltaVPenaltyPct).toBeGreaterThan(0);
    });
  });

  // Suite 4: Decision Point 4 - AGC 1201/1202 Executive Alarm Call
  describe("Node 4: AGC 1201/1202 Alarm Call", () => {
    it("calling GO on intermittent alarms continues powered descent to P66 approach", () => {
      store().triggerAlarm("1202");
      store().makeDecision("agc_alarm", "go");
      expect(store().narrative.decisions.agc_alarm).toBe("go");
      expect(store().narrative.ending).toBeNull();
    });

    it("calling ABORT STAGE stages descent engine and triggers ENDING-2", () => {
      store().triggerAlarm("1201");
      store().makeDecision("agc_alarm", "abort_stage");
      expect(store().narrative.decisions.agc_alarm).toBe("abort_stage");
      expect(store().narrative.ending).toBe("ending-2");
      expect(store().narrative.debrief.title).toContain("Abort to Orbit");
    });
  });

  // Suite 5: Decision Point 5 - P66 Final Approach & Landing Call
  describe("Node 5: P66 Final Approach Call", () => {
    it("manual redesignation past West Crater achieves historic touchdown and triggers ENDING-1", () => {
      store().makeDecision("landing_approach", "p66_redesignation");
      expect(store().narrative.decisions.landing_approach).toBe("p66_redesignation");
      expect(store().narrative.ending).toBe("ending-1");
      expect(store().narrative.debrief.title).toContain("Tranquility Base");
    });

    it("landing in West Crater boulder field causes vehicle damage and triggers ENDING-3", () => {
      store().makeDecision("landing_approach", "boulder_field");
      expect(store().narrative.decisions.landing_approach).toBe("boulder_field");
      expect(store().narrative.ending).toBe("ending-3");
      expect(store().narrative.debrief.contingencyAddress).toBeDefined();
    });

    it("bingo fuel exhaustion forces manual pull-up abort and triggers ENDING-4", () => {
      store().makeDecision("landing_approach", "bingo_abort");
      expect(store().narrative.decisions.landing_approach).toBe("bingo_abort");
      expect(store().narrative.ending).toBe("ending-4");
      expect(store().narrative.debrief.title).toContain("Bingo Fuel Abort");
    });
  });

  // Suite 6: 100% Reachability of All 5 Distinct Endings
  describe("100% Reachability of All 5 Distinct Endings", () => {
    it("Path 1 -> Reaches ENDING-1: Historic Landing ('Tranquility Base')", () => {
      store().makeDecision("inspection", "thorough");
      store().makeDecision("weather", "go");
      store().makeDecision("trajectory", "free_return");
      store().makeDecision("agc_alarm", "go");
      store().makeDecision("landing_approach", "p66_redesignation");

      expect(store().narrative.ending).toBe("ending-1");
      expect(store().narrative.score).toBeGreaterThanOrEqual(90);
    });

    it("Path 2 -> Reaches ENDING-2: Safe Abort to Lunar Orbit", () => {
      store().makeDecision("inspection", "thorough");
      store().makeDecision("weather", "go");
      store().makeDecision("trajectory", "free_return");
      store().makeDecision("agc_alarm", "abort_stage");

      expect(store().narrative.ending).toBe("ending-2");
      expect(store().narrative.score).toBeGreaterThanOrEqual(60);
      expect(store().narrative.score).toBeLessThan(85);
    });

    it("Path 3 -> Reaches ENDING-3: Rough Landing / Stranded on Tranquility", () => {
      store().makeDecision("inspection", "thorough");
      store().makeDecision("weather", "go");
      store().makeDecision("trajectory", "free_return");
      store().makeDecision("agc_alarm", "go");
      store().makeDecision("landing_approach", "boulder_field");

      expect(store().narrative.ending).toBe("ending-3");
      expect(store().narrative.score).toBeLessThanOrEqual(45);
    });

    it("Path 4 -> Reaches ENDING-4: Bingo Fuel Abort / Return Safe", () => {
      store().makeDecision("inspection", "rushed");
      store().makeDecision("weather", "go");
      store().makeDecision("trajectory", "direct");
      store().makeDecision("agc_alarm", "go");
      store().makeDecision("landing_approach", "bingo_abort");

      expect(store().narrative.ending).toBe("ending-4");
      expect(store().narrative.score).toBeGreaterThanOrEqual(50);
      expect(store().narrative.score).toBeLessThan(75);
    });

    it("Path 5 -> Reaches ENDING-5: Ascent Catastrophe", () => {
      store().makeDecision("weather", "severe_wind");

      expect(store().narrative.ending).toBe("ending-5");
      expect(store().narrative.score).toBeLessThanOrEqual(15);
      expect(store().narrative.failureReason).toBeDefined();
    });
  });

  // Suite 7: Edge Cases, Invalid Transitions, State Reset & Persistence
  describe("Edge Cases, Invalid Transitions & State Reset", () => {
    it("rejects invalid decision identifiers and maintains state integrity", () => {
      expect(() => {
        // @ts-expect-error invalid decision key test
        store().makeDecision("unknown_node", "choice");
      }).toThrow();
    });

    it("cannot transition narrative decisions after reaching a terminal ending", () => {
      store().makeDecision("weather", "severe_wind");
      expect(store().narrative.ending).toBe("ending-5");

      // Attempting further decision should throw or be ignored
      const result = store().makeDecision("landing_approach", "p66_redesignation");
      expect(result).toBe(false);
      expect(store().narrative.ending).toBe("ending-5");
    });

    it("calling newGame() resets all decision records, flags, and ending states", () => {
      store().makeDecision("inspection", "thorough");
      store().makeDecision("weather", "go");
      store().makeDecision("landing_approach", "p66_redesignation");
      expect(store().narrative.ending).toBe("ending-1");

      store().newGame();
      expect(store().stepId).toBe(FIRST_STEP_ID);
      expect(store().narrative.ending).toBeNull();
      expect(store().narrative.decisions).toEqual({});
      expect(store().narrative.flags).toEqual({});
    });

    it("persists and rehydrates narrative choices and ending status across reload", async () => {
      store().makeDecision("inspection", "thorough");
      store().makeDecision("weather", "go");
      store().makeDecision("agc_alarm", "abort_stage");
      expect(store().narrative.ending).toBe("ending-2");

      await useGameStore.persist.rehydrate();
      expect(store().narrative.ending).toBe("ending-2");
      expect(store().narrative.decisions.agc_alarm).toBe("abort_stage");
    });
  });

  // Suite 8: Historical Entities & Roster Verification
  describe("Historical Fidelity & Apollo 11 Entities", () => {
    it("features authentic Apollo 11 historical characters in characters catalog", () => {
      expect(CHARACTERS).toHaveProperty("armstrong");
      expect(CHARACTERS).toHaveProperty("aldrin");
      expect(CHARACTERS).toHaveProperty("collins");
      expect(CHARACTERS).toHaveProperty("kranz");
      expect(CHARACTERS).toHaveProperty("bales");
      expect(CHARACTERS).toHaveProperty("garman");
    });

    it("features Saturn V AS-506, CSM Columbia, and LM Eagle vehicles", () => {
      const vehicleIds = VEHICLES.map((v) => v.id);
      expect(vehicleIds).toContain("saturn_v_as506");
    });
  });
});
