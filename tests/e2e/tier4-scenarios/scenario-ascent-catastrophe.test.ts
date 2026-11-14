import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEndingDefinition,
  assertGreaterThanOrEqual,
  assertInRange,
  assertLessThanOrEqual,
} from "../harness/assertions.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";
import { SimulationValidatorBridge } from "../../../apps/server/src/validator/simBridge.ts";
import { wasmValidateLaunch, type LaunchConfiguration } from "../harness/wasmHarness.ts";

describe("Tier 4 Scenario 5: Pad 39A Launch Weather Divergence & Ascent Catastrophe", () => {
  it("plays through to Ending-5 (Ascent Catastrophe — Max-Q Structural Breakup at T+83s)", async () => {
    const session = await createGameFlowSession();
    const simBridge = new SimulationValidatorBridge();

    // -------------------------------------------------------------------------
    // Phase 1: Pre-Flight Medical & Assembly
    // -------------------------------------------------------------------------
    session.advanceTo("workshop-decision");
    session.makeDecision("inspection", "thorough");

    // -------------------------------------------------------------------------
    // Phase 2: Pad 39A Weather Call — Force Launch in Severe Crosswinds
    // -------------------------------------------------------------------------
    session.advanceTo("weather-decision");
    assert.equal(session.getCurrentStepId(), "weather-decision");

    // Option C: severe_wind — Force Launch in Severe Wind (>40 km/h)
    const dOk = session.makeDecision("weather", "severe_wind");
    assert.equal(dOk, true);

    // State machine must branch directly to 'end' (Ascent Catastrophe)
    const stepEnd = session.advance();
    assert.equal(stepEnd, "end", "Severe wind decision must bypass flight and route directly to end");

    // -------------------------------------------------------------------------
    // Phase 3: Physics Engine Aerodynamic Overpressure Verification
    // -------------------------------------------------------------------------
    // Simulate severe aerodynamic conditions (48 km/h wind shear at Pad 39A)
    const severeAscentInput = {
      wind_speed_kmh: 48.0,
      thrust_kn: 34_500,
    };

    const serverVal = await simBridge.validateSimulation(severeAscentInput);
    assert.ok(serverVal.warnings && serverVal.warnings.length > 0, "Warnings expected for severe wind");

    // Authoritative simulation run
    const simResult = await simBridge.runAuthoritativeSimulation({
      wind_speed_kmh: 78.0, // Above structural breakup threshold
      thrust_kn: 44_000,
    });
    assert.equal(simResult.isSuccess, false);
    assert.equal(simResult.failureTrace.length, 1);
    assert.equal(simResult.failureTrace[0].anomaly, "MAX_Q_STRUCTURAL_OVERPRESSURE");
    assert.ok(simResult.failureTrace[0].consequence.includes("MAX_Q_STRUCTURAL_FAILURE"));

    // -------------------------------------------------------------------------
    // Phase 4: Debrief & Telemetry Verification for Ending-5
    // -------------------------------------------------------------------------
    assert.equal(session.getEndingId(), "ending-5");
    const state = session.getState();
    assert.equal(state.narrative.ending, "ending-5");
    assert.equal(state.narrative.score, 5);
    assert.equal(state.narrative.debrief.status, "fatal");

    // Verify failure reason
    assert.ok(
      state.narrative.failureReason?.includes("Max-Q aerodynamic shear structural breakup") ||
        state.narrative.failureReason?.includes("exceeded Saturn V S-IC gimbal margin"),
      `Failure reason must detail Max-Q breakup: ${state.narrative.failureReason}`
    );

    // Verify Booster Systems Engineer quote
    assert.ok(
      state.narrative.debrief.quote.includes("severe cryogenic pressure loss on S-IC Engine 1"),
      `Quote must match booster callout: ${state.narrative.debrief.quote}`
    );
    assert.equal(
      state.narrative.debrief.quoteAttribution,
      "Booster Systems Engineer, Mission Control — T+83s (Altitude 13.4 km)"
    );

    // Verify telemetry
    const telemetry = state.narrative.debrief.telemetry;
    assert.equal(telemetry.getTouchdown, "N/A (Lost during atmospheric ascent)");
    assert.equal(telemetry.terminalVxMs, 650.0);
    assert.equal(telemetry.terminalVzMs, 420.0);
    assert.equal(telemetry.surfaceTiltDeg, 45.0);
    assert.equal(telemetry.fuelRemainingPct, 82.0, "Bulk of S-IC propellant unspent at T+83s");
    assert.equal(telemetry.scienceDeployed, false);
    assert.equal(telemetry.lunarSamplesKg, 0.0);

    // Verify debrief narrative describes breakup at T+83s / Mach 1.7
    const debriefText = state.narrative.debrief.debriefReport.map((r: any) => r.en).join(" ");
    assert.ok(debriefText.includes("Maximum Dynamic Pressure (Max-Q, 34.3 kPa) at 13.4 km altitude"));
    assert.ok(debriefText.includes("Mach 1.7"));
    assert.ok(debriefText.includes("Vehicle AS-506 broke up aerodynamically"));
  });
});
