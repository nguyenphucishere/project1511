import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEndingDefinition,
  assertGreaterThanOrEqual,
  assertInRange,
  assertLessThanOrEqual,
  assertTouchdownWithinLimits,
} from "../harness/assertions.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";
import { wasmCalculateScore } from "../harness/wasmHarness.ts";

describe("Tier 4 Scenario 3: Lunar Boulder Field Landing & Structural Collapse", () => {
  it("plays through to Ending-3 (Catastrophic Touchdown — Stranded on Tranquility / Safire Contingency)", async () => {
    const session = await createGameFlowSession();

    // -------------------------------------------------------------------------
    // Phase 1: Pre-Flight & Pad Operations
    // -------------------------------------------------------------------------
    session.advanceTo("workshop-decision");
    session.makeDecision("inspection", "thorough");

    session.advanceTo("weather-decision");
    session.makeDecision("weather", "go");

    session.advanceTo("trajectory-decision");
    session.makeDecision("trajectory", "free_return");

    // -------------------------------------------------------------------------
    // Phase 2: Powered Descent & High Gate GO Call
    // -------------------------------------------------------------------------
    session.advanceTo("agc-alarm-decision");
    session.triggerAlarm("1202");
    session.makeDecision("agc_alarm", "go"); // Continue down to landing site

    session.advanceTo("lunar-descent-scene");

    // -------------------------------------------------------------------------
    // Phase 3: Final Approach & Decision to Touch Down in Boulder Field
    // -------------------------------------------------------------------------
    const stepLanding = session.advance();
    assert.equal(stepLanding, "landing-decision");

    // Option B: boulder_field — Drop straight down into boulder field of West Crater
    const dOk = session.makeDecision("landing_approach", "boulder_field");
    assert.equal(dOk, true);

    // State machine must branch directly to 'end'
    const stepEnd = session.advance();
    assert.equal(stepEnd, "end");

    // -------------------------------------------------------------------------
    // Phase 4: Structural Damage Physics Verification
    // -------------------------------------------------------------------------
    // Terminal contact readings on boulder field exceed structural safety limits:
    const contactVx = 2.4; // 2.4 m/s lateral speed (limit: 1.22 m/s)
    const contactVz = -3.8; // -3.8 m/s sink rate (limit: 3.05 m/s)
    const contactTilt = 19.5; // 19.5 degrees slope (limit: 12.0 deg)

    assert.throws(
      () => assertTouchdownWithinLimits(contactVx, contactVz, contactTilt),
      /LM touchdown readings exceed structural envelope/
    );

    // -------------------------------------------------------------------------
    // Phase 5: Debrief & William Safire Contingency Address Verification
    // -------------------------------------------------------------------------
    assert.equal(session.getEndingId(), "ending-3");
    const state = session.getState();
    assert.equal(state.narrative.ending, "ending-3");
    assert.equal(state.narrative.score, 28);
    assert.equal(state.narrative.debrief.status, "fatal");

    // Verify historic William Safire contingency speech text
    const contingencyText =
      state.narrative.debrief.contingencyAddress ??
      state.narrative.debrief.contingencySpeechText?.en ??
      "";
    assert.ok(
      contingencyText.includes("Fate has ordained that the men who went to the Moon to explore in peace"),
      "Must include presidential speech prepared by William Safire"
    );
    assert.ok(
      contingencyText.includes("will stay on the Moon to rest in peace"),
      "Must include solemn Nixon address quote"
    );
    assert.ok(
      contingencyText.includes("Neil Armstrong and Edwin Aldrin"),
      "Must cite Armstrong and Aldrin in contingency speech"
    );

    // Verify telemetry shows catastrophic landing conditions
    const telemetry = state.narrative.debrief.telemetry;
    assert.equal(telemetry.coordinates, "0.6712° N, 23.4680° E (West Crater Rim)");
    assert.equal(telemetry.terminalVxMs, 2.4);
    assert.equal(telemetry.terminalVzMs, -3.8);
    assert.equal(telemetry.surfaceTiltDeg, 19.5);
    assert.equal(telemetry.scienceDeployed, false);
    assert.equal(telemetry.lunarSamplesKg, 0.0);

    // Verify debrief report mentions strut shearing and ascent engine crush
    const reportText = state.narrative.debrief.debriefReport.map((r: any) => r.en).join(" ");
    assert.ok(reportText.includes("West Crater"));
    assert.ok(reportText.includes("starboard primary landing gear strut sheared off"));
    assert.ok(reportText.includes("Ascent Engine nozzle was crushed"));
  });
});
