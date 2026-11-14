import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, type TestServerContext } from "../harness/serverHarness.ts";
import {
  loadWasmSimulation,
  wasmPing,
  wasmValidateLaunch,
  wasmRunDescentStep,
  APOLLO_11_LAUNCH_CONFIG,
  APOLLO_11_DESCENT_INITIAL_STATE,
  type DescentState,
} from "../harness/wasmHarness.ts";
import { createGameFlowSession, type GameFlowSession } from "../harness/gameFlowHarness.ts";
import {
  assertApprox,
  assertInRange,
  assertLiftoffTwrNominal,
  assertDescentStateSchema,
  assertEndingDefinition,
} from "../harness/assertions.ts";
import { ENDINGS } from "../../../apps/web/src/game/endings.ts";

describe("Tier 1 Feature 8: Full-Stack End-to-End Wiring & Integrated Workflow", () => {
  let ctx: TestServerContext;

  before(async () => {
    ctx = await startTestServer({ silent: true });
  });

  after(async () => {
    if (ctx) {
      await ctx.shutdown();
    }
  });

  it("launch data flow: server endpoints hydrate client launch configuration", async () => {
    // 1. Fetch launch telemetry and weather from ephemeral test server
    const res = await ctx.fetch("/api/launch/telemetry?force_fallback=true");
    assert.equal(res.status, 200);
    const telemetryData = await res.json();

    assert.equal(telemetryData.mission_id, "AS-506");
    assert.equal(telemetryData.vehicle.glom_kg, 2_938_315);
    assert.equal(telemetryData.weather.status, "GO");
    assert.equal(telemetryData.weather.wind_speed_kmh, 18.5);

    // 2. Client adapts server data into LaunchConfig structure
    const clientConfig = {
      vehicleId: telemetryData.vehicle.name,
      glomKg: telemetryData.vehicle.glom_kg,
      liftoffTwr: telemetryData.vehicle.liftoff_twr,
      launchSite: telemetryData.site?.name ?? telemetryData.launch_site?.name,
      lunarTarget: telemetryData.lunar_target?.name ?? telemetryData.landing_site?.name,
      windSpeedKmh: telemetryData.weather.wind_speed_kmh,
      weatherStatus: telemetryData.weather.status,
    };

    assert.equal(clientConfig.glomKg, 2_938_315);
    assert.equal(clientConfig.weatherStatus, "GO");
    assert.equal(clientConfig.windSpeedKmh, 18.5);
    assert.ok(clientConfig.launchSite.includes("LC-39A"));
    assert.ok(clientConfig.lunarTarget.includes("Mare Tranquillitatis"));
  });

  it("authoritative validation round-trip: server and WASM engine cross-validation", async () => {
    // 1. Query server validation bridge
    const payload = {
      vehicle_id: "saturn_v_as506",
      vehicle_name: "Saturn V AS-506",
      target_destination: "TLI",
      target_orbit_km: 185.0,
      wind_speed_kmh: 18.5,
    };

    const serverRes = await ctx.fetch("/api/simulation/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(serverRes.status, 200);
    const serverVal = await serverRes.json();
    assert.equal(serverVal.is_valid, true);

    // 2. Query in-process WASM engine directly
    const wasmVal = wasmValidateLaunch(APOLLO_11_LAUNCH_CONFIG);
    assert.equal(wasmVal.is_valid, true);

    // 3. Cross-check authoritative agreement between Server and WASM calculations
    assert.equal(serverVal.glom_kg, wasmVal.glom_kg, "GLOM calculation must match between server and wasm");
    assertApprox(serverVal.liftoff_twr, wasmVal.liftoff_twr, 0.05, "Liftoff TWR must agree within 0.05");
    assertLiftoffTwrNominal(serverVal.liftoff_twr);
    assertLiftoffTwrNominal(wasmVal.liftoff_twr);
  });

  it("WASM simulation step propagation across powered descent phase", () => {
    // Verify WASM engine banner
    const ping = wasmPing();
    assert.ok(ping.includes("sim-wasm v1.0.0"), "WASM ping banner verified");

    // Initialize descent state at PDI
    let state: DescentState = { ...APOLLO_11_DESCENT_INITIAL_STATE };
    assertDescentStateSchema(state);

    const initialAlt = state.altitude_m;
    const initialFuel = state.propellant_remaining_kg;

    // Propagate 5 seconds of descent
    for (let step = 0; step < 5; step++) {
      state = wasmRunDescentStep(state);
      assertDescentStateSchema(state);
    }

    // Verify state progression
    assert.ok(state.altitude_m < initialAlt, "Altitude must decrease during descent");
    assert.ok(state.propellant_remaining_kg < initialFuel, "Propellant must be consumed");
    assert.equal(state.is_landed, false, "Vehicle still in flight during braking phase");
    assert.equal(state.is_bingo_fuel, false, "Fuel margin healthy at PDI initiation");
  });

  it("telemetry HUD binding and alarm indicator threshold transitions", () => {
    // Simulate reactive telemetry HUD state updater
    interface HudState {
      altitudeDisplay: string;
      verticalSpeedDisplay: string;
      fuelBarPct: number;
      lowFuelWarning: boolean;
      bingoFuelAlert: boolean;
      masterAlarm: boolean;
    }

    function updateHud(state: DescentState): HudState {
      return {
        altitudeDisplay: `${Math.round(state.altitude_m)} m`,
        verticalSpeedDisplay: `${state.vertical_velocity_mps.toFixed(1)} m/s`,
        fuelBarPct: (state.propellant_remaining_kg / 8200.0) * 100.0,
        lowFuelWarning: state.propellant_remaining_kg <= 255.0,
        bingoFuelAlert: state.is_bingo_fuel || state.propellant_remaining_kg <= 112.0,
        masterAlarm: state.agc_cpu_duty_pct >= 85.0 || state.is_bingo_fuel,
      };
    }

    // 1. High-altitude nominal HUD state
    const highState = { ...APOLLO_11_DESCENT_INITIAL_STATE, propellant_remaining_kg: 5000.0 };
    const hudHigh = updateHud(highState);
    assert.equal(hudHigh.lowFuelWarning, false);
    assert.equal(hudHigh.bingoFuelAlert, false);
    assert.equal(hudHigh.masterAlarm, false);

    // 2. Low-level fuel warning HUD state (propellant = 250 kg <= 255 kg)
    const lowState = { ...APOLLO_11_DESCENT_INITIAL_STATE, propellant_remaining_kg: 250.0 };
    const hudLow = updateHud(lowState);
    assert.equal(hudLow.lowFuelWarning, true);
    assert.equal(hudLow.bingoFuelAlert, false);

    // 3. Bingo Fuel Alert HUD state (propellant = 100 kg <= 112 kg)
    const bingoState = {
      ...APOLLO_11_DESCENT_INITIAL_STATE,
      propellant_remaining_kg: 100.0,
      is_bingo_fuel: true,
    };
    const hudBingo = updateHud(bingoState);
    assert.equal(hudBingo.lowFuelWarning, true);
    assert.equal(hudBingo.bingoFuelAlert, true);
    assert.equal(hudBingo.masterAlarm, true);
  });

  it("clean mission error-free flow: complete historical Apollo 11 playthrough to Ending 1", async () => {
    const session: GameFlowSession = await createGameFlowSession();
    session.reset();

    // Verify initial start at intro-video
    assert.equal(session.getCurrentStepId(), "intro-video");

    // Advance to Workshop and select thorough LOX inspection (Decision 1)
    session.advanceTo("workshop-decision");
    assert.equal(session.getCurrentStepId(), "workshop-decision");
    session.makeDecision("inspection", "thorough");

    // Advance to Mission Control and commit to launch (Decision 2)
    session.advanceTo("weather-decision");
    assert.equal(session.getCurrentStepId(), "weather-decision");
    session.makeDecision("weather", "go");

    // Advance to Translunar Coast and confirm free-return trajectory (Decision 3)
    session.advanceTo("trajectory-decision");
    assert.equal(session.getCurrentStepId(), "trajectory-decision");
    session.makeDecision("trajectory", "free_return");

    // Advance to Lunar Descent and accept Bales/Garman GO call on 1202 alarm (Decision 4)
    session.advanceTo("agc-alarm-decision");
    assert.equal(session.getCurrentStepId(), "agc-alarm-decision");
    session.makeDecision("agc_alarm", "go");

    // Advance to Final Approach and perform P66 manual redesignation (Decision 5)
    session.advanceTo("landing-decision");
    assert.equal(session.getCurrentStepId(), "landing-decision");
    session.makeDecision("landing_approach", "p66_redesignation");

    // Advance through celebratory cutscenes and epilogue to ending
    session.advance(); // flag-video
    assert.equal(session.getCurrentStepId(), "flag-video");
    session.advance(); // epilogue
    assert.equal(session.getCurrentStepId(), "epilogue");
    session.advanceTo("end");
    assert.equal(session.getCurrentStepId(), "end");

    // Verify Mission Outcome
    assert.equal(session.getEndingId(), "ending-1", "Historical playthrough must reach Ending 1");
    const ending = ENDINGS["ending-1"];
    assertEndingDefinition(ending);
    assert.equal(ending.status, "success");
    assert.equal(ending.score, 98);

    // Verify decisions audit trail
    const decisions = session.getDecisions();
    assert.equal(decisions.inspection, "thorough");
    assert.equal(decisions.weather, "go");
    assert.equal(decisions.trajectory, "free_return");
    assert.equal(decisions.agc_alarm, "go");
    assert.equal(decisions.landing_approach, "p66_redesignation");

    // Verify flags
    const finalState = session.getState();
    assert.equal(finalState.narrative?.flags?.loxValveInspected, true);
    assert.equal(finalState.narrative?.flags?.passiveAbortAvailable, true);
    assert.equal(finalState.narrative?.penalties?.fuelPenaltyPct, 0);
  });
});
