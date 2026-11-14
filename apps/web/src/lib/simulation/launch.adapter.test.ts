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

describe("launch sites, windows and the engine's verdict", async () => {
  const { fetchLaunchSites, fetchLaunchWindows, launchSimulator } = await import("./launch.adapter");
  const { LAUNCH_SITES, OFFLINE_KSC_WINDOWS, WINDOWS } = await import("@/mocks/launch-options");
  const respond = (body: unknown, ok = true) => vi.fn(async (..._a: unknown[]) => ({ ok, json: async () => body }) as unknown as Response);
  const CONFIG = { vehicle: "saros", payload: "standard", fuelPct: 100, orbitKm: 185, window: "w1", site: "ksc-39a" } as const;

  it("lists the server's sites, or the offline copy", async () => {
    vi.stubGlobal("fetch", respond({ sites: [LAUNCH_SITES[1]] }));
    expect(await fetchLaunchSites("http://x")).toEqual([LAUNCH_SITES[1]]);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await fetchLaunchSites("http://x")).toBe(LAUNCH_SITES);
  });

  it("takes valid windows from the server and falls back to 1969 at the right site otherwise", async () => {
    const live = { ...OFFLINE_KSC_WINDOWS, site: LAUNCH_SITES[3], kind: "live", source: "api" };
    const f = respond(live);
    vi.stubGlobal("fetch", f);
    expect(await fetchLaunchWindows("kourou-ela", "http://x")).toEqual(live);
    expect(f).toHaveBeenCalledWith("http://x/api/launch/sites/kourou-ela/windows", expect.anything());

    vi.stubGlobal("fetch", respond({ ...live, windows: [{ id: "w9" }] }));
    const bad = await fetchLaunchWindows("kourou-ela", "http://x");
    expect(bad.source).toBe("offline_fallback");
    expect(bad.site.id).toBe("kourou-ela");
  });

  it("uses the server engine's verdict, and the browser engine when the server is down", async () => {
    vi.stubGlobal("fetch", respond({ is_go: false, failure_mode: "wind_shear", failure_time_s: 80, failure_reason: "server says wind" }));
    const r = await launchSimulator.simulate(CONFIG, WINDOWS[0]!);
    expect(r).toMatchObject({ isSuccess: false, weatherLoss: true, source: "server-engine", reason: "server says wind" });

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    const local = await launchSimulator.simulate(CONFIG, WINDOWS[0]!);
    expect(local).toMatchObject({ isSuccess: true, source: "browser-engine" });
  });
});
