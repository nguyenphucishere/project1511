import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createGameFlowSession, GameFlowSession } from "../harness/gameFlowHarness.ts";

describe("Tier 1 Feature 1: Apollo 11 Narrative Branching State Machine", () => {
  let session: GameFlowSession;

  beforeEach(async () => {
    session = await createGameFlowSession();
    session.reset();
  });

  it("decision node 1: workshop inspection rigor affects fuel penalty and reliability", async () => {
    // Navigate from intro to workshop decision point
    session.advanceTo("workshop-decision");
    assert.equal(session.getCurrentStepId(), "workshop-decision");

    // Branch A: Thorough LOX valve inspection (Historical)
    const successA = session.makeDecision("inspection", "thorough");
    assert.equal(successA, true, "makeDecision('inspection', 'thorough') should succeed");

    let state = session.getState();
    assert.equal(state.narrative?.flags?.loxValveInspected, true);
    assert.equal(state.narrative?.penalties?.fuelPenaltyPct, 0);

    // Advance to next chapter step
    const nextStep = session.advance();
    assert.equal(nextStep, "mission-control-briefing");

    // Branch B: Alternative run with rushed inspection
    session.reset();
    session.advanceTo("workshop-decision");
    const successB = session.makeDecision("inspection", "rushed");
    assert.equal(successB, true);

    state = session.getState();
    assert.equal(state.narrative?.flags?.uninspectedMicroleak, true);
    assert.equal(state.narrative?.penalties?.fuelPenaltyPct, 5, "Rushed inspection incurs 5% fuel reserve penalty");
  });

  it("decision node 2: weather call branches to nominal launch, hold delay, or severe wind breakup", async () => {
    // Test Option A: GO (Historical wind 18.5 km/h)
    session.advanceTo("weather-decision");
    assert.equal(session.getCurrentStepId(), "weather-decision");
    session.makeDecision("weather", "go");

    let nextStep = session.advance();
    assert.equal(nextStep, "launch-video", "Weather GO proceeds to launch cutscene");
    assert.equal(session.getEndingId(), null, "No ending triggered on nominal launch");

    // Test Option B: HOLD (Recycle delay cost)
    session.reset();
    session.advanceTo("weather-decision");
    session.makeDecision("weather", "hold");
    const stateB = session.getState();
    assert.equal(stateB.narrative?.delayCostM, 60, "Holding launch incurs $60M range delay cost");

    // Test Option C: Severe wind (>40 km/h) triggers immediate ascent catastrophe
    session.reset();
    session.advanceTo("weather-decision");
    session.makeDecision("weather", "severe_wind");
    nextStep = session.advance();
    assert.equal(nextStep, "end", "Severe wind forces immediate jump to end");
    assert.equal(session.getEndingId(), "ending-5", "Severe wind triggers Ending 5 (Ascent Catastrophe)");
    assert.equal(session.getState().narrative?.score, 5);
  });

  it("decision node 3: translunar trajectory call dictates passive abort return corridor", async () => {
    // Navigate to translunar trajectory decision point
    session.advanceTo("trajectory-decision");
    assert.equal(session.getCurrentStepId(), "trajectory-decision");

    // Option A: Circumlunar Free-Return Trajectory (Historical)
    session.makeDecision("trajectory", "free_return");
    let state = session.getState();
    assert.equal(state.narrative?.flags?.passiveAbortAvailable, true, "Free-return guarantees passive abort");
    assert.equal(state.narrative?.penalties?.deltaVPenaltyPct, 0);

    const nextStep = session.advance();
    assert.equal(nextStep, "translunar-briefing");

    // Option B: Direct High-Energy Non-Free-Return
    session.reset();
    session.advanceTo("trajectory-decision");
    session.makeDecision("trajectory", "direct");
    state = session.getState();
    assert.equal(state.narrative?.flags?.passiveAbortAvailable, false, "Direct trajectory loses passive abort corridor");
    assert.equal(state.narrative?.penalties?.deltaVPenaltyPct, 8, "Direct trajectory incurs 8% delta-V penalty");
  });

  it("decision node 4: AGC 1201/1202 program alarm call allows continuation or abort to orbit", async () => {
    session.advanceTo("agc-alarm-decision");
    assert.equal(session.getCurrentStepId(), "agc-alarm-decision");

    // Option A: Accept Bales/Garman call — GO on Alarm (Historical)
    session.makeDecision("agc_alarm", "go");
    let nextStep = session.advance();
    assert.equal(nextStep, "lunar-descent-scene", "GO call allows powered descent braking to proceed");
    assert.equal(session.getEndingId(), null);

    // Option B: Conservative Abort Stage call
    session.reset();
    session.advanceTo("agc-alarm-decision");
    session.makeDecision("agc_alarm", "abort_stage");
    nextStep = session.advance();
    assert.equal(nextStep, "end", "Abort stage call jumps to end");
    assert.equal(session.getEndingId(), "ending-2", "Abort stage triggers Ending 2 (Safe Abort to Orbit)");
    assert.equal(session.getState().narrative?.score, 72);
  });

  it("decision node 5: P66 final approach branches to historic landing, boulder crash, or bingo wave-off", async () => {
    // Setup session at landing decision
    session.advanceTo("landing-decision");
    assert.equal(session.getCurrentStepId(), "landing-decision");

    // Option A: P66 manual redesignation past West Crater (Historical)
    session.makeDecision("landing_approach", "p66_redesignation");
    let nextStep = session.advance();
    assert.equal(nextStep, "flag-video", "Historic landing proceeds to flag planting");
    assert.equal(session.getEndingId(), "ending-1", "Triggers Ending 1 (Tranquility Base)");
    assert.equal(session.getState().narrative?.score, 98);

    // Option B: Immediate touchdown in boulder field
    session.reset();
    session.advanceTo("landing-decision");
    session.makeDecision("landing_approach", "boulder_field");
    nextStep = session.advance();
    assert.equal(nextStep, "end");
    assert.equal(session.getEndingId(), "ending-3", "Boulder touchdown triggers Ending 3 (Stranded)");
    assert.equal(session.getState().narrative?.score, 28);

    // Option C: Bingo fuel wave-off at 40 feet
    session.reset();
    session.advanceTo("landing-decision");
    session.makeDecision("landing_approach", "bingo_abort");
    nextStep = session.advance();
    assert.equal(nextStep, "end");
    assert.equal(session.getEndingId(), "ending-4", "Bingo wave-off triggers Ending 4");
    assert.equal(session.getState().narrative?.score, 60);
  });

  it("enforces state machine integrity, validation guards, and terminal ending locks", async () => {
    // 1. Invalid decision point throws an error
    assert.throws(
      () => {
        session.makeDecision("invalid_point" as any, "choice");
      },
      /Invalid decision point/,
      "Must reject unrecognised decision point"
    );

    // 2. Terminal ending lock prevents mutation after reaching ending
    session.setEnding("ending-1");
    const mutated = session.makeDecision("inspection", "rushed");
    assert.equal(mutated, false, "Cannot modify decisions once in terminal ending state");
    assert.equal(session.getEndingId(), "ending-1");

    // 3. Reset properly clears ending and resets to intro
    session.reset();
    assert.equal(session.getCurrentStepId(), "intro-video");
    assert.equal(session.getEndingId(), null);
    assert.deepEqual(session.getDecisions(), {});
  });
});
