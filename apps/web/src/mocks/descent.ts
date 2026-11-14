import type { LocalizedText } from "@/i18n";
import {
  DPS_ISP_S,
  simulatePoweredDescent,
  type DescentProfile,
} from "@/lib/simulation/trajectory.physics";

/**
 * Lunar descent profile (Scene 6), calculated by the simulation engine (sim-core
 * `simulate_powered_descent`): LM-5 mass and DPS thrust / Isp / propellant from the telemetry
 * catalogue, PDI at 15,240 m and 1,695 m/s, guidance through the §4.3 high gate and low gate,
 * gravity from the engine's lunar constants. The scene installs the engine's own profile on load;
 * until then the identical TypeScript port supplies it.
 *
 * Keyframes 0–2 (PDI, high gate, low gate) are the engine's. Keyframes 3–4 are a reference
 * finish for charts and the radar only (the player flies the real one): a constant deceleration
 * from the low gate to the 1.71 m contact probes at −0.9 m/s, then engine stop and a free fall.
 */

export type DescentStepId = "pdi" | "pitch" | "site" | "engine-stop";

export interface DescentKeyframe {
  /** Seconds since powered descent started. */
  t: number;
  altM: number;
  /** Vertical speed, m/s; negative is down. */
  vsMs: number;
  fuelPct: number;
}

/** LM contact-probe length, m (§2.1: 1.71 m probes). */
export const CONTACT_PROBE_M = 1.71;
const REFERENCE_CONTACT_VS = -0.9;
const G0 = 9.80665;

/** The engine's descent profile currently in use. */
export let DESCENT: DescentProfile = simulatePoweredDescent();

const pct = (kg: number, p: DescentProfile) => (kg / p.dps_propellant_capacity_kg) * 100;

function keyframesFor(p: DescentProfile): DescentKeyframe[] {
  const pdi = p.samples[0]!;
  const hg = p.high_gate;
  const lg = p.low_gate;
  const g = p.local_gravity_mps2;
  // Reference finish: uniform deceleration to the probes, burning at the thrust that needs.
  const dur = (2 * (lg.altitude_m - CONTACT_PROBE_M)) / (Math.abs(lg.vertical_velocity_mps) + Math.abs(REFERENCE_CONTACT_VS));
  const decel = (Math.abs(lg.vertical_velocity_mps) - Math.abs(REFERENCE_CONTACT_VS)) / dur;
  const burnKg = (lg.mass_kg * (g + decel) * dur) / (DPS_ISP_S * G0);
  const contactProp = Math.max(0, lg.propellant_kg - burnKg);
  const vTouch = Math.sqrt(REFERENCE_CONTACT_VS ** 2 + 2 * g * CONTACT_PROBE_M);
  const fall = (vTouch - Math.abs(REFERENCE_CONTACT_VS)) / g;
  return [
    { t: 0, altM: pdi.altitude_m, vsMs: pdi.vertical_velocity_mps, fuelPct: pct(pdi.propellant_kg, p) },
    { t: hg.t_s, altM: hg.altitude_m, vsMs: hg.vertical_velocity_mps, fuelPct: pct(hg.propellant_kg, p) },
    { t: lg.t_s, altM: lg.altitude_m, vsMs: lg.vertical_velocity_mps, fuelPct: pct(lg.propellant_kg, p) },
    { t: lg.t_s + dur, altM: CONTACT_PROBE_M, vsMs: REFERENCE_CONTACT_VS, fuelPct: pct(contactProp, p) },
    { t: lg.t_s + dur + fall, altM: 0, vsMs: -vTouch, fuelPct: pct(contactProp, p) },
  ];
}

export let KEYFRAMES: DescentKeyframe[] = keyframesFor(DESCENT);
export let TOUCHDOWN: DescentKeyframe = KEYFRAMES[KEYFRAMES.length - 1]!;

/** Replaces the profile with the engine's answer (WASM worker or server). */
export function installDescentProfile(p: DescentProfile): void {
  if (!p || !Array.isArray(p.samples) || p.samples.length < 2 || !p.low_gate) return;
  DESCENT = p;
  KEYFRAMES = keyframesFor(p);
  TOUCHDOWN = KEYFRAMES[KEYFRAMES.length - 1]!;
}

export interface DescentStep {
  id: DescentStepId;
  /** The switch label on the console. */
  label: LocalizedText;
  /** What the crew calls when the switch becomes the next one to press. */
  cue: LocalizedText;
  /**
   * Real seconds the scripted segment this switch starts takes to play. Null for the two steps that
   * hand the lander to the player (site choice and the manual descent, then engine stop): those
   * run on the flight model, not on this profile.
   */
  playSec: number | null;
}

/** The four controls, in the only order they work. Steps 0 and 1 play keyframe i → i+1; 2 and 3 are flown. */
export const DESCENT_STEPS: DescentStep[] = [
  {
    id: "pdi",
    label: { en: "Start powered descent", vi: "Bắt đầu hạ cánh có động cơ" },
    cue: {
      en: "15 km up and on the descent orbit. Fire the descent engine.",
      vi: "Đang ở độ cao 15 km trên quỹ đạo hạ cánh. Khởi động động cơ hạ cánh.",
    },
    playSec: 7,
  },
  {
    id: "pitch",
    label: { en: "Pitch over", vi: "Xoay thẳng tàu" },
    cue: {
      en: "High gate. Pitch the lander upright so we can see the landing area.",
      vi: "Đã qua mốc cao. Xoay tàu đứng thẳng để nhìn thấy vùng đáp.",
    },
    playSec: 5,
  },
  {
    id: "site",
    label: { en: "Confirm landing site", vi: "Chốt điểm đáp" },
    cue: {
      en: "Low gate, 150 m. Boulders dead ahead. Pick a landing site, then fly us onto it.",
      vi: "Mốc thấp, 150 m. Ngay phía trước toàn đá tảng. Chọn điểm đáp rồi lái tàu tới đó.",
    },
    playSec: null,
  },
  {
    id: "engine-stop",
    label: { en: "Engine stop", vi: "Tắt động cơ" },
    cue: {
      en: "Contact light! The probes touched the ground. Engine stop.",
      vi: "Đèn tiếp đất sáng! Các que dò đã chạm mặt đất. Tắt động cơ.",
    },
    playSec: null,
  },
];

/** Touchdown structural limit, m/s (§4.3: ≤ 3.05 m/s vertical with no sideways speed). */
export const SAFE_TOUCHDOWN_MS = 3.05;

export interface DescentSample {
  t: number;
  altM: number;
  vsMs: number;
  fuelPct: number;
  /** Forward (horizontal) speed, m/s. */
  hsMs: number;
  /** Fraction of the 45.04 kN rated thrust. */
  throttle: number;
  /** LM attitude from vertical, degrees. */
  pitchDeg: number;
}

/** Cubic Hermite between two (t, alt, vs) points: altitude and vertical speed stay consistent. */
function hermite(t0: number, a0: number, v0: number, t1: number, a1: number, v1: number, t: number) {
  const h = t1 - t0;
  const s = (t - t0) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  const alt = (2 * s3 - 3 * s2 + 1) * a0 + (s3 - 2 * s2 + s) * h * v0 + (-2 * s3 + 3 * s2) * a1 + (s3 - s2) * h * v1;
  const dAlt = ((6 * s2 - 6 * s) * a0 + (3 * s2 - 4 * s + 1) * h * v0 + (-6 * s2 + 6 * s) * a1 + (3 * s2 - 2 * s) * h * v1) / h;
  return { alt, vs: dAlt, s };
}

/** State at mission time `t` (seconds since powered descent), clamped to the profile. */
export function sampleAt(t: number): DescentSample {
  const p = DESCENT;
  const samples = p.samples;
  const lg = p.low_gate;
  const last = KEYFRAMES[KEYFRAMES.length - 1]!;
  if (t <= 0) {
    const s0 = samples[0]!;
    return { t: 0, altM: s0.altitude_m, vsMs: s0.vertical_velocity_mps, fuelPct: pct(s0.propellant_kg, p), hsMs: s0.horizontal_velocity_mps, throttle: s0.throttle, pitchDeg: s0.attitude_from_vertical_deg };
  }
  if (t >= last.t) return { t: last.t, altM: 0, vsMs: last.vsMs, fuelPct: last.fuelPct, hsMs: 0, throttle: 0, pitchDeg: 0 };
  if (t <= lg.t_s) {
    // The engine's per-second samples.
    let i = Math.min(samples.length - 2, Math.max(0, Math.floor(t)));
    while (i > 0 && samples[i]!.t_s > t) i--;
    while (i < samples.length - 2 && samples[i + 1]!.t_s < t) i++;
    const a = samples[i]!;
    const b = samples[i + 1]!;
    const h = hermite(a.t_s, a.altitude_m, a.vertical_velocity_mps, b.t_s, b.altitude_m, b.vertical_velocity_mps, t);
    const lerp = (x: number, y: number) => x + (y - x) * h.s;
    return {
      t,
      altM: Math.max(0, h.alt),
      vsMs: h.vs,
      fuelPct: pct(lerp(a.propellant_kg, b.propellant_kg), p),
      hsMs: lerp(a.horizontal_velocity_mps, b.horizontal_velocity_mps),
      throttle: a.throttle,
      pitchDeg: lerp(a.attitude_from_vertical_deg, b.attitude_from_vertical_deg),
    };
  }
  // Reference finish (keyframes 2 → 3 → 4).
  const k = t < KEYFRAMES[3]!.t ? 2 : 3;
  const a = KEYFRAMES[k]!;
  const b = KEYFRAMES[k + 1]!;
  const h = hermite(a.t, a.altM, a.vsMs, b.t, b.altM, b.vsMs, t);
  const hover = (p.local_gravity_mps2 * lg.mass_kg) / p.dps_max_thrust_n;
  return {
    t,
    altM: Math.max(0, h.alt),
    vsMs: h.vs,
    fuelPct: a.fuelPct + (b.fuelPct - a.fuelPct) * h.s,
    hsMs: lg.horizontal_velocity_mps * Math.max(0, 1 - (t - lg.t_s) / (KEYFRAMES[3]!.t - lg.t_s)),
    throttle: k === 2 ? hover : 0,
    pitchDeg: 0,
  };
}

/** Mission time reached `realSec` into the segment started by step `index`. */
export function missionTimeAt(index: number, realSec: number): number {
  const a = KEYFRAMES[index];
  const b = KEYFRAMES[index + 1];
  const playSec = DESCENT_STEPS[index].playSec;
  // A flown step has no scripted segment: the clock stays at its starting keyframe.
  if (playSec === null) return a.t;
  const p = Math.min(1, Math.max(0, realSec / playSec));
  // Ease out so each segment settles into its hold point instead of stopping dead.
  const eased = 1 - (1 - p) * (1 - p);
  return a.t + (b.t - a.t) * eased;
}

