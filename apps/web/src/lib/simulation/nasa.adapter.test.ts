import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchNasaDsnStatus,
  fetchNasaMissionData,
  fetchNasaSpaceWeather,
  OFFLINE_DSN_STATUS,
  OFFLINE_NASA_DATA,
  OFFLINE_SPACE_WEATHER,
} from "./nasa.adapter";

const respond = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

afterEach(() => vi.unstubAllGlobals());

describe("NASA adapter", () => {
  it("returns the Apollo 11 baseline when the server is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await fetchNasaMissionData("http://x")).toEqual(OFFLINE_NASA_DATA);
  });

  it("falls back on non-2xx and on non-object bodies", async () => {
    vi.stubGlobal("fetch", respond({ rtlt_seconds: 9 }, false));
    expect(await fetchNasaDsnStatus("http://x")).toEqual(OFFLINE_DSN_STATUS);
    vi.stubGlobal("fetch", respond([1, 2, 3]));
    expect(await fetchNasaDsnStatus("http://x")).toEqual(OFFLINE_DSN_STATUS);
  });

  it("merges a partial live response over the baseline and hits the right route", async () => {
    const f = respond({ mission_risk_status: "SEVERE_ALERT", cme_alert: true, source: "api" });
    vi.stubGlobal("fetch", f);
    const sw = await fetchNasaSpaceWeather("http://host:4000/");
    expect(f).toHaveBeenCalledWith("http://host:4000/api/nasa/space-weather", expect.anything());
    expect(sw.mission_risk_status).toBe("SEVERE_ALERT");
    expect(sw.cme_alert).toBe(true);
    expect(sw.solar_cycle).toBe(OFFLINE_SPACE_WEATHER.solar_cycle);
  });
});
