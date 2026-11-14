import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertApprox,
  assertInRange,
  assertThrottleInCavitationBand,
  assertThrottleValid,
} from "../harness/assertions.ts";
import {
  APOLLO_11_DESCENT_INITIAL_STATE,
  wasmCalculateScore,
  wasmRunDescentStep,
} from "../harness/wasmHarness.ts";

describe("Tier 2 Boundary Suite: LM Throttle Cavitation & Operational Bands", () => {
  it("1. validates lunar free-fall and zero propellant burn at 0.0% throttle cutoff", () => {
    // 0% throttle represents engine cutoff (engine shutdown on contact probe or coast)
    assertThrottleValid(0.0, "0.0% throttle cutoff must be recognized as valid non-firing state");

    const state = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      throttle_pct: 0.0,
      altitude_m: 8000.0,
      vertical_velocity_mps: -25.0,
      horizontal_velocity_mps: 200.0,
      propellant_remaining_kg: 5000.0,
    };

    const next = wasmRunDescentStep(state);

    // Propellant mass must be completely unchanged (0.0 kg burned)
    assert.equal(
      next.propellant_remaining_kg,
      state.propellant_remaining_kg,
      "Zero propellant should be consumed at 0.0% throttle cutoff"
    );

    // Net acceleration must equal lunar surface gravity -1.622 m/s^2 downward
    const deltaVz = next.vertical_velocity_mps - state.vertical_velocity_mps;
    assertInRange(deltaVz, -1.63, -1.61, "At 0% throttle, vertical deceleration must match lunar gravity -1.622 m/s^2");

    // Horizontal deceleration is 0 without active thrust
    assert.equal(
      next.horizontal_velocity_mps,
      state.horizontal_velocity_mps,
      "Horizontal velocity must coast unaffected when throttle is 0%"
    );
  });

  it("2. verifies exact upper boundary of continuous throttle range at 60.0%", () => {
    // 60.0% is the calibrated upper physical limit of continuous needle-valve throttling
    assertThrottleValid(60.0, "60.0% throttle must be valid continuous throttling limit");

    const state = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      throttle_pct: 60.0,
      altitude_m: 3000.0,
      vertical_velocity_mps: -20.0,
      horizontal_velocity_mps: 100.0,
      propellant_remaining_kg: 4000.0,
    };

    const next = wasmRunDescentStep(state);

    // Fuel consumed at 60% throttle:
    // Thrust = 60% * 45,040 N = 27,024 N
    // Mass flow rate = 27,024 / (311 * 9.80665) = 8.861 kg/s
    const fuelBurned = state.propellant_remaining_kg - next.propellant_remaining_kg;
    assertInRange(fuelBurned, 8.5, 9.2, "Fuel consumption at 60.0% throttle must be ~8.86 kg/s");

    // Net vertical acceleration: vehicle mass ~ 6,682 kg + 4,000 kg = 10,682 kg
    // Upward accel = 27,024 / 10,682 ≈ 2.53 m/s^2; net = 2.53 - 1.622 ≈ +0.91 m/s^2
    const deltaVz = next.vertical_velocity_mps - state.vertical_velocity_mps;
    assert.ok(deltaVz > 0, "60% throttle must provide net positive vertical acceleration against lunar gravity");
  });

  it("3. detects prohibited band lower edge at 60.1% and enforces cavitation penalty", () => {
    // 60.1% crosses into the prohibited cavitation zone (60.05% to 92.45%)
    assertThrottleInCavitationBand(60.1, "60.1% must be detected as inside the prohibited cavitation band");

    assert.throws(
      () => assertThrottleValid(60.1),
      (err: any) => err.message.includes("cavitation band"),
      "assertThrottleValid must reject 60.1% with cavitation error"
    );

    // Stepping simulation with 60.1%:
    // Engine clamping logic safeguards hardware by clamping 60.1% down to safe 60.0%
    const state = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      throttle_pct: 60.1,
      altitude_m: 4000.0,
      propellant_remaining_kg: 5000.0,
    };

    const next = wasmRunDescentStep(state);
    const fuelBurned = state.propellant_remaining_kg - next.propellant_remaining_kg;
    // Clamped to 60.0% -> burns ~8.86 kg/s
    assertInRange(fuelBurned, 8.5, 9.2, "60.1% must clamp to safe 60.0% burn rate");

    // Cavitation penalty in mission evaluation
    const scoreResult = wasmCalculateScore({
      science_score: 500,
      cost_score: 100,
      risk_penalty: 35, // Cavitation risk penalty
      active_anomalies: ["THROTTLE_CAVITATION_60_1"],
    });

    assert.ok(scoreResult.final_score < 500, "Cavitation risk penalty must reduce mission score");
    assert.ok(scoreResult.risk_penalty >= 35, "Risk penalty must reflect cavitation violation");
  });

  it("4. detects prohibited band upper edge at 92.4% and verifies FTP safety clamping", () => {
    // 92.4% is immediately below the Fixed Throttle Position (FTP) threshold
    assertThrottleInCavitationBand(92.4, "92.4% must be detected as inside the prohibited cavitation band");

    assert.throws(
      () => assertThrottleValid(92.4),
      (err: any) => err.message.includes("cavitation band"),
      "assertThrottleValid must reject 92.4% with cavitation error"
    );

    // In sim-core descent physics: values >= 76.25% in the cavitation band clamp upward to 92.5% FTP
    const state = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      throttle_pct: 92.4,
      altitude_m: 10000.0,
      propellant_remaining_kg: 6000.0,
    };

    const next = wasmRunDescentStep(state);
    const fuelBurned = state.propellant_remaining_kg - next.propellant_remaining_kg;

    // Clamped to 92.5% FTP:
    // Thrust = 92.5% * 45,040 N = 41,662 N
    // Mass flow = 41,662 / (311 * 9.80665) = 13.66 kg/s
    assertInRange(fuelBurned, 13.2, 14.2, "92.4% clamped to 92.5% FTP must burn ~13.66 kg/s");
  });

  it("5. validates exact lower boundary of Fixed Throttle Position (FTP) at 92.5%", () => {
    // 92.5% is the nominal lower boundary of the Fixed Throttle Position (FTP)
    assertThrottleValid(92.5, "92.5% throttle must be valid FTP entry boundary");

    const state = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      throttle_pct: 92.5,
      altitude_m: 14000.0,
      vertical_velocity_mps: -5.0,
      horizontal_velocity_mps: 1500.0,
      propellant_remaining_kg: 8000.0,
    };

    const next = wasmRunDescentStep(state);

    // Fuel consumed at 92.5% FTP
    const fuelBurned = state.propellant_remaining_kg - next.propellant_remaining_kg;
    assertInRange(fuelBurned, 13.2, 14.2, "Nominal 92.5% FTP fuel consumption must be ~13.66 kg/s");

    // Also compare with 100.0% maximum FTP throttle
    const state100 = {
      ...state,
      throttle_pct: 100.0,
    };
    const next100 = wasmRunDescentStep(state100);
    const fuelBurned100 = state100.propellant_remaining_kg - next100.propellant_remaining_kg;
    assertInRange(fuelBurned100, 14.3, 15.3, "100.0% FTP fuel consumption must be ~14.77 kg/s");

    // 100% FTP must consume strictly more propellant than 92.5% FTP
    assert.ok(
      fuelBurned100 > fuelBurned,
      `100% burn (${fuelBurned100.toFixed(2)} kg) must exceed 92.5% burn (${fuelBurned.toFixed(2)} kg)`
    );
  });

  it("6. verifies full throttle envelope boundary partition from 0% to 100%", () => {
    // Partition summary:
    // [0%] -> Cutoff (Valid)
    // (0%, 10%) -> Sub-idle out of operating range
    // [10%, 60.0%] -> Continuous Throttle Band (Valid)
    // (60.05%, 92.45%) -> Prohibited Cavitation Band (Invalid / Cavitation Risk)
    // [92.5%, 100%] -> Fixed Throttle Position (FTP) (Valid)

    const validTestCases = [0.0, 10.0, 25.0, 50.0, 60.0, 92.5, 95.0, 100.0];
    for (const throttle of validTestCases) {
      assert.doesNotThrow(
        () => assertThrottleValid(throttle),
        `Throttle ${throttle}% must be valid`
      );
    }

    const cavitationTestCases = [60.1, 65.0, 75.0, 80.0, 85.0, 90.0, 92.4];
    for (const throttle of cavitationTestCases) {
      assertThrottleInCavitationBand(throttle, `Throttle ${throttle}% must be in cavitation band`);
      assert.throws(
        () => assertThrottleValid(throttle),
        `Throttle ${throttle}% must be rejected by assertThrottleValid`
      );
    }
  });
});
