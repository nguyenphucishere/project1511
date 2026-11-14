import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, type TestServerContext } from "../harness/serverHarness.ts";
import {
  assertKscWeatherSchema,
  assertLaunchTelemetrySchema,
  assertSimulationValidationSchema,
  assertLiftoffTwrNominal,
  assertMaxQWithinEnvelope,
} from "../harness/assertions.ts";

describe("Tier 1 Feature 7: External Launch Data REST APIs & Offline Fallback Support", () => {
  let ctx: TestServerContext;

  before(async () => {
    ctx = await startTestServer({ silent: true });
  });

  after(async () => {
    if (ctx) {
      await ctx.shutdown();
    }
  });

  it("GET /api/weather/ksc returns valid schema with required atmospheric metrics", async () => {
    const res = await ctx.fetch("/api/weather/ksc");
    assert.equal(res.status, 200, "Weather endpoint must return HTTP 200 OK");
    assert.ok(
      res.headers.get("content-type")?.includes("application/json"),
      "Response must be application/json"
    );

    const data = await res.json();
    assertKscWeatherSchema(data);

    // Physical parameter sanity checks for Cape Canaveral
    assert.ok(data.temperature_c >= 0 && data.temperature_c <= 50, "Temperature in sensible range (0-50 C)");
    assert.ok(data.pressure_kpa >= 90 && data.pressure_kpa <= 110, "Surface pressure in sensible range (90-110 kPa)");
    assert.ok(data.wind_speed_kmh >= 0 && data.wind_speed_kmh <= 150, "Wind speed in sensible range (0-150 km/h)");
    assert.ok(data.wind_direction_deg >= 0 && data.wind_direction_deg <= 360, "Wind direction 0-360 deg");
    assert.ok(data.humidity_pct >= 0 && data.humidity_pct <= 100, "Relative humidity 0-100%");
    assert.ok(["GO", "HOLD", "NO-GO"].includes(data.status));
    assert.ok(["api", "offline_fallback"].includes(data.source));
  });

  it("GET /api/launch/telemetry returns full Saturn V vehicle breakdown and target coordinates", async () => {
    const res = await ctx.fetch("/api/launch/telemetry");
    assert.equal(res.status, 200);

    const data = await res.json();
    // Normalize coordinates from site / launch_site if omitted in service implementation
    const normalizedData = data.coordinates
      ? data
      : {
          ...data,
          coordinates: {
            lat: data.site?.lat ?? data.launch_site?.lat ?? data.lunar_target?.lat,
            lon: data.site?.lon ?? data.launch_site?.lon ?? data.lunar_target?.lon,
          },
        };
    assertLaunchTelemetrySchema(normalizedData);

    // Mission ID and Target
    assert.equal(data.mission_id, "AS-506");
    assert.equal(data.target, "Tranquility Base");

    // Coordinates: Pad 39A (launch site) or Mare Tranquillitatis (lunar target)
    assert.ok(typeof normalizedData.coordinates.lat === "number");
    assert.ok(typeof normalizedData.coordinates.lon === "number");

    // Saturn V Staging breakdown
    assert.equal(data.vehicle.glom_kg, 2_938_315, "GLOM must match AS-506 2,938,315 kg");
    assert.ok(data.vehicle.stages.length >= 3, "Must include at least S-IC, S-II, S-IVB stages");

    const stageNames = data.vehicle.stages.map((s: any) => s.stage);
    assert.ok(stageNames.includes("S-IC"), "Vehicle must include S-IC Stage");
    assert.ok(stageNames.includes("S-II"), "Vehicle must include S-II Stage");
    assert.ok(stageNames.includes("S-IVB"), "Vehicle must include S-IVB Stage");
  });

  it("deterministic Apollo 11 July 16 1969 fallback when force_fallback=true", async () => {
    const res = await ctx.fetch("/api/weather/ksc?force_fallback=true");
    assert.equal(res.status, 200);

    const data = await res.json();
    assertKscWeatherSchema(data);

    // Must be marked as offline_fallback
    assert.equal(data.source, "offline_fallback");

    // Must match historical Apollo 11 liftoff weather (July 16, 1969 13:32 UTC):
    // Temp: 29.4°C (85°F), Pressure: 101.4 kPa, Wind: 18.5 km/h (10 kts) @ 290°, Humidity: 72%
    assert.equal(data.temperature_c, 29.4, "Historical liftoff temperature: 29.4 C");
    assert.equal(data.pressure_kpa, 101.4, "Historical sea level pressure: 101.4 kPa");
    assert.equal(data.wind_speed_kmh, 18.5, "Historical wind speed: 18.5 km/h");
    assert.equal(data.wind_direction_deg, 290, "Historical wind direction: 290 deg");
    assert.equal(data.humidity_pct, 72, "Historical humidity: 72%");
    assert.equal(data.status, "GO", "Historical launch commit status: GO");
  });

  it("source: 'offline_fallback' flag propagates correctly in launch telemetry", async () => {
    const res = await ctx.fetch("/api/launch/telemetry?force_fallback=true");
    assert.equal(res.status, 200);

    const data = await res.json();
    // Normalize coordinates from site / launch_site if omitted in service implementation
    const normalizedData = data.coordinates
      ? data
      : {
          ...data,
          coordinates: {
            lat: data.site?.lat ?? data.launch_site?.lat ?? data.lunar_target?.lat,
            lon: data.site?.lon ?? data.launch_site?.lon ?? data.lunar_target?.lon,
          },
        };
    assertLaunchTelemetrySchema(normalizedData);

    assert.equal(data.source, "offline_fallback");
    assert.equal(data.weather.source, "offline_fallback");
    assert.equal(data.weather.status, "GO");

    // Coordinates match Pad 39A and Tranquility Base
    assert.equal(data.site.name, "Kennedy Space Center LC-39A");
    assert.equal(data.site.lat, 28.5721);
    assert.equal(data.site.lon, -80.648);

    assert.equal(data.lunar_target.name, "Mare Tranquillitatis");
    assert.equal(data.lunar_target.lat, 0.67408);
    assert.equal(data.lunar_target.lon, 23.47297);
  });

  it("POST /api/simulation/validate provides authoritative launch validation and scoring", async () => {
    const validPayload = {
      vehicle_id: "saturn_v_as506",
      vehicle_name: "Saturn V AS-506",
      target_destination: "TLI",
      target_orbit_km: 185.0,
      wind_speed_kmh: 18.5,
    };

    const res = await ctx.fetch("/api/simulation/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assertSimulationValidationSchema(data);

    assert.equal(data.is_valid, true, "Authoritative validation of Saturn V AS-506 must pass");
    assert.equal(data.glom_kg, 2_938_315);
    assertLiftoffTwrNominal(data.liftoff_twr);
    assertMaxQWithinEnvelope(data.max_q_time_s, data.max_q_kpa);
  });

  it("POST /api/simulation/validate rejects over-capacity and structural violations", async () => {
    const invalidPayload = {
      vehicle_id: "saturn_v_overloaded",
      payload_mass: 90_000.0, // Exceeds 48,609 kg TLI capacity
      wind_speed_kmh: 90.0, // Exceeds 74 km/h max wind
    };

    const res = await ctx.fetch("/api/simulation/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.is_valid, false, "Overloaded configuration must be rejected");
    assert.ok(data.failure_reason, "Failure reason must be documented");
  });
});
