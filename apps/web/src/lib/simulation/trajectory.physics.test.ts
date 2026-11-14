import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { simulateAscent, simulatePoweredDescent, type AscentProfile, type DescentProfile } from "./trajectory.physics";

/** The port must agree with the real engine (public/wasm, built from crates/sim-wasm). */
describe("parity with the WASM engine", () => {
  type Wasm = { simulate_ascent: (j: string) => string; simulate_powered_descent: (j: string) => string };
  let wasm: (Wasm & { initSync: (m: { module: BufferSource }) => unknown }) | null = null;
  beforeAll(async () => {
    const dir = fileURLToPath(new URL("../../../public/wasm/", import.meta.url));
    const mod = (await import(/* @vite-ignore */ `${dir}sim_wasm.js`)) as typeof wasm;
    mod!.initSync({ module: readFileSync(`${dir}sim_wasm_bg.wasm`) });
    wasm = mod;
  });

  const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(b)));

  it.each([160, 185, 250])("ascent to %i km", (km) => {
    const real = JSON.parse(wasm!.simulate_ascent(JSON.stringify({ parking_orbit_km: km }))) as AscentProfile;
    const mine = simulateAscent({ parking_orbit_km: km });
    expect(mine.reached_orbit).toBe(real.reached_orbit);
    expect(mine.samples.length).toBe(real.samples.length);
    for (const [k, v] of Object.entries(real.events)) {
      const m = (mine.events as unknown as Record<string, number | null>)[k];
      if (v === null) expect(m).toBeNull();
      else close(m!, v as number);
    }
    for (let i = 0; i < real.samples.length; i += 37) {
      const a = mine.samples[i]!;
      const b = real.samples[i]!;
      expect(a.stage).toBe(b.stage);
      close(a.altitude_km, b.altitude_km);
      close(a.inertial_velocity_mps, b.inertial_velocity_mps);
      close(a.sensed_accel_g, b.sensed_accel_g);
      close(a.dynamic_pressure_kpa, b.dynamic_pressure_kpa);
    }
    close(mine.insertion_velocity_mps, real.insertion_velocity_mps);
  });

  it("powered descent", () => {
    const real = JSON.parse(wasm!.simulate_powered_descent("{}")) as DescentProfile;
    const mine = simulatePoweredDescent();
    close(mine.local_gravity_mps2, real.local_gravity_mps2);
    expect(mine.samples.length).toBe(real.samples.length);
    for (const k of ["t_s", "altitude_m", "horizontal_velocity_mps", "vertical_velocity_mps", "mass_kg", "propellant_kg"] as const) {
      close(mine.low_gate[k], real.low_gate[k]);
      close(mine.high_gate[k], real.high_gate[k]);
    }
    close(mine.throttle_down_s!, real.throttle_down_s!);
    for (let i = 0; i < real.samples.length; i += 23) {
      close(mine.samples[i]!.altitude_m, real.samples[i]!.altitude_m);
      close(mine.samples[i]!.throttle, real.samples[i]!.throttle);
      close(mine.samples[i]!.propellant_kg, real.samples[i]!.propellant_kg);
    }
  });
});
