import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAgcAlarmDutyCycle,
  assertApprox,
  assertDescentStateSchema,
  assertEarthOrbitPeriod,
  assertGreaterThanOrEqual,
  assertInRange,
  assertLessThanOrEqual,
  assertLiftoffTwrNominal,
  assertLunarEclipseDuration,
  assertLunarOrbitPeriod,
  assertMaxQWithinEnvelope,
  assertMonotonic,
  assertSimulationValidationSchema,
  assertThrottleInCavitationBand,
  assertThrottleValid,
  assertTouchdownWithinLimits,
} from "./assertions.ts";
import { ROOT_DIR, SERVER_DIR, WEB_DIR, WASM_BG_PATH } from "./env.ts";
import { createGameFlowSession } from "./gameFlowHarness.ts";
import { startTestServer } from "./serverHarness.ts";
import {
  APOLLO_11_DESCENT_INITIAL_STATE,
  APOLLO_11_LAUNCH_CONFIG,
  loadWasmSimulation,
  wasmCalculateScore,
  wasmPing,
  wasmRunDescentStep,
  wasmValidateLaunch,
} from "./wasmHarness.ts";

describe("E2E Test Harness Scaffolding Smoke Suite", () => {
  describe("Environment Paths & Configuration", () => {
    it("resolves canonical project directories", () => {
      assert.ok(ROOT_DIR.endsWith("project1511"), `ROOT_DIR should end with project1511, got: ${ROOT_DIR}`);
      assert.ok(SERVER_DIR.replace(/\\/g, "/").includes("apps/server"), `SERVER_DIR should include apps/server, got: ${SERVER_DIR}`);
      assert.ok(WEB_DIR.replace(/\\/g, "/").includes("apps/web"), `WEB_DIR should include apps/web, got: ${WEB_DIR}`);
      assert.ok(WASM_BG_PATH.endsWith("sim_wasm_bg.wasm"), `WASM_BG_PATH should end with wasm file, got: ${WASM_BG_PATH}`);
    });
  });

  describe("In-Process Ephemeral Server Lifecycle (serverHarness)", () => {
    it("starts on port 0, serves requests, issues guest tokens, and shuts down cleanly", async () => {
      const serverCtx = await startTestServer({ silent: true });
      try {
        assert.ok(serverCtx.port > 0, `Server should bind to ephemeral port > 0, got: ${serverCtx.port}`);
        assert.ok(serverCtx.baseUrl.startsWith("http://127.0.0.1:"), `baseUrl invalid: ${serverCtx.baseUrl}`);
        assert.ok(serverCtx.wsUrl.startsWith("ws://127.0.0.1:"), `wsUrl invalid: ${serverCtx.wsUrl}`);

        // Health endpoint check
        const healthRes = await serverCtx.fetch("/health");
        assert.equal(healthRes.status, 200, "Health check should return status 200");
        const healthData = (await healthRes.json()) as { status: string; rooms: number };
        assert.equal(healthData.status, "ok");
        assert.equal(typeof healthData.rooms, "number");

        // Auth guest token issuance
        const tokenInfo = serverCtx.issueToken("commander-neil");
        assert.ok(tokenInfo.token.length > 20, "JWT token should be issued");
        assert.equal(tokenInfo.username, "commander-neil");
        assert.ok(tokenInfo.userId.length > 0, "userId should be generated");
      } finally {
        await serverCtx.shutdown();
      }
    });
  });

  describe("WebAssembly Apollo 11 Physics Engine (wasmHarness)", () => {
    it("loads sim-wasm synchronously in Node 24 and returns ping banner", () => {
      const wasm = loadWasmSimulation();
      assert.ok(wasm, "WASM module should be initialized");
      const ping = wasmPing();
      assert.ok(ping.includes("sim-wasm"), `Ping should contain sim-wasm, got: ${ping}`);
    });

    it("evaluates Saturn V launch envelope via validate_launch", () => {
      const validation = wasmValidateLaunch(APOLLO_11_LAUNCH_CONFIG);
      assertSimulationValidationSchema(validation);
      assert.equal(validation.is_valid, true, "Apollo 11 nominal config must be valid");
      assertGreaterThanOrEqual(validation.glom_kg, 2_800_000, "Saturn V GLOM should be > 2.8M kg");
      assertLiftoffTwrNominal(validation.liftoff_twr);
      assertMaxQWithinEnvelope(validation.max_q_time_s, validation.max_q_kpa);
      assertGreaterThanOrEqual(validation.payload_margin_kg, 0, "Payload margin should be positive");
    });

    it("propagates lunar descent step and consumes propellant via run_descent_step", () => {
      const initial = { ...APOLLO_11_DESCENT_INITIAL_STATE };
      const stepped = wasmRunDescentStep(initial);

      assertDescentStateSchema(stepped);
      assert.ok(
        stepped.propellant_remaining_kg < initial.propellant_remaining_kg,
        `Propellant must decrease after 1s burn: was ${initial.propellant_remaining_kg}, now ${stepped.propellant_remaining_kg}`
      );
      assert.equal(stepped.touchdown_status, "IN_FLIGHT");
    });

    it("computes multi-criteria mission score and traces historical anomalies via calculate_score", () => {
      const scoreResult = wasmCalculateScore({
        science_score: 95.0,
        cost_score: 10.0,
        risk_penalty: 5.0,
        weight_science: 1.0,
        weight_cost: 0.5,
        weight_risk: 0.8,
        active_anomalies: ["ANOM-A11-01"],
      });

      assert.equal(scoreResult.is_success, true);
      assertApprox(scoreResult.final_score, 86.0, 0.01);
      assert.ok(scoreResult.failure_chain.length > 0, "Failure chain should contain anomaly record");
      assert.ok(scoreResult.failure_chain[0].includes("ANOM-A11-01"));
    });
  });

  describe("Interactive Narrative State Machine Headless Driver (gameFlowHarness)", () => {
    it("initializes useGameStore, advances steps, and records narrative decisions", async () => {
      const session = await createGameFlowSession();
      assert.ok(session.flow.length > 0, "FLOW should contain narrative steps");

      // Initial step is intro-video
      assert.equal(session.getCurrentStepId(), "intro-video");

      // Advance to next step
      const nextStep = session.advance();
      assert.equal(nextStep, "medical-briefing");

      // Record branching decision
      session.makeDecision("inspection", "thorough");
      const decisions = session.getDecisions();
      assert.equal(decisions.inspection, "thorough");

      // Record ending transition
      session.setEnding("ending-1");
      assert.equal(session.getEndingId(), "ending-1");

      // Verify mission log
      const log = session.getMissionLog();
      assert.ok(log && typeof log === "object");
      assert.equal(typeof log.launchAttempts, "number");
    });
  });

  describe("Assertions Library & Envelope Validators (assertions)", () => {
    it("validates tolerance helpers (assertApprox, assertInRange, assertMonotonic)", () => {
      // assertApprox
      assertApprox(1.00005, 1.0, 0.001);
      assert.throws(() => assertApprox(1.05, 1.0, 0.01), assert.AssertionError);

      // assertInRange
      assertInRange(50, 0, 100);
      assert.throws(() => assertInRange(150, 0, 100), assert.AssertionError);

      // assertGreaterThanOrEqual & assertLessThanOrEqual
      assertGreaterThanOrEqual(10, 5);
      assertLessThanOrEqual(5, 10);
      assert.throws(() => assertGreaterThanOrEqual(3, 5), assert.AssertionError);
      assert.throws(() => assertLessThanOrEqual(12, 10), assert.AssertionError);

      // assertMonotonic
      assertMonotonic([1, 2, 3, 4], "increasing");
      assertMonotonic([4, 3, 2, 1], "decreasing");
      assert.throws(() => assertMonotonic([1, 3, 2], "increasing"), assert.AssertionError);
    });

    it("validates physical flight envelopes and safety limits", () => {
      // Max-Q nominal
      assertMaxQWithinEnvelope(83.0, 34.3);
      assert.throws(() => assertMaxQWithinEnvelope(30.0, 34.3), assert.AssertionError);

      // Liftoff TWR
      assertLiftoffTwrNominal(1.174);
      assert.throws(() => assertLiftoffTwrNominal(0.95), assert.AssertionError);

      // Orbital periods
      assertEarthOrbitPeriod(88.18);
      assertLunarOrbitPeriod(118.0);
      assertLunarEclipseDuration(46.5);

      // Touchdown envelope
      assertTouchdownWithinLimits(0.8, 1.9, 4.5, 1.0);
      // Fails on excessive sink rate
      assert.throws(() => assertTouchdownWithinLimits(0.8, 4.0, 4.5), assert.AssertionError);
      // Fails on excessive lateral velocity
      assert.throws(() => assertTouchdownWithinLimits(2.0, 1.5, 4.5), assert.AssertionError);
      // Fails on excessive tilt
      assert.throws(() => assertTouchdownWithinLimits(0.8, 1.5, 18.0), assert.AssertionError);

      // Throttle limits & prohibited cavitation band
      assertThrottleValid(0);
      assertThrottleValid(45.0);
      assertThrottleValid(95.0);
      assert.throws(() => assertThrottleValid(75.0), assert.AssertionError);

      assertThrottleInCavitationBand(75.0);
      assert.throws(() => assertThrottleInCavitationBand(45.0), assert.AssertionError);

      // AGC duty cycle alarm trigger
      assertAgcAlarmDutyCycle(78.0, false);
      assertAgcAlarmDutyCycle(89.0, true);
      assert.throws(() => assertAgcAlarmDutyCycle(89.0, false), assert.AssertionError);
      assert.throws(() => assertAgcAlarmDutyCycle(75.0, true), assert.AssertionError);
    });
  });
});
