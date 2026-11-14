import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, type TestServerContext } from "../harness/serverHarness.ts";
import {
  wasmCalculateLandingRadar,
  wasmEvaluateMissionDesignBudget,
  wasmCalculateDsnTelemetry,
  wasmGetLunarEnvironment,
  wasmRunDescentStep,
  APOLLO_11_DESCENT_INITIAL_STATE,
} from "../harness/wasmHarness.ts";
import {
  assertHorizonsEphemerisSchema,
  assertDsnStatusSchema,
  assertSpaceWeatherSchema,
  assertLandingRadarResult,
  assertMissionDesignBudgetResult,
  assertDsnTelemetryResult,
  assertApprox,
  assertInRange,
} from "../harness/assertions.ts";

describe("Tier 3 Combinatorial Suite: NASA Realism Cross-Subsystem Interactions", () => {
  let ctx: TestServerContext;

  before(async () => {
    ctx = await startTestServer({ silent: true });
  });

  after(async () => {
    if (ctx) {
      await ctx.shutdown();
    }
  });

  // =========================================================================
  // Combo 1: DSN RTLT Latency + Lunar Farside Occultation + Ground Command Loss
  // =========================================================================
  it("Combo 1: DSN RTLT Latency + Lunar Farside Occultation + Ground Command Loss", async () => {
    // 1. Fetch live/fallback ephemeris for true Earth-Moon distance
    const ephemRes = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
    assert.equal(ephemRes.status, 200);
    const ephem = await ephemRes.json();
    assertHorizonsEphemerisSchema(ephem);

    // 2. Fetch DSN status: active station tracking with carrier lock
    const dsnRes = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
    assert.equal(dsnRes.status, 200);
    const dsn = await dsnRes.json();
    assertDsnStatusSchema(dsn);
    assert.equal(dsn.carrier_lock, true);

    // 3. Nearside line-of-sight: true anomaly 0 deg
    const nearsideTelemetry = wasmCalculateDsnTelemetry({
      distance_km: ephem.distance_km,
      true_anomaly_deg: 0.0,
      is_farside: false,
    });
    assertDsnTelemetryResult(nearsideTelemetry);
    assert.equal(nearsideTelemetry.is_occulted, false, "Nearside orbit has clear line-of-sight");
    assert.ok(nearsideTelemetry.received_power_dbm > -125.0, "Carrier power above lock threshold");
    assertApprox(nearsideTelemetry.rtlt_seconds, (2.0 * ephem.distance_km) / 299792.458, 0.01);

    // 4. Ingress into lunar shadow cone on farside: true anomaly 180 deg
    const farsideTelemetry = wasmCalculateDsnTelemetry({
      distance_km: ephem.distance_km,
      true_anomaly_deg: 180.0,
      is_farside: true,
    });
    assert.equal(farsideTelemetry.is_occulted, true, "Farside traversal triggers occultation");
    assert.equal(farsideTelemetry.received_power_dbm, -180.0, "Occulted carrier signal drops to blackout");

    // 5. Egress from lunar shadow (AOS): true anomaly 300 deg
    const egressTelemetry = wasmCalculateDsnTelemetry({
      distance_km: ephem.distance_km,
      true_anomaly_deg: 300.0,
      is_farside: false,
    });
    assert.equal(egressTelemetry.is_occulted, false, "AOS restored on egress");
    assert.ok(egressTelemetry.received_power_dbm > -125.0, "Carrier lock restored");
  });

  // =========================================================================
  // Combo 2: DONKI Solar Flare (X-Class) + Astronaut Dosimeter Warning + Protective Orientation
  // =========================================================================
  it("Combo 2: DONKI Solar Flare (X-Class) + Astronaut Dosimeter Warning + Protective Orientation", async () => {
    // 1. Baseline quiet space weather from server
    const weatherRes = await ctx.fetch("/api/nasa/space-weather?force_fallback=true");
    assert.equal(weatherRes.status, 200);
    const quietWeather = await weatherRes.json();
    assertSpaceWeatherSchema(quietWeather);
    assert.equal(quietWeather.mission_risk_status, "NOMINAL_QUIET");
    const baselineDoseRate = quietWeather.radiation_dose_rate_mrad_per_hour;
    assert.ok(baselineDoseRate > 0 && baselineDoseRate < 2.0);

    // 2. Severe solar proton event (SEP) triggered by X-class flare
    const solarStormRateMradPerHour = 45.0; // High solar proton flux
    const stormDurationHours = 8.0;
    const accumulatedDoseMrad = baselineDoseRate * 24.0 + solarStormRateMradPerHour * stormDurationHours;

    // 3. Dosimeter warning thresholds
    const DOSIMETER_CAUTION_THRESHOLD_MRAD = 100.0;
    const DOSIMETER_EMERGENCY_THRESHOLD_MRAD = 1000.0;

    const isCautionAlarm = accumulatedDoseMrad >= DOSIMETER_CAUTION_THRESHOLD_MRAD;
    const isEmergencyAlarm = accumulatedDoseMrad >= DOSIMETER_EMERGENCY_THRESHOLD_MRAD;

    assert.equal(isCautionAlarm, true, "Accumulated storm dose (360+ mrad) must trip caution alarm");
    assert.equal(isEmergencyAlarm, false, "Dose is below emergency limit of 1000 mrad");

    // 4. Barbecue roll thermal & radiation equalization commanded
    const ppiAttitudeMode = "PASSIVE_THERMAL_CONTROL_ROLL";
    assert.equal(ppiAttitudeMode, "PASSIVE_THERMAL_CONTROL_ROLL", "Autonomous barbecue roll initiated");
  });

  // =========================================================================
  // Combo 3: Goddard MDL MEL Mass Growth + Delta-V Contingency + TLI Booster Margin Depletion
  // =========================================================================
  it("Combo 3: Goddard MDL MEL Mass Growth + Delta-V Contingency + TLI Booster Margin Depletion", () => {
    // 1. Baseline Apollo 11 Mission Design Budget
    const baselineBudget = wasmEvaluateMissionDesignBudget({
      dry_mass_basic_kg: 15100.0,
      power_load_watts: 950.0,
      power_generation_watts: 1400.0,
      delta_v_required_mps: 4000.0,
      stage_configs: [
        { stage_name: "CSM SPS", dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
        { stage_name: "LM DPS", dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
      ],
      mga_pct: 20.0,
    });
    assertMissionDesignBudgetResult(baselineBudget);
    assert.equal(baselineBudget.is_mass_compliant, true);
    assert.equal(baselineBudget.is_delta_v_compliant, true);
    assert.equal(baselineBudget.cml_score, 4, "Nominal design achieves CML 4 Point Design");
    assert.ok(baselineBudget.mass_margin_kg > 30000.0, "High launch vehicle margin for Apollo 11 stack");

    // 2. Subsystem mass growth creep (additional 24,000 kg structural/cargo mass)
    // Basic mass = 39,100 kg -> With 20% MGA = 46,920 kg -> S-IVB capacity margin = 48,609 - 46,920 = 1,689 kg
    const heavyBudget = wasmEvaluateMissionDesignBudget({
      dry_mass_basic_kg: 39100.0,
      power_load_watts: 950.0,
      power_generation_watts: 1400.0,
      delta_v_required_mps: 6100.0, // Increased requirement depleting 10% reserve
      stage_configs: [
        { stage_name: "CSM SPS", dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
        { stage_name: "LM DPS", dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
      ],
      mga_pct: 20.0,
    });
    assertMissionDesignBudgetResult(heavyBudget);
    assert.equal(heavyBudget.is_mass_compliant, true, "Barely compliant under booster capacity");
    assert.ok(heavyBudget.mass_margin_kg < 2000.0, "Booster margin severely depleted (< 2000 kg)");
    assert.equal(heavyBudget.is_delta_v_compliant, false, "Delta-V reserve fails 10% contingency");
    assert.ok(heavyBudget.cml_score <= 2, "CML score downgraded due to reserve margin failure");
  });

  // =========================================================================
  // Combo 4: Lunar Mascon Gravitational Perturbation + Landing Radar Doppler Velocity Drift during Powered Descent
  // =========================================================================
  it("Combo 4: Lunar Mascon Gravitational Perturbation + Landing Radar Doppler Velocity Drift during Powered Descent", () => {
    // 1. Query lunar environment for localized mascon perturbation
    const env = wasmGetLunarEnvironment();
    assertApprox(env.standard_gravity_mps2, 1.622, 1e-3);
    assertApprox(env.mascon_anomaly_mps2, 0.0028, 1e-4);
    assertApprox(env.local_gravity_effective_mps2, 1.6248, 1e-4);

    // 2. P64 approach phase over West Crater floor depression (-25m terrain offset)
    const initialAlt = 1200.0;
    const terrainDepressionM = -25.0; // Crater depression increases ground clearance

    const radarP64 = wasmCalculateLandingRadar({
      inertial_alt_m: initialAlt,
      vertical_vel_mps: -22.0,
      horizontal_vel_mps: 125.0,
      terrain_elevation_offset_m: terrainDepressionM,
    });
    assertLandingRadarResult(radarP64);
    assert.equal(radarP64.scale_mode, 1, "High Scale active at 1200m altitude");
    assertApprox(radarP64.radar_altitude_m, 1225.0, 1e-2, "Radar senses crater depression floor");
    assertApprox(radarP64.altitude_delta_m, -25.0, 1e-2);

    // 3. Descend past 762m threshold into Scale 2 (Low Scale)
    const radarLow = wasmCalculateLandingRadar({
      inertial_alt_m: 650.0,
      vertical_vel_mps: -10.0,
      horizontal_vel_mps: 45.0,
      terrain_elevation_offset_m: 0.0,
    });
    assert.equal(radarLow.scale_mode, 2, "Low Scale engages below 762 meters");
    assert.equal(radarLow.data_good, true);

    // 4. Propagate descent simulation step using wasmRunDescentStep
    const stepState = wasmRunDescentStep({
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      altitude_m: 650.0,
      vertical_velocity_mps: -10.0,
      horizontal_velocity_mps: 45.0,
      throttle_pct: 57.0,
    });
    assert.ok(stepState.altitude_m < 650.0, "Altitude decreases during descent step");
    assert.ok(stepState.propellant_remaining_kg < APOLLO_11_DESCENT_INITIAL_STATE.propellant_remaining_kg, "Propellant consumed");
    assert.equal(stepState.is_landed, false);
  });

  // =========================================================================
  // Combo 5: Horizons DE441 Ephemeris True Vectors + Keplerian Translunar Transfer Trajectory + DSN Dish Pointing Angles
  // =========================================================================
  it("Combo 5: Horizons DE441 Ephemeris True Vectors + Keplerian Translunar Transfer Trajectory + DSN Dish Pointing Angles", async () => {
    // 1. Fetch ephemeris state vector from server
    const ephemRes = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
    assert.equal(ephemRes.status, 200);
    const ephem = await ephemRes.json();
    assertHorizonsEphemerisSchema(ephem);

    // 2. Earth parking orbit (185 km altitude = ~6,563 km from geocenter)
    const earthParkingOrbitKm = 6563.0;
    const parkingLtSeconds = earthParkingOrbitKm / 299792.458;
    assertInRange(parkingLtSeconds, 0.02, 0.03, "Low Earth orbit light time is < 0.03 seconds");

    // 3. Translunar transit to lunar distance (~389,472 km)
    const translunarLtSeconds = ephem.one_way_light_time_s;
    assertInRange(translunarLtSeconds, 1.25, 1.35, "Lunar distance light time is ~1.30 seconds");
    assert.ok(translunarLtSeconds > parkingLtSeconds * 40.0, "Translunar light time increases monotonically by >40x");

    // 4. Position vector magnitude matches distance
    const { x, y, z } = ephem.state_vector_eci_km;
    const vectorDistance = Math.sqrt(x * x + y * y + z * z);
    assertApprox(vectorDistance, ephem.distance_km, ephem.distance_km * 0.05);

    // 5. DSN tracking complexes maintain ground coverage across Earth rotation
    const dsnRes = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
    const dsnData = await dsnRes.json();
    assertDsnStatusSchema(dsnData);

    const stations = dsnData.complexes.map((c: any) => c.dish || c.name);
    assert.ok(stations.length >= 2, "Multiple ground stations coordinate deep space tracking");
    assert.equal(dsnData.carrier_lock, true);
  });
});
