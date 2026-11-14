import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDescentStateSchema,
  assertEndingDefinition,
  assertGreaterThanOrEqual,
  assertInRange,
  assertLessThanOrEqual,
} from "../harness/assertions.ts";
import {
  wasmRunDescentStep,
  wasmCalculateScore,
  type DescentState,
} from "../harness/wasmHarness.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";

describe("Tier 3 Combination: Terminal Hover Descent Abort Staging Dynamics", () => {
  describe("Terminal Hover Staging Acceleration & Mass Transition", () => {
    it("simulates pyrotechnic descent stage separation and positive climb under ascent propulsion", () => {
      // Physical constants from Apollo LM specs
      const LM_DESCENT_DRY_MASS_KG = 2_134.0;
      const LM_ASCENT_STAGE_MASS_KG = 4_548.0;
      const LUNAR_GRAVITY = 1.622; // m/s^2
      const APS_THRUST_N = 15_570.0; // 3,500 lbf Bell Ascent Engine

      // Combined stack hovering at 12m (40 ft) with low fuel
      const combinedMass = LM_DESCENT_DRY_MASS_KG + LM_ASCENT_STAGE_MASS_KG + 80.0; // 80 kg fuel left
      assert.ok(combinedMass > 6_700.0);

      // Once Abort Stage is commanded, descent stage is jettisoned
      const stagedAscentMass = LM_ASCENT_STAGE_MASS_KG + 80.0; // Ascent stage retains separate APS propellant

      // Staged vehicle climb acceleration
      const apsThrustAccel = APS_THRUST_N / stagedAscentMass;
      const netClimbAccel = apsThrustAccel - LUNAR_GRAVITY;

      // Net climb acceleration must be robustly positive (> 0.5 m/s^2)
      assertGreaterThanOrEqual(
        netClimbAccel,
        0.5,
        "Ascent engine must provide positive climb acceleration to clear terrain"
      );
      assertInRange(netClimbAccel, 1.5, 2.5, "Nominal APS climb acceleration should be ~1.8 m/s^2");
    });

    it("verifies WASM descent engine handles fuel depletion and triggers BINGO_ABORT status", () => {
      // Vehicle in free fall with zero propellant and excessive sink rate (>3.05 m/s limit)
      const emptyHover: DescentState = {
        altitude_m: 2.0,
        vertical_velocity_mps: -3.5, // Exceeds structural landing limit
        horizontal_velocity_mps: 0.2,
        throttle_pct: 40.0,
        propellant_remaining_kg: 0.0, // Exhausted
        agc_cpu_duty_pct: 75.0,
        is_bingo_fuel: true,
        is_landed: false,
        touchdown_status: "IN_FLIGHT",
      };

      // Advance by 1 step: drops to surface with 0 thrust
      const stepped = wasmRunDescentStep(emptyHover);
      assertDescentStateSchema(stepped);
      assert.equal(stepped.is_landed, true);
      assert.equal(stepped.altitude_m, 0.0);
      assert.equal(
        stepped.touchdown_status,
        "BINGO_ABORT",
        `Expected BINGO_ABORT touchdown status on zero propellant, got: ${stepped.touchdown_status}`
      );
    });
  });

  describe("Interactive Decision Branching: Bingo Fuel Wave-Off at 40 Feet", () => {
    it("branches to Ending-4 (Bingo Fuel Abort) when commanding abort wave-off on fuel exhaustion", async () => {
      const session = await createGameFlowSession();

      // Advance to landing decision
      session.advanceTo("landing-decision");
      assert.equal(session.getCurrentStepId(), "landing-decision");

      // Option C: bingo_abort
      session.makeDecision("landing_approach", "bingo_abort");
      const nextStep = session.advance();

      // Must branch directly to 'end'
      assert.equal(nextStep, "end");
      assert.equal(session.getEndingId(), "ending-4");

      const state = session.getState();
      assert.equal(state.narrative.ending, "ending-4");
      assert.equal(state.narrative.score, 60);
      assert.equal(state.narrative.debrief.status, "partial");
      assert.ok(
        state.narrative.debrief.quote.includes("Bingo fuel, Houston! We are Abort Stage!"),
        `Quote must reflect bingo abort: ${state.narrative.debrief.quote}`
      );
      assert.equal(state.narrative.debrief.telemetry.lunarSamplesKg, 0);
      assert.equal(state.narrative.debrief.telemetry.scienceDeployed, false);
      assert.equal(state.narrative.debrief.telemetry.fuelHoverMarginSeconds, 0);
    });
  });
});
