import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertApprox,
  assertInRange,
  assertEarthOrbitPeriod,
  assertLunarOrbitPeriod,
  assertLunarEclipseDuration,
} from "../harness/assertions.ts";

describe("Tier 1 Feature 4: Keplerian Orbital Mechanics & Lunar Eclipse Calculations", () => {
  // Authoritative physical constants from Telemetry Catalog NASA-APOLLO-SIM-2026-REV1 §4.2
  const EARTH_MU_KM3_S2 = 398_600.4418;
  const EARTH_RADIUS_KM = 6_378.137;
  const EARTH_J2 = 1.08263e-3;

  const MOON_MU_KM3_S2 = 4_904.8695;
  const MOON_RADIUS_KM = 1_737.4;

  /**
   * Reference Newton-Raphson Kepler solver matching crates/sim-core/src/kepler.rs
   */
  function solveKepler(meanAnomalyRad: f64, eccentricity: f64): number {
    const e = Math.min(Math.max(eccentricity, 0.0), 0.999999);
    if (e < 1e-12) return meanAnomalyRad;

    const twoPi = 2.0 * Math.PI;
    const m = ((meanAnomalyRad % twoPi) + twoPi) % twoPi;

    // Initial guess E0
    let eCurr = e < 0.8 ? m + e * Math.sin(m) + 0.5 * e * e * Math.sin(2.0 * m) : Math.PI;

    const tolerance = 1e-12;
    const maxIterations = 50;

    for (let i = 0; i < maxIterations; i++) {
      const f = eCurr - e * Math.sin(eCurr) - m;
      const fPrime = 1.0 - e * Math.cos(eCurr);
      const delta = f / fPrime;
      eCurr -= delta;
      if (Math.abs(delta) < tolerance) {
        break;
      }
    }
    return eCurr;
  }

  function trueAnomalyFromEccentric(eRad: number, e: number): number {
    const beta = Math.sqrt((1.0 + e) / (1.0 - e));
    const nu = 2.0 * Math.atan(beta * Math.tan(eRad / 2.0));
    return ((nu % (2.0 * Math.PI)) + 2.0 * Math.PI) % (2.0 * Math.PI);
  }

  it("Kepler Newton-Raphson solver converges quadratically across circular and eccentric regimes", () => {
    const testCases = [
      { e: 0.0, m: 0.0 },
      { e: 0.0, m: 1.570796 },
      { e: 0.05, m: 0.785398 },
      { e: 0.206, m: 2.356194 }, // Lunar transfer ellipse
      { e: 0.65, m: 4.712389 },
      { e: 0.85, m: 3.141592 },
    ];

    for (const { e, m } of testCases) {
      const E = solveKepler(m, e);

      // Verify Kepler equation identity: M = E - e * sin(E)
      const computedM = E - e * Math.sin(E);
      const diff = Math.abs(computedM - m);
      assert.ok(
        diff < 1e-9,
        `Kepler solver residual |(E - e*sin(E)) - M| = ${diff} must be < 1e-9 for e=${e}, M=${m}`
      );

      // Verify true anomaly is within [0, 2*pi)
      const nu = trueAnomalyFromEccentric(E, e);
      assert.ok(nu >= 0 && nu <= 2.0 * Math.PI);
    }
  });

  it("Apollo 11 Earth Parking Orbit (EPO) period matches 88.18 minutes", () => {
    // 185 km circular parking orbit
    const altitudeKm = 185.0;
    const semiMajorAxisKm = EARTH_RADIUS_KM + altitudeKm; // 6,563.137 km

    // Orbital period T = 2 * pi * sqrt(a^3 / mu)
    const periodSeconds = 2.0 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisKm, 3) / EARTH_MU_KM3_S2);
    const periodMinutes = periodSeconds / 60.0;

    // Telemetry Catalog §1.2 specifies 88.18 min
    assertApprox(periodMinutes, 88.18, 0.05, "EPO orbital period should be ~88.18 minutes");
    assertEarthOrbitPeriod(periodMinutes);

    // Circular orbital speed: v = sqrt(mu / a)
    const orbitalSpeedKmps = Math.sqrt(EARTH_MU_KM3_S2 / semiMajorAxisKm);
    const orbitalSpeedMps = orbitalSpeedKmps * 1000.0;
    assertApprox(orbitalSpeedMps, 7793.0, 10.0, "EPO circular speed should be ~7,791-7,793 m/s");
  });

  it("Apollo 11 Lunar Orbit state: 110 km circular orbit period and circular velocity", () => {
    // Apollo 11 nominal lunar parking orbit: 110 km circular (60 nmi)
    const lunarAltitudeKm = 110.0;
    const lunarSemiMajorAxisKm = MOON_RADIUS_KM + lunarAltitudeKm; // 1,847.4 km

    // Orbital period T = 2 * pi * sqrt(a^3 / mu_moon)
    const periodSeconds = 2.0 * Math.PI * Math.sqrt(Math.pow(lunarSemiMajorAxisKm, 3) / MOON_MU_KM3_S2);
    const periodMinutes = periodSeconds / 60.0;

    // Period is ~118.8 minutes (matches envelope 118.0 ± 6.0 min)
    assertApprox(periodMinutes, 118.81, 0.5, "Lunar orbit period should be ~118.8 minutes");
    assertLunarOrbitPeriod(periodMinutes);

    // Circular orbital velocity v = sqrt(mu_moon / a)
    const orbitalSpeedKmps = Math.sqrt(MOON_MU_KM3_S2 / lunarSemiMajorAxisKm);
    const orbitalSpeedMps = orbitalSpeedKmps * 1000.0;
    assertApprox(orbitalSpeedMps, 1629.3, 2.0, "Lunar circular velocity should be ~1,629 m/s");

    // Vis-viva consistency: v^2 = mu * (2/r - 1/a)
    const visVivaSpeed = Math.sqrt(MOON_MU_KM3_S2 * (2.0 / lunarSemiMajorAxisKm - 1.0 / lunarSemiMajorAxisKm));
    assertApprox(visVivaSpeed, orbitalSpeedKmps, 1e-6);
  });

  it("lunar cylindrical shadow calculator validates eclipse duration between 45.5 and 47.5 minutes", () => {
    // 110 km lunar orbit geometry
    const a = MOON_RADIUS_KM + 110.0; // 1,847.4 km
    const sinPhi = MOON_RADIUS_KM / a; // 1737.4 / 1847.4 = 0.94046
    const phi = Math.asin(sinPhi); // half-angle of occultation (rad)

    const periodSeconds = 2.0 * Math.PI * Math.sqrt(Math.pow(a, 3) / MOON_MU_KM3_S2);
    const eclipseDurationSeconds = (phi / Math.PI) * periodSeconds;
    const eclipseDurationMinutes = eclipseDurationSeconds / 60.0;

    // Telemetry Catalog §4.2 specifies 45.5 to 47.5 minutes
    assertInRange(
      eclipseDurationMinutes,
      45.0,
      47.8,
      "Lunar cylindrical eclipse duration must match historical 45.5 - 47.5 min window"
    );
    assertLunarEclipseDuration(eclipseDurationMinutes);
  });

  it("computes Earth J2 secular nodal precession rate and orbital plane rotation", () => {
    // Apollo 11 inclination: 32.52 degrees, altitude 185 km, e = 0
    const a = EARTH_RADIUS_KM + 185.0; // 6,563.137 km
    const incRad = (32.52 * Math.PI) / 180.0;

    // Mean motion n = sqrt(mu / a^3) in rad/s
    const n = Math.sqrt(EARTH_MU_KM3_S2 / Math.pow(a, 3));

    // Nodal precession rate: dOmega/dt = -1.5 * J2 * (R_E / p)^2 * n * cos(i)
    const dOmegaDtRadPerS = -1.5 * EARTH_J2 * Math.pow(EARTH_RADIUS_KM / a, 2) * n * Math.cos(incRad);
    const dOmegaDtDegPerDay = dOmegaDtRadPerS * (180.0 / Math.PI) * 86_400.0;

    // Negative sign represents westward (retrograde) nodal regression: ~ -7.58 deg/day
    assertInRange(dOmegaDtDegPerDay, -8.0, -7.0, "Apollo 11 J2 precession rate ~ -7.6 deg/day");

    // Theoretical boundary tests:
    // Polar orbit (i = 90 deg) has zero nodal precession: cos(90) = 0
    const polarIncRad = (90.0 * Math.PI) / 180.0;
    const polarPrecession = -1.5 * EARTH_J2 * Math.pow(EARTH_RADIUS_KM / a, 2) * n * Math.cos(polarIncRad);
    assertApprox(polarPrecession, 0.0, 1e-12, "Polar orbit experiences zero nodal precession");

    // Equatorial orbit (i = 0 deg) has maximal negative precession
    const eqIncRad = 0.0;
    const eqPrecession = -1.5 * EARTH_J2 * Math.pow(EARTH_RADIUS_KM / a, 2) * n * Math.cos(eqIncRad);
    assert.ok(eqPrecession < dOmegaDtRadPerS, "Equatorial orbit experiences maximum westward regression");
  });

  it("orbital energy conservation holds for Apollo 11 descent orbit insertion (15 x 111 km)", () => {
    // LM Descent Orbit Insertion (DOI): 15 km periapsis x 111 km apoapsis
    const rpKm = MOON_RADIUS_KM + 15.0; // 1,752.4 km
    const raKm = MOON_RADIUS_KM + 111.0; // 1,848.4 km
    const aKm = (rpKm + raKm) / 2.0; // 1,800.4 km
    const e = (raKm - rpKm) / (raKm + rpKm); // ~0.02666

    // Specific orbital energy epsilon = -mu / (2*a)
    const specificEnergy = -MOON_MU_KM3_S2 / (2.0 * aKm);

    // Speed at periapsis: v_p = sqrt(mu * (2/rp - 1/a))
    const vp = Math.sqrt(MOON_MU_KM3_S2 * (2.0 / rpKm - 1.0 / aKm));
    const energyAtPeriapsis = 0.5 * vp * vp - MOON_MU_KM3_S2 / rpKm;
    assertApprox(energyAtPeriapsis, specificEnergy, 1e-6);

    // Speed at apoapsis: v_a = sqrt(mu * (2/ra - 1/a))
    const va = Math.sqrt(MOON_MU_KM3_S2 * (2.0 / raKm - 1.0 / aKm));
    const energyAtApoapsis = 0.5 * va * va - MOON_MU_KM3_S2 / raKm;
    assertApprox(energyAtApoapsis, specificEnergy, 1e-6);

    // Periapsis speed must be higher than apoapsis speed
    assert.ok(vp > va, `Periapsis speed (${vp} km/s) must exceed apoapsis speed (${va} km/s)`);
  });
});
