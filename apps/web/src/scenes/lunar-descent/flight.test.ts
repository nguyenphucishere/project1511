import { describe, expect, it } from "vitest";
import { KEYFRAMES } from "@/mocks/descent";
import {
  CONTACT_HEIGHT,
  CRATER_EDGE_X,
  HOVER_THROTTLE,
  LUNAR_G,
  NO_INPUT,
  RCS_THRUST_N,
  ROD_MAX,
  THROTTLE_MAX,
  THROTTLE_MIN,
  massAt,
  ROD_MIN,
  calloutFor,
  createFlight,
  cutEngine,
  fuelSecondsLeft,
  nudgeTargetVs,
  recommendedVs,
  stepFlight,
  terrainAt,
  type FlightInput,
  type FlightState,
} from "./flight";

/** Flies until the status changes (or a safety cap), asking `pilot` for the controls each second of sim time. */
function fly(s: FlightState, pilot: (s: FlightState) => FlightInput | void, maxSec = 600) {
  const dt = 0.05;
  for (let t = 0; t < maxSec && s.status === "flying"; t += dt) {
    const input = pilot(s) ?? NO_INPUT;
    stepFlight(s, input, dt);
  }
  return s;
}

/** A competent pilot: brake to the crew's envelope, cut the engine at the contact light. */
function goodPilot(s: FlightState): FlightInput | void {
  const want = Math.max(-3, Math.min(-0.5, recommendedVs(s.altM)));
  while (s.targetVs > want + 0.25) nudgeTargetVs(s, -1);
  while (s.targetVs < want - 0.25) nudgeTargetVs(s, 1);
  if (s.contact && s.engineOn) cutEngine(s);
}

describe("flight model", () => {
  it("starts at the engine's low gate with a hovering-class throttle", () => {
    const s = createFlight("A");
    const gate = KEYFRAMES[2]!;
    expect(s.altM).toBe(gate.altM);
    expect(s.altM).toBeCloseTo(152.4, 0); // §4.3 low gate, 500 ft
    expect(s.vsMs).toBe(gate.vsMs);
    expect(s.fuelPct).toBe(gate.fuelPct);
    expect(s.throttle).toBeCloseTo(HOVER_THROTTLE, 6);
    // §4.3: hover at the low gate takes 26–30 % of rated thrust.
    expect(HOVER_THROTTLE).toBeGreaterThan(0.26);
    expect(HOVER_THROTTLE).toBeLessThan(0.3);
    expect(LUNAR_G).toBeCloseTo(1.6248, 6); // engine lunar constants, mascon included
    expect(s.status).toBe("flying");
  });

  it("keeps the throttle inside the P66 band (10–60 % of rated thrust)", () => {
    const s = createFlight("A");
    s.targetVs = ROD_MIN;
    stepFlight(s, NO_INPUT, 5);
    expect(s.throttle).toBeGreaterThanOrEqual(THROTTLE_MIN - 1e-12);
    s.targetVs = ROD_MAX;
    stepFlight(s, NO_INPUT, 5);
    expect(s.throttle).toBeLessThanOrEqual(THROTTLE_MAX + 1e-12);
  });

  it("falls at lunar gravity with the engine out", () => {
    const s = createFlight("A");
    s.engineOn = false;
    s.throttle = 0;
    s.vsMs = 0;
    s.altM = 1000;
    stepFlight(s, NO_INPUT, 10);
    expect(s.vsMs).toBeCloseTo(-LUNAR_G * 10, 3);
    expect(s.altM).toBeCloseTo(1000 - 0.5 * LUNAR_G * 100, 1);
  });

  it("gives the same result whatever the frame length", () => {
    const a = createFlight("A");
    const b = createFlight("A");
    for (let i = 0; i < 600; i++) stepFlight(a, NO_INPUT, 1 / 60);
    for (let i = 0; i < 20; i++) stepFlight(b, NO_INPUT, 0.5);
    expect(b.altM).toBeCloseTo(a.altM, 3);
    expect(b.vsMs).toBeCloseTo(a.vsMs, 3);
    expect(b.fuelPct).toBeCloseTo(a.fuelPct, 3);
  });

  it("holds the commanded rate of descent", () => {
    const s = createFlight("A");
    s.targetVs = -4;
    stepFlight(s, NO_INPUT, 12);
    expect(s.vsMs).toBeCloseTo(-4, 1);
    nudgeTargetVs(s, 1);
    nudgeTargetVs(s, 1);
    nudgeTargetVs(s, 1);
    nudgeTargetVs(s, 1); // -2 m/s
    stepFlight(s, NO_INPUT, 12);
    expect(s.vsMs).toBeCloseTo(-2, 1);
  });

  it("keeps the commanded rate inside its limits", () => {
    const s = createFlight("A");
    for (let i = 0; i < 40; i++) nudgeTargetVs(s, 1);
    expect(s.targetVs).toBe(ROD_MAX);
    for (let i = 0; i < 40; i++) nudgeTargetVs(s, -1);
    expect(s.targetVs).toBe(ROD_MIN);
  });

  it("limits how fast the throttle can change", () => {
    const s = createFlight("A");
    for (let i = 0; i < 10; i++) nudgeTargetVs(s, -1);
    const before = s.throttle;
    stepFlight(s, NO_INPUT, 0.1);
    expect(Math.abs(s.throttle - before)).toBeLessThanOrEqual(0.121);
  });

  it("burns fuel, and more of it the harder the engine works", () => {
    const hover = createFlight("A");
    nudgeTargetVs(hover, 1);
    nudgeTargetVs(hover, 1);
    nudgeTargetVs(hover, 1);
    nudgeTargetVs(hover, 1);
    nudgeTargetVs(hover, 1);
    nudgeTargetVs(hover, 1); // hover
    stepFlight(hover, NO_INPUT, 20);
    const drop = createFlight("A");
    stepFlight(drop, NO_INPUT, 20);
    expect(hover.fuelPct).toBeLessThan(KEYFRAMES[2]!.fuelPct);
    expect(hover.fuelPct).toBeLessThan(drop.fuelPct + 1e-9);
    expect(fuelSecondsLeft(hover)).toBeGreaterThan(60);
  });

  it("drifts sideways until the RCS jets stop it (four 445 N jets, their own propellant)", () => {
    const s = createFlight("A");
    const twin = createFlight("A");
    const x0 = s.xM;
    stepFlight(s, NO_INPUT, 5);
    stepFlight(twin, NO_INPUT, 5);
    expect(s.xM).toBeCloseTo(x0 + 0.4 * 5, 2);
    const accel = RCS_THRUST_N / massAt(s.fuelPct);
    stepFlight(s, { rcs: -1, nullDrift: false }, 1);
    stepFlight(twin, NO_INPUT, 1);
    expect(s.hsMs).toBeCloseTo(0.4 - accel, 2);
    expect(s.rcs).toBe(-1);
    expect(s.fuelPct).toBeCloseTo(twin.fuelPct, 9); // the DPS tank is untouched by the RCS
  });

  it("null-drift stops sideways speed without overshooting", () => {
    const s = createFlight("A", 2); // 0.5 m/s drift
    for (let i = 0; i < 80; i++) stepFlight(s, { rcs: 0, nullDrift: true }, 0.05);
    expect(s.hsMs).toBe(0);
    expect(s.rcs).toBe(0);
  });

  it("lights the contact light at the probe height", () => {
    const s = createFlight("A");
    s.altM = CONTACT_HEIGHT + 0.5;
    s.vsMs = -1;
    nudgeTargetVs(s, 1);
    nudgeTargetVs(s, 1);
    nudgeTargetVs(s, 1);
    nudgeTargetVs(s, 1); // -1 m/s
    stepFlight(s, NO_INPUT, 0.6);
    expect(s.contact).toBe(true);
    expect(s.status).toBe("flying");
  });

  it("lands softly on the clear patch with a good pilot", () => {
    const s = createFlight("A");
    // Translate to site A (x = 8) early, then null the drift.
    const done = fly(s, (st) => {
      goodPilot(st);
      if (st.altM > 70) return { rcs: st.xM < 6 ? 1 : 0, nullDrift: st.xM >= 6 };
      return { rcs: 0, nullDrift: true };
    });
    expect(done.status).toBe("landed");
    expect(done.touchdown?.success).toBe(true);
    expect(done.touchdown!.vsMs).toBeLessThanOrEqual(3);
    expect(done.touchdown!.stars).toBeGreaterThanOrEqual(1);
    expect(done.fuelPct).toBeGreaterThan(0);
  });

  it("crashes into the boulder field when nobody steers away from it", () => {
    const s = createFlight("A");
    const done = fly(s, (st) => {
      goodPilot(st);
      return { rcs: 0, nullDrift: true }; // holds x = 0
    });
    expect(done.status).toBe("crashed");
    expect(done.touchdown?.reason).toBe("boulders");
    expect(done.touchdown?.stars).toBe(0);
  });

  it("crashes when the fuel runs out above the ground", () => {
    const s = createFlight("A");
    s.fuelPct = 0.2;
    s.xM = 12;
    s.hsMs = 0;
    const done = fly(s, () => {});
    expect(done.status).toBe("crashed");
    expect(done.touchdown?.reason).toBe("hard");
    expect(done.touchdown!.vsMs).toBeGreaterThan(3);
  });

  it("judges sideways speed at contact", () => {
    const s = createFlight("A");
    s.xM = 10;
    s.hsMs = 2.5;
    s.altM = 0.3;
    s.vsMs = -0.8;
    s.engineOn = false;
    s.throttle = 0;
    stepFlight(s, NO_INPUT, 1);
    expect(s.touchdown?.reason).toBe("tipover");
  });

  it("fails a landing with the engine still burning, however gentle", () => {
    const s = createFlight("A");
    s.xM = 8;
    s.hsMs = 0;
    s.altM = 0.2;
    s.vsMs = -0.4;
    s.targetVs = -0.5;
    stepFlight(s, NO_INPUT, 1);
    expect(s.status).toBe("crashed");
    expect(s.touchdown?.engineOn).toBe(true);
    expect(s.touchdown?.reason).toBe("engine");
    expect(s.touchdown?.stars).toBe(0);
  });

  it("does not let a hands-off descent succeed", () => {
    for (const site of ["A", "B", "C"] as const) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const s = createFlight(site, attempt);
        const done = fly(s, () => {});
        expect(done.status).toBe("crashed");
      }
    }
  });

  it("cutting the engine at the contact light, gently, lands the lander", () => {
    const s = createFlight("A");
    s.xM = 8;
    s.hsMs = 0;
    s.altM = 3;
    s.vsMs = -0.8;
    s.targetVs = -0.5;
    s.fuelPct = 6;
    const done = fly(s, (st) => {
      if (st.contact && st.engineOn) cutEngine(st);
    });
    expect(done.status).toBe("landed");
    expect(done.touchdown!.vsMs).toBeLessThan(3);
    expect(done.touchdown!.stars).toBeGreaterThanOrEqual(2);
  });

  it("awards three stars for a gentle, precise, engine-off landing with fuel to spare", () => {
    const s = createFlight("A");
    s.xM = 8.5;
    s.hsMs = 0.1;
    s.altM = 0.05;
    s.vsMs = -0.9;
    s.fuelPct = 6;
    s.engineOn = false;
    s.throttle = 0;
    stepFlight(s, NO_INPUT, 0.5);
    expect(s.touchdown?.stars).toBe(3);
  });

  it("reads the terrain along the strip", () => {
    expect(terrainAt(0)).toBe("boulders");
    expect(terrainAt(4.4)).toBe("boulders");
    expect(terrainAt(8)).toBe("clear");
    expect(terrainAt(-14)).toBe("clear");
    expect(terrainAt(CRATER_EDGE_X)).toBe("crater");
    expect(terrainAt(-30)).toBe("crater");
  });

  it("crew calls the most urgent problem first", () => {
    const s = createFlight("A");
    expect(calloutFor(s)?.id).toBe("approach");
    s.altM = 30;
    s.vsMs = -8;
    expect(calloutFor(s)?.id).toBe("tooFast");
    s.vsMs = -1;
    s.xM = 0;
    s.hsMs = 0;
    expect(calloutFor(s)?.id).toBe("boulders");
    s.xM = 10;
    s.hsMs = 2;
    expect(calloutFor(s)?.id).toBe("driftRight");
    s.hsMs = 0;
    s.fuelPct = 2;
    expect(calloutFor(s)?.id).toBe("lowFuel");
    s.fuelPct = 0;
    expect(calloutFor(s)?.id).toBe("fuelOut");
  });

  it("recommends a slower descent nearer the ground", () => {
    expect(recommendedVs(150)).toBe(-3);
    expect(recommendedVs(20)).toBeGreaterThan(recommendedVs(60));
    expect(recommendedVs(0)).toBeCloseTo(-0.4, 6);
  });
});
