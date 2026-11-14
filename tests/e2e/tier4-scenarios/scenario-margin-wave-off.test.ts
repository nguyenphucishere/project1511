import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";

describe("Tier 4 Scenario 6: Earlier shortcuts turn the P66 landing into a forced wave-off", () => {
  it("rushed LOX check + direct trajectory + P66 reaches Ending-4 with the margin recorded", async () => {
    const session = await createGameFlowSession();

    session.advanceTo("workshop-decision");
    session.makeDecision("inspection", "rushed");
    session.advanceTo("weather-decision");
    session.makeDecision("weather", "go");
    session.advanceTo("trajectory-decision");
    session.makeDecision("trajectory", "direct");
    session.advanceTo("agc-alarm-decision");
    session.makeDecision("agc_alarm", "go");
    session.advanceTo("landing-decision");

    assert.equal(session.makeDecision("landing_approach", "p66_redesignation"), true);
    assert.equal(session.advance(), "end", "Forced wave-off skips the flag-planting video");
    assert.equal(session.getEndingId(), "ending-4");
    assert.equal(session.getState().narrative.hoverMarginS, 9);
    assert.equal(session.getState().narrative.score, 60);
  });

  it("a single shortcut still allows the historic landing", async () => {
    const session = await createGameFlowSession();
    session.advanceTo("workshop-decision");
    session.makeDecision("inspection", "rushed");
    session.advanceTo("landing-decision");

    session.makeDecision("landing_approach", "p66_redesignation");
    assert.equal(session.advance(), "flag-video");
    assert.equal(session.getEndingId(), "ending-1");
    assert.equal(session.getState().narrative.hoverMarginS, 17);
  });
});
