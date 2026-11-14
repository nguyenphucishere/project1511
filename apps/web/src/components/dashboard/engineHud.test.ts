import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServerEnginePanel } from "./ServerEnginePanel";
import { EasepPanel } from "./EasepPanel";
import { LunarEnvironmentPanel } from "@/components/hud/LunarEnvironmentPanel";
import { DsnTrackingStatus } from "@/components/hud/DsnTrackingStatus";
import { OFFLINE_DSN_STATUS, OFFLINE_EASEP, OFFLINE_LUNAR_ENVIRONMENT } from "@/lib/simulation/nasa.adapter";
import { dsnTelemetry } from "@/lib/simulation/nasa.physics";
import type { EngineApollo11Data } from "@/lib/simulation/nasa.types";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const APOLLO11: EngineApollo11Data = {
  validate_launch: { input: {}, result: { is_valid: true, glom_kg: 2938315, liftoff_twr: 1.1747, max_q_kpa: 34.41, payload_margin_kg: 2907 } },
  run_descent_step: { input: {}, result: { altitude_m: 15239.1, vertical_velocity_mps: -0.86, propellant_remaining_kg: 8185.2, is_bingo_fuel: false } },
  calculate_score: { input: {}, result: { is_success: true, final_score: 451.4, science_score: 500, cost_score: 94, risk_penalty: 2 } },
  calculate_landing_radar: { input: {}, result: { radar_altitude_m: 152.4, scale_mode: 2, forward_velocity_mps: 18.3, data_good: true } },
  evaluate_mission_design_budget: {
    input: {},
    result: { cml_score: 4, overall_mdl_score: 86.84, delta_v_reserve_pct: 49.03, is_mass_compliant: true, is_power_compliant: true, is_delta_v_compliant: false },
  },
  calculate_dsn_telemetry: { input: {}, result: { rtlt_seconds: 2.598, path_loss_db: 211.4, received_power_dbm: -100.9, is_occulted: false } },
  source: "engine",
};

describe("ServerEnginePanel", () => {
  it("lists every engine calculation with its Apollo 11 result", () => {
    const out = html(
      createElement(ServerEnginePanel, {
        status: { loaded: true, version: "sim-wasm v1.0.0 (Apollo 11 engine)", calculations: [] },
        apollo11: APOLLO11,
      }),
    );
    expect(out).toContain('data-engine="online"');
    expect(out).toContain("sim-wasm v1.0.0");
    for (const k of Object.keys(APOLLO11).filter((k) => k !== "source")) expect(out).toContain(`data-calc="${k}"`);
    expect(out).toContain("2,938,315");
    expect(out).toContain("451.4 pts");
    expect(out).toContain("CHECK"); // Δv non-compliant in this fixture
  });

  it("says when the server engine is unreachable", () => {
    const out = html(createElement(ServerEnginePanel, { status: null, apollo11: null }));
    expect(out).toContain('data-engine="offline"');
    expect(out).toContain("calculations run in the browser");
  });
});

describe("LunarEnvironmentPanel / EasepPanel", () => {
  it("shows engine lunar constants with the day/night range when present", () => {
    const out = html(
      createElement(LunarEnvironmentPanel, {
        data: { ...OFFLINE_LUNAR_ENVIRONMENT, regolith_bearing_capacity_kpa: 140, surface_temperature_day_c: 101, surface_temperature_night_c: -130, mascon_anomaly_mgal: 280, source: "engine" },
      }),
    );
    expect(out).toContain("SIM ENGINE");
    expect(out).toContain("+280 mGal");
    expect(out).toContain("140 kPa");
    expect(out).toContain("-130 … 101 °C");
  });

  it("lists the EASEP experiments", () => {
    const out = html(createElement(EasepPanel, { data: { ...OFFLINE_EASEP, source: "reference" } }));
    expect(out).toContain("1969 FLIGHT SPEC");
    for (const id of ["PSEP", "LRRR", "SWC"]) expect(out).toContain(id);
    expect(out).toContain("50 yr");
  });
});

describe("DsnTrackingStatus with the server link", () => {
  it("shows the live range when the link came from /api/nasa/dsn/link", () => {
    const link = { ...dsnTelemetry({ distance_km: 405_584 }), distance_km: 405_584, epoch: "2026-11-14", distance_source: "api", source: "engine" };
    const out = html(createElement(DsnTrackingStatus, { status: OFFLINE_DSN_STATUS, link }));
    expect(out).toContain("405,584 km");
    expect(out).toContain("JPL Horizons");
    expect(out).toContain("2.71 s");
  });
});
