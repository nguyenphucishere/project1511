import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDescentStateSchema,
  assertEndingDefinition,
  assertInRange,
  assertLessThanOrEqual,
  assertTouchdownWithinLimits,
} from "../harness/assertions.ts";
import {
  wasmRunDescentStep,
  wasmCalculateScore,
  type DescentState,
} from "../harness/wasmHarness.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";

describe("Tier 3 Combination: Obstacle Hazard (West Crater) & Propellant Depletion (P66 / Bingo)", () => {
  describe("Low Fuel Light & Bingo Reserve Thresholds", () => {
    it("activates is_bingo_fuel when propellant drops to or below 112.0 kg reserve", () => {
      // Nominal descent hovering at 35m with 130 kg propellant (above Bingo reserve)
      const hoverAboveBingo: DescentState = {
        altitude_m: 35.0,
        vertical_velocity_mps: -0.5,
        horizontal_velocity_mps: 1.2,
        throttle_pct: 30.0, // Low continuous throttle
        propellant_remaining_kg: 130.0,
        agc_cpu_duty_pct: 74.0,
        is_bingo_fuel: false,
        is_landed: false,
        touchdown_status: "IN_FLIGHT",
      };

      const step1 = wasmRunDescentStep(hoverAboveBingo);
      assertDescentStateSchema(step1);
      assert.ok(
        step1.propellant_remaining_kg < 130.0,
        "Propellant must be consumed during hover"
      );

      // Now set propellant directly at Bingo threshold: 112.0 kg
      const atBingoThreshold: DescentState = {
        ...step1,
        propellant_remaining_kg: 112.0,
      };
      const bingoStepped = wasmRunDescentStep(atBingoThreshold);
      assert.equal(
        bingoStepped.is_bingo_fuel,
        true,
        "is_bingo_fuel must be true at or below 112.0 kg propellant"
      );

      // Far below Bingo threshold: 50 kg
      const criticalFuel: DescentState = {
        ...step1,
        propellant_remaining_kg: 50.0,
      };
      const critStepped = wasmRunDescentStep(criticalFuel);
      assert.equal(critStepped.is_bingo_fuel, true);
    });

    it("evaluates historical West Crater anomaly ANOM-A11-02 and failure chain tracing", () => {
      const evalResult = wasmCalculateScore({
        science_score: 500,
        cost_score: 376,
        risk_penalty: 0.05,
        active_anomalies: ["ANOM-A11-02"],
      });

      assert.equal(evalResult.is_success, true);
      assert.equal(evalResult.failure_chain.length, 1);

      const anomalyLog = evalResult.failure_chain[0];
      assert.ok(
        anomalyLog.includes("ANOM-A11-02"),
        `Failure chain must include ANOM-A11-02: ${anomalyLog}`
      );
      assert.ok(
        anomalyLog.includes("P66 manual") || anomalyLog.includes("West Crater") || anomalyLog.includes("Bingo"),
        `Failure chain must describe West Crater redesignation: ${anomalyLog}`
      );
    });
  });

  describe("Touchdown Structural Limits: Smooth Landing vs Boulder Impact", () => {
    it("validates nominal touchdown envelope for manual P66 redesignation landing", () => {
      // Historical Apollo 11 touchdown values at Tranquility Base
      const vx = 0.5; // m/s forward ground speed
      const vz = -0.45; // m/s sink rate
      const tilt = 4.5; // deg pitch/roll
      const angularRate = 0.4; // deg/s

      // Must pass structural limits check without throwing
      assertTouchdownWithinLimits(vx, vz, tilt, angularRate);

      // Step physics model to touchdown (starting from 0.4m altitude)
      const nearSurface: DescentState = {
        altitude_m: 0.4,
        vertical_velocity_mps: -0.45,
        horizontal_velocity_mps: 0.5,
        throttle_pct: 25.0,
        propellant_remaining_kg: 220.0, // ~25s hover margin
        agc_cpu_duty_pct: 70.0,
        is_bingo_fuel: false,
        is_landed: false,
        touchdown_status: "IN_FLIGHT",
      };

      const landed = wasmRunDescentStep(nearSurface);
      assert.equal(landed.is_landed, true);
      assert.equal(landed.altitude_m, 0.0);
      assert.equal(
        landed.touchdown_status,
        "SAFE_LANDING",
        `Touchdown status should be SAFE_LANDING, got: ${landed.touchdown_status}`
      );
    });

    it("fails touchdown structural envelope when touching down on West Crater boulder slopes", () => {
      // Boulder field impact parameters (18-19.5 degree slope, lateral shear)
      const badVx = 2.4; // Exceeds 1.22 m/s lateral limit
      const badVz = -3.8; // Exceeds 3.05 m/s vertical limit
      const badTilt = 19.5; // Exceeds 12.0 deg tilt limit

      assert.throws(() => {
        assertTouchdownWithinLimits(badVx, -0.5, 4.0);
      }, /lateral velocity.*1\.22 m\/s/);

      assert.throws(() => {
        assertTouchdownWithinLimits(0.2, badVz, 4.0);
      }, /vertical velocity.*3\.05 m\/s/);

      assert.throws(() => {
        assertTouchdownWithinLimits(0.2, -0.5, badTilt);
      }, /surface tilt.*12\.0°/);
    });
  });

  describe("Interactive Decision Branching: P66 Redesignation vs Boulder Impact", () => {
    it("branches to Ending-1 (Historic Landing) when executing P66 manual redesignation", async () => {
      const session = await createGameFlowSession();

      // Advance through to landing decision
      session.advanceTo("landing-decision");
      assert.equal(session.getCurrentStepId(), "landing-decision");

      // Option A: p66_redesignation
      session.makeDecision("landing_approach", "p66_redesignation");
      const nextStep = session.advance();

      // Flow goes to flag video -> epilogue -> end
      assert.equal(nextStep, "flag-video");
      assert.equal(session.advance(), "epilogue");
      assert.equal(session.advanceTo("end"), "end");

      assert.equal(session.getEndingId(), "ending-1");
      const state = session.getState();
      assert.equal(state.narrative.ending, "ending-1");
      assert.equal(state.narrative.score, 98);
      assert.equal(state.narrative.debrief.status, "success");
      assert.ok(state.narrative.debrief.quote.includes("The Eagle has landed"));
      assert.equal(state.narrative.debrief.telemetry.scienceDeployed, true);
      assert.equal(state.narrative.debrief.telemetry.lunarSamplesKg, 21.55);
    });

    it("branches to Ending-3 (Rough Landing / Stranded) when landing directly into West Crater boulders", async () => {
      const session = await createGameFlowSession();

      session.advanceTo("landing-decision");
      session.makeDecision("landing_approach", "boulder_field");
      const nextStep = session.advance();

      // Routes directly to end
      assert.equal(nextStep, "end");
      assert.equal(session.getEndingId(), "ending-3");

      const state = session.getState();
      assert.equal(state.narrative.ending, "ending-3");
      assert.equal(state.narrative.score, 28);
      assert.equal(state.narrative.debrief.status, "fatal");
      assert.ok(
        state.narrative.debrief.contingencyAddress?.includes("Fate has ordained") ||
          state.narrative.debrief.quote?.includes("Fate has ordained")
      );
    });
  });
});
