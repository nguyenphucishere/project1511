import assert from "node:assert/strict";

/**
 * Asserts that actual is within epsilon of expected.
 */
export function assertApprox(
  actual: number,
  expected: number,
  eps = 1e-4,
  message?: string
): void {
  const diff = Math.abs(actual - expected);
  if (diff > eps) {
    const defaultMsg = `Expected ${actual} to be within ${eps} of ${expected} (diff: ${diff})`;
    throw new assert.AssertionError({
      message: message ? `${message} — ${defaultMsg}` : defaultMsg,
      actual,
      expected,
      operator: "assertApprox",
    });
  }
}

/**
 * Asserts that actual is between min and max inclusive.
 */
export function assertInRange(
  actual: number,
  min: number,
  max: number,
  message?: string
): void {
  if (actual < min || actual > max) {
    const defaultMsg = `Expected ${actual} to be in range [${min}, ${max}]`;
    throw new assert.AssertionError({
      message: message ? `${message} — ${defaultMsg}` : defaultMsg,
      actual,
      expected: `[${min}, ${max}]`,
      operator: "assertInRange",
    });
  }
}

/**
 * Asserts that actual is >= min.
 */
export function assertGreaterThanOrEqual(
  actual: number,
  min: number,
  message?: string
): void {
  if (actual < min) {
    const defaultMsg = `Expected ${actual} >= ${min}`;
    throw new assert.AssertionError({
      message: message ? `${message} — ${defaultMsg}` : defaultMsg,
      actual,
      expected: `>= ${min}`,
      operator: "assertGreaterThanOrEqual",
    });
  }
}

/**
 * Asserts that actual is <= max.
 */
export function assertLessThanOrEqual(
  actual: number,
  max: number,
  message?: string
): void {
  if (actual > max) {
    const defaultMsg = `Expected ${actual} <= ${max}`;
    throw new assert.AssertionError({
      message: message ? `${message} — ${defaultMsg}` : defaultMsg,
      actual,
      expected: `<= ${max}`,
      operator: "assertLessThanOrEqual",
    });
  }
}

/**
 * Asserts that a numerical series is monotonic in the specified direction.
 */
export function assertMonotonic(
  series: number[],
  direction: "increasing" | "decreasing" = "increasing",
  message?: string
): void {
  if (series.length < 2) return;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (direction === "increasing" && curr < prev) {
      throw new assert.AssertionError({
        message: `${message ?? "Series not monotonic increasing"}: index ${i - 1} (${prev}) > index ${i} (${curr})`,
        actual: series,
        operator: "assertMonotonic",
      });
    }
    if (direction === "decreasing" && curr > prev) {
      throw new assert.AssertionError({
        message: `${message ?? "Series not monotonic decreasing"}: index ${i - 1} (${prev}) < index ${i} (${curr})`,
        actual: series,
        operator: "assertMonotonic",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Physical Units & Apollo 11 Flight Envelope Assertions
// ---------------------------------------------------------------------------

/**
 * Verifies that dynamic pressure and time to Max-Q fall within Apollo 11 Saturn V flight envelope:
 * Max-Q time: 83.0 ± 15 s
 * Max-Q dynamic pressure: 34.3 ± 15 kPa
 */
export function assertMaxQWithinEnvelope(
  timeS: number,
  qKpa: number,
  message = "Max-Q values outside Saturn V flight envelope"
): void {
  assertInRange(timeS, 65.0, 100.0, `${message} (timeS = ${timeS})`);
  assertInRange(qKpa, 15.0, 50.0, `${message} (qKpa = ${qKpa})`);
}

/**
 * Verifies Saturn V liftoff thrust-to-weight ratio is nominal (~1.174, range [1.10, 1.30]).
 */
export function assertLiftoffTwrNominal(
  twr: number,
  message = "Liftoff TWR outside nominal envelope"
): void {
  assertInRange(twr, 1.10, 1.30, message);
}

/**
 * Verifies Earth 185 km parking orbit period is nominal (88.18 ± 2.0 min).
 */
export function assertEarthOrbitPeriod(
  periodMinutes: number,
  message = "Earth orbit period outside 185 km envelope"
): void {
  assertInRange(periodMinutes, 86.0, 90.5, message);
}

/**
 * Verifies Lunar 110 km orbit period is nominal (118.0 ± 6.0 min).
 */
export function assertLunarOrbitPeriod(
  periodMinutes: number,
  message = "Lunar orbit period outside 110 km envelope"
): void {
  assertInRange(periodMinutes, 112.0, 124.0, message);
}

/**
 * Verifies lunar farside eclipse/shadow duration is nominal (45.5 to 47.5 min ± 3 min).
 */
export function assertLunarEclipseDuration(
  durationMinutes: number,
  message = "Lunar eclipse duration outside nominal envelope"
): void {
  assertInRange(durationMinutes, 42.0, 51.0, message);
}

/**
 * Evaluates Apollo 11 Lunar Module touchdown structural limits:
 * - Lateral velocity Vx <= 1.22 m/s (4.0 ft/s)
 * - Vertical velocity Vz <= 3.05 m/s (10.0 ft/s) structural limit (nominal <= 2.13 m/s)
 * - Surface tilt <= 12.0 degrees
 * - Angular rate <= 2.0 deg/s (if provided)
 */
export function assertTouchdownWithinLimits(
  vxMs: number,
  vzMs: number,
  tiltDeg: number,
  angularRateDegS?: number,
  message = "LM touchdown readings exceed structural envelope"
): void {
  assertLessThanOrEqual(Math.abs(vxMs), 1.22, `${message}: lateral velocity ${vxMs} m/s > 1.22 m/s`);
  assertLessThanOrEqual(Math.abs(vzMs), 3.05, `${message}: vertical velocity ${vzMs} m/s > 3.05 m/s`);
  assertLessThanOrEqual(Math.abs(tiltDeg), 12.0, `${message}: surface tilt ${tiltDeg}° > 12.0°`);
  if (angularRateDegS !== undefined) {
    assertLessThanOrEqual(
      Math.abs(angularRateDegS),
      2.0,
      `${message}: angular rate ${angularRateDegS} deg/s > 2.0 deg/s`
    );
  }
}

/**
 * Verifies LM DPS throttle is outside the prohibited cavitation band [60.1%, 92.4%].
 * Valid ranges: 0% (cutoff), 10.0% to 60.0% (continuous), 92.5% to 100% (FTP).
 */
export function assertThrottleValid(
  throttlePct: number,
  message = "Throttle setting is invalid"
): void {
  if (throttlePct === 0) return;
  const inContinuous = throttlePct >= 10.0 && throttlePct <= 60.05;
  const inFtp = throttlePct >= 92.45 && throttlePct <= 100.0;
  if (!inContinuous && !inFtp) {
    throw new assert.AssertionError({
      message: `${message}: throttle ${throttlePct}% falls in prohibited cavitation band [60.1%, 92.4%] or out of range`,
      actual: throttlePct,
      expected: "10-60% or 92.5-100%",
      operator: "assertThrottleValid",
    });
  }
}

/**
 * Asserts that throttle is inside the prohibited cavitation band (60.1% to 92.4%).
 */
export function assertThrottleInCavitationBand(
  throttlePct: number,
  message = "Expected throttle to be in cavitation band"
): void {
  if (throttlePct <= 60.05 || throttlePct >= 92.45) {
    throw new assert.AssertionError({
      message: `${message}: throttle ${throttlePct}% is outside prohibited band (60.1% to 92.4%)`,
      actual: throttlePct,
      expected: "60.1% to 92.4%",
      operator: "assertThrottleInCavitationBand",
    });
  }
}

/**
 * Asserts AGC duty cycle threshold logic:
 * Alarm triggered if duty >= 85.0%, nominal otherwise.
 */
export function assertAgcAlarmDutyCycle(
  dutyPct: number,
  alarmTriggered: boolean,
  message = "AGC duty cycle does not match alarm state"
): void {
  if (dutyPct >= 85.0 && !alarmTriggered) {
    throw new assert.AssertionError({
      message: `${message}: CPU duty is ${dutyPct}% (>= 85.0%) but alarm was not triggered`,
      actual: alarmTriggered,
      expected: true,
      operator: "assertAgcAlarmDutyCycle",
    });
  }
  if (dutyPct < 85.0 && alarmTriggered) {
    throw new assert.AssertionError({
      message: `${message}: CPU duty is ${dutyPct}% (< 85.0%) but alarm was unexpectedly triggered`,
      actual: alarmTriggered,
      expected: false,
      operator: "assertAgcAlarmDutyCycle",
    });
  }
}

// ---------------------------------------------------------------------------
// Schema & API Response Assertions
// ---------------------------------------------------------------------------

/**
 * Validates KSC weather response schema.
 */
export function assertKscWeatherSchema(response: any): void {
  assert.ok(response && typeof response === "object", "Weather response must be an object");
  assert.equal(typeof response.temperature_c, "number", "temperature_c must be a number");
  assert.equal(typeof response.pressure_kpa, "number", "pressure_kpa must be a number");
  assert.equal(typeof response.wind_speed_kmh, "number", "wind_speed_kmh must be a number");
  assert.equal(typeof response.wind_direction_deg, "number", "wind_direction_deg must be a number");
  assert.equal(typeof response.humidity_pct, "number", "humidity_pct must be a number");
  assert.ok(
    ["GO", "HOLD", "NO-GO"].includes(response.status),
    `status must be GO, HOLD, or NO-GO; got '${response.status}'`
  );
  assert.ok(
    ["api", "offline_fallback"].includes(response.source),
    `source must be api or offline_fallback; got '${response.source}'`
  );
}

/**
 * Validates launch telemetry endpoint response schema.
 */
export function assertLaunchTelemetrySchema(response: any): void {
  assert.ok(response && typeof response === "object", "Launch telemetry response must be an object");
  assert.equal(typeof response.mission_id, "string", "mission_id must be a string");
  assert.equal(typeof response.target, "string", "target must be a string");
  assert.ok(response.coordinates && typeof response.coordinates === "object", "coordinates must be an object");
  assert.equal(typeof response.coordinates.lat, "number", "coordinates.lat must be a number");
  assert.equal(typeof response.coordinates.lon, "number", "coordinates.lon must be a number");
  assert.ok(response.vehicle && typeof response.vehicle === "object", "vehicle must be an object");
  assert.equal(typeof response.vehicle.glom_kg, "number", "vehicle.glom_kg must be a number");
  assert.ok(Array.isArray(response.vehicle.stages), "vehicle.stages must be an array");
  assert.ok(response.weather && typeof response.weather === "object", "weather must be an object");
  assert.ok(
    ["api", "offline_fallback"].includes(response.source),
    `source must be api or offline_fallback; got '${response.source}'`
  );
}

/**
 * Validates simulation validation endpoint / wasm envelope schema.
 */
export function assertSimulationValidationSchema(data: any): void {
  assert.ok(data && typeof data === "object", "Simulation validation must be an object");
  assert.equal(typeof data.is_valid, "boolean", "is_valid must be a boolean");
  assert.equal(typeof data.glom_kg, "number", "glom_kg must be a number");
  assert.equal(typeof data.liftoff_twr, "number", "liftoff_twr must be a number");
  assert.equal(typeof data.max_q_kpa, "number", "max_q_kpa must be a number");
  assert.equal(typeof data.max_q_time_s, "number", "max_q_time_s must be a number");
  assert.equal(typeof data.payload_margin_kg, "number", "payload_margin_kg must be a number");
}

/**
 * Validates lunar descent physics state schema.
 */
export function assertDescentStateSchema(state: any): void {
  assert.ok(state && typeof state === "object", "DescentState must be an object");
  assert.equal(typeof state.altitude_m, "number", "altitude_m must be a number");
  assert.equal(typeof state.vertical_velocity_mps, "number", "vertical_velocity_mps must be a number");
  assert.equal(typeof state.horizontal_velocity_mps, "number", "horizontal_velocity_mps must be a number");
  assert.equal(typeof state.throttle_pct, "number", "throttle_pct must be a number");
  assert.equal(typeof state.propellant_remaining_kg, "number", "propellant_remaining_kg must be a number");
  assert.equal(typeof state.agc_cpu_duty_pct, "number", "agc_cpu_duty_pct must be a number");
  assert.equal(typeof state.is_bingo_fuel, "boolean", "is_bingo_fuel must be a boolean");
  assert.equal(typeof state.is_landed, "boolean", "is_landed must be a boolean");
  assert.equal(typeof state.touchdown_status, "string", "touchdown_status must be a string");
}

/**
 * Validates mission ending schema.
 */
export function assertEndingDefinition(ending: any): void {
  assert.ok(ending && typeof ending === "object", "Ending must be an object");
  assert.equal(typeof ending.id, "string", "ending.id must be a string");
  assert.ok(["success", "partial", "fatal"].includes(ending.status), "status must be success, partial, or fatal");
  assert.equal(typeof ending.score, "number", "ending.score must be a number");
  assert.ok(ending.title && typeof ending.title === "object", "ending.title must be LocalizedText");
}
