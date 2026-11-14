import { afterEach, describe, expect, it, vi } from "vitest";
import { OFFLINE_APOLLO11_TELEMETRY, fetchLaunchTelemetryFromServer, normalizeSite } from "./launch.adapter";

const FALLBACK = OFFLINE_APOLLO11_TELEMETRY.launch_site;

afterEach(() => vi.unstubAllGlobals());

describe("normalizeSite", () => {
  it("reads the server's lat/lon names", () => {
    const site = normalizeSite({ name: "LC-39A", lat: 28.5721, lon: -80.648, elevation_m: 3 }, FALLBACK);
    expect(site).toEqual({ name: "LC-39A", latitude_deg: 28.5721, longitude_deg: -80.648, elevation_m: 3 });
  });

  it("keeps latitude_deg/longitude_deg when they are already there", () => {
    const site = normalizeSite({ latitude_deg: 1.5, longitude_deg: 2.5 }, FALLBACK);
    expect(site.latitude_deg).toBe(1.5);
    expect(site.longitude_deg).toBe(2.5);
  });

  it("falls back field by field, never leaving a coordinate undefined", () => {
    for (const raw of [undefined, null, {}, "text", { lat: "28", lon: NaN }]) {
      const site = normalizeSite(raw, FALLBACK);
      expect(Number.isFinite(site.latitude_deg)).toBe(true);
      expect(Number.isFinite(site.longitude_deg)).toBe(true);
      expect(Number.isFinite(site.elevation_m)).toBe(true);
      expect(typeof site.name).toBe("string");
    }
    expect(normalizeSite({ lat: 10 }, FALLBACK)).toMatchObject({ latitude_deg: 10, longitude_deg: FALLBACK.longitude_deg });
  });
});

describe("fetchLaunchTelemetryFromServer", () => {
  it("accepts the real server payload (sites named lat/lon) and can be formatted by the panel", async () => {
    const payload = {
      mission_id: "AS-506",
      site: { name: "KSC LC-39A", lat: 28.5721, lon: -80.648, elevation_m: 3 },
      launch_site: { name: "KSC LC-39A", lat: 28.5721, lon: -80.648, elevation_m: 3 },
      lunar_target: { name: "Mare Tranquillitatis", lat: 0.67408, lon: 23.47297, elevation_m: -2570 },
      vehicle: { glom_kg: 2938315, liftoff_twr: 1.174, max_q_kpa: 34.3 },
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => payload })));
    const t = await fetchLaunchTelemetryFromServer("http://server.test");
    // The same calls the mission-control panel makes.
    expect(t.launch_site.latitude_deg.toFixed(4)).toBe("28.5721");
    expect(Math.abs(t.launch_site.longitude_deg).toFixed(4)).toBe("80.6480");
    expect(t.landing_site.latitude_deg).toBeCloseTo(0.67408, 5);
    expect(t.vehicle.liftoff_twr.toFixed(3)).toBe("1.174");
    expect(t.vehicle.max_q_kpa.toFixed(1)).toBe("34.3");
  });

  it("uses the offline archive when the server is unreachable or answers with an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await fetchLaunchTelemetryFromServer("http://server.test")).toBe(OFFLINE_APOLLO11_TELEMETRY);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await fetchLaunchTelemetryFromServer("http://server.test")).toBe(OFFLINE_APOLLO11_TELEMETRY);
  });
});
