import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAgcAlarmDutyCycle,
  assertEndingDefinition,
  assertGreaterThanOrEqual,
  assertInRange,
} from "../harness/assertions.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";
import { wasmCalculateScore } from "../harness/wasmHarness.ts";

describe("Tier 4 Scenario 2: High Gate Trajectory Deviation & Safe Abort to Lunar Orbit", () => {
  it("plays through to Ending-2 (Powered Descent Abort to Orbit — Safe in Lunar Orbit)", async () => {
    const session = await createGameFlowSession();

    // -------------------------------------------------------------------------
    // Phase 1: Nominal Pre-Flight & Assembly
    // -------------------------------------------------------------------------
    session.advanceTo("workshop-decision");
    session.makeDecision("inspection", "thorough");

    // -------------------------------------------------------------------------
    // Phase 2: Nominal Weather & Launch Commitment
    // -------------------------------------------------------------------------
    session.advanceTo("weather-decision");
    session.makeDecision("weather", "go");

    // -------------------------------------------------------------------------
    // Phase 3: Translunar Trajectory Call (Free-Return Corridor)
    // -------------------------------------------------------------------------
    session.advanceTo("trajectory-decision");
    session.makeDecision("trajectory", "free_return");
    assert.equal(session.getState().narrative.flags.passiveAbortAvailable, true);

    // -------------------------------------------------------------------------
    // Phase 4: Powered Descent & High Gate AGC 1201/1202 Overload
    // -------------------------------------------------------------------------
    session.advanceTo("agc-alarm-decision");
    assert.equal(session.getCurrentStepId(), "agc-alarm-decision");

    // Rendezvous radar buffer overflow produces CPU duty cycle of 91.5%
    const cpuDutyPct = 91.5;
    assertAgcAlarmDutyCycle(cpuDutyPct, true);

    // Trigger AGC alarm in game state
    session.triggerAlarm("1201");
    assert.equal(session.getState().narrative.activeAlarm, "1201");

    // -------------------------------------------------------------------------
    // Phase 5: Guidance Officer Conservative Abort Decision (Abort Stage)
    // -------------------------------------------------------------------------
    // Option B: abort_stage — Hit ABORT STAGE
    const decisionOk = session.makeDecision("agc_alarm", "abort_stage");
    assert.equal(decisionOk, true);

    // State machine must immediately branch directly to 'end'
    const stepAfterAbort = session.advance();
    assert.equal(stepAfterAbort, "end", "Abort stage must bypass surface landing and route directly to end");

    // -------------------------------------------------------------------------
    // Phase 6: Debrief & Telemetry Verification for Ending-2
    // -------------------------------------------------------------------------
    assert.equal(session.getEndingId(), "ending-2");
    const state = session.getState();
    assert.equal(state.narrative.ending, "ending-2");
    assert.equal(state.narrative.score, 72);
    assert.equal(state.narrative.debrief.status, "partial");

    // Verify historical abort quote
    assert.ok(
      state.narrative.debrief.quote.includes("Eagle is Abort Stage") ||
        state.narrative.debrief.quote.includes("APS burning steady"),
      `Quote must reflect abort staging: ${state.narrative.debrief.quote}`
    );
    assert.equal(state.narrative.debrief.quoteAttribution, "Neil A. Armstrong, CDR — GET 102:39:12");

    // Verify telemetry shows orbital abort metrics rather than surface contact
    const telemetry = state.narrative.debrief.telemetry;
    assert.equal(telemetry.getTouchdown, "N/A (Aborted at 33,500 ft AGL)");
    assert.equal(telemetry.scienceDeployed, false, "Science cannot be deployed on abort");
    assert.equal(telemetry.lunarSamplesKg, 0.0, "Zero lunar samples collected on abort");
    assert.equal(telemetry.fuelRemainingPct, 84.0, "Descent stage was separated with bulk propellant unused");

    // Verify debrief narrative describes Columbia rendezvous
    const debriefReports = state.narrative.debrief.debriefReport;
    assert.ok(Array.isArray(debriefReports) && debriefReports.length >= 2);
    const reportText = debriefReports.map((r: any) => r.en).join(" ");
    assert.ok(reportText.includes("ABORT STAGE switch"));
    assert.ok(reportText.includes("Bell Aerosystems Ascent Engine"));
    assert.ok(reportText.includes("Michael Collins"));
    assert.ok(reportText.includes("Columbia"));

    // Multi-criteria score reflects partial success with zero science
    const scoreEval = wasmCalculateScore({
      science_score: 0,
      cost_score: 376,
      risk_penalty: 0.1,
      active_anomalies: ["ANOM-A11-01"],
    });
    assert.equal(scoreEval.failure_chain.length, 1);
  });
});
