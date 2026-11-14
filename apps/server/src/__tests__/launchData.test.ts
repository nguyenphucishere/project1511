import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { SimulationResultSchema } from "@space-sim/shared-schema";
import {
  LaunchDataService,
  evaluateWeatherStatus,
  HISTORICAL_APOLLO_11_WEATHER,
  KSC_PAD_39A,
  MARE_TRANQUILLITATIS,
  SATURN_V_AS506,
} from "../services/launchDataService.js";
import {
  SimulationValidatorBridge,
  APOLLO11_CONSTANTS,
} from "../validator/simBridge.js";

describe("LaunchDataService", () => {
  let service: LaunchDataService;

  beforeEach(() => {
    service = new LaunchDataService();
    service.clearCache();
  });

  describe("Historical Apollo 11 Fallback", () => {
    it("matches exact Apollo 11 July 16, 1969 13:32 UTC launch weather", async () => {
      const weather = await service.getKscWeather({ forceFallback: true });

      assert.equal(weather.temperature_c, 29.4);
      assert.equal(weather.pressure_kpa, 101.4);
      assert.equal(weather.wind_speed_kmh, 18.5);
      assert.equal(weather.wind_direction_deg, 290);
      assert.equal(weather.humidity_pct, 72);
      assert.equal(weather.status, "GO");
      assert.equal(weather.source, "offline_fallback");
    });

    it("matches constant reference values", () => {
      assert.equal(HISTORICAL_APOLLO_11_WEATHER.temperature_c, 29.4);
      assert.equal(HISTORICAL_APOLLO_11_WEATHER.pressure_kpa, 101.4);
      assert.equal(HISTORICAL_APOLLO_11_WEATHER.wind_speed_kmh, 18.5);
      assert.equal(HISTORICAL_APOLLO_11_WEATHER.wind_direction_deg, 290);
      assert.equal(HISTORICAL_APOLLO_11_WEATHER.humidity_pct, 72);
      assert.equal(HISTORICAL_APOLLO_11_WEATHER.status, "GO");
      assert.equal(HISTORICAL_APOLLO_11_WEATHER.source, "offline_fallback");
    });
  });

  describe("Weather Launch Commit Criteria", () => {
    it("evaluates wind <= 40 km/h as GO", () => {
      assert.equal(evaluateWeatherStatus(0), "GO");
      assert.equal(evaluateWeatherStatus(18.5), "GO");
      assert.equal(evaluateWeatherStatus(39.9), "GO");
      assert.equal(evaluateWeatherStatus(40.0), "GO");
    });

    it("evaluates wind > 40 km/h and <= 55 km/h as HOLD", () => {
      assert.equal(evaluateWeatherStatus(40.1), "HOLD");
      assert.equal(evaluateWeatherStatus(45.0), "HOLD");
      assert.equal(evaluateWeatherStatus(55.0), "HOLD");
    });

    it("evaluates wind > 55 km/h as NO-GO", () => {
      assert.equal(evaluateWeatherStatus(55.1), "NO-GO");
      assert.equal(evaluateWeatherStatus(70.0), "NO-GO");
      assert.equal(evaluateWeatherStatus(120.0), "NO-GO");
    });

    it("handles invalid or negative wind speeds safely", () => {
      assert.equal(evaluateWeatherStatus(-5), "NO-GO");
      assert.equal(evaluateWeatherStatus(NaN), "NO-GO");
      assert.equal(evaluateWeatherStatus(Infinity), "NO-GO");
    });
  });

  describe("Geographic Site & Landing Coordinates", () => {
    it("contains exact Pad 39A coordinates and elevation", () => {
      assert.equal(KSC_PAD_39A.name, "Kennedy Space Center LC-39A");
      assert.equal(KSC_PAD_39A.pad_id, "LC-39A");
      assert.equal(KSC_PAD_39A.lat, 28.5721);
      assert.equal(KSC_PAD_39A.lon, -80.6480);
      assert.equal(KSC_PAD_39A.elevation_m, 3.0);
      assert.equal(KSC_PAD_39A.azimuth_deg, 72.058);
    });

    it("contains exact Mare Tranquillitatis coordinates and elevation", () => {
      assert.equal(MARE_TRANQUILLITATIS.name, "Mare Tranquillitatis");
      assert.equal(MARE_TRANQUILLITATIS.site_code, "ALS-2");
      assert.equal(MARE_TRANQUILLITATIS.lat, 0.67408);
      assert.equal(MARE_TRANQUILLITATIS.lon, 23.47297);
      assert.equal(MARE_TRANQUILLITATIS.elevation_m, -2570);
    });
  });

  describe("Saturn V AS-506 Staging & Component Masses", () => {
    it("has exact Apollo 11 GLOM of 2,938,315 kg", () => {
      assert.equal(SATURN_V_AS506.glom_kg, 2938315);
      assert.equal(SATURN_V_AS506.liftoff_twr, 1.174);
      assert.equal(SATURN_V_AS506.max_q_kpa, 34.3);
      assert.equal(SATURN_V_AS506.max_q_time_s, 83.0);
    });

    it("contains all 5 stages with flight-verified parameters", () => {
      assert.equal(SATURN_V_AS506.stages.length, 5);

      const [s1, s2, s3, csm, lm] = SATURN_V_AS506.stages;
      assert.equal(s1.stage, "S-IC");
      assert.equal(s1.dry_mass_kg, 130860);
      assert.equal(s1.propellant_mass_kg, 2077000);
      assert.equal(s1.thrust_kn, 33850);
      assert.equal(s1.isp_s, 263.0);

      assert.equal(s2.stage, "S-II");
      assert.equal(s2.dry_mass_kg, 39870);
      assert.equal(s2.propellant_mass_kg, 443200);
      assert.equal(s2.thrust_kn, 5115);
      assert.equal(s2.isp_s, 421.0);

      assert.equal(s3.stage, "S-IVB");
      assert.equal(s3.dry_mass_kg, 15116);
      assert.equal(s3.propellant_mass_kg, 106900);
      assert.equal(s3.thrust_kn, 1001);
      assert.equal(s3.isp_s, 421.0);

      assert.equal(csm.stage, "CSM-107");
      assert.equal(csm.dry_mass_kg, 10757);
      assert.equal(csm.propellant_mass_kg, 18044);
      assert.equal(csm.thrust_kn, 91.2);
      assert.equal(csm.isp_s, 314.5);

      assert.equal(lm.stage, "LM-5");
      assert.equal(lm.dry_mass_kg, 4287);
      assert.equal(lm.propellant_mass_kg, 10816);
      assert.equal(lm.thrust_kn, 43.9);
      assert.equal(lm.isp_s, 311.0);
    });
  });

  describe("API Fetch, Pressure Conversion & Caching", () => {
    it("converts surface pressure hPa / 10 -> kPa and marks source as api on successful fetch", async () => {
      const mockService = new LaunchDataService();
      const originalFetch = globalThis.fetch;

      // Mock live Open-Meteo response
      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            latitude: 28.5721,
            longitude: -80.648,
            current: {
              time: "2026-11-13T12:00:00Z",
              temperature_2m: 26.5,
              relative_humidity_2m: 65,
              surface_pressure: 1013.2, // in hPa
              wind_speed_10m: 14.2, // km/h
              wind_direction_10m: 95,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch;

      try {
        const weather = await mockService.getKscWeather();
        assert.equal(weather.source, "api");
        assert.equal(weather.temperature_c, 26.5);
        assert.equal(weather.pressure_kpa, 101.3); // 1013.2 / 10 -> 101.32 -> rounded to 101.3
        assert.equal(weather.wind_speed_kmh, 14.2);
        assert.equal(weather.wind_direction_deg, 95);
        assert.equal(weather.humidity_pct, 65);
        assert.equal(weather.status, "GO");

        // Verify 60s in-memory caching
        let fetchCount = 0;
        globalThis.fetch = (async () => {
          fetchCount++;
          return new Response("{}", { status: 500 });
        }) as typeof fetch;

        const cachedWeather = await mockService.getKscWeather();
        assert.equal(fetchCount, 0, "Expected in-memory cache to be used without calling fetch");
        assert.equal(cachedWeather.cached, true);
        assert.equal(cachedWeather.source, "api");
        assert.equal(cachedWeather.temperature_c, 26.5);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on network error (ENOTFOUND)", async () => {
      const mockService = new LaunchDataService();
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async () => {
        throw new TypeError("fetch failed: getaddrinfo ENOTFOUND api.open-meteo.com");
      }) as typeof fetch;

      try {
        const weather = await mockService.getKscWeather();
        assert.equal(weather.source, "offline_fallback");
        assert.equal(weather.temperature_c, 29.4);
        assert.equal(weather.pressure_kpa, 101.4);
        assert.equal(weather.status, "GO");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on timeout", async () => {
      const mockService = new LaunchDataService({ timeoutMs: 50 });
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async () => {
        const err = new Error("The operation was aborted");
        err.name = "TimeoutError";
        throw err;
      }) as typeof fetch;

      try {
        const weather = await mockService.getKscWeather();
        assert.equal(weather.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on HTTP 500 or malformed JSON", async () => {
      const mockService = new LaunchDataService();
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async () => {
        return new Response("Internal Server Error", { status: 500 });
      }) as typeof fetch;

      try {
        const weather = await mockService.getKscWeather();
        assert.equal(weather.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully when response schema is invalid", async () => {
      const mockService = new LaunchDataService();
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ unexpected: "structure" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch;

      try {
        const weather = await mockService.getKscWeather();
        assert.equal(weather.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("getLaunchTelemetry", () => {
    it("returns integrated launch telemetry package", async () => {
      const telemetry = await service.getLaunchTelemetry({ forceFallback: true });

      assert.equal(telemetry.mission_id, "AS-506");
      assert.equal(telemetry.target, "Tranquility Base");
      assert.equal(telemetry.site.name, "Kennedy Space Center LC-39A");
      assert.equal(telemetry.site.lat, 28.5721);
      assert.equal(telemetry.site.lon, -80.6480);
      assert.equal(telemetry.lunar_target.name, "Mare Tranquillitatis");
      assert.equal(telemetry.lunar_target.lat, 0.67408);
      assert.equal(telemetry.lunar_target.lon, 23.47297);
      assert.equal(telemetry.vehicle.name, "Saturn V AS-506");
      assert.equal(telemetry.vehicle.glom_kg, 2938315);
      assert.equal(telemetry.vehicle.stages.length, 5);
      assert.equal(telemetry.weather.status, "GO");
      assert.equal(telemetry.source, "offline_fallback");
    });
  });
});

describe("SimulationValidatorBridge", () => {
  let bridge: SimulationValidatorBridge;

  beforeEach(() => {
    bridge = new SimulationValidatorBridge();
  });

  describe("Nominal Apollo 11 Launch Configuration", () => {
    it("validates nominal AS-506 launch envelope with exact flight parameters", async () => {
      const res = await bridge.validateSimulation({});

      assert.equal(res.is_valid, true);
      assert.equal(res.glom_kg, 2938315);
      assert.equal(res.liftoff_twr, 1.174);
      assert.equal(res.max_q_kpa, 34.3);
      assert.equal(res.max_q_time_s, 83.0);
      assert.equal(res.payload_margin_kg, 2907); // 48,609 - 45,702 = 2,907 kg
      assert.ok(res.score && res.score > 400, "Expected composite score > 400");
      assert.equal(res.failure_reason, undefined);
    });
  });

  describe("Pad Structural Hold-Down GLOM Limit", () => {
    it("fails validation when GLOM exceeds 2,965,000 kg", async () => {
      const res = await bridge.validateSimulation({
        vehicle_mass: 800000,
        propellant_mass: 2150000,
        payload_mass: 45702, // Total GLOM = 2,995,702 kg > 2,965,000 kg
      });

      assert.equal(res.is_valid, false);
      assert.ok(
        res.failure_reason?.includes("GLOM_LIMIT_EXCEEDED"),
        `Expected GLOM_LIMIT_EXCEEDED, got: ${res.failure_reason}`,
      );
      assert.equal(res.score, 0);
    });
  });

  describe("Liftoff TWR Thresholds", () => {
    it("triggers critical abort when TWR < 1.02", async () => {
      const res = await bridge.validateSimulation({
        thrust_kn: 28000, // TWR ~ 0.971 < 1.02
      });

      assert.equal(res.is_valid, false);
      assert.ok(
        res.failure_reason?.includes("TWR_ABORT"),
        `Expected TWR_ABORT, got: ${res.failure_reason}`,
      );
      assert.ok(res.liftoff_twr < 1.02);
      assert.equal(res.score, 0);
    });

    it("generates warning when TWR is in warning band [1.02, 1.10)", async () => {
      const res = await bridge.validateSimulation({
        thrust_kn: 31000, // TWR ~ 1.076
      });

      assert.equal(res.is_valid, true);
      assert.ok(
        res.warnings?.some((w) => w.includes("TWR_LOW_WARNING")),
        "Expected TWR_LOW_WARNING in warnings",
      );
    });
  });

  describe("Max-Q Dynamic Pressure & Vehicle Structural Limits", () => {
    it("triggers structural breakup failure when Max-Q exceeds 45.0 kPa", async () => {
      const res = await bridge.validateSimulation({
        thrust_kn: 39000, // Increased TWR
        wind_speed_kmh: 110, // Severe wind
      });

      assert.equal(res.is_valid, false);
      assert.ok(
        res.failure_reason?.includes("MAX_Q_STRUCTURAL_FAILURE"),
        `Expected MAX_Q_STRUCTURAL_FAILURE, got: ${res.failure_reason}`,
      );
      assert.ok(res.max_q_kpa > 45.0);
      assert.equal(res.score, 0);
    });

    it("generates warning when Max-Q exceeds 38.0 kPa but is below 45.0 kPa", async () => {
      const res = await bridge.validateSimulation({
        thrust_kn: 34500,
        wind_speed_kmh: 45,
      });

      assert.equal(res.is_valid, true);
      assert.ok(
        res.warnings?.some((w) => w.includes("MAX_Q_WARNING")),
        "Expected MAX_Q_WARNING in warnings",
      );
    });
  });

  describe("Payload Capacity Limits", () => {
    it("fails validation when spacecraft mass exceeds booster capacity", async () => {
      const res = await bridge.validateSimulation({
        target_destination: "TLI",
        payload_mass: 55000, // Exceeds max TLI capacity 48,609 kg
      });

      assert.equal(res.is_valid, false);
      assert.ok(
        res.failure_reason?.includes("PAYLOAD_CAPACITY_EXCEEDED"),
        `Expected PAYLOAD_CAPACITY_EXCEEDED, got: ${res.failure_reason}`,
      );
      assert.ok(res.payload_margin_kg < 0);
      assert.equal(res.score, 0);
    });
  });

  describe("Multi-Stage Delta-V Budget", () => {
    it("fails validation when total delta-v is insufficient for target orbit", async () => {
      const res = await bridge.validateSimulation({
        stages: [
          {
            stage: "S-IC",
            dry_mass_kg: 130860,
            propellant_mass_kg: 2077000,
            thrust_kn: 33850,
            isp_s: 263.0,
          },
          {
            stage: "S-II",
            dry_mass_kg: 39870,
            propellant_mass_kg: 443200,
            thrust_kn: 5115,
            isp_s: 421.0,
          },
          {
            stage: "S-IVB",
            dry_mass_kg: 15116,
            propellant_mass_kg: 1000, // Severely insufficient S-IVB propellant
            thrust_kn: 1001,
            isp_s: 421.0,
          },
        ],
      });

      assert.equal(res.is_valid, false);
      assert.ok(
        res.failure_reason?.includes("INSUFFICIENT_DELTA_V"),
        `Expected INSUFFICIENT_DELTA_V, got: ${res.failure_reason}`,
      );
      assert.equal(res.score, 0);
    });
  });

  describe("Multi-Criteria Scoring Formula: Score = ws*S - wc*C - wr*R", () => {
    it("scales score with science return, cost, and risk", async () => {
      const nominal = await bridge.validateSimulation({});
      assert.ok(nominal.score && nominal.score > 0);

      const highRisk = await bridge.validateSimulation({
        wind_speed_kmh: 38, // High wind increases risk
      });

      assert.ok(
        (highRisk.score ?? 0) < (nominal.score ?? 0),
        "Expected higher risk to reduce score",
      );
    });
  });

  describe("runAuthoritativeSimulation", () => {
    it("returns valid SimulationResult matching shared schema on success", async () => {
      const simResult = await bridge.runAuthoritativeSimulation({});

      // Validate against shared-schema
      const parsed = SimulationResultSchema.parse(simResult);
      assert.equal(parsed.isSuccess, true);
      assert.ok(parsed.finalScore > 400);
      assert.equal(parsed.failureTrace.length, 0);
      assert.ok(parsed.resourceTimeSeries.altitude_km.length > 0);
      assert.ok(parsed.resourceTimeSeries.velocity_ms.length > 0);
    });

    it("returns failure trace on validation failure", async () => {
      const simResult = await bridge.runAuthoritativeSimulation({
        thrust_kn: 25000, // Critical abort
      });

      const parsed = SimulationResultSchema.parse(simResult);
      assert.equal(parsed.isSuccess, false);
      assert.equal(parsed.finalScore, 0);
      assert.equal(parsed.failureTrace.length, 1);
      assert.equal(parsed.failureTrace[0].subsystem, "Propulsion / S-IC Stage");
      assert.equal(parsed.failureTrace[0].anomaly, "TWR_BELOW_ABORT_THRESHOLD");
      assert.ok(parsed.failureTrace[0].consequence.includes("TWR_ABORT"));
    });
  });
});
