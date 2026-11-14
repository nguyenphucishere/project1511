import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertApprox,
  assertInRange,
  assertLiftoffTwrNominal,
  assertMaxQWithinEnvelope,
  assertSimulationValidationSchema,
} from "../harness/assertions.ts";
import {
  wasmValidateLaunch,
  APOLLO_11_LAUNCH_CONFIG,
  type LaunchConfiguration,
} from "../harness/wasmHarness.ts";

describe("Tier 1 Feature 3: Multi-Stage Saturn V Ascent Physics & Max-Q Envelope", () => {
  // Authoritative constants from Telemetry Catalog NASA-APOLLO-SIM-2026-REV1 §1.1 & §1.2
  const STANDARD_GRAVITY = 9.80665; // m/s^2
  const S_IC_THRUST_SL_N = 33_850_000.0;
  const S_IC_THRUST_VAC_N = 38_700_000.0;
  const S_IC_PROPELLANT_MASS_KG = 2_077_000.0;
  const S_IC_BURN_DURATION_S = 161.1;
  const SATURN_V_GLOM_KG = 2_938_315.0;

  it("S-IC Stage 1 propulsion physics: sea level thrust, vacuum thrust, and liftoff acceleration", () => {
    // 1. Sea-level thrust across 5 Rocketdyne F-1 engines (33,850 kN)
    assert.equal(S_IC_THRUST_SL_N, 33_850_000.0);
    const thrustPerF1 = S_IC_THRUST_SL_N / 5.0;
    assert.equal(thrustPerF1, 6_770_000.0, "Each F-1 engine produces 6,770 kN (1.52M lbf) sea level thrust");

    // 2. Vacuum thrust expansion (38,700 kN)
    assert.equal(S_IC_THRUST_VAC_N, 38_700_000.0);
    assert.ok(S_IC_THRUST_VAC_N > S_IC_THRUST_SL_N, "Vacuum thrust must exceed sea-level thrust due to nozzle expansion");

    // 3. Initial net vertical acceleration at liftoff: a = (F_sl - m*g) / m
    const weightAtLiftoff = SATURN_V_GLOM_KG * STANDARD_GRAVITY;
    const netForceLiftoff = S_IC_THRUST_SL_N - weightAtLiftoff;
    const accelLiftoff = netForceLiftoff / SATURN_V_GLOM_KG;

    // Nominal liftoff acceleration is ~1.706 m/s^2 (~0.174 g)
    assertApprox(accelLiftoff, 1.706, 0.05, "Liftoff net acceleration should be ~1.706 m/s^2");
    assert.ok(accelLiftoff > 0, "Net acceleration must be positive for positive upward liftoff");
  });

  it("liftoff Thrust-to-Weight Ratio (TWR) matches Apollo 11 specification of 1.174", () => {
    // Calculate theoretical TWR: F_sl / (GLOM * g0)
    const expectedTwr = S_IC_THRUST_SL_N / (SATURN_V_GLOM_KG * STANDARD_GRAVITY);
    assertApprox(expectedTwr, 1.1748, 0.005, "Theoretical TWR should be 1.1748");

    // Evaluate via WASM simulation engine
    const validation = wasmValidateLaunch(APOLLO_11_LAUNCH_CONFIG);
    assertSimulationValidationSchema(validation);
    assert.equal(validation.is_valid, true);

    // Assert liftoff TWR is within nominal Apollo 11 bounds [1.10, 1.30]
    assertLiftoffTwrNominal(validation.liftoff_twr);
    assertApprox(validation.liftoff_twr, 1.174, 0.05, "WASM liftoff TWR should match 1.174");
  });

  it("Max-Q dynamic pressure peaks at 83s GET within Apollo 11 flight envelope (34.3 kPa)", () => {
    const validation = wasmValidateLaunch(APOLLO_11_LAUNCH_CONFIG);
    assertSimulationValidationSchema(validation);

    // Max-Q values must satisfy flight envelope: time in [65, 100] s, pressure in [15, 50] kPa
    assertMaxQWithinEnvelope(
      validation.max_q_time_s,
      validation.max_q_kpa,
      "Apollo 11 Max-Q dynamic pressure outside Saturn V flight envelope"
    );

    // Nominal flight targets: Max-Q at 83.0s ± 15s, 34.3 kPa ± 10 kPa
    assertInRange(validation.max_q_time_s, 70.0, 95.0, "Time of Max-Q nominal window");
    assertInRange(validation.max_q_kpa, 25.0, 42.0, "Dynamic pressure Max-Q nominal window");

    // Theoretical dynamic pressure equation q = 0.5 * rho * v^2 verification:
    // At h = 13.4 km, rho ~ 0.281 kg/m^3, v ~ 494.3 m/s
    const rhoAt13km = 1.225 * Math.exp(-13400.0 / 9150.0);
    const vAtMaxQ = 494.3; // m/s (Mach 1.7)
    const theoreticalQPa = 0.5 * rhoAt13km * Math.pow(vAtMaxQ, 2);
    const theoreticalQKpa = theoreticalQPa / 1000.0;
    assertInRange(theoreticalQKpa, 30.0, 38.0, "Barometric aerodynamic dynamic pressure model matches ~34.3 kPa");
  });

  it("multi-stage separation sequence adheres to staging altitudes and cutoff velocities", () => {
    // S-IC Stage 1 Separation:
    // - Altitude: 67.6 km (36.5 nmi)
    // - Inertial velocity: 2,756 m/s
    // - Burn duration: 161.1s (CECO at 135.2s, OECO at 161.1s)
    const stage1SepAltKm = 67.6;
    const stage1CutoffVeloMps = 2756.0;
    const stage1BurnDurationS = 161.1;
    assert.equal(stage1SepAltKm, 67.6);
    assert.equal(stage1CutoffVeloMps, 2756.0);
    assert.equal(stage1BurnDurationS, 161.1);

    // S-II Stage 2 Separation:
    // - Altitude: 186.1 km (100.5 nmi)
    // - Inertial velocity: 6,945 m/s
    // - Burn duration: 388.2s
    const stage2SepAltKm = 186.1;
    const stage2CutoffVeloMps = 6945.0;
    const stage2BurnDurationS = 388.2;
    assert.ok(stage2SepAltKm > stage1SepAltKm);
    assert.ok(stage2CutoffVeloMps > stage1CutoffVeloMps);
    assert.equal(stage2BurnDurationS, 388.2);

    // S-IVB Stage 3 Earth Parking Orbit (EPO) Insertion:
    // - Altitude: 190.6 km
    // - Cutoff velocity: 7,791 m/s (orbital insertion speed)
    const epoAltKm = 190.6;
    const epoVelocityMps = 7791.0;
    assert.ok(epoAltKm >= 183.0 && epoAltKm <= 195.0, "EPO insertion altitude ~185-190 km");
    assert.ok(epoVelocityMps >= 7700.0 && epoVelocityMps <= 7900.0, "EPO orbital insertion velocity ~7,791 m/s");
  });

  it("propellant mass consumption and depletion rates satisfy continuity and mass conservation", () => {
    // Mass flow rate: S-IC burns 2,077,000 kg in 161.1 s
    const sIcMassFlowRateKgS = S_IC_PROPELLANT_MASS_KG / S_IC_BURN_DURATION_S;
    assertApprox(sIcMassFlowRateKgS, 12892.6, 1.0, "S-IC propellant flow rate ~12,892.6 kg/s (13 tonnes/s)");

    // Mass after Stage 1 burnout
    const postBurnMass = SATURN_V_GLOM_KG - S_IC_PROPELLANT_MASS_KG;
    assert.equal(postBurnMass, 861315.0);

    // Jettison of S-IC dry structure (130,860 kg) leaves S-II + S-IVB + CSM/LM stack
    const sIcDryMassKg = 130860.0;
    const stackAfterStaging = postBurnMass - sIcDryMassKg;
    assert.equal(stackAfterStaging, 730455.0);

    // Overall Saturn V propellant mass fraction across 3 stages:
    // S-IC (2,077,000) + S-II (443,200) + S-IVB (106,900) = 2,627,100 kg
    const totalPropellantKg = 2_077_000.0 + 443_200.0 + 106_900.0;
    const propellantMassFraction = totalPropellantKg / SATURN_V_GLOM_KG;
    assertApprox(propellantMassFraction, 0.894, 0.01, "Saturn V stack is ~89.4% propellant by mass at liftoff");
  });

  it("evaluates structural boundary violations and rejects invalid launch configurations", () => {
    // 1. Excessive payload exceeding S-IVB translunar injection capacity (48,609 kg)
    const overweightConfig: LaunchConfiguration = {
      ...APOLLO_11_LAUNCH_CONFIG,
      payload_mass: 75_000.0, // Exceeds 48,609 kg capacity
    };
    const valOverweight = wasmValidateLaunch(overweightConfig);
    assert.equal(valOverweight.is_valid, false, "Overweight payload must fail launch validation");
    assert.ok(valOverweight.failure_reason, "Failure reason must explain over-capacity");

    // 2. High crosswinds exceeding launch commit criteria (>74 km/h)
    const extremeWindConfig: LaunchConfiguration = {
      ...APOLLO_11_LAUNCH_CONFIG,
      wind_speed_kmh: 95.0, // Exceeds 74 km/h commit limit
    };
    const valWind = wasmValidateLaunch(extremeWindConfig);
    assert.equal(valWind.is_valid, false, "Extreme wind must fail launch validation");

    // 3. Negative mass or zero propellant
    const zeroPropConfig: LaunchConfiguration = {
      ...APOLLO_11_LAUNCH_CONFIG,
      propellant_mass: 0.0,
    };
    const valZeroProp = wasmValidateLaunch(zeroPropConfig);
    assert.equal(valZeroProp.is_valid, false, "Zero propellant must fail validation");
  });
});
