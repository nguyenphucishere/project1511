import { describe, expect, it } from "vitest";
import { PAYLOADS, WINDOWS } from "@/mocks/launch-options";
import { assessLaunch, planRequestFor, resultFromPlan, ORBIT_INSERTION_SEC } from "./launch.engine";
import { planLaunch } from "./launch.physics";
import type { LaunchConfig, LaunchWindow } from "./launch.types";

const CALM = WINDOWS[0]!;
const GOOD: LaunchConfig = { vehicle: "saros", payload: "standard", fuelPct: 100, orbitKm: 185, window: "w1", site: "ksc-39a" };
const windy = (wind: number, gust = wind): LaunchWindow => ({ ...CALM, weather: { ...CALM.weather, wind_speed_kmh: wind, wind_gust_kmh: gust } });

describe("payload masses add up", () => {
  it("each payload is the sum of its parts", () => {
    for (const p of PAYLOADS) expect(p.massT * 1000).toBeCloseTo(p.components.reduce((m, c) => m + c.massKg, 0), 6);
    expect(PAYLOADS.find((p) => p.id === "standard")!.massT).toBeCloseTo(43.904, 6); // 5,557 + 23,244 + 15,103
  });
});

describe("console → engine request", () => {
  it("maps vehicle, payload, fuel, orbit and the window's weather", () => {
    const req = planRequestFor({ ...GOOD, vehicle: "kestrel", payload: "rover", fuelPct: 88, orbitKm: 250 }, windy(30, 44));
    expect(req).toMatchObject({
      vehicle_id: "saturn-ib",
      payload_mass_kg: 46_260,
      propellant_load_pct: 88,
      parking_orbit_km: 250,
      wind_speed_kmh: 30,
      wind_gust_kmh: 44,
      thunderstorm: false,
    });
  });

  it("assessment comes from the engine plan and costs include the window delay", () => {
    const a = assessLaunch(GOOD, CALM);
    expect(a.plan.is_go).toBe(true);
    expect(a.capacityT).toBeCloseTo(a.plan.payload_capacity_kg / 1000, 9);
    expect(a.minFuelPct).toBe(a.plan.min_propellant_load_pct);
    expect(a.costM).toBe(1200 + 250);
    expect(assessLaunch({ ...GOOD, window: "w3" }, WINDOWS[2]!).costM).toBe(1200 + 250 + 120);
  });
});

describe("engine verdict → flight", () => {
  const run = (config: LaunchConfig, w: LaunchWindow) => resultFromPlan(planLaunch(planRequestFor(config, w)), 0, "browser-engine");

  it("a good configuration reaches orbit", () => {
    expect(run(GOOD, CALM)).toMatchObject({ isSuccess: true, endSec: ORBIT_INSERTION_SEC, failureTrace: [] });
  });

  it("too little fuel runs stage 2 dry, earlier the shorter the load", () => {
    const short = run({ ...GOOD, fuelPct: 90 }, CALM);
    expect(short.failureTrace.map((s) => s.code)).toEqual(["fuel-depleted"]);
    expect(short.weatherLoss).toBe(false);
    expect(run({ ...GOOD, fuelPct: 70 }, CALM).endSec).toBeLessThan(short.endSec);
  });

  it("Saturn IB with an Apollo stack climbs slowly then runs dry", () => {
    expect(run({ ...GOOD, vehicle: "kestrel" }, CALM).failureTrace.map((s) => s.code)).toEqual(["slow-climb", "fuel-depleted"]);
  });

  it("wind or lightning outside the criteria is a weather loss", () => {
    const shear = run(GOOD, windy(48, 60));
    expect(shear.failureTrace[0]!.code).toBe("wind-shear");
    expect(shear.weatherLoss).toBe(true);
    expect(shear.reason).toMatch(/Wind 48 km\/h/);
    const storm = run(GOOD, { ...CALM, weather: { ...CALM.weather, thunderstorm: true, weather_code: 95 } });
    expect(storm.failureTrace[0]!.code).toBe("lightning");
    expect(storm.weatherLoss).toBe(true);
  });
});
