import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  assertApprox,
  assertGreaterThanOrEqual,
  assertInRange,
  assertLessThanOrEqual,
  assertLiftoffTwrNominal,
  assertMaxQWithinEnvelope,
  assertMonotonic,
  assertKscWeatherSchema,
  assertLaunchTelemetrySchema,
  assertSimulationValidationSchema,
} from "../harness/assertions.ts";
import { startTestServer, type TestServerContext } from "../harness/serverHarness.ts";
import {
  APOLLO_11_LAUNCH_CONFIG,
  wasmValidateLaunch,
  type LaunchConfiguration,
} from "../harness/wasmHarness.ts";
import { createGameFlowSession } from "../harness/gameFlowHarness.ts";
import { SimulationValidatorBridge } from "../../../apps/server/src/validator/simBridge.ts";

describe("Tier 3 Combination: Launch Weather Crosswinds & Throttle / Max-Q Dynamics", () => {
  let serverCtx: TestServerContext;
  let simBridge: SimulationValidatorBridge;

  before(async () => {
    serverCtx = await startTestServer({ silent: true });
    simBridge = new SimulationValidatorBridge();
  });

  after(async () => {
    await serverCtx.shutdown();
  });

  describe("Nominal Pad 39A Weather & Full S-IC Liftoff Thrust", () => {
    it("retrieves Cape Canaveral weather and validates baseline Saturn V flight envelope", async () => {
      const weatherRes = await serverCtx.fetch("/api/weather/ksc");
      assert.equal(weatherRes.status, 200);
      const weather = await weatherRes.json();
      assertKscWeatherSchema(weather);
      assert.equal(weather.status, "GO", "Nominal weather should be GO");
      assertInRange(weather.wind_speed_kmh, 5.0, 30.0, "Nominal morning wind speed should be mild");

      const telemRes = await serverCtx.fetch("/api/launch/telemetry");
      assert.equal(telemRes.status, 200);
      const telemetry = (await telemRes.json()) as any;
      assert.equal(telemetry.mission_id, "AS-506");
      assert.equal(telemetry.target, "Tranquility Base");
      assert.ok(telemetry.site && typeof telemetry.site.lat === "number");
      assert.ok(telemetry.vehicle && Array.isArray(telemetry.vehicle.stages));

      // Validate launch using WASM engine
      const wasmValidation = wasmValidateLaunch({
        ...APOLLO_11_LAUNCH_CONFIG,
        wind_speed_kmh: weather.wind_speed_kmh,
      });
      assertSimulationValidationSchema(wasmValidation);
      assert.equal(wasmValidation.is_valid, true, "WASM launch validation should succeed");
      assertLiftoffTwrNominal(wasmValidation.liftoff_twr);
      assertMaxQWithinEnvelope(wasmValidation.max_q_time_s, wasmValidation.max_q_kpa);

      // Validate launch using Server Sim Bridge
      const serverValidation = await simBridge.validateSimulation({
        wind_speed_kmh: weather.wind_speed_kmh,
      });
      assert.equal(serverValidation.is_valid, true, "Server launch validation should succeed");
      assertLiftoffTwrNominal(serverValidation.liftoff_twr);
      assertMaxQWithinEnvelope(serverValidation.max_q_time_s, serverValidation.max_q_kpa);
      assertGreaterThanOrEqual(serverValidation.score ?? 0, 80, "Nominal launch score should be high");
    });
  });

  describe("Crosswind & Dynamic Pressure Correlation (Pairwise Interaction)", () => {
    it("demonstrates monotonic increase in Max-Q dynamic pressure with increasing crosswinds", () => {
      const windSpeeds = [0.0, 15.0, 30.0, 45.0, 60.0];
      const maxQValues: number[] = [];
      const maxQTimes: number[] = [];

      for (const wind of windSpeeds) {
        const config: LaunchConfiguration = {
          ...APOLLO_11_LAUNCH_CONFIG,
          wind_speed_kmh: wind,
        };
        const res = wasmValidateLaunch(config);
        assertSimulationValidationSchema(res);
        assert.equal(res.is_valid, true, `Wind ${wind} km/h should remain within safe envelope`);
        maxQValues.push(res.max_q_kpa);
        maxQTimes.push(res.max_q_time_s);
      }

      // Max-Q dynamic pressure must strictly increase with wind speed
      assertMonotonic(maxQValues, "increasing", "Dynamic pressure must rise with higher wind speed");
      assertGreaterThanOrEqual(
        maxQValues[maxQValues.length - 1],
        maxQValues[0] + 1.0,
        "60 km/h wind should measurably increase dynamic pressure over calm air"
      );
    });

    it("evaluates server bridge warnings as wind speed approaches the 40 km/h threshold", async () => {
      // Wind speed below 30 km/h: zero warnings
      const calm = await simBridge.validateSimulation({ wind_speed_kmh: 15.0 });
      assert.equal(calm.is_valid, true);
      assert.equal(calm.warnings?.length ?? 0, 0, "No warnings expected for 15 km/h wind");

      // Wind speed above 30 km/h with higher TWR: triggers warning and risk penalty increase
      const highWind = await simBridge.validateSimulation({
        wind_speed_kmh: 38.0,
        thrust_kn: 36_000, // Higher thrust amplifies dynamic pressure
      });
      assert.equal(highWind.is_valid, true);
      assert.ok(
        (highWind.details?.risk_factor ?? 0) > (calm.details?.risk_factor ?? 0),
        "High wind + thrust must increase risk factor"
      );
      assert.ok(
        (highWind.score ?? 0) < (calm.score ?? 0),
        "Increased aerodynamic risk must penalize composite score"
      );
    });
  });

  describe("Boundary Overpressure Violations & Structural Failure", () => {
    it("rejects launch when crosswind exceeds maximum launch limit (74 km/h)", () => {
      const config: LaunchConfiguration = {
        ...APOLLO_11_LAUNCH_CONFIG,
        wind_speed_kmh: 78.0, // Exceeds 74.0 km/h limit
      };
      const res = wasmValidateLaunch(config);
      assert.equal(res.is_valid, false, "Launch must be rejected above 74 km/h wind");
      assert.ok(
        res.failure_reason?.includes("exceeds maximum launch limit") ||
          res.error_message?.includes("exceeds maximum launch limit"),
        `Failure reason must cite wind limit: ${res.failure_reason}`
      );
    });

    it("server bridge aborts on aerodynamic structural failure when Max-Q exceeds 45.0 kPa", async () => {
      // Extreme aerodynamic combination: High thrust + severe wind
      const overpressureInput = {
        thrust_kn: 42_000, // 24% overthrust
        wind_speed_kmh: 65.0,
      };

      const val = await simBridge.validateSimulation(overpressureInput);
      assert.equal(val.is_valid, false, "Overpressure launch must fail validation");
      assert.ok(
        val.failure_reason?.includes("MAX_Q_STRUCTURAL_FAILURE") || val.failure_reason?.includes("45.0 kPa"),
        `Failure reason must cite Max-Q structural failure: ${val.failure_reason}`
      );
      assert.equal(val.score, 0, "Failed launch must receive score 0");

      // Authoritative simulation execution produces failure trace
      const simResult = await simBridge.runAuthoritativeSimulation(overpressureInput);
      assert.equal(simResult.isSuccess, false);
      assert.equal(simResult.failureTrace.length, 1);
      assert.equal(simResult.failureTrace[0].anomaly, "MAX_Q_STRUCTURAL_OVERPRESSURE");
      assert.ok(simResult.failureTrace[0].subsystem.includes("Aerodynamics"));
      assertInRange(simResult.failureTrace[0].timestampSec, 60.0, 100.0);
    });
  });

  describe("Interactive Narrative Decision Branching on Severe Weather", () => {
    it("branches to Ending-5 (Ascent Catastrophe) when committing to launch in severe wind (>40 km/h)", async () => {
      const session = await createGameFlowSession();

      // Advance through medical and assembly
      session.advanceTo("weather-decision");
      assert.equal(session.getCurrentStepId(), "weather-decision");

      // Make decision: severe_wind
      session.makeDecision("weather", "severe_wind");
      const nextStep = session.advance();

      // State machine must branch directly to 'end'
      assert.equal(nextStep, "end");
      assert.equal(session.getEndingId(), "ending-5");

      const state = session.getState();
      assert.equal(state.narrative.ending, "ending-5");
      assert.equal(state.narrative.score, 5);
      assert.ok(state.narrative.failureReason?.includes("Max-Q"));
    });

    it("continues nominal countdown to launch video when accepting historical weather GO", async () => {
      const session = await createGameFlowSession();

      session.advanceTo("weather-decision");
      session.makeDecision("weather", "go");
      const nextStep = session.advance();

      // Nominal path continues to launch video
      assert.equal(nextStep, "launch-video");
      assert.equal(session.getEndingId(), null, "Ending must not be set on nominal GO");
    });
  });
});
