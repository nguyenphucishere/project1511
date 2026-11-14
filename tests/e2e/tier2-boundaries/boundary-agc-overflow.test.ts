import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAgcAlarmDutyCycle,
  assertInRange,
} from "../harness/assertions.ts";
import {
  GameFlowSession,
  loadGameModules,
} from "../harness/gameFlowHarness.ts";
import {
  wasmCalculateScore,
} from "../harness/wasmHarness.ts";

describe("Tier 2 Boundary Suite: Apollo Guidance Computer (AGC) CPU Duty & Alarms", () => {
  it("1. validates 84% CPU duty cycle operates sub-alarm without triggering 1201/1202 alarms", () => {
    // 84.0% duty cycle is below the 85.0% alarm threshold
    assertAgcAlarmDutyCycle(84.0, false, "84.0% CPU duty must operate nominally without alarms");
    assertAgcAlarmDutyCycle(84.9, false, "84.9% CPU duty must remain sub-alarm");

    // Must throw if alarm is claimed to be active at 84%
    assert.throws(
      () => assertAgcAlarmDutyCycle(84.0, true),
      (err: any) => err.message.includes("unexpectedly triggered"),
      "assertAgcAlarmDutyCycle must throw if alarm is claimed at 84% duty"
    );
  });

  it("2. verifies exact 85.0% CPU duty boundary triggers 1202 program alarm", async () => {
    // Exact threshold boundary: 85.0%
    assertAgcAlarmDutyCycle(85.0, true, "Exact 85.0% CPU duty must trigger program alarm");

    // Must throw if alarm is omitted at 85%
    assert.throws(
      () => assertAgcAlarmDutyCycle(85.0, false),
      (err: any) => err.message.includes("alarm was not triggered"),
      "assertAgcAlarmDutyCycle must throw if alarm is omitted at >= 85% duty"
    );

    // Verify 1202 alarm dispatch in game narrative engine
    const mods = await loadGameModules();
    const session = new GameFlowSession(mods);
    session.reset();

    const store = session.getState();
    store.triggerAlarm?.("1202");

    const updated = session.getState();
    assert.equal(
      updated.narrative?.activeAlarm,
      "1202",
      "Active alarm in narrative state must be set to '1202'"
    );
  });

  it("3. validates 98% CPU duty peak overload conditions and telemetry anomaly tracing", () => {
    // 98.0% peak load: rendezvous radar counter pulses flooding executive core memory
    assertAgcAlarmDutyCycle(98.0, true, "98.0% peak CPU load must have active alarm flag");

    // Authoritative anomaly catalog trace verification in sim engine
    const evalResult = wasmCalculateScore({
      science_score: 500,
      cost_score: 100,
      risk_penalty: 20,
      active_anomalies: ["ANOM-A11-01"], // Historical 1202 alarm code
    });

    assert.ok(Array.isArray(evalResult.failure_chain), "Failure chain must be an array");
    const agcAnomaly = evalResult.failure_chain.find((entry) => entry.includes("ANOM-A11-01"));
    assert.ok(agcAnomaly, "Must trace ANOM-A11-01 historical AGC 1202 program alarm");
    assert.ok(
      agcAnomaly.includes("Executive BAILOUT restart") || agcAnomaly.includes("1202"),
      `Anomaly trace description must detail Executive BAILOUT restart: ${agcAnomaly}`
    );
  });

  it("4. verifies executive queue priority flush recovery when calling GO on intermittent alarm", async () => {
    const mods = await loadGameModules();
    const session = new GameFlowSession(mods);
    session.reset();

    const store = session.getState();

    // Advance to prior decision points
    store.makeDecision?.("inspection", "thorough");
    store.makeDecision?.("weather", "go");
    store.makeDecision?.("trajectory", "free_return");

    // Trigger intermittent 1202 alarm
    store.triggerAlarm?.("1202");
    assert.equal(session.getState().narrative?.activeAlarm, "1202");

    // Jack Garman / Steve Bales historical call: GO on intermittent alarm
    // The executive drops low-priority radar display routines; guidance integration continues uninterrupted
    const goAccepted = store.makeDecision?.("agc_alarm", "go");
    assert.equal(goAccepted, true, "makeDecision 'go' on agc_alarm must succeed");

    const postGoState = session.getState();
    assert.equal(
      postGoState.narrative?.decisions?.agc_alarm,
      "go",
      "Decision record must show 'go' call"
    );

    // Flight continues uninterrupted: ending remains null (not aborted)
    assert.equal(
      postGoState.narrative?.ending,
      null,
      "Calling GO on alarm must continue descent without terminating the mission"
    );
  });

  it("5. validates sustained overload / conservative call forces emergency guidance abort to orbit (Ending 2)", async () => {
    const mods = await loadGameModules();
    const session = new GameFlowSession(mods);
    session.reset();

    const store = session.getState();

    store.makeDecision?.("inspection", "thorough");
    store.makeDecision?.("weather", "go");
    store.makeDecision?.("trajectory", "free_return");

    // Trigger 1201 alarm (executive core vacancy buffer overflow)
    store.triggerAlarm?.("1201");

    // Guidance officer calls conservative abort: hit ABORT STAGE
    const abortAccepted = store.makeDecision?.("agc_alarm", "abort_stage");
    assert.equal(abortAccepted, true, "makeDecision 'abort_stage' must succeed");

    const state = session.getState();
    assert.equal(
      state.narrative?.ending,
      "ending-2",
      "AGC alarm abort must trigger ending-2 (Safe Abort to Lunar Orbit)"
    );

    // Inspect Ending 2 properties in catalog
    const ending2 = mods.ENDINGS_CATALOG?.["ending-2"];
    assert.ok(ending2, "Ending-2 must exist in catalog");
    assert.equal(ending2.status, "partial");
    assert.equal(ending2.score, 72);
    assert.ok(
      ending2.title.en.includes("Abort to Orbit") || ending2.title.en.includes("Safe in Lunar Orbit"),
      `Ending-2 title must specify Abort to Orbit: ${ending2.title.en}`
    );

    // Verify terminal lock prevents subsequent landing decisions
    const rejectedDecision = store.makeDecision?.("landing_approach", "p66_redesignation");
    assert.equal(
      rejectedDecision,
      false,
      "Terminal lock must prevent landing decision after AGC abort"
    );
    assert.equal(session.getState().narrative?.ending, "ending-2");
  });
});
