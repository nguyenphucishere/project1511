import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  APOLLO_11_STACK_KG,
  LAUNCH_COMMIT_CRITERIA,
  LAUNCH_VEHICLE_PRESETS,
  planLaunch,
  type LaunchPlanRequest,
} from "./launch.physics";

describe("launch plan mirror", () => {
  it("Saturn V carries the Apollo 11 stack and needs most of a full load", () => {
    const p = planLaunch({ vehicle_id: "saturn-v", payload_mass_kg: APOLLO_11_STACK_KG, wind_speed_kmh: 9 });
    expect(p.is_go).toBe(true);
    expect(p.payload_capacity_kg / 1000).toBeCloseTo(49.4, 0);
    expect(p.min_propellant_load_pct).toBeGreaterThan(90);
  });

  it("Saturn IB cannot reach the Moon with any Apollo stack", () => {
    const p = planLaunch({ vehicle_id: "saturn-ib", payload_mass_kg: APOLLO_11_STACK_KG });
    expect(p.failure_mode).toBe("over_capacity");
    expect(p.min_propellant_load_pct).toBeNull();
  });

  it("weather beyond the commit criteria fails at Max-Q or with lightning", () => {
    const windy = planLaunch({ payload_mass_kg: APOLLO_11_STACK_KG, wind_speed_kmh: LAUNCH_COMMIT_CRITERIA.max_sustained_wind_kmh + 1 });
    expect(windy.failure_mode).toBe("wind_shear");
    expect(windy.failure_time_s).toBe(windy.max_q_time_s);
    expect(planLaunch({ wind_speed_kmh: 10, wind_gust_kmh: 60 }).failure_mode).toBe("wind_shear");
    expect(planLaunch({ thunderstorm: true }).failure_mode).toBe("lightning_strike");
    expect(planLaunch({ wind_speed_kmh: 40, wind_gust_kmh: 55 }).is_go).toBe(true);
  });
});

/** The mirror must agree with the real engine (public/wasm, built from crates/sim-wasm). */
describe("parity with the WASM engine", () => {
  type Wasm = { plan_launch: (j: string) => string; get_launch_catalog: () => string };
  let wasm: (Wasm & { initSync: (m: { module: BufferSource }) => unknown }) | null = null;

  beforeAll(async () => {
    const dir = fileURLToPath(new URL("../../../public/wasm/", import.meta.url));
    const mod = (await import(/* @vite-ignore */ `${dir}sim_wasm.js`)) as typeof wasm;
    mod!.initSync({ module: readFileSync(`${dir}sim_wasm_bg.wasm`) });
    wasm = mod;
  });

  it("same vehicle presets and commit criteria", () => {
    const real = JSON.parse(wasm!.get_launch_catalog());
    expect(real.criteria).toEqual(LAUNCH_COMMIT_CRITERIA);
    expect(real.vehicles).toEqual(LAUNCH_VEHICLE_PRESETS);
  });

  const cases: LaunchPlanRequest[] = [];
  for (const v of LAUNCH_VEHICLE_PRESETS)
    for (const payload of [43_904, 43_981, 46_260])
      for (const load of [70, 90, 96, 100])
        for (const orbit of [160, 185, 250]) cases.push({ vehicle_id: v.id, payload_mass_kg: payload, propellant_load_pct: load, parking_orbit_km: orbit, wind_speed_kmh: 12 });
  cases.push({ wind_speed_kmh: 48 }, { wind_speed_kmh: 30, wind_gust_kmh: 61 }, { thunderstorm: true }, { vehicle_id: "n1" });

  it(`plan_launch over ${cases.length} configurations`, () => {
    for (const c of cases) {
      const real = JSON.parse(wasm!.plan_launch(JSON.stringify(c)));
      const mine = planLaunch(c);
      expect(mine.is_go, JSON.stringify(c)).toBe(real.is_go);
      expect(mine.failure_mode).toBe(real.failure_mode);
      expect(mine.min_propellant_load_pct).toBe(real.min_propellant_load_pct);
      expect(mine.glom_kg).toBeCloseTo(real.glom_kg, 6);
      expect(mine.liftoff_twr).toBeCloseTo(real.liftoff_twr, 9);
      expect(mine.max_q_kpa).toBeCloseTo(real.max_q_kpa, 6);
      expect(mine.max_q_time_s).toBeCloseTo(real.max_q_time_s, 6);
      expect(mine.delta_v_available_mps).toBeCloseTo(real.delta_v_available_mps, 6);
      expect(mine.payload_capacity_kg).toBeCloseTo(real.payload_capacity_kg, 3);
      if (real.failure_time_s !== null) expect(mine.failure_time_s).toBeCloseTo(real.failure_time_s, 6);
    }
  });
});
