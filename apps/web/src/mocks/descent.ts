import type { LocalizedText } from "@/i18n";

/**
 * DEMO lunar descent profile. Scripted, not simulated: five keyframes in the spirit of a crewed
 * powered descent (start at ~15 km, high gate ~2 km, low gate ~150 m, contact ~2 m). Between them
 * altitude follows a cubic Hermite curve whose slopes are the vertical speeds, so the altitude and
 * vertical-speed charts always agree. Replace with engine output when the lunar model exists.
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

export const KEYFRAMES: DescentKeyframe[] = [
  { t: 0, altM: 15000, vsMs: 0, fuelPct: 100 },
  { t: 470, altM: 2200, vsMs: -30, fuelPct: 38 },
  { t: 580, altM: 150, vsMs: -3, fuelPct: 18 },
  { t: 700, altM: 2, vsMs: -0.6, fuelPct: 6 },
  { t: 703, altM: 0, vsMs: -0.5, fuelPct: 5 },
];

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

/** The softest vertical speed, m/s, the DEMO counts as a safe touchdown. */
export const SAFE_TOUCHDOWN_MS = 3;

export interface DescentSample {
  t: number;
  altM: number;
  vsMs: number;
  fuelPct: number;
}

/** State at mission time `t` (seconds since powered descent), clamped to the profile. */
export function sampleAt(t: number): DescentSample {
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  if (t <= 0) return { ...KEYFRAMES[0] };
  if (t >= last.t) return { t: last.t, altM: 0, vsMs: last.vsMs, fuelPct: last.fuelPct };
  const i = KEYFRAMES.findIndex((k, n) => t >= k.t && t < KEYFRAMES[n + 1].t);
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const h = b.t - a.t;
  const s = (t - a.t) / h;
  // Cubic Hermite basis and its derivative.
  const s2 = s * s;
  const s3 = s2 * s;
  const alt =
    (2 * s3 - 3 * s2 + 1) * a.altM + (s3 - 2 * s2 + s) * h * a.vsMs + (-2 * s3 + 3 * s2) * b.altM + (s3 - s2) * h * b.vsMs;
  const dAlt =
    ((6 * s2 - 6 * s) * a.altM + (3 * s2 - 4 * s + 1) * h * a.vsMs + (-6 * s2 + 6 * s) * b.altM + (3 * s2 - 2 * s) * h * b.vsMs) / h;
  return { t, altM: Math.max(0, alt), vsMs: dAlt, fuelPct: a.fuelPct + (b.fuelPct - a.fuelPct) * s };
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

export const TOUCHDOWN = KEYFRAMES[KEYFRAMES.length - 1];
