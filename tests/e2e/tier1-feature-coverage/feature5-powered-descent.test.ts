import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertApprox,
  assertInRange,
  assertThrottleValid,
  assertThrottleInCavitationBand,
  assertTouchdownWithinLimits,
  assertDescentStateSchema,
  assertMonotonic,
} from "../harness/assertions.ts";
import {
  wasmRunDescentStep,
  APOLLO_11_DESCENT_INITIAL_STATE,
  type DescentState,
} from "../harness/wasmHarness.ts";

describe("Tier 1 Feature 5: LM Powered Descent Throttling & Touchdown Structural Limits", () => {
  // Authoritative constants from Telemetry Catalog NASA-APOLLO-SIM-2026-REV1 §2.4 & §4.3
  const LMDE_MAX_THRUST_N = 45_040.0;
  const LMDE_ISP_S = 311.0;
  const STANDARD_GRAVITY = 9.80665;
  const LOW_LEVEL_FUEL_WARNING_KG = 255.0; // 5% usable fuel (~60s to Bingo)
  const BINGO_FUEL_RESERVE_KG = 112.0; // 25s hover reserve (~17s to mandatory abort)

  it("LM Descent Propulsion System (DPS) throttling validates continuous (10-60%) and FTP (92.5-100%) bands", () => {
    // 1. Valid Continuous Throttling Band [10.0%, 60.0%]
    assert.doesNotThrow(() => assertThrottleValid(10.0));
    assert.doesNotThrow(() => assertThrottleValid(25.0)); // Lunar hover (~26-30%)
    assert.doesNotThrow(() => assertThrottleValid(55.0)); // High Gate approach
    assert.doesNotThrow(() => assertThrottleValid(60.0)); // Continuous upper limit

    // 2. Valid Fixed Throttle Position (FTP) Band [92.5%, 100.0%]
    assert.doesNotThrow(() => assertThrottleValid(92.5)); // FTP lower limit
    assert.doesNotThrow(() => assertThrottleValid(95.0));
    assert.doesNotThrow(() => assertThrottleValid(100.0)); // PDI ignition

    // 3. Cutoff (0.0%) is valid
    assert.doesNotThrow(() => assertThrottleValid(0.0));

    // 4. Prohibited Cavitation Band (60.1% to 92.4%) triggers throat erosion risk
    const cavitationSettings = [61.0, 70.0, 75.0, 80.0, 90.0, 92.0];
    for (const throttle of cavitationSettings) {
      assertThrottleInCavitationBand(throttle);
      assert.throws(
        () => assertThrottleValid(throttle),
        /prohibited cavitation band/,
        `Throttle ${throttle}% must be rejected as prohibited cavitation band`
      );
    }
  });

  it("DPS propellant burn rate and mass flow rate satisfy rocket propulsion equations", () => {
    // Mass flow rate equation: m_dot = F / (Isp * g0)
    // At 100% FTP (45,040 N): m_dot = 45,040 / (311.0 * 9.80665) ~ 14.767 kg/s
    const mDotFtpKgS = LMDE_MAX_THRUST_N / (LMDE_ISP_S * STANDARD_GRAVITY);
    assertApprox(mDotFtpKgS, 14.767, 0.05, "FTP mass flow rate should be ~14.77 kg/s");

    // At 55% throttle (24,772 N): m_dot ~ 8.12 kg/s
    const thrust55N = 0.55 * LMDE_MAX_THRUST_N;
    const mDot55KgS = thrust55N / (LMDE_ISP_S * STANDARD_GRAVITY);
    assertApprox(mDot55KgS, 8.122, 0.05, "55% throttle mass flow rate should be ~8.12 kg/s");

    // At 27% hover throttle (12,160 N): m_dot ~ 3.99 kg/s
    const thrust27N = 0.27 * LMDE_MAX_THRUST_N;
    const mDot27KgS = thrust27N / (LMDE_ISP_S * STANDARD_GRAVITY);
    assertApprox(mDot27KgS, 3.987, 0.05, "Hover mass flow rate should be ~3.99 kg/s");

    // Verify 1-second simulation step consumption in WASM engine
    const initial = { ...APOLLO_11_DESCENT_INITIAL_STATE, throttle_pct: 100.0, propellant_remaining_kg: 8200.0 };
    const stepped = wasmRunDescentStep(initial);
    const consumedKg = initial.propellant_remaining_kg - stepped.propellant_remaining_kg;

    // Consumed mass in 1.0 second should match FTP mass flow rate ~14.8 kg
    assertApprox(consumedKg, mDotFtpKgS, 0.5, "WASM descent step consumes propellant according to mass flow rate");
  });

  it("touchdown structural limits evaluate nominal Apollo 11 landing conditions", () => {
    // Historical Apollo 11 touchdown telemetry at Tranquility Base:
    // - Lateral velocity: 0.5 m/s (<= 1.22 m/s)
    // - Vertical sink rate: 0.45 m/s (<= 2.13 m/s)
    // - Surface tilt: 4.5 degrees (<= 12.0 degrees)
    // - Angular body rate: 0.2 deg/s (<= 2.0 deg/s)
    assert.doesNotThrow(() => {
      assertTouchdownWithinLimits(0.5, 0.45, 4.5, 0.2);
    });

    // Exact allowable boundary envelope:
    // Max horizontal Vx = 1.22 m/s, Max vertical Vz = 2.13 m/s, Max tilt = 12.0 deg
    assert.doesNotThrow(() => {
      assertTouchdownWithinLimits(1.22, 2.13, 12.0, 2.0);
    });

    // Zero horizontal velocity allows up to 3.05 m/s vertical sink rate
    assert.doesNotThrow(() => {
      assertTouchdownWithinLimits(0.0, 3.05, 5.0, 1.0);
    });
  });

  it("touchdown structural limits reject exceedances and trigger catastrophic failure", () => {
    // 1. Excessive lateral velocity: Vx = 2.4 m/s > 1.22 m/s (shears primary landing strut)
    assert.throws(
      () => assertTouchdownWithinLimits(2.4, 1.0, 5.0),
      /lateral velocity 2.4 m\/s > 1.22 m\/s/
    );

    // 2. Excessive vertical velocity: Vz = 3.8 m/s > 3.05 m/s (exceeds honeycomb crush limit)
    assert.throws(
      () => assertTouchdownWithinLimits(0.0, 3.8, 5.0),
      /vertical velocity 3.8 m\/s > 3.05 m\/s/
    );

    // 3. Excessive surface tilt / boulder slope: tilt = 18.0 deg > 12.0 deg (tip-over)
    assert.throws(
      () => assertTouchdownWithinLimits(0.5, 0.5, 18.0),
      /surface tilt 18° > 12.0°/
    );

    // 4. Excessive body angular rate: 3.5 deg/s > 2.0 deg/s
    assert.throws(
      () => assertTouchdownWithinLimits(0.5, 0.5, 5.0, 3.5),
      /angular rate 3.5 deg\/s > 2.0 deg\/s/
    );
  });

  it("low-level propellant warning (5%) and Bingo Fuel abort transition", () => {
    // Nominal state above warning
    const nominalState: DescentState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      altitude_m: 50.0,
      propellant_remaining_kg: 350.0, // Above 255 kg
      is_bingo_fuel: false,
    };
    const steppedNominal = wasmRunDescentStep(nominalState);
    assert.equal(steppedNominal.is_bingo_fuel, false);

    // Bingo Fuel state (propellant <= 112 kg)
    const bingoState: DescentState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      altitude_m: 12.0,
      vertical_velocity_mps: -0.5,
      horizontal_velocity_mps: 1.0,
      throttle_pct: 27.0,
      propellant_remaining_kg: 105.0, // Under 112 kg Bingo threshold
      is_bingo_fuel: false,
    };
    const steppedBingo = wasmRunDescentStep(bingoState);
    assert.equal(
      steppedBingo.is_bingo_fuel,
      true,
      "WASM engine must flag is_bingo_fuel when propellant drops below 112 kg reserve"
    );
  });

  it("multi-step descent propagation validates continuous trajectory and monotonic fuel drain", () => {
    let current: DescentState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      altitude_m: 5000.0,
      vertical_velocity_mps: -25.0,
      horizontal_velocity_mps: 150.0,
      throttle_pct: 55.0,
      propellant_remaining_kg: 2500.0,
    };

    const altitudes: number[] = [current.altitude_m];
    const fuels: number[] = [current.propellant_remaining_kg];

    // Step 10 seconds into descent
    for (let i = 0; i < 10; i++) {
      current = wasmRunDescentStep(current);
      assertDescentStateSchema(current);
      altitudes.push(current.altitude_m);
      fuels.push(current.propellant_remaining_kg);
    }

    // Altitude and fuel remaining must decrease monotonically
    assertMonotonic(altitudes, "decreasing", "Descent altitude must decrease monotonically");
    assertMonotonic(fuels, "decreasing", "Descent propellant must decrease monotonically");
    assert.ok(current.propellant_remaining_kg < 2500.0);
  });
});
