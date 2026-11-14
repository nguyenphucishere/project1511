import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, type TestServerContext } from "../harness/serverHarness.ts";
import {
  wasmCalculateLandingRadar,
  wasmEvaluateMissionDesignBudget,
  wasmCalculateDsnTelemetry,
  wasmGetLunarEnvironment,
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
} from "../harness/assertions.ts";

describe("Tier 1 Feature 9: Authentic NASA Realism & Data Services Coverage Suite", () => {
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
  // Suite 9.1: JPL Horizons Lunar Ephemeris Service & Fallback (5 tests)
  // =========================================================================
  describe("Suite 9.1: JPL Horizons Lunar Ephemeris Service & Fallback", () => {
    it("1. GET /api/nasa/ephemeris returns valid schema with DE441 state vectors and distance", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
      assert.equal(res.status, 200, "Horizons ephemeris endpoint must return 200 OK");
      const data = await res.json();
      assertHorizonsEphemerisSchema(data);
      assertInRange(data.distance_km, 350000, 420000, "Earth-Moon distance must be within physical orbital limits");
    });

    it("2. GET /api/nasa/ephemeris with epoch='1969-07-16T13:32:00Z' returns Apollo 11 liftoff ephemeris", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?epoch=1969-07-16T13:32:00Z&force_fallback=true");
      assert.equal(res.status, 200);
      const data = await res.json();
      assertHorizonsEphemerisSchema(data);
      assertInRange(data.distance_km, 380000, 410000, "Apollo 11 liftoff distance in ~389,000-405,000 km range");
      assertInRange(data.one_way_light_time_s, 1.25, 1.40, "One-way light time consistent with distance");
    });

    it("3. GET /api/nasa/ephemeris?force_fallback=true returns historical DE441 offline dataset", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.source, "offline_fallback", "Source must identify as 'offline_fallback'");
      assert.ok(data.target_body.includes("Moon"), "Target body must be Moon");
      assert.ok(data.center_body.includes("Earth"), "Center body must be Earth");
      assert.ok(Math.abs(data.state_vector_eci_km.x) > 100000, "State vector X must reflect deep space ECI coordinates");
    });

    it("4. GET /api/nasa/ephemeris verifies 3D Cartesian position vector magnitude matches distance_km", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
      const data = await res.json();
      const { x, y, z } = data.state_vector_eci_km;
      const computedDist = Math.sqrt(x * x + y * y + z * z);
      assertApprox(computedDist, data.distance_km, data.distance_km * 0.05, "State vector magnitude must match distance_km within 5%");
    });

    it("5. GET /api/nasa/ephemeris computes one-way light time consistent with speed of light c", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
      const data = await res.json();
      const c = 299792.458; // km/s
      const expectedLt = data.distance_km / c;
      assertApprox(data.one_way_light_time_s, expectedLt, 0.05, "One way light time must equal distance / c");
    });
  });

  // =========================================================================
  // Suite 9.2: NASA DSN Ground Tracking Service & MSFN Fallback (5 tests)
  // =========================================================================
  describe("Suite 9.2: NASA DSN Ground Tracking Service & MSFN Fallback", () => {
    it("6. GET /api/nasa/dsn/status returns active ground station and tracking complex telemetry", async () => {
      const res = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
      assert.equal(res.status, 200, "DSN status endpoint must return 200 OK");
      const data = await res.json();
      assertDsnStatusSchema(data);
      assert.ok(data.active_station.length > 0, "active_station must not be empty");
    });

    it("7. GET /api/nasa/dsn/status verifies Goldstone, Madrid, and Canberra tracking complexes present", async () => {
      const res = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
      const data = await res.json();
      const allText = data.complexes.map((c: any) => `${c.id} ${c.name} ${c.dish}`).join(" ").toLowerCase();
      assert.ok(allText.includes("canberra") || allText.includes("dss-44") || allText.includes("honeysuckle"), "Canberra/Honeysuckle complex must be present");
      assert.ok(allText.includes("goldstone") || allText.includes("dss-14"), "Goldstone complex must be present");
      assert.ok(allText.includes("madrid") || allText.includes("dss-61"), "Madrid complex must be present");
    });

    it("8. GET /api/nasa/dsn/status?force_fallback=true returns historical Apollo 11 MSFN tracking network", async () => {
      const res = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
      const data = await res.json();
      assert.equal(data.source, "offline_fallback");
      assert.equal(data.carrier_lock, true, "Historical Apollo 11 telemetry had carrier lock");
      assertInRange(data.rtlt_seconds, 2.4, 2.8, "RTLT must fall in Earth-Moon transit window");
    });

    it("9. GET /api/nasa/dsn/status validates RF link budget parameters (S-band carrier frequencies & signal dBm)", async () => {
      const res = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
      const data = await res.json();
      assertInRange(data.uplink_frequency_mhz, 2090, 2130, "Uplink frequency in Apollo S-band envelope");
      assertInRange(data.downlink_frequency_mhz, 2270, 2300, "Downlink frequency in Apollo S-band envelope");
      assertInRange(data.signal_strength_dbm, -145, -70, "Signal strength within receiver sensitivity window");
    });

    it("10. GET /api/nasa/dsn/status validates Round-Trip Light Time (RTLT) falls within Earth-Moon bounds (2.4s to 2.8s)", async () => {
      const res = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
      const data = await res.json();
      assertInRange(data.rtlt_seconds, 2.40, 2.80, "RTLT must strictly fall within 2.40s to 2.80s");
    });
  });

  // =========================================================================
  // Suite 9.3: NASA DONKI Space Weather Service & Fallback (5 tests)
  // =========================================================================
  describe("Suite 9.3: NASA DONKI Space Weather Service & Fallback", () => {
    it("11. GET /api/nasa/space-weather returns valid schema with solar flux, Kp index, and radiation dose rate", async () => {
      const res = await ctx.fetch("/api/nasa/space-weather?force_fallback=true");
      assert.equal(res.status, 200);
      const data = await res.json();
      assertSpaceWeatherSchema(data);
    });

    it("12. GET /api/nasa/space-weather?force_fallback=true returns historical quiet Sun Apollo 11 environment", async () => {
      const res = await ctx.fetch("/api/nasa/space-weather?force_fallback=true");
      const data = await res.json();
      assert.equal(data.source, "offline_fallback");
      assert.equal(data.mission_risk_status, "NOMINAL_QUIET");
      assert.equal(data.cme_alert, false);
      assert.equal(data.solar_proton_event_alert, false);
      assert.equal(data.solar_cycle, 20);
    });

    it("13. GET /api/nasa/space-weather validates Kp index integer range [0, 9] and risk level mapping", async () => {
      const res = await ctx.fetch("/api/nasa/space-weather?force_fallback=true");
      const data = await res.json();
      assertInRange(data.geomagnetic_kp_index, 0, 9);
      assert.ok(["NOMINAL_QUIET", "ELEVATED_WATCH", "SEVERE_ALERT"].includes(data.mission_risk_status));
    });

    it("14. GET /api/nasa/space-weather validates radiation dose rate under quiet conditions (< 1.50 mrad/hr)", async () => {
      const res = await ctx.fetch("/api/nasa/space-weather?force_fallback=true");
      const data = await res.json();
      assert.ok(data.radiation_dose_rate_mrad_per_hour > 0, "Radiation dose rate must be positive GCR background");
      assert.ok(data.radiation_dose_rate_mrad_per_hour <= 1.50, "Quiet Sun radiation dose rate must not exceed 1.50 mrad/hr");
    });

    it("15. GET /api/nasa/space-weather verifies solar radio flux F10.7 falls within solar cycle envelope (65 to 300 sfu)", async () => {
      const res = await ctx.fetch("/api/nasa/space-weather?force_fallback=true");
      const data = await res.json();
      assertInRange(data.solar_flux_f107, 65, 300, "F10.7 radio flux within physical solar cycle envelope");
    });
  });

  // =========================================================================
  // Suite 9.4: NASA EASEP Science Package Payload Service (5 tests)
  // =========================================================================
  describe("Suite 9.4: NASA EASEP Science Package Payload Service", () => {
    it("16. GET /api/nasa/mission-design/easep returns full EASEP scientific package inventory", async () => {
      const res = await ctx.fetch("/api/nasa/mission-design/easep");
      assert.equal(res.status, 200);
      const data = await res.json();
      assertEasepPayloadSchema(data);
      assert.ok(data.package_name.includes("EASEP"), "Package name must indicate EASEP");
      assert.ok(data.total_mass_kg >= 40.0, "Total mass must be realistic for deployed lunar science package");
    });

    it("17. GET /api/nasa/mission-design/easep validates PSEP, LRRR, and SWC experiment specifications", async () => {
      const res = await ctx.fetch("/api/nasa/mission-design/easep");
      const data = await res.json();
      const ids = data.experiments.map((e: any) => e.id);
      assert.ok(ids.includes("PSEP"), "Passive Seismic Experiment Package (PSEP) must be listed");
      assert.ok(ids.includes("LRRR"), "Laser Ranging Retro-Reflector (LRRR) must be listed");

      for (const exp of data.experiments) {
        assert.ok(exp.mass_kg > 0, `Experiment ${exp.id} mass must be positive`);
        assert.ok(exp.power_draw_watts >= 0, `Experiment ${exp.id} power must be non-negative`);
        assert.ok(exp.operating_lifetime_days > 0, `Experiment ${exp.id} lifetime must be positive`);
      }
    });

    it("18. GET /api/nasa/mission-design/easep validates Tranquility Base deployment coordinates and distance", async () => {
      const res = await ctx.fetch("/api/nasa/mission-design/easep");
      const data = await res.json();
      const site = data.deployment_site;
      assertApprox(site.latitude_deg, 0.674, 0.1, "Tranquility base latitude ~0.67 deg N");
      assertApprox(site.longitude_deg, 23.473, 0.1, "Tranquility base longitude ~23.47 deg E");
      assertInRange(site.distance_from_lm_m, 10, 40, "EASEP deployment distance from LM between 10m and 40m");
    });

    it("19. GET /api/nasa/lunar-environment returns authentic lunar physical and regolith parameters", async () => {
      const res = await ctx.fetch("/api/nasa/lunar-environment");
      assert.equal(res.status, 200);
      const data = await res.json();
      assertLunarEnvironmentSchema(data);
      assertInRange(data.standard_gravity_mps2, 1.61, 1.63, "Lunar standard gravity ~1.62 m/s²");
      assertInRange(data.regolith_bulk_density_kg_m3, 1400, 1900, "Lunar regolith bulk density ~1500-1800 kg/m³");
      assertInRange(data.regolith_bearing_capacity_kpa, 15, 150, "Regolith bearing capacity ~20-140 kPa");
    });

    it("20. GET /api/nasa/lunar-environment validates lunar temperature extremes and mascon anomaly", async () => {
      const res = await ctx.fetch("/api/nasa/lunar-environment");
      const data = await res.json();
      assertInRange(data.surface_temperature_c, -160, 150, "Lunar surface temperature within physical extremes");
      assert.ok(data.mascon_anomaly_mps2 > 0, "Mare mascon anomaly must be positive (+280 mGal)");
      assertApprox(data.local_gravity_effective_mps2, data.standard_gravity_mps2 + data.mascon_anomaly_mps2, 1e-4);
    });
  });

  // =========================================================================
  // Suite 9.5: Goddard MDL MEL, MGA Margin, Delta-V & CML Scorer (5 tests)
  // =========================================================================
  describe("Suite 9.5: Goddard MDL MEL, MGA Margin, Delta-V & CML Scorer", () => {
    it("21. WASM evaluate_mission_design_budget applies 15-20% Mass Growth Allowance per AIAA S-120-2006", () => {
      const budget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [
          { dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
          { dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
        ],
      });
      assertMissionDesignBudgetResult(budget);
      assertApprox(budget.dry_mass_with_mga_kg, 18120.0, 1e-2, "Basic mass scales by 1.20 under standard 20% MGA");
      assert.equal(budget.is_mass_compliant, true, "18,120 kg fits comfortably within Saturn V S-IVB TLI capacity");
    });

    it("22. WASM evaluate_mission_design_budget enforces minimum 30% electrical power margin compliance", () => {
      // 950W load with 1400W source -> 47.37% margin (PASS)
      const passBudget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        power_generation_watts: 1400.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: 311.0 }],
      });
      assert.equal(passBudget.is_power_compliant, true);
      assertApprox(passBudget.power_margin_pct, 47.3684, 1e-2);

      // 1200W load with 1400W source -> 16.67% margin (FAIL < 30%)
      const failBudget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 1200.0,
        power_generation_watts: 1400.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: 311.0 }],
      });
      assert.equal(failBudget.is_power_compliant, false);
      assertApprox(failBudget.power_margin_pct, 16.6667, 1e-2);
    });

    it("23. WASM evaluate_mission_design_budget calculates stage-by-stage multi-maneuver Delta-V budget", () => {
      const budget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [
          { stage_name: "CSM SPS", dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
          { stage_name: "LM DPS", dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
        ],
      });
      // Sum of CSM (3219.29 m/s) + LM (3164.31 m/s) = 6383.60 m/s
      assertApprox(budget.delta_v_available_mps, 6383.6047, 1.0);
      assertApprox(budget.delta_v_reserve_pct, 59.59, 1.0);
      assert.equal(budget.is_delta_v_compliant, true);
    });

    it("24. WASM evaluate_mission_design_budget scores JPL Concept Maturity Level (CML 1–4) readiness", () => {
      const budget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [
          { dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
          { dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
        ],
      });
      assert.equal(budget.cml_score, 4, "Fully compliant design reaches CML 4 (Point Design)");
      assert.ok(budget.overall_mdl_score >= 80.0, "Overall score must exceed 80 points");
    });

    it("25. WASM evaluate_mission_design_budget downgrades CML score when margins fail closure", () => {
      // Basic mass 45,000 kg -> With 20% MGA = 54,000 kg, exceeding 48,609 kg booster limit
      const overMassBudget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 45000.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [
          { dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
        ],
      });
      assert.equal(overMassBudget.is_mass_compliant, false);
      assert.ok(overMassBudget.cml_score <= 2, "Non-compliant budget capped at CML 2 or lower");
    });
  });

  // =========================================================================
  // Suite 9.6: Apollo 11 Landing Radar Doppler Dynamics & Scales (5 tests)
  // =========================================================================
  describe("Suite 9.6: Apollo 11 Landing Radar Doppler Dynamics & Scales", () => {
    it("26. WASM calculate_landing_radar computes Doppler velocity components (forward, vertical, lateral)", () => {
      const radar = wasmCalculateLandingRadar({
        inertial_alt_m: 1200.0,
        vertical_vel_mps: -25.5,
        horizontal_vel_mps: 142.0,
        terrain_elevation_offset_m: 0.0,
      });
      assertLandingRadarResult(radar);
      assertApprox(radar.forward_velocity_mps, 142.0, 1e-2);
      assertApprox(radar.vertical_velocity_mps, -25.5, 1e-2);
      assertApprox(radar.lateral_velocity_mps, 0.0, 1e-2);
    });

    it("27. WASM calculate_landing_radar switches scale mode from Scale 1 (High) to Scale 2 (Low) at 762 meters", () => {
      // 800m altitude -> Scale 1 (High Scale)
      const highScale = wasmCalculateLandingRadar({
        inertial_alt_m: 800.0,
        vertical_vel_mps: -15.0,
        horizontal_vel_mps: 80.0,
        terrain_elevation_offset_m: 0.0,
      });
      assert.equal(highScale.scale_mode, 1, "Altitude > 762m must operate in Scale 1");

      // 700m altitude -> Scale 2 (Low Scale)
      const lowScale = wasmCalculateLandingRadar({
        inertial_alt_m: 700.0,
        vertical_vel_mps: -12.0,
        horizontal_vel_mps: 60.0,
        terrain_elevation_offset_m: 0.0,
      });
      assert.equal(lowScale.scale_mode, 2, "Altitude <= 762m must operate in Scale 2");
    });

    it("28. WASM calculate_landing_radar adjusts radar altitude for lunar crater terrain elevation delta", () => {
      const radar = wasmCalculateLandingRadar({
        inertial_alt_m: 1200.0,
        vertical_vel_mps: -20.0,
        horizontal_vel_mps: 100.0,
        terrain_elevation_offset_m: 150.0, // Crater rim / elevated terrain
      });
      assertApprox(radar.radar_altitude_m, 1050.0, 1e-2, "Radar altitude = inertial - terrain offset");
      assertApprox(radar.altitude_delta_m, 150.0, 1e-2);
    });

    it("29. WASM calculate_landing_radar invalidates data_good flag during extreme pitch attitudes (>65 deg)", () => {
      const nominalPitch = wasmCalculateLandingRadar({
        inertial_alt_m: 500.0,
        vertical_vel_mps: -8.0,
        horizontal_vel_mps: 40.0,
        terrain_elevation_offset_m: 0.0,
        pitch_deg: 60.0,
      });
      assert.equal(nominalPitch.data_good, true, "Pitch 60 deg is within radar beam view angle");

      const extremePitch = wasmCalculateLandingRadar({
        inertial_alt_m: 500.0,
        vertical_vel_mps: -8.0,
        horizontal_vel_mps: 40.0,
        terrain_elevation_offset_m: 0.0,
        pitch_deg: 70.0,
      });
      assert.equal(extremePitch.data_good, false, "Pitch > 65 deg causes radar beam drop");
    });

    it("30. WASM calculate_landing_radar validates continuous lock and low-altitude accuracy below 100 meters", () => {
      const lowAltitudes = [50.0, 20.0, 5.0];
      for (const alt of lowAltitudes) {
        const radar = wasmCalculateLandingRadar({
          inertial_alt_m: alt,
          vertical_vel_mps: -1.5,
          horizontal_vel_mps: 2.0,
          terrain_elevation_offset_m: 0.0,
        });
        assert.equal(radar.scale_mode, 2);
        assert.equal(radar.data_good, true);
        assertApprox(radar.radar_altitude_m, alt, 1e-3);
      }
    });
  });

  // =========================================================================
  // Suite 9.7: Lunar Mascon Gravity Anomaly & DSN Occultation (5 tests)
  // =========================================================================
  describe("Suite 9.7: Lunar Mascon Gravity Anomaly & DSN Occultation", () => {
    it("31. WASM calculate_dsn_telemetry computes Round-Trip Light Time (RTLT) based on true ephemeris distance", () => {
      const nearDist = wasmCalculateDsnTelemetry({
        distance_km: 384400.0,
        true_anomaly_deg: 0.0,
        is_farside: false,
      });
      assertApprox(nearDist.rtlt_seconds, 2.56444, 0.005, "RTLT for 384,400 km is ~2.564s");

      const farDist = wasmCalculateDsnTelemetry({
        distance_km: 405000.0,
        true_anomaly_deg: 0.0,
        is_farside: false,
      });
      assertApprox(farDist.rtlt_seconds, 2.70187, 0.005, "RTLT for 405,000 km is ~2.702s");
      assert.ok(farDist.rtlt_seconds > nearDist.rtlt_seconds, "RTLT must scale strictly with distance");
    });

    it("32. WASM calculate_dsn_telemetry models RF space path loss (dB) and received carrier power (dBm)", () => {
      const telemetry = wasmCalculateDsnTelemetry({
        distance_km: 384400.0,
        true_anomaly_deg: 0.0,
        is_farside: false,
      });
      assertDsnTelemetryResult(telemetry);
      assertInRange(telemetry.path_loss_db, 205.0, 215.0, "Path loss in ~211 dB range at 2282.5 MHz");
      assertInRange(telemetry.received_power_dbm, -120.0, -95.0, "Received power in ~-100 dBm range");
    });

    it("33. WASM calculate_dsn_telemetry detects lunar farside occultation and asserts telemetry blackout", () => {
      const farside = wasmCalculateDsnTelemetry({
        distance_km: 384400.0,
        true_anomaly_deg: 180.0,
        is_farside: true,
      });
      assert.equal(farside.is_occulted, true, "is_farside=true must trigger occultation");
      assert.equal(farside.received_power_dbm, -180.0, "Occulted carrier signal drops to receiver floor");
    });

    it("34. WASM get_lunar_environment_constants provides +280 mGal lunar mascon gravitational perturbation", () => {
      const env = wasmGetLunarEnvironment();
      assertLunarEnvironmentSchema(env);
      assertApprox(env.standard_gravity_mps2, 1.622, 1e-3);
      assertApprox(env.mascon_anomaly_mps2, 0.0028, 1e-4, "+280 mGal = 0.0028 m/s²");
      assertApprox(env.local_gravity_effective_mps2, 1.6248, 1e-4);
    });

    it("35. WASM calculate_dsn_telemetry confirms line-of-sight restoration on orbital farside exit (AOS)", () => {
      const nearside = wasmCalculateDsnTelemetry({
        distance_km: 384400.0,
        true_anomaly_deg: 0.0,
        is_farside: false,
      });
      assert.equal(nearside.is_occulted, false, "Nearside true anomaly 0 deg has clear line-of-sight");
      assert.ok(nearside.received_power_dbm > -125.0, "Received carrier power restored above lock threshold");
    });
  });
});
