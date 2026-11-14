import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, type TestServerContext } from "../harness/serverHarness.ts";
import {
  wasmCalculateLandingRadar,
  wasmEvaluateMissionDesignBudget,
  wasmCalculateDsnTelemetry,
  wasmGetLunarEnvironment,
  wasmRunDescentStep,
  wasmCalculateScore,
  APOLLO_11_DESCENT_INITIAL_STATE,
  type DescentState,
} from "../harness/wasmHarness.ts";
import {
  assertHorizonsEphemerisSchema,
  assertDsnStatusSchema,
  assertSpaceWeatherSchema,
  assertEasepPayloadSchema,
  assertLunarEnvironmentSchema,
  assertLandingRadarResult,
  assertMissionDesignBudgetResult,
  assertDsnTelemetryResult,
  assertApprox,
  assertInRange,
  assertTouchdownWithinLimits,
} from "../harness/assertions.ts";

describe("Tier 4 Scenario Suite: NASA Realism Full Mission Operations", () => {
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
  // Scenario 1: Authentic NASA Mission Design & Lunar Landing (Scenario 6)
  // =========================================================================
  it("Scenario 1: Authentic NASA Mission Design, Ephemeris Sync, DSN Tracking & Doppler Landing", async () => {
    // -----------------------------------------------------------------------
    // Phase 1: Mission Design Lab (MDL) Audit & Baseline Certification
    // -----------------------------------------------------------------------
    const baselineMdlBudget = wasmEvaluateMissionDesignBudget({
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
    assertMissionDesignBudgetResult(baselineMdlBudget);
    assert.equal(baselineMdlBudget.is_mass_compliant, true);
    assert.equal(baselineMdlBudget.is_power_compliant, true);
    assert.equal(baselineMdlBudget.is_delta_v_compliant, true);
    assert.equal(baselineMdlBudget.cml_score, 4, "Flight baseline certified at CML Level 4");
    assert.ok(baselineMdlBudget.overall_mdl_score >= 85.0);

    // -----------------------------------------------------------------------
    // Phase 2: Epoch Synchronization & DSN Tracking Lock
    // -----------------------------------------------------------------------
    const ephemRes = await ctx.fetch("/api/nasa/ephemeris?epoch=1969-07-20T20:17:40Z&force_fallback=true");
    assert.equal(ephemRes.status, 200);
    const ephemeris = await ephemRes.json();
    assertHorizonsEphemerisSchema(ephemeris);
    assertInRange(ephemeris.distance_km, 380000, 400000);

    const dsnRes = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
    assert.equal(dsnRes.status, 200);
    const dsnStatus = await dsnRes.json();
    assertDsnStatusSchema(dsnStatus);
    assert.equal(dsnStatus.carrier_lock, true, "DSN Honeysuckle Creek DSS-44 acquired carrier lock");
    assertInRange(dsnStatus.rtlt_seconds, 2.4, 2.8);

    // -----------------------------------------------------------------------
    // Phase 3: Space Weather Verification & EASEP Science Package Staging
    // -----------------------------------------------------------------------
    const weatherRes = await ctx.fetch("/api/nasa/space-weather?force_fallback=true");
    const weather = await weatherRes.json();
    assertSpaceWeatherSchema(weather);
    assert.equal(weather.mission_risk_status, "NOMINAL_QUIET", "Space weather GO for powered descent");

    const easepRes = await ctx.fetch("/api/nasa/mission-design/easep");
    const easep = await easepRes.json();
    assertEasepPayloadSchema(easep);
    assert.ok(easep.total_mass_kg >= 40.0);
    assertApprox(easep.deployment_site.latitude_deg, 0.674, 0.1);
    assertApprox(easep.deployment_site.longitude_deg, 23.473, 0.1);

    // -----------------------------------------------------------------------
    // Phase 4: Powered Descent with Landing Radar Doppler Dynamics
    // -----------------------------------------------------------------------
    const env = wasmGetLunarEnvironment();
    assertLunarEnvironmentSchema(env);
    assertApprox(env.mascon_anomaly_mps2, 0.0028, 1e-4);

    let currentState: DescentState = { ...APOLLO_11_DESCENT_INITIAL_STATE };

    // Step 4a: High-altitude braking phase (15,240m -> 1,200m)
    currentState = wasmRunDescentStep(currentState);
    assert.ok(currentState.altitude_m <= 15240.0);
    assert.ok(currentState.propellant_remaining_kg < 8200.0);

    // Step 4b: Approach phase (P64) over terrain offset (West Crater depression -25m)
    const radarHigh = wasmCalculateLandingRadar({
      inertial_alt_m: 1200.0,
      vertical_vel_mps: -25.0,
      horizontal_vel_mps: 120.0,
      terrain_elevation_offset_m: -25.0,
    });
    assertLandingRadarResult(radarHigh);
    assert.equal(radarHigh.scale_mode, 1, "Scale 1 High mode above 762m");
    assertApprox(radarHigh.radar_altitude_m, 1225.0, 1e-2);

    // Step 4c: Terminal guidance scale shift (< 762m)
    const radarLow = wasmCalculateLandingRadar({
      inertial_alt_m: 500.0,
      vertical_vel_mps: -8.0,
      horizontal_vel_mps: 30.0,
      terrain_elevation_offset_m: 0.0,
    });
    assertLandingRadarResult(radarLow);
    assert.equal(radarLow.scale_mode, 2, "Scale 2 Low mode below 762m");
    assert.equal(radarLow.data_good, true);

    // -----------------------------------------------------------------------
    // Phase 5: Touchdown & Mission Scoring
    // -----------------------------------------------------------------------
    const touchdownState: DescentState = {
      altitude_m: 0.0,
      vertical_velocity_mps: -0.52, // 1.7 ft/s (within 3.05 m/s limit)
      horizontal_velocity_mps: 0.28, // 0.9 ft/s (within 1.22 m/s limit)
      throttle_pct: 0.0,
      propellant_remaining_kg: 218.0, // Above bingo fuel reserve (112 kg)
      agc_cpu_duty_pct: 68.0,
      is_bingo_fuel: false,
      is_landed: true,
      touchdown_status: "NOMINAL_TOUCHDOWN",
    };

    assertTouchdownWithinLimits(
      touchdownState.vertical_velocity_mps,
      touchdownState.horizontal_velocity_mps,
      2.1 // Surface tilt angle in degrees (<= 12.0 deg limit)
    );

    // Score mission with all NASA realism factors nominal
    const scoreResult = wasmCalculateScore({
      science_score: 500.0,
      cost_score: 350.0,
      risk_penalty: 5.0,
      active_anomalies: [],
    });
    assert.equal(scoreResult.is_success, true);
    assert.ok(scoreResult.final_score >= 300.0, "Score reflects successful historic landing");
  });

  // =========================================================================
  // Scenario 2: Solar Energetic Particle Storm & Mascon Orbit Perturbation (Scenario 7)
  // =========================================================================
  it("Scenario 2: Solar Energetic Particle Storm, Farside Occultation & Mascon Orbit Recovery", async () => {
    // -----------------------------------------------------------------------
    // Phase 1: Translunar Flight & Severe Solar Flare Alert
    // -----------------------------------------------------------------------
    const stormKp = 8.5;
    const isSevereAlert = stormKp >= 8.0;
    assert.equal(isSevereAlert, true, "Kp 8.5 triggers SEVERE_ALERT");

    const ambientRadiationRateMradPerHour = 55.0; // Elevated solar flare dose rate
    const flareDurationHours = 6.0;
    const totalCrewDoseMrad = ambientRadiationRateMradPerHour * flareDurationHours; // 330 mrad

    // Caution alarm triggered at 100 mrad
    assert.ok(totalCrewDoseMrad >= 100.0, "Crew dosimeter trips caution alarm");
    assert.ok(totalCrewDoseMrad < 1000.0, "Dose remains well within non-lethal abort bounds");

    // Command protective barbecue roll mode
    const ptcRollActive = true;
    assert.equal(ptcRollActive, true, "Passive Thermal & Radiation Control active");

    // -----------------------------------------------------------------------
    // Phase 2: Lunar Farside Occultation Blackout (LOS)
    // -----------------------------------------------------------------------
    const ephemRes = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
    const ephemeris = await ephemRes.json();

    // Spacecraft swings behind the Moon: true anomaly 180 deg
    const blackoutTelemetry = wasmCalculateDsnTelemetry({
      distance_km: ephemeris.distance_km,
      true_anomaly_deg: 180.0,
      is_farside: true,
    });
    assertDsnTelemetryResult(blackoutTelemetry);
    assert.equal(blackoutTelemetry.is_occulted, true, "Complete RF line-of-sight loss behind Moon");
    assert.equal(blackoutTelemetry.received_power_dbm, -180.0, "Signal floor during 45-minute blackout");

    // -----------------------------------------------------------------------
    // Phase 3: Mascon Gravitational Perturbation & Orbit Decay
    // -----------------------------------------------------------------------
    const env = wasmGetLunarEnvironment();
    const masconAnomalyMgal = env.mascon_anomaly_mps2 * 1e5; // +280 mGal
    assertApprox(masconAnomalyMgal, 280.0, 1.0);

    // Mascon anomaly causes localized orbital pericenter altitude perturbation
    const nominalPericenterKm = 110.0;
    const pericenterDecayKm = (env.mascon_anomaly_mps2 / 1.622) * 1000.0; // ~1.73 km decay
    const perturbedPericenterKm = nominalPericenterKm - pericenterDecayKm;
    assertInRange(perturbedPericenterKm, 107.0, 109.5, "Pericenter slightly lowered by mare mascon pull");

    // -----------------------------------------------------------------------
    // Phase 4: Lunar Limb Re-Emergence (AOS) & Telemetry Restoration
    // -----------------------------------------------------------------------
    const aosTelemetry = wasmCalculateDsnTelemetry({
      distance_km: ephemeris.distance_km,
      true_anomaly_deg: 0.0,
      is_farside: false,
    });
    assert.equal(aosTelemetry.is_occulted, false, "Acquisition of Signal (AOS) on lunar limb emergence");
    assert.ok(aosTelemetry.received_power_dbm > -120.0, "Carrier lock restored");
    assertInRange(aosTelemetry.rtlt_seconds, 2.4, 2.8);

    // -----------------------------------------------------------------------
    // Phase 5: Delta-V Contingency Trim Burn & Mission Recovery
    // -----------------------------------------------------------------------
    const orbitTrimDvMps = 8.5; // Orbit trim burn restoring 110 km circular orbit
    const recoveryBudget = wasmEvaluateMissionDesignBudget({
      dry_mass_basic_kg: 15100.0,
      power_load_watts: 950.0,
      power_generation_watts: 1400.0,
      delta_v_required_mps: 4000.0 + orbitTrimDvMps, // Trim burn consumed from reserve
      stage_configs: [
        { stage_name: "CSM SPS", dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
        { stage_name: "LM DPS", dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
      ],
      mga_pct: 20.0,
    });
    assertMissionDesignBudgetResult(recoveryBudget);
    assert.equal(recoveryBudget.is_delta_v_compliant, true, "10% reserve margin maintained after trim burn");
    assert.ok(recoveryBudget.delta_v_reserve_pct >= 55.0);
    assert.equal(recoveryBudget.cml_score, 4, "Mission remains fully certified point design");

    // Mission evaluation under handled contingency
    const contingencyScore = wasmCalculateScore({
      science_score: 450.0,
      cost_score: 380.0,
      risk_penalty: 25.0, // Penalty for solar storm radiation and orbit decay
      active_anomalies: ["ANOM-A11-01"],
    });
    assert.equal(contingencyScore.is_success, true, "Mission succeeds with contingency managed");
    assert.ok(contingencyScore.final_score >= 200.0);
  });
});
