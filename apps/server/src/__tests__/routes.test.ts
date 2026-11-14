import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { MissionDesign } from "@space-sim/shared-schema";
import { createAppServer, type AppServer } from "../app.js";
import { loadConfig } from "../config.js";
import {
  LaunchDataService,
  LaunchWeatherSchema,
} from "../services/launchDataService.js";
import { MemoryRoomStore } from "../services/roomStore.js";
import { SimulationValidatorBridge } from "../validator/simBridge.js";

const silent = { info() {}, warn() {}, error() {} };

const config = loadConfig({
  NODE_ENV: "test",
  JWT_SECRET: "integration-test-secret-routes-123",
  SNAPSHOT_DEBOUNCE_MS: "20",
  ROOM_IDLE_TTL_MS: "50",
});

describe("Server REST Endpoints (Integration)", () => {
  let app: AppServer;
  let port: number;

  before(async () => {
    const store = new MemoryRoomStore();
    app = createAppServer({ config, store, log: silent });
    port = await app.listen(0);
  });

  after(async () => {
    await app.shutdown();
  });

  describe("GET /api/weather/ksc", () => {
    it("returns HTTP 200 with schema-valid launch weather", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/weather/ksc`);
      assert.equal(res.status, 200);

      const json = await res.json();
      const parsed = LaunchWeatherSchema.safeParse(json);
      assert.ok(parsed.success, `Schema validation failed: ${JSON.stringify(parsed)}`);

      const weather = parsed.data;
      assert.equal(typeof weather.temperature_c, "number");
      assert.equal(typeof weather.pressure_kpa, "number");
      assert.equal(typeof weather.wind_speed_kmh, "number");
      assert.equal(typeof weather.wind_direction_deg, "number");
      assert.equal(typeof weather.humidity_pct, "number");
      assert.ok(["GO", "HOLD", "NO-GO"].includes(weather.status));
      assert.ok(["api", "offline_fallback"].includes(weather.source));
    });

    it("serves Apollo 11 historical fallback when force_fallback=true", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/weather/ksc?force_fallback=true`);
      assert.equal(res.status, 200);

      const weather = (await res.json()) as {
        temperature_c: number;
        pressure_kpa: number;
        wind_speed_kmh: number;
        wind_direction_deg: number;
        humidity_pct: number;
        status: string;
        source: string;
      };

      assert.equal(weather.source, "offline_fallback");
      assert.equal(weather.status, "GO");
      assert.equal(weather.temperature_c, 29.4);
      assert.equal(weather.pressure_kpa, 101.4);
      assert.equal(weather.wind_speed_kmh, 18.5);
      assert.equal(weather.wind_direction_deg, 290);
      assert.equal(weather.humidity_pct, 72);
    });
  });

  describe("GET /api/launch/telemetry", () => {
    it("returns HTTP 200 with integrated AS-506 launch telemetry package", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/launch/telemetry?force_fallback=true`);
      assert.equal(res.status, 200);

      const telemetry = (await res.json()) as {
        mission_id: string;
        target: string;
        site: {
          name: string;
          lat: number;
          lon: number;
          elevation_m: number;
          azimuth_deg: number;
        };
        lunar_target: {
          name: string;
          lat: number;
          lon: number;
          elevation_m: number;
        };
        vehicle: {
          name: string;
          glom_kg: number;
          stages: Array<{
            stage: string;
            dry_mass_kg: number;
            propellant_mass_kg: number;
            thrust_kn: number;
            isp_s: number;
          }>;
        };
        weather: {
          status: string;
          source: string;
        };
        source: string;
      };

      assert.equal(telemetry.mission_id, "AS-506");
      assert.equal(telemetry.target, "Tranquility Base");

      // Pad 39A
      assert.equal(telemetry.site.name, "Kennedy Space Center LC-39A");
      assert.equal(telemetry.site.lat, 28.5721);
      assert.equal(telemetry.site.lon, -80.6480);
      assert.equal(telemetry.site.elevation_m, 3.0);
      assert.equal(telemetry.site.azimuth_deg, 72.058);

      // Mare Tranquillitatis
      assert.equal(telemetry.lunar_target.name, "Mare Tranquillitatis");
      assert.equal(telemetry.lunar_target.lat, 0.67408);
      assert.equal(telemetry.lunar_target.lon, 23.47297);
      assert.equal(telemetry.lunar_target.elevation_m, -2570);

      // Saturn V AS-506
      assert.equal(telemetry.vehicle.name, "Saturn V AS-506");
      assert.equal(telemetry.vehicle.glom_kg, 2938315);
      assert.equal(telemetry.vehicle.stages.length, 5);

      // Weather & provenance
      assert.equal(telemetry.weather.status, "GO");
      assert.equal(telemetry.source, "offline_fallback");
    });
  });

  describe("POST /api/simulation/validate", () => {
    it("returns HTTP 200 with is_valid true on nominal Apollo 11 request", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/simulation/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        is_valid: boolean;
        glom_kg: number;
        liftoff_twr: number;
        max_q_kpa: number;
        max_q_time_s: number;
        payload_margin_kg: number;
        score: number;
      };

      assert.equal(data.is_valid, true);
      assert.equal(data.glom_kg, 2938315);
      assert.equal(data.liftoff_twr, 1.174);
      assert.equal(data.max_q_kpa, 34.3);
      assert.equal(data.max_q_time_s, 83.0);
      assert.equal(data.payload_margin_kg, 2907);
      assert.ok(data.score > 400);
    });

    it("returns HTTP 200 with is_valid false on overweight vehicle", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/simulation/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicle_mass: 850000,
          propellant_mass: 2150000,
          payload_mass: 45702, // GLOM = 3,045,702 kg > 2,965,000 kg
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        is_valid: boolean;
        failure_reason: string;
        score: number;
      };

      assert.equal(data.is_valid, false);
      assert.ok(data.failure_reason.includes("GLOM_LIMIT_EXCEEDED"));
      assert.equal(data.score, 0);
    });

    it("returns HTTP 200 with is_valid false on critical TWR abort", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/simulation/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thrust_kn: 26000, // TWR ~ 0.90 < 1.02
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        is_valid: boolean;
        failure_reason: string;
        liftoff_twr: number;
        score: number;
      };

      assert.equal(data.is_valid, false);
      assert.ok(data.failure_reason.includes("TWR_ABORT"));
      assert.ok(data.liftoff_twr < 1.02);
      assert.equal(data.score, 0);
    });

    it("validates full MissionDesign payload correctly", async () => {
      const missionDesign: MissionDesign = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Apollo 11 Lunar Landing",
        objective: "Landed human mission to Mare Tranquillitatis",
        difficulty: "advanced",
        constraints: {
          maxBudgetMillions: 376,
          maxTotalMassKg: 2950000,
          minOperationalLifetimeDays: 8,
          minScientificReturnScore: 500,
        },
        orbitType: "hyperbolic_escape",
        keplerianElements: {
          semiMajorAxisKm: 185,
          eccentricity: 0.001,
          inclinationDeg: 32.52,
          raanDeg: 0,
          argPeriapsisDeg: 0,
          trueAnomalyDeg: 0,
        },
        launchVehicleId: "saturn-v-as506",
        bus: {
          id: "apollo-csm-lm",
          name: "Apollo Command & Lunar Module",
          structureMassKg: 15000,
          maxSlots: 10,
          installedComponents: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(`http://127.0.0.1:${port}/api/simulation/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(missionDesign),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        is_valid: boolean;
        score: number;
      };

      assert.equal(data.is_valid, true);
      assert.ok(data.score > 400);
    });
  });

  describe("Body Parser Limits & Error Handling", () => {
    it("returns HTTP 400 bad_request on malformed JSON body", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/simulation/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{malformed_json: missing_quotes",
      });

      assert.equal(res.status, 400);
      const json = (await res.json()) as { error: string };
      assert.equal(json.error, "bad_request");
    });

    it("accepts payloads up to 64kb limit", async () => {
      // 30kb payload with padding
      const padding = "x".repeat(30 * 1024);
      const res = await fetch(`http://127.0.0.1:${port}/api/simulation/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicle_id: "saturn-v", notes: padding }),
      });

      assert.equal(res.status, 200);
    });

    it("rejects payloads exceeding 64kb limit with 413 Payload Too Large", async () => {
      // 70kb payload exceeding 64kb limit
      const oversized = "x".repeat(70 * 1024);
      const res = await fetch(`http://127.0.0.1:${port}/api/simulation/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicle_id: "saturn-v", notes: oversized }),
      });

      assert.equal(res.status, 413);
      const json = (await res.json()) as { error: string };
      assert.equal(json.error, "bad_request");
    });
  });

  describe("Dependency Injection", () => {
    it("respects custom injected launchData and simBridge instances", async () => {
      const customStore = new MemoryRoomStore();
      const customLaunchData = new LaunchDataService();
      const customSimBridge = new SimulationValidatorBridge();

      const customApp = createAppServer({
        config,
        store: customStore,
        log: silent,
        launchData: customLaunchData,
        simBridge: customSimBridge,
      });

      assert.equal(customApp.launchData, customLaunchData);
      assert.equal(customApp.simBridge, customSimBridge);

      await customApp.shutdown();
    });
  });
});
