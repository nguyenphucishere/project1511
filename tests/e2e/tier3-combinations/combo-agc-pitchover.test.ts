import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAgcAlarmDutyCycle,
  assertDescentStateSchema,
  assertEndingDefinition,
  assertInRange,
  assertLessThanOrEqual,
  assertThrottleValid,
} from "../harness/assertions.ts";
import {
  wasmRunDescentStep,
  wasmCalculateScore,
  type DescentState,
} from "../harness/wasmHarness.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";

describe("Tier 3 Combination: AGC 1201/1202 Program Alarm & High Gate Pitchover Dynamics", () => {
  describe("High Gate Flight Dynamics & Throttle Validation", () => {
    it("maintains stable descent dynamics during High Gate pitchover maneuver (~7,500 ft / 2,286 m)", () => {
      // High Gate state: Transition from braking phase (P63) into approach phase (P64)
      const highGateState: DescentState = {
        altitude_m: 2_286.0, // 7,500 ft High Gate altitude
        vertical_velocity_mps: -25.0, // Sink rate ~82 ft/s
        horizontal_velocity_mps: 152.0, // Ground speed ~500 ft/s
        throttle_pct: 57.0, // Nominal continuous throttle (within 10-60% band)
        propellant_remaining_kg: 2_450.0,
        agc_cpu_duty_pct: 72.0, // Nominal duty cycle before radar saturation
        is_bingo_fuel: false,
        is_landed: false,
        touchdown_status: "IN_FLIGHT",
      };

      assertDescentStateSchema(highGateState);
      assertThrottleValid(highGateState.throttle_pct);

      // Propagate 5 seconds through pitchover
      let current = { ...highGateState };
      const altitudes: number[] = [current.altitude_m];
      const propellantLevels: number[] = [current.propellant_remaining_kg];

      for (let s = 1; s <= 5; s++) {
        current = wasmRunDescentStep(current);
        assertDescentStateSchema(current);
        altitudes.push(current.altitude_m);
        propellantLevels.push(current.propellant_remaining_kg);
      }

      // Altitude and propellant must decrease progressively
      assert.ok(
        current.altitude_m < highGateState.altitude_m,
        `Altitude must decrease: initial ${highGateState.altitude_m}, current ${current.altitude_m}`
      );
      assert.ok(
        current.propellant_remaining_kg < highGateState.propellant_remaining_kg,
        `Propellant must decrease: initial ${highGateState.propellant_remaining_kg}, current ${current.propellant_remaining_kg}`
      );
      assert.equal(current.is_landed, false);
      assert.equal(current.touchdown_status, "IN_FLIGHT");
    });
  });

  describe("AGC CPU Duty Cycle Overflow & Alarm Threshold Logic", () => {
    it("differentiates nominal CPU load from 1201/1202 overload threshold (85.0%)", () => {
      // Below threshold: 72.0% (nominal radar + landing guidance)
      assertAgcAlarmDutyCycle(72.0, false);

      // At boundary below: 84.9%
      assertAgcAlarmDutyCycle(84.9, false);

      // At threshold and above: 85.0% and 91.2% (1202 pulse overflow)
      assertAgcAlarmDutyCycle(85.0, true);
      assertAgcAlarmDutyCycle(91.2, true);

      // Mismatched states must throw assertion error
      assert.throws(() => {
        assertAgcAlarmDutyCycle(88.0, false, "Overloaded CPU should trigger alarm");
      });
      assert.throws(() => {
        assertAgcAlarmDutyCycle(65.0, true, "Nominal CPU should not trigger alarm");
      });
    });

    it("evaluates historical anomaly ANOM-A11-01 and Executive BAILOUT failure chain", () => {
      // Mission evaluation with 1202 anomaly active
      const evalWithAlarm = wasmCalculateScore({
        science_score: 500,
        cost_score: 376,
        risk_penalty: 0.05,
        active_anomalies: ["ANOM-A11-01"],
      });

      assert.equal(evalWithAlarm.is_success, true);
      assert.ok(evalWithAlarm.final_score > 0);
      assert.equal(evalWithAlarm.failure_chain.length, 1);

      const chainEntry = evalWithAlarm.failure_chain[0];
      assert.ok(
        chainEntry.includes("ANOM-A11-01"),
        `Failure chain must contain ANOM-A11-01, got: ${chainEntry}`
      );
      assert.ok(
        chainEntry.includes("1202") || chainEntry.includes("Executive BAILOUT") || chainEntry.includes("GNC"),
        `Failure chain must detail 1202 BAILOUT consequence: ${chainEntry}`
      );
    });
  });

  describe("Interactive Decision Branching: GO vs ABORT STAGE on 1202 Alarm", () => {
    it("branches to Ending-2 (Safe Abort to Lunar Orbit) when executing ABORT STAGE", async () => {
      const session = await createGameFlowSession();

      // Advance to the AGC alarm decision node
      session.advanceTo("agc-alarm-decision");
      assert.equal(session.getCurrentStepId(), "agc-alarm-decision");

      // Trigger 1202 alarm code and select Option B: abort_stage
      session.triggerAlarm("1202");
      session.makeDecision("agc_alarm", "abort_stage");

      const nextStep = session.advance();
      assert.equal(nextStep, "end", "Abort stage decision must route directly to end");

      const endingId = session.getEndingId();
      assert.equal(endingId, "ending-2");

      const state = session.getState();
      assert.equal(state.narrative.ending, "ending-2");
      assert.equal(state.narrative.score, 72);
      assert.equal(state.narrative.debrief.status, "partial");
      assert.ok(state.narrative.debrief.quote.includes("Eagle is Abort Stage"));
      assert.equal(state.narrative.debrief.telemetry.lunarSamplesKg, 0);
      assert.equal(state.narrative.debrief.telemetry.scienceDeployed, false);
    });

    it("continues to lunar-descent-scene when accepting Bales/Garman GO call", async () => {
      const session = await createGameFlowSession();

      session.advanceTo("agc-alarm-decision");
      session.triggerAlarm("1202");
      session.makeDecision("agc_alarm", "go");

      const nextStep = session.advance();
      assert.equal(
        nextStep,
        "lunar-descent-scene",
        "GO call must continue descent into lunar-descent-scene"
      );
      assert.equal(session.getEndingId(), null, "Mission ending must not be set on GO call");
      assert.equal(session.getState().narrative.activeAlarm, "1202");
    });
  });
});
