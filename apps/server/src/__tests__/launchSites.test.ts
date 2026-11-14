import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { createAppServer, type AppServer } from "../app.js";
import { loadConfig } from "../config.js";
import { MemoryRoomStore } from "../services/roomStore.js";
import { LAUNCH_SITES, LaunchSiteService, upcomingWindowTimes, weatherAt } from "../services/launchSiteService.js";

const silent = { info() {}, warn() {}, error() {} };
const config = loadConfig({ NODE_ENV: "test", JWT_SECRET: "integration-test-secret-launch-sites-1", SNAPSHOT_DEBOUNCE_MS: "20", ROOM_IDLE_TTL_MS: "50" });

/** Two hourly samples an hour apart, for interpolation checks. */
const hourly = (times: string[], wind: number[], gust: number[], code = [3, 3]) => ({
  hourly: {
    time: times,
    temperature_2m: [20, 22],
    relative_humidity_2m: [70, 80],
    wind_speed_10m: wind,
    wind_gusts_10m: gust,
    wind_direction_10m: [100, 120],
    precipitation: [0, 1],
    cloud_cover: [20, 40],
    weather_code: code,
  },
});

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("launch site weather", () => {
  it("interpolates between hourly samples and flags thunderstorms by WMO code", () => {
    const h = hourly(["2026-01-01T10:00", "2026-01-01T11:00"], [10, 20], [20, 40], [3, 95]).hourly;
    const w = weatherAt(h, new Date("2026-01-01T10:30:00Z"))!;
    assert.equal(w.wind_speed_kmh, 15);
    assert.equal(w.wind_gust_kmh, 30);
    assert.equal(w.temperature_c, 21);
    const later = weatherAt(h, new Date("2026-01-01T10:45:00Z"))!;
    assert.equal(later.weather_code, 95);
    assert.equal(later.thunderstorm, true);
  });

  it("offers the next whole hour at least 2 h ahead, then +24 h and +48 h", () => {
    const [a, b, c] = upcomingWindowTimes(new Date("2026-11-14T07:20:00Z"));
    assert.equal(a!.toISOString(), "2026-11-14T10:00:00.000Z");
    assert.equal(b!.toISOString(), "2026-11-15T10:00:00.000Z");
    assert.equal(c!.toISOString(), "2026-11-16T10:00:00.000Z");
  });

  it("Kennedy uses the ERA5 archive for Apollo 11's three July 1969 opportunities", async () => {
    let url = "";
    globalThis.fetch = (async (input: string | URL | Request) => {
      url = String(input);
      return new Response(JSON.stringify(hourly(["1969-07-16T13:00", "1969-07-16T14:00"], [9, 10], [16, 17])), { status: 200 });
    }) as typeof fetch;
    const data = (await new LaunchSiteService().getWindows("ksc-39a"))!;
    assert.match(url, /archive-api\.open-meteo\.com.*start_date=1969-07-16/);
    assert.equal(data.kind, "historical");
    assert.equal(data.source, "api");
    assert.deepEqual(data.windows.map((w) => w.opens_at.slice(0, 10)), ["1969-07-16", "1969-07-18", "1969-07-21"]);
    assert.ok(data.windows.every((w) => !("status" in w.weather)), "measurements only, no GO/NO-GO");
  });

  it("other pads use the live forecast at their own coordinates", async () => {
    let url = "";
    globalThis.fetch = (async (input: string | URL | Request) => {
      url = String(input);
      return new Response(JSON.stringify(hourly(["2026-11-14T00:00", "2026-11-17T00:00"], [12, 50], [20, 70])), { status: 200 });
    }) as typeof fetch;
    const svc = new LaunchSiteService({ now: () => new Date("2026-11-14T07:20:00Z") });
    const data = (await svc.getWindows("kourou-ela"))!;
    assert.match(url, /api\.open-meteo\.com\/v1\/forecast.*latitude=5\.239.*longitude=-52\.7684/);
    assert.equal(data.kind, "live");
    assert.deepEqual(data.windows.map((w) => w.delay_cost_m), [0, 60, 120]);
    assert.ok(data.windows[2]!.weather.wind_speed_kmh > data.windows[0]!.weather.wind_speed_kmh, "weather differs per window");
  });

  it("falls back offline, and keeps the last live answer when the upstream drops", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const off = (await new LaunchSiteService().getWindows("wenchang"))!;
    assert.equal(off.source, "offline_fallback");
    assert.equal(off.site.id, "wenchang");

    const svc = new LaunchSiteService({ liveTtlMs: 1, now: () => new Date("2026-11-14T07:20:00Z") });
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(hourly(["2026-11-14T00:00", "2026-11-17T00:00"], [12, 50], [20, 70])), { status: 200 })) as typeof fetch;
    const live = (await svc.getWindows("wenchang"))!;
    await new Promise((r) => setTimeout(r, 5));
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const stale = (await svc.getWindows("wenchang"))!;
    assert.equal(stale.source, "api");
    assert.equal(stale.cached, true);
    assert.deepEqual(stale.windows, live.windows);
  });

  it("unknown sites are null", async () => {
    assert.equal(await new LaunchSiteService().getWindows("cape-nowhere"), null);
  });
});

describe("launch routes", () => {
  let app: AppServer;
  let base: string;
  before(async () => {
    app = createAppServer({ config, store: new MemoryRoomStore(), log: silent });
    base = `http://127.0.0.1:${await app.listen(0)}`;
  });
  after(async () => app.shutdown());

  it("GET /api/launch/sites lists every pad", async () => {
    const json = await (await fetch(`${base}/api/launch/sites`)).json();
    assert.deepEqual(json.sites.map((s: { id: string }) => s.id), LAUNCH_SITES.map((s) => s.id));
  });

  it("GET /api/launch/sites/:id/windows (offline) and 404 for unknown pads", async () => {
    const json = await (await fetch(`${base}/api/launch/sites/ksc-39a/windows?force_fallback=true`)).json();
    assert.equal(json.windows.length, 3);
    assert.equal(json.source, "offline_fallback");
    assert.equal((await fetch(`${base}/api/launch/sites/nowhere/windows`)).status, 404);
  });

  it("POST /api/engine/launch/plan judges configuration and weather with the engine", async () => {
    const post = (body: unknown) =>
      fetch(`${base}/api/engine/launch/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    const good = await post({ vehicle_id: "saturn-v", payload_mass_kg: 43_904, propellant_load_pct: 100, wind_speed_kmh: 9 });
    assert.equal(good.is_go, true);
    assert.equal(good.source, "engine");
    const windy = await post({ vehicle_id: "saturn-v", payload_mass_kg: 43_904, wind_speed_kmh: 48, wind_gust_kmh: 63 });
    assert.equal(windy.failure_mode, "wind_shear");
    const short = await post({ vehicle_id: "saturn-v", payload_mass_kg: 43_904, propellant_load_pct: 85 });
    assert.equal(short.failure_mode, "propellant_depletion");
    const catalog = await (await fetch(`${base}/api/engine/launch/catalog`)).json();
    assert.deepEqual(catalog.vehicles.map((v: { id: string }) => v.id), ["saturn-ib", "saturn-v", "saturn-v-uprated"]);
  });
});
