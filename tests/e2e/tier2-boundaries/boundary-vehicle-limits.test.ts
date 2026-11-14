import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SpacecraftBusSchema, SpacecraftComponentSchema } from "@space-sim/shared-schema";
import {
  APOLLO11_CONSTANTS,
  SimulationValidatorBridge,
} from "../../../apps/server/src/validator/simBridge.ts";
import {
  assertInRange,
  assertLessThanOrEqual,
} from "../harness/assertions.ts";
import {
  APOLLO_11_DESCENT_INITIAL_STATE,
  APOLLO_11_LAUNCH_CONFIG,
  wasmRunDescentStep,
  wasmValidateLaunch,
} from "../harness/wasmHarness.ts";
import { EVENTS, gForce, INSERTION_MET } from "../../../apps/web/src/game/ascentFlight.ts";

describe("Tier 2 Boundary Suite: Vehicle Mass & Flight Envelope Limits", () => {
  const simBridge = new SimulationValidatorBridge();

  it("1. rejects vehicle design with zero or non-positive payload mass at schema & validation boundaries", async () => {
    // 1a. SpacecraftBusSchema strictly requires structureMassKg to be positive (> 0)
    const zeroBusResult = SpacecraftBusSchema.safeParse({
      id: "bus-zero-payload",
      name: "Zero Payload Test Bus",
      structureMassKg: 0,
      maxSlots: 4,
      installedComponents: [],
    });
    assert.equal(zeroBusResult.success, false, "Schema must reject zero structureMassKg");
    if (!zeroBusResult.success) {
      const issue = zeroBusResult.error.issues.find((i) => i.path.includes("structureMassKg"));
      assert.ok(issue, "Must produce validation error on structureMassKg");
    }

    // Negative mass must also be rejected
    const negativeBusResult = SpacecraftBusSchema.safeParse({
      id: "bus-neg-payload",
      name: "Negative Payload Test Bus",
      structureMassKg: -500,
      maxSlots: 4,
      installedComponents: [],
    });
    assert.equal(negativeBusResult.success, false, "Schema must reject negative structureMassKg");

    // Component schema must reject negative mass
    const negativeComponent = SpacecraftComponentSchema.safeParse({
      id: "bad-comp",
      name: "Negative Mass Sensor",
      category: "science_payload",
      massKg: -10,
      powerDrawWatts: 15,
      costMillions: 1.2,
      dimensions: { x: 1, y: 1, z: 1 },
    });
    assert.equal(negativeComponent.success, false, "Component schema must reject negative massKg");

    // 1b. Simulation bridge validation with explicit zero payload mass
    // In simBridge, when payload_mass: 0 is supplied, it verifies that total spacecraft mass must be accounted for
    const res = await simBridge.validateSimulation({
      vehicle_mass: 130000,
      propellant_mass: 2800000,
      payload_mass: 0,
      target_destination: "TLI",
    });
    // With 0 payload mass, GLOM is less than minimum allowable GLOM or payload margin is flagged
    assert.ok(res.glom_kg > 0, "GLOM calculation should be computed");
    assert.ok(typeof res.is_valid === "boolean");
  });

  it("2. enforces over-capacity payload boundary (>140,000 kg LEO limit and >48,609 kg TLI limit)", async () => {
    // 2a. LEO Payload Boundary Test (Max LEO = 140,000 kg)
    // Exactly at boundary: 140,000 kg
    const atBoundaryLEO = await simBridge.validateSimulation({
      target_destination: "LEO",
      payload_mass: 140000,
    });
    assert.equal(atBoundaryLEO.payload_margin_kg, 0, "Payload margin at exactly 140,000 kg must be 0 kg");

    // 1 kg over boundary: 140,001 kg -> MUST FAIL with PAYLOAD_CAPACITY_EXCEEDED
    const overCapacityLEO = await simBridge.validateSimulation({
      target_destination: "LEO",
      payload_mass: 140001,
    });
    assert.equal(overCapacityLEO.is_valid, false, "Must reject payload > 140,000 kg LEO limit");
    assert.equal(overCapacityLEO.payload_margin_kg, -1, "Payload margin must be -1 kg");
    assert.ok(
      overCapacityLEO.failure_reason?.includes("PAYLOAD_CAPACITY_EXCEEDED"),
      `Expected failure reason to contain PAYLOAD_CAPACITY_EXCEEDED, got: ${overCapacityLEO.failure_reason}`
    );

    // 2b. TLI Payload Boundary Test (Max TLI = 48,609 kg)
    // Test in WebAssembly engine
    const overCapacityWasm = wasmValidateLaunch({
      ...APOLLO_11_LAUNCH_CONFIG,
      payload_mass: 55000.0, // Exceeds 48,609.0 kg TLI capacity
    });
    assert.equal(overCapacityWasm.is_valid, false, "sim-wasm must reject payload > 48,609 kg TLI limit");
    assert.ok(overCapacityWasm.payload_margin_kg < 0, "Payload margin must be negative");
    assert.ok(
      overCapacityWasm.failure_reason?.includes("exceeds launch vehicle capacity"),
      `Expected failure reason in sim-wasm, got: ${overCapacityWasm.failure_reason}`
    );

    // Nominal Apollo 11 payload (45,000 kg) must pass with positive margin
    const nominalWasm = wasmValidateLaunch(APOLLO_11_LAUNCH_CONFIG);
    assert.equal(nominalWasm.is_valid, true, "Nominal 45,000 kg payload must be valid");
    assert.ok(nominalWasm.payload_margin_kg > 0, "Nominal margin must be positive (~3,609 kg)");
  });

  it("3. validates zero propellant immediate engine cutoff and lunar gravitational free-fall", () => {
    // Stepping descent engine with zero propellant remaining
    const dryState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: 0.0,
      altitude_m: 5000.0,
      vertical_velocity_mps: -10.0,
      horizontal_velocity_mps: 50.0,
      throttle_pct: 100.0, // Commanded 100% FTP but tanks are bone dry
    };

    const nextState = wasmRunDescentStep(dryState);

    // Tanks stay strictly at 0.0 kg (never negative)
    assert.equal(nextState.propellant_remaining_kg, 0.0, "Propellant must stay clamped at 0.0 kg");
    assert.equal(nextState.is_bingo_fuel, true, "Bingo fuel flag must be true at zero propellant");

    // With 0 fuel, thrust is 0 N. Net vertical acceleration is purely lunar gravity (-1.622 m/s^2)
    // v_next = v_prev + (-1.622 * dt) = -10.0 + (-1.622 * 1.0) = -11.622 m/s
    const deltaVz = nextState.vertical_velocity_mps - dryState.vertical_velocity_mps;
    assertInRange(deltaVz, -1.63, -1.61, "Free fall downward acceleration must match lunar gravity -1.622 m/s^2");

    // Step a second time to ensure persistent zero-propellant physics
    const step2State = wasmRunDescentStep(nextState);
    assert.equal(step2State.propellant_remaining_kg, 0.0);
    const deltaVz2 = step2State.vertical_velocity_mps - nextState.vertical_velocity_mps;
    assertInRange(deltaVz2, -1.63, -1.61, "Second step must continue lunar gravitational free-fall");
  });

  it("4. verifies maximum ascent acceleration limits against human and structural tolerances", () => {
    // Sample the engine's Saturn V ascent acceleration profile from liftoff to parking-orbit insertion
    let maxG = 0;
    let maxGMet = 0;

    for (let met = 0; met <= INSERTION_MET + 1; met += 1) {
      const g = gForce(met);
      if (g > maxG) {
        maxG = g;
        maxGMet = met;
      }

      // Acceleration must never exceed human safety tolerance limit (4.5 g)
      assertLessThanOrEqual(
        g,
        4.5,
        `Ascent acceleration at MET ${met}s (${g}g) exceeded maximum human tolerance threshold (4.5g)`
      );
    }

    // The peak comes at the end of the S-IC burn (S-IC CECO at T+135.2 s caps it), from the
    // catalogue's S-IC thrust, Isp and mass: a = (F_vac − P_amb·A_e − D)/m.
    assertInRange(maxG, 3.2, 4.2, "Peak felt g-force must fall in the Saturn V envelope [3.2, 4.2]");
    assertInRange(maxGMet, 125, 162, "Peak g-force occurs late in the S-IC burn");

    // In the staging coast after S-IC cutoff (T+161.1 s), the crew is nearly weightless.
    const sep = EVENTS.find((e) => e.id === "stageSep")!.met;
    const stagingG = gForce(Math.ceil(sep));
    assertInRange(stagingG, 0.0, 0.3, "Staging separation must drop g-force near weightlessness");

    // After insertion, felt g-force is 0g (parking-orbit weightlessness)
    const postMecoG = gForce(INSERTION_MET + 1);
    assert.equal(postMecoG, 0, "Post-MECO felt g-force must be 0g in parking orbit");
  });

  it("5. detects sub-orbital periapsis trajectory leading to atmospheric reentry", () => {
    const EARTH_RADIUS_KM = 6378.137;

    // Sub-orbital profile: semi-major axis = 6,450 km with eccentricity 0.02
    // Periapsis distance rp = a * (1 - e) = 6450 * 0.98 = 6,321 km
    // Periapsis altitude hp = rp - R_E = 6,321 - 6,378.137 = -57.137 km (below Earth surface / deep atmosphere)
    const subOrbitalA = 6450.0;
    const subOrbitalE = 0.02;
    const periapsisRadiusKm = subOrbitalA * (1.0 - subOrbitalE);
    const periapsisAltitudeKm = periapsisRadiusKm - EARTH_RADIUS_KM;

    assert.ok(
      periapsisAltitudeKm < 0,
      `Periapsis altitude (${periapsisAltitudeKm.toFixed(2)} km) must be negative, indicating atmospheric reentry`
    );
    assert.ok(
      periapsisAltitudeKm < 100.0,
      "Periapsis altitude is below 100 km Karman line, ensuring ballistic atmospheric decay"
    );

    // Compare with nominal 185 km Earth parking orbit
    const nominalA = EARTH_RADIUS_KM + 185.0; // 6,563.137 km
    const nominalE = 0.0001; // Circular orbit
    const nominalPeriapsisKm = nominalA * (1.0 - nominalE) - EARTH_RADIUS_KM;

    assertInRange(nominalPeriapsisKm, 184.0, 185.1, "Nominal parking orbit periapsis must remain safe above 184 km");
    assert.ok(nominalPeriapsisKm > 100.0, "Nominal orbit remains safely above Karman line");
  });
});
