import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDsnLink, fetchEngineApollo11, fetchEngineStatus, postEngine, serverFirstBudget } from "./engine.adapter";
import { APOLLO_11_DESIGN_BASELINE, missionDesignBudget } from "./nasa.physics";

const respond = (body: unknown, ok = true) =>
  vi.fn(async (..._args: unknown[]) => ({ ok, json: async () => body }) as unknown as Response);

afterEach(() => vi.unstubAllGlobals());

describe("server engine adapter", () => {
  it("hits the engine routes and returns their JSON", async () => {
    const f = respond({ loaded: true, version: "sim-wasm v1.0.0", calculations: ["validate_launch"] });
    vi.stubGlobal("fetch", f);
    expect((await fetchEngineStatus("http://h:4000/"))?.loaded).toBe(true);
    expect(f).toHaveBeenCalledWith("http://h:4000/api/engine/status", expect.anything());

    await fetchEngineApollo11("http://h:4000");
    expect(f).toHaveBeenLastCalledWith("http://h:4000/api/engine/apollo11", expect.anything());
    await fetchDsnLink("http://h:4000");
    expect(f).toHaveBeenLastCalledWith("http://h:4000/api/nasa/dsn/link", expect.anything());
  });

  it("POSTs JSON to a calculation", async () => {
    const f = respond({ rtlt_seconds: 2.56, source: "engine" });
    vi.stubGlobal("fetch", f);
    const out = await postEngine<{ rtlt_seconds: number }>("/dsn/telemetry", { distance_km: 384_400 }, "http://h");
    expect(out?.rtlt_seconds).toBe(2.56);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://h/api/engine/dsn/telemetry");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ distance_km: 384_400 });
  });

  it("returns null when the server is down, errors or answers a non-object", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await fetchEngineStatus("http://x")).toBeNull();
    vi.stubGlobal("fetch", respond({ error: "engine_unavailable" }, false));
    expect(await fetchDsnLink("http://x")).toBeNull();
    vi.stubGlobal("fetch", respond([1]));
    expect(await fetchEngineApollo11("http://x")).toBeNull();
  });

  it("serverFirstBudget prefers the server and falls back to the local engine", async () => {
    const local = vi.fn(async () => missionDesignBudget(APOLLO_11_DESIGN_BASELINE));
    vi.stubGlobal("fetch", respond({ ...missionDesignBudget(APOLLO_11_DESIGN_BASELINE), overall_mdl_score: 1 }));
    expect((await serverFirstBudget(local, "http://x")(APOLLO_11_DESIGN_BASELINE)).overall_mdl_score).toBe(1);
    expect(local).not.toHaveBeenCalled();

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    const out = await serverFirstBudget(local, "http://x")(APOLLO_11_DESIGN_BASELINE);
    expect(local).toHaveBeenCalledOnce();
    expect(out.cml_score).toBe(4);
  });
});
