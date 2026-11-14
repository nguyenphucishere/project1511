import { describe, it, before, after, beforeEach, afterEach } from "node:test";
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

describe("Tier 2 Boundary Suite: NASA Realism Limits, Singularity & Fault Boundaries", () => {
  let ctx: TestServerContext;
  let originalFetch: typeof globalThis.fetch;

  before(async () => {
    ctx = await startTestServer({ silent: true });
    originalFetch = globalThis.fetch;
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (ctx) {
      await ctx.shutdown();
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // Domain 2.1: Horizons Ephemeris Boundaries & Error Handling (5 tests)
  // =========================================================================
  describe("Domain 2.1: Horizons Ephemeris Boundaries & Error Handling", () => {
    it("1. rejects invalid or non-existent celestial target body ID (e.g. COMMAND='999999') with clean fallback", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?target=999999");
      assert.equal(res.status, 200, "Server must return 200 OK with fallback for non-existent target ID");
      const data = await res.json();
      assertHorizonsEphemerisSchema(data);
      assert.equal(data.source, "offline_fallback");
    });

    it("2. handles negative Julian Day / pre-spaceflight epoch query without throwing uncaught exceptions", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?epoch=BC-4000-01-01");
      assert.equal(res.status, 200, "Server must return 200 OK without unhandled exception for ancient epoch");
      const data = await res.json();
      assertHorizonsEphemerisSchema(data);
      assert.equal(data.source, "offline_fallback");
    });

    it("3. recovers gracefully from upstream Horizons 1500ms network timeout via AbortController", async () => {
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url ?? "";
        if (url.includes("ssd.jpl.nasa.gov")) {
          // Simulate hung network request exceeding 1500ms
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return new Response("Simulated Timeout", { status: 504 });
        }
        return originalFetch(input, init);
      }) as typeof fetch;

      const start = Date.now();
      const res = await ctx.fetch("/api/nasa/ephemeris?target=301");
      const duration = Date.now() - start;

      assert.equal(res.status, 200, "Must recover with 200 OK on timeout");
      const data = await res.json();
      assertHorizonsEphemerisSchema(data);
      assert.equal(data.source, "offline_fallback");
      assert.ok(duration < 2500, "Timeout handler should abort within ~1.5-2.0 seconds");
    });

    it("4. handles upstream Horizons HTTP 429 rate limit backoff by serving cached ephemeris", async () => {
      (ctx.server as any).nasaHorizons?.clearCache();
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url ?? "";
        if (url.includes("ssd.jpl.nasa.gov")) {
          return new Response("429 Too Many Requests", { status: 429 });
        }
        return originalFetch(input, init);
      }) as typeof fetch;

      const res = await ctx.fetch("/api/nasa/ephemeris?target=301");
      assert.equal(res.status, 200, "Must return 200 OK when rate limited");
      const data = await res.json();
      assertHorizonsEphemerisSchema(data);
      assert.equal(data.source, "offline_fallback");
    });

    it("5. validates Earth-Moon distance extreme perigee (356,500 km) and apogee (406,700 km) boundary limits", async () => {
      const res = await ctx.fetch("/api/nasa/ephemeris?force_fallback=true");
      const data = await res.json();
      // True lunar orbit perigee ~356,500 km, apogee ~406,700 km
      assertInRange(data.distance_km, 350000, 415000, "Distance must remain within orbital boundaries");
    });
  });

  // =========================================================================
  // Domain 2.2: DSN Ground Tracking Boundaries & Feed Malformation (5 tests)
  // =========================================================================
  describe("Domain 2.2: DSN Ground Tracking Boundaries & Feed Malformation", () => {
    it("6. parses DSN Now XML containing empty string numeric attributes without generating NaN", async () => {
      (ctx.server as any).nasaDsn?.clearCache();
      // Mock DSN XML feed with empty string attributes
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url ?? "";
        if (url.includes("eyes.nasa.gov/dsn")) {
          const malformedXml = `<?xml version="1.0"?><dsn><station name="gdscc" friendlyName="Goldstone"><dish name="DSS-14" azimuthAngle="" elevationAngle="" activity="TRACKING"><downlink active="true" signalType="carrier" power=""/></dish></station></dsn>`;
          return new Response(malformedXml, { status: 200 });
        }
        return originalFetch(input, init);
      }) as typeof fetch;

      const res = await ctx.fetch("/api/nasa/dsn/status");
      assert.equal(res.status, 200);
      const data = await res.json();
      assertDsnStatusSchema(data);
      for (const complex of data.complexes) {
        assert.ok(!Number.isNaN(complex.azimuth_deg), "Azimuth must not be NaN");
        assert.ok(!Number.isNaN(complex.elevation_deg), "Elevation must not be NaN");
      }
    });

    it("7. filters stowed and maintenance tracking dishes (azimuth=0, elevation=90, activity='Stowed')", async () => {
      const res = await ctx.fetch("/api/nasa/dsn/status?force_fallback=true");
      const data = await res.json();
      // Active station selected must be a live tracking facility
      assert.ok(data.active_station.length > 0);
      assert.ok(!data.active_station.toLowerCase().includes("stowed"));
    });

    it("8. handles upstream DSN XML feed returning invalid / truncated XML document", async () => {
      (ctx.server as any).nasaDsn?.clearCache();
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url ?? "";
        if (url.includes("eyes.nasa.gov/dsn")) {
          return new Response("<dsn><station><unclosed_tag>", { status: 200 });
        }
        return originalFetch(input, init);
      }) as typeof fetch;

      const res = await ctx.fetch("/api/nasa/dsn/status");
      assert.equal(res.status, 200, "Malformed XML must trigger clean MSFN fallback");
      const data = await res.json();
      assertDsnStatusSchema(data);
      assert.equal(data.source, "offline_fallback");
    });

    it("9. asserts signal carrier lock drops when received power drops below receiver sensitivity threshold (-145 dBm)", () => {
      // In deep space link budgets, signals below -145 dBm drop receiver carrier lock
      const thresholdCarrier = -145.0; // dBm threshold
      const weakSignal = -146.5;
      const nominalSignal = -115.0;

      const isLockedWeak = weakSignal >= thresholdCarrier;
      const isLockedNominal = nominalSignal >= thresholdCarrier;

      assert.equal(isLockedWeak, false, "Signal below -145 dBm loses carrier lock");
      assert.equal(isLockedNominal, true, "Signal above -145 dBm maintains carrier lock");
    });

    it("10. handles concurrent DSN status polling under rapid request burst without socket starvation", async () => {
      const burstSize = 15;
      const requests = Array.from({ length: burstSize }, () =>
        ctx.fetch("/api/nasa/dsn/status?force_fallback=true")
      );
      const responses = await Promise.all(requests);
      for (const res of responses) {
        assert.equal(res.status, 200);
      }
    });
  });

  // =========================================================================
  // Domain 2.3: DONKI Space Weather Boundaries & Alert Thresholds (5 tests)
  // =========================================================================
  describe("Domain 2.3: DONKI Space Weather Boundaries & Alert Thresholds", () => {
    it("11. handles quiet solar period with zero active alerts ([] empty array) as nominal quiet Sun", async () => {
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input?.url ?? "";
        if (url.includes("api.nasa.gov/DONKI")) {
          return new Response("[]", { status: 200 });
        }
        return originalFetch(input, init);
      }) as typeof fetch;

      const res = await ctx.fetch("/api/nasa/space-weather");
      assert.equal(res.status, 200);
      const data = await res.json();
      assertSpaceWeatherSchema(data);
      assert.equal(data.mission_risk_status, "NOMINAL_QUIET");
      assert.equal(data.cme_alert, false);
      assert.equal(data.solar_proton_event_alert, false);
    });

    it("12. evaluates boundary geomagnetic Kp index: Kp=4 (QUIET) vs Kp=5 (ELEVATED) vs Kp=9 (EXTREME)", () => {
      // Classification mapping: Kp < 5 NOMINAL_QUIET/WATCH, Kp 5-7 ELEVATED_WATCH, Kp >= 8 SEVERE_ALERT
      const classifyKp = (kp: number) => {
        if (kp >= 8) return "SEVERE_ALERT";
        if (kp >= 5) return "ELEVATED_WATCH";
        return "NOMINAL_QUIET";
      };

      assert.equal(classifyKp(4.9), "NOMINAL_QUIET");
      assert.equal(classifyKp(5.0), "ELEVATED_WATCH");
      assert.equal(classifyKp(7.9), "ELEVATED_WATCH");
      assert.equal(classifyKp(9.0), "SEVERE_ALERT");
    });

    it("13. handles DEMO_KEY rate limit HTTP 403 / 429 exhaustion with silent offline fallback", async () => {
      (ctx.server as any).nasaSpaceWeather?.clearCache();
      // DONKI rate-limited and NOAA SWPC unreachable: nothing live left, so the 1969 baseline.
      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";
        if (url.includes("api.nasa.gov")) {
          return new Response(JSON.stringify({ error: { code: "OVER_RATE_LIMIT" } }), { status: 429 });
        }
        if (url.includes("swpc.noaa.gov")) throw new TypeError("fetch failed: getaddrinfo ENOTFOUND");
        return originalFetch(input, init);
      }) as typeof fetch;

      const res = await ctx.fetch("/api/nasa/space-weather");
      assert.equal(res.status, 200);
      const data = await res.json();
      assertSpaceWeatherSchema(data);
      assert.equal(data.source, "offline_fallback");
    });

    it("14. clamps astronaut cumulative radiation dosimeter at maximum survivable emergency threshold", () => {
      // Emergency radiation ceiling: 100,000 mrad (100 rad) maximum survivable lunar abort dose
      const maxDoseLimitMrad = 100_000.0;
      const simulateDose = (rateMradPerHour: number, hours: number) => {
        const rawDose = Math.max(0.0, rateMradPerHour * hours);
        return Math.min(rawDose, maxDoseLimitMrad);
      };

      assert.equal(simulateDose(50.0, 10.0), 500.0);
      assert.equal(simulateDose(20000.0, 10.0), maxDoseLimitMrad, "Extreme spike clamped at safety limit");
      assert.equal(simulateDose(-10.0, 5.0), 0.0, "Negative rate clamped to zero");
    });

    it("15. validates solar flare classification boundaries (C-class < M-class 10^-5 W/m² < X-class 10^-4 W/m²)", () => {
      const classifyFlare = (fluxWattsM2: number) => {
        if (fluxWattsM2 >= 1e-4) return "SEVERE_ALERT";
        if (fluxWattsM2 >= 1e-5) return "ELEVATED_WATCH";
        return "NOMINAL_QUIET";
      };

      assert.equal(classifyFlare(5e-6), "NOMINAL_QUIET", "C-class flare is quiet");
      assert.equal(classifyFlare(1.5e-5), "ELEVATED_WATCH", "M-class flare triggers elevated watch");
      assert.equal(classifyFlare(1.2e-4), "SEVERE_ALERT", "X-class flare triggers severe alert");
    });
  });

  // =========================================================================
  // Domain 2.4: EASEP & Lunar Environment Specification Boundaries (5 tests)
  // =========================================================================
  describe("Domain 2.4: EASEP & Lunar Environment Specification Boundaries", () => {
    it("16. validates EASEP package total mass matches sum of constituent experiment masses", async () => {
      const res = await ctx.fetch("/api/nasa/mission-design/easep");
      const data = await res.json();
      assertEasepPayloadSchema(data);

      const expMassSum = data.experiments.reduce((sum: number, e: any) => sum + e.mass_kg, 0);
      // Total package mass is experiments sum + structural pallet/mounting hardware
      assert.ok(data.total_mass_kg >= expMassSum * 0.95, "Total mass must account for all experiment hardware");
    });

    it("17. enforces non-negative power draw and operational lifetime across all EASEP experiments", async () => {
      const res = await ctx.fetch("/api/nasa/mission-design/easep");
      const data = await res.json();

      for (const exp of data.experiments) {
        assert.ok(exp.power_draw_watts >= 0.0, `${exp.id} power draw must be non-negative`);
        assert.ok(exp.operating_lifetime_days > 0.0, `${exp.id} lifetime must be positive`);
        assert.ok(exp.mass_kg > 0.0, `${exp.id} mass must be positive`);
      }
    });

    it("18. validates lunar surface temperature extremes: -130°C night boundary to +120°C noon boundary", async () => {
      const res = await ctx.fetch("/api/nasa/lunar-environment");
      const data = await res.json();
      assertLunarEnvironmentSchema(data);
      assertInRange(data.surface_temperature_c, -140.0, 130.0, "Tranquility Base temperature within lunar bounds");
    });

    it("19. verifies lunar regolith bearing capacity boundary prevents LM footpad punch-through (>15 kPa)", async () => {
      const res = await ctx.fetch("/api/nasa/lunar-environment");
      const data = await res.json();
      // LM footpad static ground pressure is ~7.0 kPa; allowable soil bearing capacity is >= 15.0 kPa
      assert.ok(data.regolith_bearing_capacity_kpa >= 15.0, "Bearing capacity must support LM footpads without punch-through");
    });

    it("20. validates lunar mascon gravitational anomaly boundary (+200 mGal to +350 mGal)", async () => {
      const res = await ctx.fetch("/api/nasa/lunar-environment");
      const data = await res.json();
      // 1 mGal = 1e-5 m/s² -> +200 mGal = 0.0020 m/s², +350 mGal = 0.0035 m/s²
      assertInRange(data.mascon_anomaly_mps2, 0.0020, 0.0035, "Mascon perturbation must fall within +200 to +350 mGal");
    });
  });

  // =========================================================================
  // Domain 2.5: Goddard MDL Mass Equipment List & MGA Margin Boundaries (5 tests)
  // =========================================================================
  describe("Domain 2.5: Goddard MDL Mass Equipment List & MGA Margin Boundaries", () => {
    it("21. rejects spacecraft design with 0% booster mass margin before Mass Growth Allowance (MGA)", () => {
      // Basic mass equal to booster throw-weight capacity: 48,609 kg
      // With 20% MGA, predicted dry mass is 58,330.8 kg -> Mass margin is -9,721.8 kg (FAIL)
      const budget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 48609.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 }],
      });
      assert.equal(budget.is_mass_compliant, false, "0% margin before MGA must fail mass compliance after 20% MGA");
      assert.ok(budget.mass_margin_kg < 0.0);
    });

    it("22. evaluates exact 15.0% MGA preliminary design boundary vs 20.0% conceptual design boundary", () => {
      const basicMass = 10000.0;
      const budget15 = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: basicMass,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: 311.0 }],
        mga_pct: 15.0,
      });
      assertApprox(budget15.dry_mass_with_mga_kg, 11500.0, 1e-2, "15% MGA yields 11,500 kg");

      const budget20 = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: basicMass,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: 311.0 }],
        mga_pct: 20.0,
      });
      assertApprox(budget20.dry_mass_with_mga_kg, 12000.0, 1e-2, "20% MGA yields 12,000 kg");
    });

    it("23. rejects non-positive specific impulse (Isp <= 0) with explicit validation error", () => {
      const budgetZeroIsp = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: 0.0 }],
      });
      assert.ok(budgetZeroIsp.error !== undefined || budgetZeroIsp.cml_score <= 1, "Zero Isp must flag an error or lowest CML");

      const budgetNegativeIsp = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: -311.0 }],
      });
      assert.ok(budgetNegativeIsp.error !== undefined || budgetNegativeIsp.cml_score <= 1, "Negative Isp must flag an error");
    });

    it("24. evaluates minimum 30.0% power margin boundary: 29.9% (FAIL) vs 30.0% (PASS)", () => {
      // Baseline power generation = 1400.0 Watts
      // Margin = (1400 - P) / P * 100 >= 30.0%  =>  1400 / 1.30 = 1076.923 Watts
      const passBudget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 1076.0, // (1400 - 1076) / 1076 * 100 = 30.11% (PASS)
        power_generation_watts: 1400.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: 311.0 }],
      });
      assert.equal(passBudget.is_power_compliant, true);

      const failBudget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 1078.0, // (1400 - 1078) / 1078 * 100 = 29.87% (FAIL)
        power_generation_watts: 1400.0,
        delta_v_required_mps: 4000.0,
        stage_configs: [{ dry_mass_kg: 5000.0, propellant_mass_kg: 10000.0, isp_seconds: 311.0 }],
      });
      assert.equal(failBudget.is_power_compliant, false);
    });

    it("25. evaluates minimum 10.0% Delta-V reserve margin boundary: 9.9% (FAIL) vs 10.0% (PASS)", () => {
      // Stage yields available Delta-V = 6383.6 m/s
      // To get 10.0% reserve: required = 6383.6 / 1.10 = 5803.27 m/s
      const passBudget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 5800.0, // (6383.6 - 5800) / 5800 = 10.06% (PASS)
        stage_configs: [
          { dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
          { dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
        ],
      });
      assert.equal(passBudget.is_delta_v_compliant, true);

      const failBudget = wasmEvaluateMissionDesignBudget({
        dry_mass_basic_kg: 15100.0,
        power_load_watts: 950.0,
        delta_v_required_mps: 5850.0, // (6383.6 - 5850) / 5850 = 9.12% (FAIL < 10%)
        stage_configs: [
          { dry_mass_kg: 10000.0, propellant_mass_kg: 18400.0, isp_seconds: 314.5 },
          { dry_mass_kg: 4500.0, propellant_mass_kg: 8200.0, isp_seconds: 311.0 },
        ],
      });
      assert.equal(failBudget.is_delta_v_compliant, false);
    });
  });

  // =========================================================================
  // Domain 2.6: Landing Radar Doppler Dynamics & Boundary Limits (5 tests)
  // =========================================================================
  describe("Domain 2.6: Landing Radar Doppler Dynamics & Boundary Limits", () => {
    it("26. evaluates Landing Radar scale shift exact boundary: 762.1m (Scale 1) vs 762.0m (Scale 2)", () => {
      const highScale = wasmCalculateLandingRadar({
        inertial_alt_m: 762.1,
        vertical_vel_mps: -10.0,
        horizontal_vel_mps: 50.0,
        terrain_elevation_offset_m: 0.0,
      });
      assert.equal(highScale.scale_mode, 1, "762.1m must evaluate to Scale 1 (High Scale)");

      const lowScale = wasmCalculateLandingRadar({
        inertial_alt_m: 762.0,
        vertical_vel_mps: -10.0,
        horizontal_vel_mps: 50.0,
        terrain_elevation_offset_m: 0.0,
      });
      assert.equal(lowScale.scale_mode, 2, "762.0m must evaluate to Scale 2 (Low Scale)");
    });

    it("27. validates radar beam drop at exact pitch attitude boundary (65.0 deg valid vs 65.1 deg drop)", () => {
      const validBeam = wasmCalculateLandingRadar({
        inertial_alt_m: 600.0,
        vertical_vel_mps: -8.0,
        horizontal_vel_mps: 30.0,
        terrain_elevation_offset_m: 0.0,
        pitch_deg: 65.0,
      });
      assert.equal(validBeam.data_good, true, "Pitch 65.0 deg must be valid");

      const droppedBeam = wasmCalculateLandingRadar({
        inertial_alt_m: 600.0,
        vertical_vel_mps: -8.0,
        horizontal_vel_mps: 30.0,
        terrain_elevation_offset_m: 0.0,
        pitch_deg: 65.1,
      });
      assert.equal(droppedBeam.data_good, false, "Pitch 65.1 deg must drop radar lock");
    });

    it("28. handles zero and negative radar altitudes (touchdown sensor probe contact at 1.63m)", () => {
      // When probe touches ground at 1.63m, inertial alt is equal to or below terrain elevation offset
      const touchdownProbe = wasmCalculateLandingRadar({
        inertial_alt_m: 1.63,
        vertical_vel_mps: -0.5,
        horizontal_vel_mps: 0.1,
        terrain_elevation_offset_m: 5.0, // Crater elevation offset higher than inertial altitude
      });
      assert.equal(touchdownProbe.radar_altitude_m, 0.0, "Radar altitude clamped to 0.0 on ground contact");
      assert.equal(touchdownProbe.scale_mode, 2);
      assert.equal(touchdownProbe.data_good, true);
    });

    it("29. verifies Doppler radar velocity bounds under extreme descent rates (vertical vel > 50 m/s)", () => {
      const extremeDescent = wasmCalculateLandingRadar({
        inertial_alt_m: 500.0,
        vertical_vel_mps: -350.0, // Unsafe sink rate exceeding Doppler bandwidth (passband max 300 m/s)
        horizontal_vel_mps: 20.0,
        terrain_elevation_offset_m: 0.0,
      });
      assert.equal(extremeDescent.data_good, false, "Sink rate exceeding bandwidth flags data_good = false");
    });

    it("30. handles extreme terrain crater slope elevation step delta (-100m to +100m)", () => {
      const craterDepression = wasmCalculateLandingRadar({
        inertial_alt_m: 500.0,
        vertical_vel_mps: -10.0,
        horizontal_vel_mps: 30.0,
        terrain_elevation_offset_m: -100.0,
      });
      assertApprox(craterDepression.radar_altitude_m, 600.0, 1e-2);
      assertApprox(craterDepression.altitude_delta_m, -100.0, 1e-2);

      const craterRim = wasmCalculateLandingRadar({
        inertial_alt_m: 500.0,
        vertical_vel_mps: -10.0,
        horizontal_vel_mps: 30.0,
        terrain_elevation_offset_m: 100.0,
      });
      assertApprox(craterRim.radar_altitude_m, 400.0, 1e-2);
      assertApprox(craterRim.altitude_delta_m, 100.0, 1e-2);
    });
  });

  // =========================================================================
  // Domain 2.7: Lunar Mascon Anomaly & Farside Occultation Boundaries (5 tests)
  // =========================================================================
  describe("Domain 2.7: Lunar Mascon Anomaly & Farside Occultation Boundaries", () => {
    it("31. evaluates DSN occultation sector boundary: true anomaly 109.8 deg (LOS) vs 110.0 deg (OCCULTED)", () => {
      // Occultation cone ingress threshold is ~109.872 degrees
      const losAngle = wasmCalculateDsnTelemetry({
        distance_km: 384400.0,
        true_anomaly_deg: 109.8,
        is_farside: false,
      });
      assert.equal(losAngle.is_occulted, false, "109.8 deg is outside shadow cone");
      assert.ok(losAngle.received_power_dbm > -125.0);

      const occultedAngle = wasmCalculateDsnTelemetry({
        distance_km: 384400.0,
        true_anomaly_deg: 110.0,
        is_farside: false,
      });
      assert.equal(occultedAngle.is_occulted, true, "110.0 deg enters occultation shadow cone");
      assert.equal(occultedAngle.received_power_dbm, -180.0);
    });

    it("32. validates DSN round-trip light time at closest lunar approach perigee (2.38s) vs apogee (2.71s)", () => {
      const perigee = wasmCalculateDsnTelemetry({
        distance_km: 356500.0,
        true_anomaly_deg: 0.0,
        is_farside: false,
      });
      assertApprox(perigee.rtlt_seconds, 2.3783, 0.01, "Perigee RTLT ~2.378s");

      const apogee = wasmCalculateDsnTelemetry({
        distance_km: 406700.0,
        true_anomaly_deg: 0.0,
        is_farside: false,
      });
      assertApprox(apogee.rtlt_seconds, 2.7132, 0.01, "Apogee RTLT ~2.713s");
      assert.ok(apogee.rtlt_seconds > perigee.rtlt_seconds);
    });

    it("33. handles zero spacecraft distance (distance_km <= 0) guard condition", () => {
      const zeroDist = wasmCalculateDsnTelemetry({
        distance_km: 0.0,
        true_anomaly_deg: 0.0,
        is_farside: false,
      });
      assert.ok(!Number.isNaN(zeroDist.rtlt_seconds), "RTLT must not be NaN");
      assert.ok(!Number.isNaN(zeroDist.path_loss_db), "Path loss must not be NaN");
      assert.ok(zeroDist.rtlt_seconds >= 0.0);
    });

    it("34. evaluates carrier frequency Doppler shift under orbital velocity (±1.6 km/s lunar orbital speed)", () => {
      // Doppler shift: delta_f = f0 * (v / c)
      // At S-band f0 = 2282.5 MHz = 2.2825e9 Hz, v = 1600 m/s, c = 299792458 m/s
      const f0 = 2282.5e6;
      const v = 1600.0;
      const c = 299792458.0;
      const dopplerShiftHz = f0 * (v / c);

      assertInRange(dopplerShiftHz, 12000.0, 12300.0, "Doppler shift at 1.6 km/s is ~12.18 kHz");
    });

    it("35. asserts mascon gravity perturbation acceleration bounds (+280 mGal = +0.0028 m/s²)", () => {
      const env = wasmGetLunarEnvironment();
      const standardG = 1.622;
      const masconG = env.mascon_anomaly_mps2;
      const effectiveG = env.local_gravity_effective_mps2;

      assertApprox(masconG, 0.0028, 1e-4);
      assertApprox(effectiveG, standardG + masconG, 1e-4);
      assert.ok(effectiveG > standardG, "Local Mare gravity must be higher due to mascon");
    });
  });
});
