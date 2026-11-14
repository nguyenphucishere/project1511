import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createAppServer, type AppServer } from "../app.js";
import { loadConfig } from "../config.js";
import { MemoryRoomStore } from "../services/roomStore.js";
import { ENGINE_CALCULATIONS } from "../services/simEngine.js";

const silent = { info() {}, warn() {}, error() {} };
const config = loadConfig({
  NODE_ENV: "test",
  JWT_SECRET: "integration-test-secret-engine-routes-1",
  SNAPSHOT_DEBOUNCE_MS: "20",
  ROOM_IDLE_TTL_MS: "50",
});

describe("Simulation engine routes (/api/engine)", () => {
  let app: AppServer;
  let base: string;

  before(async () => {
    app = createAppServer({ config, store: new MemoryRoomStore(), log: silent });
    base = `http://127.0.0.1:${await app.listen(0)}`;
  });
  after(async () => app.shutdown());

  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  it("reports the loaded engine and every calculation it exposes", async () => {
    const res = await fetch(`${base}/api/engine/status`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.loaded, true);
    assert.match(json.version, /sim-wasm/);
    for (const n of ENGINE_CALCULATIONS) {
      assert.ok(json.calculations.includes(n), n);
      assert.ok(json.endpoints[n].startsWith("/api/engine/"));
    }
    assert.ok(json.calculations.includes("get_lunar_environment_constants"));
  });

  it("runs every calculation on the Apollo 11 baseline in one call", async () => {
    const json = await (await fetch(`${base}/api/engine/apollo11`)).json();
    assert.equal(json.source, "engine");
    assert.equal(json.validate_launch.result.is_valid, true);
    assert.equal(json.validate_launch.result.glom_kg, 2_938_315);
    assert.equal(json.calculate_landing_radar.result.scale_mode, 2);
    assert.equal(json.evaluate_mission_design_budget.result.cml_score, 4);
    assert.ok(json.run_descent_step.result.altitude_m < 15_240);
    assert.equal(json.calculate_score.result.is_success, true);
    assert.ok(Math.abs(json.calculate_dsn_telemetry.result.rtlt_seconds - 2.598) < 0.01);
  });

  it("computes from a POSTed body", async () => {
    const res = await post("/api/engine/dsn/telemetry", { distance_km: 384_400 });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.source, "engine");
    assert.equal(json.rtlt_seconds, 2.56444);

    const launch = await (await post("/api/engine/launch/validate", { vehicle_mass: 185_846, propellant_mass: 2_706_767, payload_mass: 60_000, stage_count: 3, target_orbit_km: 185 })).json();
    assert.equal(launch.is_valid, false, "payload over the TLI capacity");
    assert.ok(launch.payload_margin_kg < 0);
  });

  it("serves the Apollo 11 answer for each calculation over GET", async () => {
    for (const path of ["launch/validate", "descent/step", "score", "landing-radar", "mission-design/budget", "dsn/telemetry"]) {
      const res = await fetch(`${base}/api/engine/${path}/apollo11`);
      assert.equal(res.status, 200, path);
      const json = await res.json();
      assert.equal(json.source, "engine");
      assert.ok(json.input && typeof json.input === "object");
    }
  });

  it("rejects bodies the engine cannot use with 400", async () => {
    assert.equal((await post("/api/engine/score", [1, 2])).status, 400);
    const bad = await post("/api/engine/score", { science_score: "lots" });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).detail, /Invalid JSON/);
  });

  it("serves the engine's lunar constants", async () => {
    const json = await (await fetch(`${base}/api/engine/lunar-environment`)).json();
    assert.equal(json.source, "engine");
    assert.equal(json.mascon_anomaly_mgal, 280);
    assert.equal(json.surface_temperature_night_c, -130);
  });

  it("computes the DSN link on the ephemeris distance (/api/nasa/dsn/link)", async () => {
    const res = await fetch(`${base}/api/nasa/dsn/link?force_fallback=true`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.source, "engine");
    assert.equal(json.distance_source, "offline_fallback");
    assert.equal(json.distance_km, 389_472.8);
    assert.ok(Math.abs(json.rtlt_seconds - (2 * 389_472.8) / 299_792.458) < 1e-4);
  });
});
