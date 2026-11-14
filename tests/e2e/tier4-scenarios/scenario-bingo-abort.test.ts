import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDescentStateSchema,
  assertEndingDefinition,
  assertGreaterThanOrEqual,
  assertInRange,
  assertLessThanOrEqual,
} from "../harness/assertions.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";
import {
  wasmCalculateScore,
  wasmRunDescentStep,
  type DescentState,
} from "../harness/wasmHarness.ts";

describe("Tier 4 Scenario 4: Extended P66 Hover Propellant Depletion & Bingo Fuel Abort", () => {
  it("plays through to Ending-4 (Bingo Fuel Abort — Low Propellant Wave-Off at 40 Feet)", async () => {
    const session = await createGameFlowSession();

    // -------------------------------------------------------------------------
    // Phase 1: Pre-Flight LOX Valve Inspection (Rushed Visual Sign-Off)
    // -------------------------------------------------------------------------
    session.advanceTo("workshop-decision");
    // Option B: rushed — incurs -5% fuel reserve penalty
    session.makeDecision("inspection", "rushed");
    const flags = session.getState().narrative.flags;
    const penalties = session.getState().narrative.penalties;
    assert.equal(flags.uninspectedMicroleak, true);
    assert.equal(penalties.fuelPenaltyPct, 5);

    // -------------------------------------------------------------------------
    // Phase 2: Pad 39A Launch Weather & Free-Return Trajectory
    // -------------------------------------------------------------------------
    session.advanceTo("weather-decision");
    session.makeDecision("weather", "go");

    session.advanceTo("trajectory-decision");
    session.makeDecision("trajectory", "free_return");

    // -------------------------------------------------------------------------
    // Phase 3: Powered Descent & High Gate 1202 Alarm
    // -------------------------------------------------------------------------
    session.advanceTo("agc-alarm-decision");
    session.triggerAlarm("1202");
    session.makeDecision("agc_alarm", "go");

    session.advanceTo("lunar-descent-scene");

    // -------------------------------------------------------------------------
    // Phase 4: Extended P66 Hover & Propellant Depletion to Bingo Threshold
    // -------------------------------------------------------------------------
    // Extended manual hover: propellant depletes past 255 kg low-level warning to Bingo threshold (112 kg)
    const lowFuelHover: DescentState = {
      altitude_m: 12.2, // 40 feet AGL
      vertical_velocity_mps: 0.1, // Near zero hover vertical speed
      horizontal_velocity_mps: 3.5, // Drifting over crater rim
      throttle_pct: 35.0,
      propellant_remaining_kg: 108.0, // Below 112 kg Bingo threshold
      agc_cpu_duty_pct: 76.0,
      is_bingo_fuel: false,
      is_landed: false,
      touchdown_status: "IN_FLIGHT",
    };

    const steppedHover = wasmRunDescentStep(lowFuelHover);
    assertDescentStateSchema(steppedHover);
    assert.equal(steppedHover.is_bingo_fuel, true, "is_bingo_fuel must be true below 112 kg");
    assert.ok(steppedHover.propellant_remaining_kg < 108.0);

    // -------------------------------------------------------------------------
    // Phase 5: Landing Decision — Mandatory Bingo Fuel Abort Call at 40 Feet
    // -------------------------------------------------------------------------
    const stepLanding = session.advance();
    assert.equal(stepLanding, "landing-decision");

    // Option C: bingo_abort — Bingo Fuel Wave-Off at 40 Feet (Abort Stage)
    const dOk = session.makeDecision("landing_approach", "bingo_abort");
    assert.equal(dOk, true);

    // State machine must branch directly to 'end'
    const stepEnd = session.advance();
    assert.equal(stepEnd, "end");

    // -------------------------------------------------------------------------
    // Phase 6: Debrief & Telemetry Verification for Ending-4
    // -------------------------------------------------------------------------
    assert.equal(session.getEndingId(), "ending-4");
    const state = session.getState();
    assert.equal(state.narrative.ending, "ending-4");
    assert.equal(state.narrative.score, 60);
    assert.equal(state.narrative.debrief.status, "partial");

    // Verify quote
    assert.ok(
      state.narrative.debrief.quote.includes("Bingo fuel, Houston! We are Abort Stage!"),
      `Quote must match historical bingo call: ${state.narrative.debrief.quote}`
    );
    assert.equal(state.narrative.debrief.quoteAttribution, "Neil A. Armstrong, CDR — GET 102:45:32");

    // Verify telemetry
    const telemetry = state.narrative.debrief.telemetry;
    assert.equal(telemetry.getTouchdown, "N/A (Aborted at 40 ft AGL)");
    assert.equal(telemetry.fuelHoverMarginSeconds, 0.0, "Zero seconds hover margin at bingo");
    assert.equal(telemetry.fuelRemainingPct, 0.1, "Descent tanks practically bone dry");
    assert.equal(telemetry.scienceDeployed, false);
    assert.equal(telemetry.lunarSamplesKg, 0.0);
    assert.ok(telemetry.terminalVzMs > 0, "Ascent stage climbing away with positive velocity");

    // Verify debrief narrative describes staging at 40 feet and Columbia recovery
    const debriefText = state.narrative.debrief.debriefReport.map((r: any) => r.en).join(" ");
    assert.ok(debriefText.includes("40 feet (12 meters)"));
    assert.ok(debriefText.includes("Ascent Stage blasted off directly from the descending stack"));
    assert.ok(debriefText.includes("Collins rendezvoused with Eagle"));
    assert.ok(debriefText.includes("bringing the crew home safely"));

    // Multi-criteria score validation
    const scoreResult = wasmCalculateScore({
      science_score: 0,
      cost_score: 376,
      risk_penalty: 0.25,
      active_anomalies: ["ANOM-A11-01", "ANOM-A11-02"],
    });
    assert.equal(scoreResult.failure_chain.length, 2);
  });
});
