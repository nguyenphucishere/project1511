import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  APOLLO_11_DESIGN_BASELINE,
  dsnTelemetry,
  EARTH_MOON_NOMINAL_DISTANCE_KM,
  landingRadar,
  missionDesignBudget,
} from "./nasa.physics";
import type { MissionDesignBudgetInput } from "./nasa.types";

describe("landing radar mirror", () => {
  it("measures altitude over terrain and shifts scale at 762 m", () => {
    const high = landingRadar({ inertial_alt_m: 2000, vertical_vel_mps: -20, horizontal_vel_mps: 100, terrain_elevation_offset_m: 30 });
    expect(high.radar_altitude_m).toBe(1970);
    expect(high.altitude_delta_m).toBe(30);
    expect(high.scale_mode).toBe(1);
    expect(landingRadar({ inertial_alt_m: 762, vertical_vel_mps: -5, horizontal_vel_mps: 10 }).scale_mode).toBe(2);
  });

  it("drops data-good outside the beam, altitude and velocity envelope", () => {
    const ok = { inertial_alt_m: 1000, vertical_vel_mps: -10, horizontal_vel_mps: 50 };
    expect(landingRadar({ ...ok, pitch_angle_deg: 65 }).data_good).toBe(true);
    expect(landingRadar({ ...ok, pitch_angle_deg: 65.1 }).data_good).toBe(false);
    expect(landingRadar({ ...ok, inertial_alt_m: 15_241 }).data_good).toBe(false);
    expect(landingRadar({ ...ok, vertical_vel_mps: -300.1 }).data_good).toBe(false);
    expect(landingRadar({ ...ok, horizontal_vel_mps: 1800.1 }).data_good).toBe(false);
  });
});

describe("mission design budget mirror", () => {
  it("rates the Apollo 11 baseline as a compliant CML 4 point design", () => {
    const r = missionDesignBudget(APOLLO_11_DESIGN_BASELINE);
    expect(r.dry_mass_with_mga_kg).toBeCloseTo(46_200, 6);
    expect(r.is_mass_compliant).toBe(true);
    expect(r.power_margin_pct).toBeCloseTo(50, 6);
    expect(r.is_delta_v_compliant).toBe(true);
    expect(r.cml_score).toBe(4);
    expect(r.overall_mdl_score).toBeGreaterThan(50);
  });

  it("falls through the CML levels as margins close", () => {
    const base = APOLLO_11_DESIGN_BASELINE;
    expect(missionDesignBudget({ ...base, power_generation_watts: 1_700 }).cml_score).toBe(3); // 21 % power
    expect(missionDesignBudget({ ...base, dry_mass_basic_kg: 45_000 }).cml_score).toBe(2); // MGA over capacity
    expect(missionDesignBudget({ ...base, dry_mass_basic_kg: 50_000 }).cml_score).toBe(1);
    expect(missionDesignBudget({ ...base, dry_mass_basic_kg: 0 }).overall_mdl_score).toBe(0);
  });

  it("uses an explicit stage Δv instead of the rocket equation", () => {
    const r = missionDesignBudget({
      ...APOLLO_11_DESIGN_BASELINE,
      stage_configs: [{ stage_name: "x", dry_mass_kg: 1, propellant_mass_kg: 1, isp_s: 1, burn_delta_v_mps: 5_500 }],
    });
    expect(r.delta_v_available_mps).toBe(5_500);
  });
});

describe("DSN telemetry mirror", () => {
  it("gives the ~2.56 s Earth–Moon round trip and S-band path loss", () => {
    const r = dsnTelemetry({ distance_km: EARTH_MOON_NOMINAL_DISTANCE_KM });
    expect(r.rtlt_seconds).toBeCloseTo(2.56444, 5);
    expect(r.path_loss_db).toBeGreaterThan(211);
    expect(r.is_occulted).toBe(false);
    expect(r.received_power_dbm).toBeCloseTo(110.5 - r.path_loss_db, 3);
  });

  it("loses the signal behind the Moon", () => {
    expect(dsnTelemetry({ distance_km: 384_400, true_anomaly_deg: 180 }).received_power_dbm).toBe(-180);
    expect(dsnTelemetry({ distance_km: 384_400, true_anomaly_deg: 109.87 }).is_occulted).toBe(false);
    expect(dsnTelemetry({ distance_km: 384_400, true_anomaly_deg: -170 }).is_occulted).toBe(true);
    expect(dsnTelemetry({ distance_km: 384_400, is_farside: true }).is_occulted).toBe(true);
  });
});

/** The mirror must agree with the real engine (public/wasm, built from crates/sim-wasm). */
describe("parity with the WASM engine", () => {
  type Wasm = {
    calculate_landing_radar: (j: string) => string;
    evaluate_mission_design_budget: (j: string) => string;
    calculate_dsn_telemetry: (j: string) => string;
  };
  let wasm: (Wasm & { initSync: (m: { module: BufferSource }) => unknown }) | null = null;

  beforeAll(async () => {
    const dir = fileURLToPath(new URL("../../../public/wasm/", import.meta.url));
    const mod = (await import(/* @vite-ignore */ `${dir}sim_wasm.js`)) as typeof wasm;
    mod!.initSync({ module: readFileSync(`${dir}sim_wasm_bg.wasm`) });
    wasm = mod;
  });

  const designs: MissionDesignBudgetInput[] = [
    APOLLO_11_DESIGN_BASELINE,
    { ...APOLLO_11_DESIGN_BASELINE, power_generation_watts: 1_700 },
    { ...APOLLO_11_DESIGN_BASELINE, dry_mass_basic_kg: 45_000, mga_margin_pct: 15 },
    { ...APOLLO_11_DESIGN_BASELINE, power_load_watts: 2_500, power_generation_watts: undefined },
  ];

  it("mission design budget", () => {
    for (const d of designs) {
      const real = JSON.parse(wasm!.evaluate_mission_design_budget(JSON.stringify(d)));
      const mine = missionDesignBudget(d);
      expect(mine.cml_score).toBe(real.cml_score);
      expect(mine.is_mass_compliant).toBe(real.is_mass_compliant);
      expect(mine.is_power_compliant).toBe(real.is_power_compliant);
      expect(mine.is_delta_v_compliant).toBe(real.is_delta_v_compliant);
      expect(mine.delta_v_available_mps).toBeCloseTo(real.delta_v_available_mps, 6);
      expect(mine.overall_mdl_score).toBeCloseTo(real.overall_mdl_score, 6);
    }
  });

  it("landing radar and DSN link", () => {
    for (const input of [
      { inertial_alt_m: 9000, vertical_vel_mps: -30, horizontal_vel_mps: 600, terrain_elevation_offset_m: 18, pitch_angle_deg: 55 },
      { inertial_alt_m: 500, vertical_vel_mps: -5, horizontal_vel_mps: 20, terrain_elevation_offset_m: -9, pitch_angle_deg: 70 },
    ]) {
      expect(landingRadar(input)).toEqual(JSON.parse(wasm!.calculate_landing_radar(JSON.stringify(input))));
    }
    for (const input of [{ distance_km: 389_472.8 }, { distance_km: 384_400, true_anomaly_deg: 200 }]) {
      expect(dsnTelemetry(input)).toEqual(JSON.parse(wasm!.calculate_dsn_telemetry(JSON.stringify(input))));
    }
  });
});
