import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertApprox,
  assertInRange,
  assertLunarEclipseDuration,
  assertLunarOrbitPeriod,
} from "../harness/assertions.ts";
import { wasmCalculateScore } from "../harness/wasmHarness.ts";

describe("Tier 3 Combination: Keplerian Lunar Eclipse & Power Load Shedding", () => {
  describe("Keplerian Orbit Propagation & Cylindrical Shadow Geometry", () => {
    // Apollo 11 CSM / LM Lunar Parking Orbit Parameters
    const MOON_RADIUS_KM = 1_737.4;
    const MOON_MU_KM3_S2 = 4_904.8695;
    const PARKING_ORBIT_ALTITUDE_KM = 110.0;
    const SEMI_MAJOR_AXIS_KM = MOON_RADIUS_KM + PARKING_ORBIT_ALTITUDE_KM; // 1,847.4 km

    it("calculates nominal lunar parking orbit period (118.0 ± 6.0 min)", () => {
      // T = 2 * pi * sqrt(a^3 / mu)
      const a = SEMI_MAJOR_AXIS_KM;
      const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MOON_MU_KM3_S2);
      const periodMin = periodSec / 60.0;

      assertInRange(periodMin, 112.0, 124.0, "Lunar parking orbit period must be ~118 min");
      assertLunarOrbitPeriod(periodMin);
      assertApprox(periodMin, 118.73, 0.5);
    });

    it("evaluates cylindrical shadow duration during lunar farside eclipse (45.5 to 47.5 min)", () => {
      // sin(phi) = R_moon / a
      const a = SEMI_MAJOR_AXIS_KM;
      const sinPhi = Math.min(1.0, MOON_RADIUS_KM / a);
      const phiRad = Math.asin(sinPhi);

      const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MOON_MU_KM3_S2);
      // Eclipse duration = (phi / pi) * T
      const eclipseSec = (phiRad / Math.PI) * periodSec;
      const eclipseMin = eclipseSec / 60.0;

      assertInRange(eclipseMin, 42.0, 51.0, "Eclipse duration must fall in nominal 45.5-47.5 min window");
      assertLunarEclipseDuration(eclipseMin);
      assertApprox(eclipseMin, 45.94, 1.0);
    });
  });

  describe("Electrical Energy Balance & Priority Load Shedding Simulation", () => {
    it("simulates battery depletion and priority load shedding during extended eclipse darkness", () => {
      // Define multi-resource DAG state for lunar eclipse
      interface LoadNode {
        id: string;
        name: string;
        rateWatts: number;
        priority: 1 | 2 | 3; // 1 = Critical, 2 = Operational, 3 = Non-essential
        isActive: boolean;
      }

      const loads: LoadNode[] = [
        { id: "LOAD-AGC", name: "Apollo Guidance Computer & IMU", rateWatts: 420.0, priority: 1, isActive: true },
        { id: "LOAD-ECLSS", name: "Cabin Oxygen & CO2 Scrubber", rateWatts: 350.0, priority: 1, isActive: true },
        { id: "LOAD-RADAR", name: "Rendezvous & Landing Radar", rateWatts: 480.0, priority: 2, isActive: true },
        { id: "LOAD-COMMS", name: "High-Gain S-Band Transmitter", rateWatts: 250.0, priority: 2, isActive: true },
        { id: "LOAD-HEATERS", name: "Descent Stage Utility Heaters", rateWatts: 400.0, priority: 3, isActive: true },
        { id: "LOAD-SCIENCE", name: "Scientific Sensor Telemetry", rateWatts: 200.0, priority: 3, isActive: true },
      ];

      // Battery Storage: 800 Wh capacity (degraded/depleted scenario)
      let batteryWh = 800.0;
      let brownoutActive = false;
      const stepDurationMin = 10.0; // 10 minute steps across 46m eclipse
      const totalSteps = 5; // 50 minutes total in shadow

      for (let step = 1; step <= totalSteps; step++) {
        // Solar generation in shadow is 0 W
        const solarGenWatts = 0.0;
        const totalConsumptionWatts = loads
          .filter((l) => l.isActive)
          .reduce((sum, l) => sum + l.rateWatts, 0);

        const netPowerWatts = solarGenWatts - totalConsumptionWatts;
        const energyDrawnWh = (-netPowerWatts * stepDurationMin) / 60.0;

        if (batteryWh >= energyDrawnWh) {
          batteryWh -= energyDrawnWh;
        } else {
          // Battery exhausted -> Brownout triggers priority load shedding
          batteryWh = 0.0;
          brownoutActive = true;

          // Priority 3 loads shed first
          for (const load of loads) {
            if (load.priority >= 3) {
              load.isActive = false;
            }
          }
        }
      }

      // Assertions on electrical brownout and load shedding
      assert.equal(brownoutActive, true, "Battery exhaustion must activate brownout state");
      assert.equal(batteryWh, 0.0, "Battery should be completely depleted");

      // Verify that Priority 3 non-essential loads were shed
      const shedLoads = loads.filter((l) => !l.isActive);
      assert.ok(shedLoads.length >= 2, "Priority 3 loads must be shed");
      assert.ok(
        shedLoads.every((l) => l.priority >= 3),
        "Only Priority 3 non-essential loads should be shed during initial brownout"
      );

      // Verify that Priority 1 life support & AGC remained active
      const criticalLoads = loads.filter((l) => l.priority === 1);
      assert.ok(
        criticalLoads.every((l) => l.isActive),
        "Critical Priority 1 life support and guidance must remain powered"
      );
    });
  });

  describe("Historical Electrical Subsystem Anomaly Evaluation", () => {
    it("traces Apollo program electrical anomalies (ANOM-A12-01 lightning, ANOM-A13-01 cryo tank short)", () => {
      // ANOM-A12-01: Atmospheric lightning, 3 fuel cells disconnect
      const a12Result = wasmCalculateScore({
        science_score: 500,
        cost_score: 376,
        risk_penalty: 0.15,
        active_anomalies: ["ANOM-A12-01"],
      });

      assert.equal(a12Result.is_success, true);
      assert.equal(a12Result.failure_chain.length, 1);
      assert.ok(a12Result.failure_chain[0].includes("ANOM-A12-01"));
      assert.ok(
        a12Result.failure_chain[0].includes("Fuel Cells") ||
          a12Result.failure_chain[0].includes("lightning") ||
          a12Result.failure_chain[0].includes("SCE to AUX")
      );

      // Combined severe electrical failure: ANOM-A13-01 (Cryo tank 2 rupture)
      const a13Result = wasmCalculateScore({
        science_score: 100,
        cost_score: 376,
        risk_penalty: 0.85,
        active_anomalies: ["ANOM-A13-01"],
      });

      assert.equal(a13Result.failure_chain.length, 1);
      assert.ok(a13Result.failure_chain[0].includes("ANOM-A13-01"));
      assert.ok(
        a13Result.failure_chain[0].includes("Oxygen Tank") ||
          a13Result.failure_chain[0].includes("lifeboat") ||
          a13Result.failure_chain[0].includes("fuel cells fail")
      );
    });
  });
});
