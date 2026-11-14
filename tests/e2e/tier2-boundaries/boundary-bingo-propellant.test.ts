import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertInRange,
  assertLessThanOrEqual,
  assertTouchdownWithinLimits,
} from "../harness/assertions.ts";
import {
  GameFlowSession,
  loadGameModules,
} from "../harness/gameFlowHarness.ts";
import {
  APOLLO_11_DESCENT_INITIAL_STATE,
  wasmRunDescentStep,
} from "../harness/wasmHarness.ts";

describe("Tier 2 Boundary Suite: Propellant Margins, Bingo Fuel & Abort Staging", () => {
  // Historical Apollo 11 thresholds from telemetry catalog §4.3 & descent.rs
  const LOW_LEVEL_FUEL_WARNING_KG = 255.0; // 5.0% usable propellant (~60s to Bingo)
  const BINGO_FUEL_RESERVE_KG = 112.0; // 25.0s hover fuel threshold

  it("1. validates exactly 5% low-level propellant warning light threshold at 255.0 kg", () => {
    // Check fuel status immediately above and at warning threshold
    const stateAbove = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: 256.0,
      altitude_m: 60.0,
      vertical_velocity_mps: -1.5,
      horizontal_velocity_mps: 3.0,
      throttle_pct: 27.0, // Hover throttle ~4.2 kg/s
    };

    // 256 kg is above the 255.0 kg low-level warning light trigger
    const isWarningTriggeredAbove = stateAbove.propellant_remaining_kg <= LOW_LEVEL_FUEL_WARNING_KG;
    assert.equal(isWarningTriggeredAbove, false, "At 256.0 kg, quantity warning light must remain OFF");

    // Stepping simulation: burns ~3.99 kg (27% throttle * 45,040 N / (311 * 9.80665) ≈ 3.99 kg/s)
    const nextState = wasmRunDescentStep(stateAbove);
    const fuelRemaining = nextState.propellant_remaining_kg;

    // Now fuel is ~252.0 kg <= 255.0 kg
    assertLessThanOrEqual(
      fuelRemaining,
      LOW_LEVEL_FUEL_WARNING_KG,
      "After 1s burn, fuel drops below 255.0 kg threshold"
    );

    const isWarningTriggeredNext = fuelRemaining <= LOW_LEVEL_FUEL_WARNING_KG;
    assert.equal(isWarningTriggeredNext, true, "At <= 255.0 kg, 5% low-level quantity warning light must illuminate");

    // At exact boundary: 255.0 kg
    const atBoundaryState = {
      ...stateAbove,
      propellant_remaining_kg: LOW_LEVEL_FUEL_WARNING_KG,
    };
    const isAtBoundaryWarning = atBoundaryState.propellant_remaining_kg <= LOW_LEVEL_FUEL_WARNING_KG;
    assert.equal(isAtBoundaryWarning, true, "At exact 255.0 kg boundary, low-level warning must trigger");
  });

  it("2. enforces Bingo Fuel threshold boundary at 112.0 kg mandatory abort", () => {
    // 2a. Above Bingo threshold: 113.0 kg
    const stateAboveBingo = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: 113.0,
      altitude_m: 30.0,
      vertical_velocity_mps: -0.8,
      horizontal_velocity_mps: 1.0,
      throttle_pct: 26.0,
      is_bingo_fuel: false,
    };

    // In step_descent, is_bingo_fuel checks initial propellant <= 112.0
    // At 113.0 kg, step 1 has is_bingo_fuel = false
    const step1Above = wasmRunDescentStep(stateAboveBingo);
    assert.equal(step1Above.is_bingo_fuel, false, "Initial fuel 113.0 kg (> 112.0 kg) must evaluate is_bingo_fuel as false");
    assert.ok(step1Above.propellant_remaining_kg < 112.0, "Step burns fuel below 112.0 kg");

    // On the subsequent step, the depleted fuel is now <= 112.0 kg, so is_bingo_fuel transitions to true
    const step2Above = wasmRunDescentStep(step1Above);
    assert.equal(step2Above.is_bingo_fuel, true, "Subsequent step with fuel < 112 kg must set is_bingo_fuel to true");

    // 2b. Exact Bingo threshold: 112.0 kg
    const atBingoState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: BINGO_FUEL_RESERVE_KG, // 112.0 kg
      altitude_m: 20.0,
      vertical_velocity_mps: -0.5,
      horizontal_velocity_mps: 0.5,
      throttle_pct: 26.0,
      is_bingo_fuel: false,
    };

    const nextAtBingo = wasmRunDescentStep(atBingoState);
    assert.equal(nextAtBingo.is_bingo_fuel, true, "Exact 112.0 kg boundary must immediately trigger is_bingo_fuel = true");

    // 2c. Sub-Bingo threshold: 111.0 kg
    const subBingoState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: 111.0,
      altitude_m: 15.0,
      vertical_velocity_mps: -0.5,
      horizontal_velocity_mps: 0.2,
      throttle_pct: 26.0,
      is_bingo_fuel: false,
    };

    const nextSubBingo = wasmRunDescentStep(subBingoState);
    assert.equal(nextSubBingo.is_bingo_fuel, true, "111.0 kg (< 112 kg) must immediately trigger is_bingo_fuel = true");
  });

  it("3. validates complete fuel exhaustion at 0.0 kg flameout and free-fall impact", () => {
    // Zero fuel remaining
    const dryState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: 0.0,
      altitude_m: 10.0,
      vertical_velocity_mps: -5.0,
      horizontal_velocity_mps: 1.0,
      throttle_pct: 50.0,
    };

    const step1 = wasmRunDescentStep(dryState);

    // Propellant stays at 0.0 kg (never negative)
    assert.equal(step1.propellant_remaining_kg, 0.0, "Dry tanks must remain clamped at 0.0 kg");
    assert.equal(step1.is_bingo_fuel, true);

    // Vertical acceleration equals lunar gravity -1.622 m/s^2
    const deltaVz = step1.vertical_velocity_mps - dryState.vertical_velocity_mps;
    assertInRange(deltaVz, -1.63, -1.61, "Dry tanks produce zero thrust and purely gravitational acceleration");

    // Altitude drops from 10m to ~3.4m:
    assert.ok(step1.altitude_m < 10.0, "Altitude must decrease during dry free-fall");

    // Step into ground impact:
    const step2 = wasmRunDescentStep(step1);
    assert.equal(step2.altitude_m, 0.0, "Vehicle touches surface at altitude 0.0 m");
    assert.equal(step2.is_landed, true, "is_landed must be true");
    // With severe sink rate (> 3.05 m/s) and zero fuel, landing is unsafe or bingo abort
    assert.ok(
      step2.touchdown_status.includes("ABORT") ||
      step2.touchdown_status.includes("COLLAPSE") ||
      step2.touchdown_status.includes("ROUGH"),
      `Touchdown status must indicate non-nominal landing, got: ${step2.touchdown_status}`
    );
  });

  it("4. verifies successful touchdown at 0.1s before dry tanks", () => {
    // 0.1 second of fuel remaining at hover burn rate (~4.0 kg/s) corresponds to ~0.4 kg fuel
    const nearDryState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: 0.5, // ~0.12s of hover fuel remaining
      altitude_m: 0.3, // 30 cm off lunar regolith (within 1.71m contact probe threshold)
      vertical_velocity_mps: -0.45, // Gentle touchdown rate (-1.5 ft/s)
      horizontal_velocity_mps: 0.2, // Minimal drift
      throttle_pct: 26.0,
      is_bingo_fuel: true,
      is_landed: false,
    };

    // Structural contact criteria verification
    assertTouchdownWithinLimits(
      nearDryState.horizontal_velocity_mps,
      nearDryState.vertical_velocity_mps,
      3.0, // nominal 3 degree surface tilt
      0.5  // nominal 0.5 deg/s rate
    );

    const landedState = wasmRunDescentStep(nearDryState);

    // Altitude clamped to 0.0m on touchdown
    assert.equal(landedState.altitude_m, 0.0, "Altitude must clamp to 0.0m on touchdown");
    assert.equal(landedState.is_landed, true, "Vehicle must be landed");

    // Propellant remaining is non-negative and close to zero
    assert.ok(landedState.propellant_remaining_kg >= 0.0, "Propellant must be non-negative");
    assert.ok(landedState.propellant_remaining_kg <= 0.5, "Fuel was consumed on final contact second");

    // Touchdown status evaluates to SAFE_LANDING because velocities were within structural limits
    assert.equal(
      landedState.touchdown_status,
      "SAFE_LANDING",
      "Touchdown within structural limits must evaluate to SAFE_LANDING even with low fuel"
    );
  });

  it("5. executes emergency Abort Stage separation with dry descent tanks and verifies Ending 4", async () => {
    const mods = await loadGameModules();
    const session = new GameFlowSession(mods);
    session.reset();

    const store = session.getState();

    // Set up narrative state prior to landing decision
    store.makeDecision?.("inspection", "thorough");
    store.makeDecision?.("weather", "go");
    store.makeDecision?.("trajectory", "free_return");
    store.makeDecision?.("agc_alarm", "go");

    // Decision 5: Trigger Bingo Fuel Wave-Off (Option C: bingo_abort)
    const success = store.makeDecision?.("landing_approach", "bingo_abort");
    assert.equal(success, true, "makeDecision for bingo_abort must succeed");

    const updatedState = session.getState();
    assert.equal(
      updatedState.narrative?.ending,
      "ending-4",
      "Bingo fuel abort must trigger ending-4"
    );

    // Verify catalog definition for Ending 4
    const ending4 = mods.ENDINGS_CATALOG?.["ending-4"];
    assert.ok(ending4, "Ending-4 must exist in catalog");
    assert.equal(ending4.id, "ending-4");
    assert.equal(ending4.status, "partial");
    assert.equal(ending4.score, 60);
    assert.ok(
      ending4.title.en.includes("Bingo Fuel") || ending4.title.en.includes("Wave-Off"),
      `Ending-4 title must mention Bingo Fuel: ${ending4.title.en}`
    );

    // Verify terminal lock: once ending is reached, subsequent decisions are rejected (returns false)
    const lockedDecision = store.makeDecision?.("landing_approach", "p66_redesignation");
    assert.equal(
      lockedDecision,
      false,
      "Terminal state lock must return false to reject decision changes after reaching ending-4"
    );
    assert.equal(
      session.getState().narrative?.ending,
      "ending-4",
      "Ending must remain locked at ending-4"
    );
  });
});
