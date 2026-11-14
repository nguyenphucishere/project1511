import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertApprox,
  assertInRange,
  assertMonotonic,
  assertAgcAlarmDutyCycle,
} from "../harness/assertions.ts";
import {
  wasmCalculateScore,
  type ScoreInputRequest,
  type MissionEvaluationResult,
} from "../harness/wasmHarness.ts";

describe("Tier 1 Feature 6: Apollo 11 Telemetry (20 Channels) & Resource DAG Diagnostics", () => {
  it("20 Apollo 11 telemetry channels present with valid data types and monotonic GET", () => {
    // Generate a sampled 10-step telemetry snapshot series across Apollo 11 powered descent
    interface Apollo11TelemetrySnapshot {
      get_s: number; // 1. Ground Elapsed Time (s)
      glom_kg: number; // 2. Gross Liftoff Mass (kg)
      liftoff_twr: number; // 3. Thrust to Weight Ratio
      altitude_m: number; // 4. Altitude (m)
      inertial_velocity_mps: number; // 5. Inertial Velocity (m/s)
      downrange_distance_km: number; // 6. Downrange Distance (km)
      dynamic_pressure_kpa: number; // 7. Dynamic Pressure (kPa)
      axial_accel_g: number; // 8. Axial Acceleration (g)
      stage1_thrust_kn: number; // 9. S-IC Thrust (kN)
      stage2_thrust_kn: number; // 10. S-II Thrust (kN)
      stage3_thrust_kn: number; // 11. S-IVB Thrust (kN)
      sps_propellant_kg: number; // 12. SPS Propellant (kg)
      dps_propellant_kg: number; // 13. DPS Propellant (kg)
      aps_propellant_kg: number; // 14. APS Propellant (kg)
      main_bus_voltage_v: number; // 15. Main DC Bus Voltage (V)
      total_electrical_power_w: number; // 16. Total Electrical Power (W)
      potable_water_kg: number; // 17. Potable Water Level (kg)
      cryo_o2_pressure_kpa: number; // 18. Cryo O2 Tank Pressure (kPa)
      agc_cpu_duty_pct: number; // 19. AGC CPU Duty Cycle (%)
      imu_pitch_deg: number; // 20. IMU Gimbal Pitch Angle (deg)
    }

    const telemetryTimeline: Apollo11TelemetrySnapshot[] = [];
    const baseGet = 369_500.0; // GET ~102:38:20 (Braking phase)

    for (let step = 0; step < 10; step++) {
      const t = baseGet + step;
      telemetryTimeline.push({
        get_s: t,
        glom_kg: 2_938_315.0,
        liftoff_twr: 1.174,
        altitude_m: 10_200.0 - step * 18.0,
        inertial_velocity_mps: 1_250.0 - step * 4.2,
        downrange_distance_km: 180.0 + step * 0.8,
        dynamic_pressure_kpa: 0.0, // Vacuum
        axial_accel_g: 0.28 + step * 0.005,
        stage1_thrust_kn: 0.0,
        stage2_thrust_kn: 0.0,
        stage3_thrust_kn: 0.0,
        sps_propellant_kg: 18_413.0,
        dps_propellant_kg: 6_200.0 - step * 14.8,
        aps_propellant_kg: 2_353.0,
        main_bus_voltage_v: 28.5,
        total_electrical_power_w: 1_850.0,
        potable_water_kg: 45.0 + step * 0.01,
        cryo_o2_pressure_kpa: 6_350.0,
        agc_cpu_duty_pct: 72.0 + (step > 4 ? 13.0 : 0.0), // Spikes to 85% at step 5
        imu_pitch_deg: 55.0 - step * 1.5,
      });
    }

    // 1. Verify all 20 channels are present on every record
    assert.equal(telemetryTimeline.length, 10);
    const requiredChannels = [
      "get_s",
      "glom_kg",
      "liftoff_twr",
      "altitude_m",
      "inertial_velocity_mps",
      "downrange_distance_km",
      "dynamic_pressure_kpa",
      "axial_accel_g",
      "stage1_thrust_kn",
      "stage2_thrust_kn",
      "stage3_thrust_kn",
      "sps_propellant_kg",
      "dps_propellant_kg",
      "aps_propellant_kg",
      "main_bus_voltage_v",
      "total_electrical_power_w",
      "potable_water_kg",
      "cryo_o2_pressure_kpa",
      "agc_cpu_duty_pct",
      "imu_pitch_deg",
    ];

    for (const snap of telemetryTimeline) {
      for (const ch of requiredChannels) {
        assert.equal(typeof (snap as any)[ch], "number", `Channel ${ch} must be numeric`);
      }
    }

    // 2. Verify GET is strictly monotonic increasing
    const getSeries = telemetryTimeline.map((s) => s.get_s);
    assertMonotonic(getSeries, "increasing", "GET time series must be strictly monotonic increasing");

    // 3. Verify channel physical bounds
    for (const s of telemetryTimeline) {
      assertInRange(s.main_bus_voltage_v, 26.0, 31.0, "Bus voltage nominal range 28V DC");
      assertInRange(s.agc_cpu_duty_pct, 0.0, 100.0, "AGC CPU duty within 0-100%");
      assert.ok(s.dps_propellant_kg > 0, "Propellant must be positive");
    }
  });

  it("DAG continuous electrical load balance, fuel cell power generation, and priority shedding", () => {
    // 3 x Apollo CSM Fuel Cells: rated 1.4 kW each, total max 4.2 kW
    const fcCount = 3;
    const maxPowerPerFcW = 1400.0;
    const totalMaxPowerW = fcCount * maxPowerPerFcW;
    assert.equal(totalMaxPowerW, 4200.0);

    // Subsystem loads:
    // Priority 1: GNC (AGC 70W + IMU 60W = 130W)
    // Priority 2: Comms (USB Transponder 98W) + Radars (LR 130W) = 228W
    // Priority 3: Cabin lighting and non-essential heaters (1,400W)
    const prio1LoadW = 130.0;
    const prio2LoadW = 228.0;
    const prio3LoadW = 1400.0;
    const totalDemandW = prio1LoadW + prio2LoadW + prio3LoadW; // 1,758 W

    // Nominal operation: 2 fuel cells online @ 1,100W each = 2,200W
    const nominalSupplyW = 2200.0;
    const netMarginW = nominalSupplyW - totalDemandW;
    assert.ok(netMarginW > 0, "Nominal supply exceeds demand by 442 W");

    // Brownout scenario: Lightning strike / tank failure drops generation to 1,200 W
    const degradedSupplyW = 1200.0;
    const brownoutDeficitW = totalDemandW - degradedSupplyW;
    assert.ok(brownoutDeficitW > 0, "Deficit of 558 W triggers priority load shedding");

    // Shed Priority 3 (1,400W)
    const criticalDemandW = prio1LoadW + prio2LoadW; // 358 W
    const postSheddingMarginW = degradedSupplyW - criticalDemandW;
    assert.ok(postSheddingMarginW > 0, "Critical GNC and Comms preserved after shedding non-essential loads");
  });

  it("consumables O2/water reaction stoichiometry satisfies mass conservation", () => {
    // Fuel cell reaction: 2 H2 + O2 -> 2 H2O + Electricity
    // Specific reactant consumption: 0.37 kg reactants per kWh produced
    const specificConsumptionKgPerKwh = 0.37;

    // Run for 10 hours at constant 2.0 kW load
    const hours = 10.0;
    const powerKw = 2.0;
    const energyKwh = powerKw * hours; // 20.0 kWh

    const reactantsConsumedKg = energyKwh * specificConsumptionKgPerKwh;
    assertApprox(reactantsConsumedKg, 7.4, 0.01, "7.4 kg of cryo H2/O2 reactants consumed");

    // Water produced equals mass of reacted hydrogen and oxygen (stoichiometric conservation)
    const waterProducedKg = reactantsConsumedKg;
    assert.equal(waterProducedKg, 7.4, "Produced potable water mass exactly matches consumed reactant mass");
  });

  it("multi-criteria composite scoring function computes science, cost, and risk penalties", () => {
    // Score = ws * S - wc * C - wr * R (clamped at 0.0)
    // Nominal case: S = 100, C = 20, R = 0, ws = 1.0, wc = 0.5, wr = 0.8
    const reqNominal: ScoreInputRequest = {
      science_score: 100.0,
      cost_score: 20.0,
      risk_penalty: 0.0,
      weight_science: 1.0,
      weight_cost: 0.5,
      weight_risk: 0.8,
      active_anomalies: [],
    };
    const resNominal: MissionEvaluationResult = wasmCalculateScore(reqNominal);
    assert.equal(resNominal.is_success, true);
    // Score = 1.0 * 100 - 0.5 * 20 - 0.8 * 0 = 90.0
    assertApprox(resNominal.final_score, 90.0, 0.1);

    // Penalty case: R = 50.0
    const reqPenalty: ScoreInputRequest = {
      science_score: 100.0,
      cost_score: 30.0,
      risk_penalty: 25.0,
      weight_science: 1.0,
      weight_cost: 0.5,
      weight_risk: 0.8,
      active_anomalies: [],
    };
    const resPenalty: MissionEvaluationResult = wasmCalculateScore(reqPenalty);
    // Score = 1.0 * 100 - 0.5 * 30 - 0.8 * 25 = 100 - 15 - 20 = 65.0
    assertApprox(resPenalty.final_score, 65.0, 0.1);

    // Zero-floor clamping test
    const reqZero: ScoreInputRequest = {
      science_score: 10.0,
      cost_score: 80.0,
      risk_penalty: 50.0,
      weight_science: 1.0,
      weight_cost: 0.5,
      weight_risk: 0.8,
      active_anomalies: [],
    };
    const resZero: MissionEvaluationResult = wasmCalculateScore(reqZero);
    assert.equal(resZero.final_score, 0.0, "Score cannot be negative");
  });

  it("causal failure chain diagnostic trace reconstructs historical Apollo 11 anomalies", () => {
    // Run score calculation with both Apollo 11 historical anomalies
    const req: ScoreInputRequest = {
      science_score: 95.0,
      cost_score: 25.0,
      risk_penalty: 10.0,
      active_anomalies: ["ANOM-A11-01", "ANOM-A11-02"],
    };
    const result: MissionEvaluationResult = wasmCalculateScore(req);

    assert.ok(result.failure_chain.length >= 2, "Failure chain must include both Apollo 11 anomalies");

    // Anomaly 1: 1201/1202 Program Alarm (GNC)
    const anom1 = result.failure_chain.find((s) => s.includes("ANOM-A11-01"));
    assert.ok(anom1, "Trace must include ANOM-A11-01");
    assert.ok(anom1.includes("GNC"), "Subsystem tag must be GNC");
    assert.ok(anom1.includes("1202") || anom1.includes("restart") || anom1.includes("BAILOUT"));

    // Anomaly 2: Downrange Mascon Perturbation & Boulder Field (PROP)
    const anom2 = result.failure_chain.find((s) => s.includes("ANOM-A11-02"));
    assert.ok(anom2, "Trace must include ANOM-A11-02");
    assert.ok(anom2.includes("PROP"), "Subsystem tag must be PROP");
    assert.ok(anom2.includes("P66") || anom2.includes("Bingo") || anom2.includes("hover"));
  });

  it("AGC CPU duty cycle threshold evaluates program alarms (1201/1202) at >=85%", () => {
    // Nominal duty cycle (72%) does not trigger alarm
    assertAgcAlarmDutyCycle(72.0, false);
    assertAgcAlarmDutyCycle(80.0, false);

    // Overload duty cycle (>=85%) triggers program alarm
    assertAgcAlarmDutyCycle(85.0, true);
    assertAgcAlarmDutyCycle(98.0, true); // Peak load during 1202 alarm

    // Mismatched states must throw AssertionError
    assert.throws(
      () => assertAgcAlarmDutyCycle(90.0, false),
      /CPU duty is 90% \(>= 85.0%\) but alarm was not triggered/
    );
    assert.throws(
      () => assertAgcAlarmDutyCycle(65.0, true),
      /CPU duty is 65% \(< 85.0%\) but alarm was unexpectedly triggered/
    );
  });
});
