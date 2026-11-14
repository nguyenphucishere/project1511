import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertApprox,
  assertEarthOrbitPeriod,
  assertEndingDefinition,
  assertGreaterThanOrEqual,
  assertInRange,
  assertLiftoffTwrNominal,
  assertMaxQWithinEnvelope,
  assertTouchdownWithinLimits,
} from "../harness/assertions.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";
import {
  APOLLO_11_DESCENT_INITIAL_STATE,
  APOLLO_11_LAUNCH_CONFIG,
  wasmCalculateScore,
  wasmRunDescentStep,
  wasmValidateLaunch,
  type DescentState,
} from "../harness/wasmHarness.ts";
import { SimulationValidatorBridge } from "../../../apps/server/src/validator/simBridge.ts";

describe("Tier 4 Scenario 1: Historical Apollo 11 Mission Playthrough to Historic Landing", () => {
  it("plays through the complete mission to Ending-1 (Tranquility Base Historic Landing)", async () => {
    const session = await createGameFlowSession();
    const simBridge = new SimulationValidatorBridge();

    // -------------------------------------------------------------------------
    // Phase 1: Pre-Flight Check & Assembly Hall (Workshop LOX Valve Inspection)
    // -------------------------------------------------------------------------
    assert.equal(session.getCurrentStepId(), "intro-video");
    session.advance(); // medical-briefing
    session.advance(); // medical-scene
    session.advance(); // workshop-briefing
    session.advance(); // workshop-scene
    const stepWorkshop = session.advance(); // workshop-decision
    assert.equal(stepWorkshop, "workshop-decision");

    // Decision 1: Option A (thorough) — Full Pneumatic & Torque Inspection
    const d1Ok = session.makeDecision("inspection", "thorough");
    assert.equal(d1Ok, true);
    const flagsAfterD1 = session.getState().narrative.flags;
    assert.equal(flagsAfterD1.loxValveInspected, true);
    assert.equal(session.getState().narrative.penalties.fuelPenaltyPct, 0);

    // -------------------------------------------------------------------------
    // Phase 2: Mission Control & Pad 39A Launch Weather Commit
    // -------------------------------------------------------------------------
    session.advance(); // mission-control-briefing
    session.advance(); // mission-control-scene
    const stepWeather = session.advance(); // weather-decision
    assert.equal(stepWeather, "weather-decision");

    // Decision 2: Option A (go) — GO for Terminal Countdown (Historical 18.5 km/h)
    const d2Ok = session.makeDecision("weather", "go");
    assert.equal(d2Ok, true);
    assert.equal(session.getState().narrative.delayCostM, 0);

    // -------------------------------------------------------------------------
    // Phase 3: Multi-Stage Saturn V Ascent Physics & Earth Orbit Insertion
    // -------------------------------------------------------------------------
    const stepLaunchVideo = session.advance();
    assert.equal(stepLaunchVideo, "launch-video");
    session.advance(); // ascent-briefing
    const stepAscent = session.advance(); // ascent-scene
    assert.equal(stepAscent, "ascent-scene");

    // Verify Saturn V ascent physics with WASM and Server SimBridge
    const wasmLaunch = wasmValidateLaunch({
      ...APOLLO_11_LAUNCH_CONFIG,
      wind_speed_kmh: 18.5,
    });
    assert.equal(wasmLaunch.is_valid, true);
    assertLiftoffTwrNominal(wasmLaunch.liftoff_twr);
    assertMaxQWithinEnvelope(wasmLaunch.max_q_time_s, wasmLaunch.max_q_kpa);

    const serverLaunch = await simBridge.validateSimulation({
      wind_speed_kmh: 18.5,
      target_destination: "TLI",
    });
    assert.equal(serverLaunch.is_valid, true);
    assertApprox(serverLaunch.liftoff_twr, 1.174, 0.01);
    assertApprox(serverLaunch.max_q_kpa, 34.3, 0.5);
    assertApprox(serverLaunch.max_q_time_s, 83.0, 1.0);

    // Earth 185 km Parking Orbit (semi-major axis 6,563.1 km, period ~88.18 min)
    const earthMu = 398_600.4418;
    const earthRadiusKm = 6_378.137;
    const aEarthKm = earthRadiusKm + 185.0;
    const earthPeriodMin = (2 * Math.PI * Math.sqrt(Math.pow(aEarthKm, 3) / earthMu)) / 60.0;
    assertEarthOrbitPeriod(earthPeriodMin);

    // -------------------------------------------------------------------------
    // Phase 4: Translunar Coast Trajectory Selection
    // -------------------------------------------------------------------------
    const stepTraj = session.advance(); // trajectory-decision
    assert.equal(stepTraj, "trajectory-decision");

    // Decision 3: Option A (free_return) — Circumlunar Free-Return Trajectory
    const d3Ok = session.makeDecision("trajectory", "free_return");
    assert.equal(d3Ok, true);
    assert.equal(session.getState().narrative.flags.passiveAbortAvailable, true);
    assert.equal(session.getState().narrative.penalties.deltaVPenaltyPct, 0);

    // -------------------------------------------------------------------------
    // Phase 5: Translunar Coast, Lunar Powered Descent & AGC 1202 Alarm Call
    // -------------------------------------------------------------------------
    assert.equal(session.advance(), "translunar-briefing");
    assert.equal(session.advance(), "translunar-scene");
    session.advance(); // lunar-descent-briefing
    const stepAgc = session.advance(); // agc-alarm-decision
    assert.equal(stepAgc, "agc-alarm-decision");

    // Trigger historical 1202 CPU overload alarm at 33,500 ft
    session.triggerAlarm("1202");
    assert.equal(session.getState().narrative.activeAlarm, "1202");

    // Decision 4: Option A (go) — Accept Bales/Garman Call (Executive BAILOUT recovery)
    const d4Ok = session.makeDecision("agc_alarm", "go");
    assert.equal(d4Ok, true);

    const stepDescentScene = session.advance(); // lunar-descent-scene
    assert.equal(stepDescentScene, "lunar-descent-scene");

    // Propagate descent dynamics toward final approach
    let simDescent: DescentState = { ...APOLLO_11_DESCENT_INITIAL_STATE };
    for (let i = 0; i < 10; i++) {
      simDescent = wasmRunDescentStep(simDescent);
    }
    assert.ok(simDescent.propellant_remaining_kg < APOLLO_11_DESCENT_INITIAL_STATE.propellant_remaining_kg);

    // -------------------------------------------------------------------------
    // Phase 6: Final Approach & P66 Manual Redesignation past West Crater
    // -------------------------------------------------------------------------
    const stepLanding = session.advance(); // landing-decision
    assert.equal(stepLanding, "landing-decision");

    // Decision 5: Option A (p66_redesignation) — Fly Long past West Crater
    const d5Ok = session.makeDecision("landing_approach", "p66_redesignation");
    assert.equal(d5Ok, true);

    // Verify touchdown structural envelope at Tranquility Base
    const vxContact = 0.5; // m/s forward ground speed
    const vzContact = -0.45; // m/s sink rate
    const tiltContact = 4.5; // degrees tilt
    assertTouchdownWithinLimits(vxContact, vzContact, tiltContact, 0.4);

    // Record touchdown landing in game session
    session.recordLanding({
      touchdownMs: Math.abs(vzContact),
      fuelLeftPct: 5.6,
    });

    // -------------------------------------------------------------------------
    // Phase 7: Flag Planting, Epilogue & Debrief Validation (Ending-1)
    // -------------------------------------------------------------------------
    const stepFlag = session.advance();
    assert.equal(stepFlag, "flag-video");
    const stepEpilogue = session.advance();
    assert.equal(stepEpilogue, "epilogue");
    assert.equal(session.advance(), "return-briefing");
    assert.equal(session.advance(), "return-scene");
    const stepEnd = session.advance();
    assert.equal(stepEnd, "end");

    // Verify ending state
    assert.equal(session.getEndingId(), "ending-1");
    const state = session.getState();
    assert.equal(state.narrative.ending, "ending-1");
    assert.equal(state.narrative.score, 98);
    assert.equal(state.narrative.debrief.status, "success");

    // Verify debrief content and telemetry
    assert.ok(
      state.narrative.debrief.quote.includes("The Eagle has landed"),
      `Historical Armstrong quote must be present: ${state.narrative.debrief.quote}`
    );
    assert.equal(state.narrative.debrief.quoteAttribution, "Neil A. Armstrong, CDR — GET 102:45:58 (July 20, 1969)");

    const telemetry = state.narrative.debrief.telemetry;
    assert.equal(telemetry.coordinates, "0.67408° N, 23.47297° E (Mare Tranquillitatis)");
    assert.equal(telemetry.scienceDeployed, true, "EASEP science package must be deployed");
    assert.equal(telemetry.lunarSamplesKg, 21.55, "Apollo 11 historical sample mass must be 21.55 kg");
    assert.equal(telemetry.fuelHoverMarginSeconds, 25.0, "Hover reserve margin should be 25 seconds");
    assert.ok(telemetry.terminalVxMs <= 1.22);
    assert.ok(Math.abs(telemetry.terminalVzMs) <= 2.13);
    assert.ok(telemetry.surfaceTiltDeg <= 12.0);

    // Multi-criteria score calculation confirmation
    const finalScoreResult = wasmCalculateScore({
      science_score: 500,
      cost_score: 376,
      risk_penalty: 0.02,
      active_anomalies: ["ANOM-A11-01", "ANOM-A11-02"],
    });
    assert.equal(finalScoreResult.is_success, true);
    assert.ok(finalScoreResult.final_score > 300);
    assert.equal(finalScoreResult.failure_chain.length, 2);
  });
});
