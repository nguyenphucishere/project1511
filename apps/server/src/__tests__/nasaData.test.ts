import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createAppServer, type AppServer } from "../app.js";
import { loadConfig } from "../config.js";
import { MemoryRoomStore } from "../services/roomStore.js";
import {
  NasaHorizonsService,
  NasaDsnService,
  NasaSpaceWeatherService,
  NasaMdlService,
  EphemerisDataSchema,
  HorizonsEphemerisSchema,
  DsnStatusDataSchema,
  DsnStatusSchema,
  SpaceWeatherDataSchema,
  SpaceWeatherSchema,
  EasepDataSchema,
  EasepSpecSchema,
  LunarEnvironmentDataSchema,
  LunarEnvironmentSchema,
  HISTORICAL_APOLLO_11_EPHEMERIS,
  APOLLO_11_DE441_EPHEMERIS,
  HISTORICAL_APOLLO_11_DSN_STATUS,
  HISTORICAL_MSFN_DSN_STATUS,
  HISTORICAL_APOLLO_11_SPACE_WEATHER,
  HISTORICAL_DONKI_QUIET_SUN,
  HISTORICAL_APOLLO_11_EASEP,
  APOLLO_11_EASEP_SPEC,
  HISTORICAL_APOLLO_11_LUNAR_ENVIRONMENT,
  MARE_TRANQUILLITATIS_LUNAR_ENV,
} from "../services/nasa/index.js";

const silent = { info() {}, warn() {}, error() {} };

const config = loadConfig({
  NODE_ENV: "test",
  JWT_SECRET: "integration-test-secret-nasa-routes-123",
  SNAPSHOT_DEBOUNCE_MS: "20",
  ROOM_IDLE_TTL_MS: "50",
});

// Mock Payloads
const MOCK_HORIZONS_RESPONSE = {
  signature: { source: "NASA/JPL Horizons API", version: "1.2" },
  result: `
*******************************************************************************
 Revised: May 31, 2023             Moon / (Earth)                           301
*******************************************************************************
$$SOE
2440419.063888889 = A.D. 1969-Jul-16 13:32:00.0000 TDB 
 X =-2.892936365319985E+05 Y = 2.810455848529285E+05 Z = 2.168381042733979E+04
 VX=-6.654000000000000E-01 VY=-7.110000000000000E-01 VZ=-6.990000000000000E-02
 LT= 1.347316644265492E+00 RG= 4.039153578761266E+05 RR= 3.840000000000000E-02
$$EOE
*******************************************************************************
`,
};

const MOCK_DSN_XML = `
<dsn>
  <station name="cdscc" friendlyName="Canberra" timeUTC="1715688000000" timeZoneOffset="36000000">
    <dish name="DSS-44" azimuthAngle="142.50" elevationAngle="48.20" windSpeed="12.0">
      <downSignal active="true" signalType="data" dataRate="51200" frequency="2287500000" power="-118.5"/>
      <upSignal active="true" signalType="carrier" frequency="2101800000" power="20000"/>
      <target name="APOLLO11" roundTripLightTime="2.56"/>
    </dish>
  </station>
  <station name="gdscc" friendlyName="Goldstone" timeUTC="1715688000000" timeZoneOffset="-25200000">
    <dish name="DSS-14" azimuthAngle="210.00" elevationAngle="35.00" windSpeed="15.0">
      <downSignal active="true" signalType="carrier" frequency="2287500000" power="-122.0" dataRate="51200"/>
      <target name="APOLLO11" roundTripLightTime="2.56"/>
    </dish>
  </station>
  <station name="mdscc" friendlyName="Madrid" timeUTC="1715688000000" timeZoneOffset="7200000">
    <dish name="DSS-61" azimuthAngle="0.00" elevationAngle="0.00" windSpeed="5.0"/>
  </station>
</dsn>
`;

const MOCK_DONKI_QUIET: unknown[] = [];

const MOCK_DONKI_STORM = [
  {
    messageType: "FLR",
    messageID: "2024-05-10T12:00:00-FLR-001",
    messageIssueTime: "2024-05-10T12:05:00Z",
    messageBody: "Solar Flare X5.8 detected from Active Region 3664",
  },
  {
    messageType: "SEP",
    messageID: "2024-05-10T14:00:00-SEP-001",
    messageIssueTime: "2024-05-10T14:10:00Z",
    messageBody: "Solar Energetic Particle event exceeds 10 MeV 100 pfu threshold",
  },
  {
    messageType: "GST",
    messageID: "2024-05-10T16:00:00-GST-001",
    messageIssueTime: "2024-05-10T16:15:00Z",
    messageBody: "Severe Geomagnetic Storm Kp=8.3 observed",
  },
];

const MOCK_DONKI_WATCH = [
  {
    messageType: "FLR",
    messageID: "2024-05-11T08:00:00-FLR-002",
    messageIssueTime: "2024-05-11T08:05:00Z",
    messageBody: "Solar Flare M3.2 observed",
  },
  {
    messageType: "CME",
    messageID: "2024-05-11T09:00:00-CME-001",
    messageIssueTime: "2024-05-11T09:10:00Z",
    messageBody: "Partial halo CME detected with speed 650 km/s",
  },
];

describe("NASA Data Services & Resilience (Milestone 1)", () => {
  // ========================================================
  // Block 1: NasaHorizonsService Unit Tests
  // ========================================================
  describe("NasaHorizonsService", () => {
    let service: NasaHorizonsService;

    beforeEach(() => {
      service = new NasaHorizonsService();
      service.clearCache();
    });

    it("parses live mock Horizons response and extracts state vectors", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(MOCK_HORIZONS_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      try {
        const ephem = await service.getEphemeris({ epoch: "1969-07-16" });
        assert.equal(ephem.source, "api");
        assert.equal(ephem.target_body, "Moon (301)");
        assert.equal(ephem.center_body, "Earth Center (500@399)");
        assert.ok(Math.abs(ephem.distance_km - 403915.357) < 1.0);
        assert.ok(Math.abs(ephem.one_way_light_time_s - 1.3473) < 0.001);
        assert.equal(ephem.state_vector_eci_km.x, -289293.6365319985);
        assert.equal(ephem.state_vector_eci_km.vx, -0.6654);

        const parsed = HorizonsEphemerisSchema.safeParse(ephem);
        assert.ok(parsed.success, "Payload must satisfy HorizonsEphemerisSchema");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("serves cached ephemeris within TTL without repeating network calls", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        callCount++;
        return new Response(JSON.stringify(MOCK_HORIZONS_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      try {
        const first = await service.getEphemeris({ epoch: "1969-07-16" });
        assert.equal(callCount, 1);
        assert.equal(first.source, "api");

        // Second call should hit in-memory cache
        const second = await service.getEphemeris({ epoch: "1969-07-16" });
        assert.equal(callCount, 1, "Must not fetch when cache is valid");
        assert.equal(second.cached, true);
        assert.equal(second.distance_km, first.distance_km);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("evicts expired cache when TTL expires", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        callCount++;
        return new Response(JSON.stringify(MOCK_HORIZONS_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      try {
        const shortTtlService = new NasaHorizonsService({ cacheTtlMs: 20 });
        await shortTtlService.getEphemeris({ epoch: "1969-07-16" });
        assert.equal(callCount, 1);

        await new Promise((r) => setTimeout(r, 30));
        await shortTtlService.getEphemeris({ epoch: "1969-07-16" });
        assert.equal(callCount, 2, "Must re-fetch after cache expiration");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("serves immutable historical Apollo 11 fallback when forceFallback is true", async () => {
      const ephem = await service.getEphemeris({ forceFallback: true });
      assert.equal(ephem.source, "offline_fallback");
      assert.equal(ephem.distance_km, HISTORICAL_APOLLO_11_EPHEMERIS.distance_km);
      assert.equal(ephem.one_way_light_time_s, HISTORICAL_APOLLO_11_EPHEMERIS.one_way_light_time_s);
      assert.deepEqual(ephem.state_vector_eci_km, HISTORICAL_APOLLO_11_EPHEMERIS.state_vector_eci_km);
      assert.ok(HorizonsEphemerisSchema.safeParse(ephem).success);
    });

    it("falls back gracefully without throwing when network request aborts or times out", async () => {
      const timeoutService = new NasaHorizonsService({ timeoutMs: 20 });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        const err = new Error("The operation was aborted");
        err.name = "TimeoutError";
        throw err;
      }) as typeof fetch;

      try {
        const ephem = await timeoutService.getEphemeris();
        assert.equal(ephem.source, "offline_fallback");
        assert.equal(ephem.distance_km, APOLLO_11_DE441_EPHEMERIS.distance_km);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on network errors (ENOTFOUND, ECONNREFUSED)", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        throw new TypeError("fetch failed: getaddrinfo ENOTFOUND ssd.jpl.nasa.gov");
      }) as typeof fetch;

      try {
        const ephem = await service.getEphemeris();
        assert.equal(ephem.source, "offline_fallback");
        assert.equal(ephem.distance_km, HISTORICAL_APOLLO_11_EPHEMERIS.distance_km);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on HTTP 500 or HTTP 429 status codes", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response("Internal Server Error", { status: 500 });
      }) as typeof fetch;

      try {
        const ephem = await service.getEphemeris();
        assert.equal(ephem.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on malformed response missing delimiters or invalid format", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ result: "No matches found for target." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      try {
        const ephem = await service.getEphemeris();
        assert.equal(ephem.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ========================================================
  // Block 2: NasaDsnService Unit Tests
  // ========================================================
  describe("NasaDsnService", () => {
    let service: NasaDsnService;

    beforeEach(() => {
      service = new NasaDsnService();
      service.clearCache();
    });

    it("parses mock DSN Now XML feed accurately", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(MOCK_DSN_XML, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        });
      }) as typeof fetch;

      try {
        const dsn = await service.getDsnStatus();
        assert.equal(dsn.source, "api");
        assert.ok(dsn.active_station.includes("DSS-44") || dsn.active_station.includes("Canberra"));
        assert.ok(dsn.complexes.length >= 3);

        const canberra = dsn.complexes.find((c) => c.dish === "DSS-44");
        assert.ok(canberra);
        assert.equal(canberra.azimuth_deg, 142.5);
        assert.equal(canberra.elevation_deg, 48.2);

        assert.equal(dsn.rtlt_seconds, 2.56);
        assert.equal(dsn.carrier_lock, true);
        assert.equal(dsn.telemetry_lock, true);
        assert.equal(dsn.uplink_frequency_mhz, 2101.8);
        assert.equal(dsn.downlink_frequency_mhz, 2287.5);
        assert.equal(dsn.bitrate_kbps, 51.2);
        assert.equal(dsn.signal_strength_dbm, -118.5);
        assert.equal(dsn.is_lunar_occultation, false);

        assert.ok(DsnStatusSchema.safeParse(dsn).success);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("serves cached DSN status within 15s TTL", async () => {
      let fetchCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        fetchCount++;
        return new Response(MOCK_DSN_XML, { status: 200 });
      }) as typeof fetch;

      try {
        const first = await service.getDsnStatus();
        assert.equal(fetchCount, 1);
        assert.equal(first.source, "api");

        const second = await service.getDsnStatus();
        assert.equal(fetchCount, 1, "Must not fetch when cache is valid");
        assert.equal(second.cached, true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("serves immutable historical MSFN fallback on forceFallback", async () => {
      const dsn = await service.getDsnStatus({ forceFallback: true });
      assert.equal(dsn.source, "offline_fallback");
      assert.equal(dsn.active_station, HISTORICAL_APOLLO_11_DSN_STATUS.active_station);
      assert.equal(dsn.rtlt_seconds, 2.56);
      assert.equal(dsn.uplink_frequency_mhz, 2106.4);
      assert.equal(dsn.downlink_frequency_mhz, 2287.5);
      assert.equal(dsn.bitrate_kbps, 51.2);
      assert.equal(dsn.carrier_lock, true);
      assert.ok(DsnStatusDataSchema.safeParse(dsn).success);
    });

    it("falls back gracefully on timeout abort", async () => {
      const timeoutService = new NasaDsnService({ timeoutMs: 20 });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        const err = new Error("The operation was aborted");
        err.name = "TimeoutError";
        throw err;
      }) as typeof fetch;

      try {
        const dsn = await timeoutService.getDsnStatus();
        assert.equal(dsn.source, "offline_fallback");
        assert.equal(dsn.active_station, HISTORICAL_MSFN_DSN_STATUS.active_station);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on network error (ENOTFOUND, ECONNREFUSED)", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        throw new TypeError("fetch failed: getaddrinfo ENOTFOUND eyes.nasa.gov");
      }) as typeof fetch;

      try {
        const dsn = await service.getDsnStatus();
        assert.equal(dsn.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles XML with empty attributes and malformed structure safely", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        const emptyAttrXml = `
<dsn>
  <station name="cdscc" friendlyName="Canberra">
    <dish name="DSS-44" azimuthAngle="" elevationAngle="" windSpeed="">
      <downSignal active="true" power=""/>
    </dish>
  </station>
</dsn>
`;
        return new Response(emptyAttrXml, { status: 200 });
      }) as typeof fetch;

      try {
        const dsn = await service.getDsnStatus();
        assert.equal(dsn.source, "api");
        assert.equal(dsn.complexes[0].azimuth_deg, 0);
        assert.equal(dsn.complexes[0].elevation_deg, 0);
        assert.ok(DsnStatusSchema.safeParse(dsn).success);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ========================================================
  // Block 3: NasaSpaceWeatherService Unit Tests
  // ========================================================
  describe("NasaSpaceWeatherService", () => {
    let service: NasaSpaceWeatherService;

    beforeEach(() => {
      service = new NasaSpaceWeatherService();
      service.clearCache();
    });

    it("classifies quiet period as NOMINAL_QUIET", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(MOCK_DONKI_QUIET), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      try {
        const sw = await service.getSpaceWeather();
        assert.equal(sw.source, "api");
        assert.equal(sw.mission_risk_status, "NOMINAL_QUIET");
        assert.equal(sw.cme_alert, false);
        assert.equal(sw.solar_proton_event_alert, false);
        assert.ok(SpaceWeatherSchema.safeParse(sw).success);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("classifies SEP event as SEVERE_ALERT with elevated dose rate", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(MOCK_DONKI_STORM), { status: 200 });
      }) as typeof fetch;

      try {
        const sw = await service.getSpaceWeather();
        assert.equal(sw.source, "api");
        assert.equal(sw.mission_risk_status, "SEVERE_ALERT");
        assert.equal(sw.solar_proton_event_alert, true);
        assert.ok(sw.radiation_dose_rate_mrad_per_hour > 5.0);
        assert.ok(sw.geomagnetic_kp_index >= 7.0);
        assert.ok(SpaceWeatherDataSchema.safeParse(sw).success);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("classifies CME event as ELEVATED_WATCH", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify(MOCK_DONKI_WATCH), { status: 200 });
      }) as typeof fetch;

      try {
        const sw = await service.getSpaceWeather();
        assert.equal(sw.source, "api");
        assert.equal(sw.mission_risk_status, "ELEVATED_WATCH");
        assert.equal(sw.cme_alert, true);
        assert.equal(sw.solar_proton_event_alert, false);
        assert.ok(SpaceWeatherDataSchema.safeParse(sw).success);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("serves cached space weather within 300s TTL", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        callCount++;
        return new Response(JSON.stringify(MOCK_DONKI_QUIET), { status: 200 });
      }) as typeof fetch;

      try {
        const first = await service.getSpaceWeather();
        assert.equal(callCount, 1);
        assert.equal(first.source, "api");

        const second = await service.getSpaceWeather();
        assert.equal(callCount, 1, "Must hit cache");
        assert.equal(second.cached, true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("serves historical Apollo 11 quiet Sun fallback on forceFallback", async () => {
      const sw = await service.getSpaceWeather({ forceFallback: true });
      assert.equal(sw.source, "offline_fallback");
      assert.equal(sw.solar_cycle, 20);
      assert.equal(sw.solar_flux_f107, 152.0);
      assert.equal(sw.geomagnetic_kp_index, 1.7);
      assert.equal(sw.radiation_dose_rate_mrad_per_hour, 0.92);
      assert.equal(sw.mission_risk_status, "NOMINAL_QUIET");
      assert.deepEqual(sw, HISTORICAL_DONKI_QUIET_SUN);
      assert.ok(SpaceWeatherSchema.safeParse(sw).success);
    });

    it("falls back gracefully on timeout abort", async () => {
      const timeoutService = new NasaSpaceWeatherService({ timeoutMs: 20 });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        const err = new Error("The operation was aborted");
        err.name = "TimeoutError";
        throw err;
      }) as typeof fetch;

      try {
        const sw = await timeoutService.getSpaceWeather();
        assert.equal(sw.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on network errors and HTTP 429 rate limits", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response("Too Many Requests", { status: 429 });
      }) as typeof fetch;

      try {
        const sw = await service.getSpaceWeather();
        assert.equal(sw.source, "offline_fallback");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ========================================================
  // Block 4: NasaMdlService Unit Tests
  // ========================================================
  describe("NasaMdlService", () => {
    let service: NasaMdlService;

    beforeEach(() => {
      service = new NasaMdlService();
    });

    it("serves authentic EASEP specifications (PSEP, LRRR, SWC)", () => {
      const easep = service.getEasepData();
      assert.ok(easep.package_name.includes("Early Apollo"));
      assert.ok(typeof easep.total_mass_kg === "number" && easep.total_mass_kg > 40);
      assert.equal(easep.experiments.length, 3);
      assert.equal(easep.source, "offline_fallback");

      const psep = easep.experiments.find((e) => e.id === "PSEP");
      assert.ok(psep);
      assert.ok(psep.mass_kg >= 45.0);
      assert.ok(psep.power_draw_watts >= 30.0);
      assert.ok(psep.operating_lifetime_days >= 20.0);
      assert.ok(psep.description.toLowerCase().includes("seismic"));

      const lrrr = easep.experiments.find((e) => e.id === "LRRR");
      assert.ok(lrrr);
      assert.ok(lrrr.mass_kg >= 20.0);
      assert.equal(lrrr.power_draw_watts, 0.0);
      assert.ok(lrrr.operating_lifetime_days > 10000);
      assert.ok(lrrr.description.toLowerCase().includes("laser ranging"));

      const swc = easep.experiments.find((e) => e.id === "SWC");
      assert.ok(swc);
      assert.ok(swc.mass_kg < 1.0);
      assert.equal(swc.power_draw_watts, 0.0);
      assert.ok(swc.description.toLowerCase().includes("solar wind"));

      assert.equal(easep.deployment_site.latitude_deg, 0.67408);
      assert.equal(easep.deployment_site.longitude_deg, 23.47297);
      assert.ok(easep.deployment_site.distance_from_lm_m > 10);

      assert.ok(EasepSpecSchema.safeParse(easep).success);
    });

    it("supports getEasepSpec() alias method", () => {
      const easep = service.getEasepSpec();
      assert.equal(easep.package_name, APOLLO_11_EASEP_SPEC.package_name);
      assert.ok(EasepDataSchema.safeParse(easep).success);
    });

    it("serves authentic lunar surface environment constants including +280 mGal mascon", () => {
      const env = service.getLunarEnvironment();
      assert.equal(env.standard_gravity_mps2, 1.622);
      assert.equal(env.mascon_anomaly_mps2, 0.0028);
      assert.equal(env.local_gravity_effective_mps2, 1.6248);
      assert.equal(env.terrain_slope_deg, 4.5);
      assert.equal(env.regolith_bulk_density_kg_m3, 1500.0);
      assert.equal(env.regolith_bearing_capacity_kpa, 35.0);
      assert.equal(env.surface_temperature_c, 85.0);
      assert.equal(env.source, "offline_fallback");

      assert.ok(LunarEnvironmentSchema.safeParse(env).success);
      assert.deepEqual(env, MARE_TRANQUILLITATIS_LUNAR_ENV);
    });
  });

  // ========================================================
  // Block 5: Express REST Route Integration Tests (All 5 Endpoints)
  // ========================================================
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

    describe("GET /api/nasa/ephemeris", () => {
      it("returns HTTP 200 with schema-valid ephemeris payload", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/ephemeris`);
        assert.equal(res.status, 200);

        const json = await res.json();
        const parsed = EphemerisDataSchema.safeParse(json);
        assert.ok(parsed.success, `Ephemeris schema invalid: ${JSON.stringify(parsed)}`);

        assert.ok(["api", "offline_fallback"].includes(parsed.data.source));
        assert.ok(parsed.data.distance_km > 350000 && parsed.data.distance_km < 420000);
        assert.equal(typeof parsed.data.state_vector_eci_km.x, "number");
        assert.equal(typeof parsed.data.state_vector_eci_km.y, "number");
        assert.equal(typeof parsed.data.state_vector_eci_km.z, "number");
      });

      it("returns historical Apollo 11 fallback with ?force_fallback=true", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/ephemeris?force_fallback=true`);
        assert.equal(res.status, 200);

        const json = (await res.json()) as typeof HISTORICAL_APOLLO_11_EPHEMERIS;
        assert.equal(json.source, "offline_fallback");
        assert.equal(json.distance_km, HISTORICAL_APOLLO_11_EPHEMERIS.distance_km);
      });

      it("returns historical Apollo 11 fallback with ?fallback=true synonym", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/ephemeris?fallback=true`);
        assert.equal(res.status, 200);

        const json = (await res.json()) as typeof HISTORICAL_APOLLO_11_EPHEMERIS;
        assert.equal(json.source, "offline_fallback");
      });

      it("accepts custom target and epoch parameters", async () => {
        const res = await fetch(
          `http://127.0.0.1:${port}/api/nasa/ephemeris?epoch=1969-07-20&target=301&force_fallback=true`
        );
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.ok(EphemerisDataSchema.safeParse(json).success);
      });
    });

    describe("GET /api/nasa/dsn/status", () => {
      it("returns HTTP 200 with schema-valid DSN status payload", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/dsn/status`);
        assert.equal(res.status, 200);

        const json = await res.json();
        const parsed = DsnStatusDataSchema.safeParse(json);
        assert.ok(parsed.success, `DSN schema invalid: ${JSON.stringify(parsed)}`);

        assert.ok(["api", "offline_fallback"].includes(parsed.data.source));
        assert.equal(typeof parsed.data.active_station, "string");
        assert.ok(Array.isArray(parsed.data.complexes) && parsed.data.complexes.length > 0);
        assert.ok(parsed.data.rtlt_seconds > 2.0);
        assert.equal(typeof parsed.data.carrier_lock, "boolean");
        assert.equal(typeof parsed.data.telemetry_lock, "boolean");
      });

      it("returns historical Apollo 11 MSFN fallback with ?force_fallback=true", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/dsn/status?force_fallback=true`);
        assert.equal(res.status, 200);

        const json = (await res.json()) as typeof HISTORICAL_APOLLO_11_DSN_STATUS;
        assert.equal(json.source, "offline_fallback");
        assert.equal(json.active_station, HISTORICAL_APOLLO_11_DSN_STATUS.active_station);
        assert.equal(json.rtlt_seconds, 2.56);
      });
    });

    describe("GET /api/nasa/space-weather", () => {
      it("returns HTTP 200 with schema-valid space weather payload", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/space-weather`);
        assert.equal(res.status, 200);

        const json = await res.json();
        const parsed = SpaceWeatherDataSchema.safeParse(json);
        assert.ok(parsed.success, `Space weather schema invalid: ${JSON.stringify(parsed)}`);

        assert.ok(["api", "offline_fallback"].includes(parsed.data.source));
        assert.equal(typeof parsed.data.solar_cycle, "number");
        assert.equal(typeof parsed.data.solar_flux_f107, "number");
        assert.equal(typeof parsed.data.geomagnetic_kp_index, "number");
        assert.ok(
          ["NOMINAL_QUIET", "ELEVATED_WATCH", "SEVERE_ALERT"].includes(
            parsed.data.mission_risk_status
          )
        );
      });

      it("returns historical Apollo 11 quiet Sun fallback with ?force_fallback=true", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/space-weather?force_fallback=true`);
        assert.equal(res.status, 200);

        const json = (await res.json()) as typeof HISTORICAL_APOLLO_11_SPACE_WEATHER;
        assert.equal(json.source, "offline_fallback");
        assert.equal(json.mission_risk_status, "NOMINAL_QUIET");
        assert.equal(json.solar_cycle, 20);
      });
    });

    describe("GET /api/nasa/mission-design/easep", () => {
      it("returns HTTP 200 with EASEP experiment package specification", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/mission-design/easep`);
        assert.equal(res.status, 200);

        const json = await res.json();
        const parsed = EasepDataSchema.safeParse(json);
        assert.ok(parsed.success, `EASEP schema invalid: ${JSON.stringify(parsed)}`);

        assert.equal(parsed.data.source, "offline_fallback");
        assert.equal(parsed.data.experiments.length, 3);
        const expIds = parsed.data.experiments.map((e) => e.id).sort();
        assert.deepEqual(expIds, ["LRRR", "PSEP", "SWC"]);
        assert.equal(parsed.data.deployment_site.latitude_deg, 0.67408);
      });
    });

    describe("GET /api/nasa/lunar-environment", () => {
      it("returns HTTP 200 with lunar gravity and mascon environment parameters", async () => {
        const res = await fetch(`http://127.0.0.1:${port}/api/nasa/lunar-environment`);
        assert.equal(res.status, 200);

        const json = await res.json();
        const parsed = LunarEnvironmentDataSchema.safeParse(json);
        assert.ok(parsed.success, `Lunar env schema invalid: ${JSON.stringify(parsed)}`);

        assert.equal(parsed.data.source, "offline_fallback");
        assert.equal(parsed.data.standard_gravity_mps2, 1.622);
        assert.equal(parsed.data.mascon_anomaly_mps2, 0.0028);
        assert.equal(parsed.data.local_gravity_effective_mps2, 1.6248);
        assert.equal(parsed.data.regolith_bulk_density_kg_m3, 1500.0);
      });
    });
  });

  // ========================================================
  // Block 6: Resiliency, Inflight Stampede, and Dependency Injection Tests
  // ========================================================
  describe("Resiliency, Stampede & Dependency Injection", () => {
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

    it("handles concurrent inflight request stampede reliably", async () => {
      const requests = Array.from({ length: 10 }, () =>
        fetch(`http://127.0.0.1:${port}/api/nasa/ephemeris?force_fallback=true`)
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.equal(json.source, "offline_fallback");
      }
    });

    it("verifies dependency injection for custom NASA services in createAppServer", async () => {
      const customHorizons = new NasaHorizonsService({ timeoutMs: 500 });
      const customDsn = new NasaDsnService({ timeoutMs: 500 });
      const customSpaceWeather = new NasaSpaceWeatherService({ timeoutMs: 500 });
      const customMdl = new NasaMdlService();

      const store = new MemoryRoomStore();
      const customApp = createAppServer({
        config,
        store,
        log: silent,
        nasaHorizons: customHorizons,
        nasaDsn: customDsn,
        nasaSpaceWeather: customSpaceWeather,
        nasaMdl: customMdl,
      });

      assert.equal(customApp.nasaHorizons, customHorizons);
      assert.equal(customApp.nasaDsn, customDsn);
      assert.equal(customApp.nasaSpaceWeather, customSpaceWeather);
      assert.equal(customApp.nasaMdl, customMdl);

      const customPort = await customApp.listen(0);
      const res = await fetch(`http://127.0.0.1:${customPort}/api/nasa/lunar-environment`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.mascon_anomaly_mps2, 0.0028);

      await customApp.shutdown();
    });
  });
});
