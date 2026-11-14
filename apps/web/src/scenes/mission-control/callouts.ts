import type { LocalizedText } from "@/i18n";
import type { RadioVoice } from "@/game/radio";
import { ADAPTER_T, CUTOFF_T, DOCK_T, HOLD_DOWN, LES_T, SEP2_T, SEPARATION_T, STAGE2_T, STAGE3_T } from "./ascent";
import { MAX_Q_SEC, realSecondsAt } from "./flight";

/**
 * What launch control says over the radio as the rocket climbs, and the one keyword shown on screen
 * for it: the name of the stage or event, nothing more. Times are real seconds after ignition and
 * follow the film (see ascent.ts), so a call lands with the moment it describes.
 */
export interface Callout {
  t: number;
  voice: RadioVoice;
  /** The words on the radio. */
  line: LocalizedText;
  /** The on-screen keyword. */
  keyword: LocalizedText;
}

const c = (t: number, voice: RadioVoice, keyword: LocalizedText, line: LocalizedText): Callout => ({ t, voice, keyword, line });
const l = (en: string, vi: string): LocalizedText => ({ en, vi });

/** The final countdown, read out loud one number a second: index 0 is "one", index 9 is "ten". */
export const COUNT_VOICE: LocalizedText[] = [
  l("One.", "Một."),
  l("Two.", "Hai."),
  l("Three.", "Ba."),
  l("Four.", "Bốn."),
  l("Five.", "Năm."),
  l("Six.", "Sáu."),
  l("Seven.", "Bảy."),
  l("Eight.", "Tám."),
  l("Nine.", "Chín."),
  l("Ten.", "Mười."),
];

export const MAX_Q_T = realSecondsAt(MAX_Q_SEC);

export const CALLOUTS: Callout[] = [
  c(0.4, "capcom", l("Ignition", "Đánh lửa"), l("Ignition sequence start. We have ignition.", "Bắt đầu đánh lửa. Động cơ đã nổ.")),
  c(HOLD_DOWN + 0.3, "capcom", l("Liftoff", "Rời bệ"), l("Liftoff. We have a liftoff.", "Rời bệ. Tên lửa đã rời bệ phóng.")),
  c(HOLD_DOWN + 5.2, "capcom", l("Tower cleared", "Qua tháp"), l("Tower cleared.", "Đã qua tháp phóng.")),
  c(MAX_Q_T - 0.6, "booster", l("Max-Q", "Áp suất cực đại"), l("Passing max Q. Engines steady.", "Qua áp suất cực đại. Động cơ ổn định.")),
  c(SEPARATION_T - 7, "booster", l("Engine cutoff", "Tắt động cơ"), l("Stage one engines cutting off.", "Động cơ tầng một đang tắt.")),
  c(SEPARATION_T - 0.4, "capcom", l("Stage 1 separation", "Tách tầng 1"), l("Stage one separation. Confirmed.", "Tách tầng một. Đã xác nhận.")),
  c(STAGE2_T, "booster", l("Stage 2 ignition", "Tầng 2 nổ máy"), l("Stage two ignition. All engines burning.", "Tầng hai nổ máy. Tất cả động cơ đang cháy.")),
  c(LES_T, "capcom", l("Tower jettison", "Bỏ tháp thoát hiểm"), l("Tower jettison.", "Bỏ tháp thoát hiểm.")),
  c(SEP2_T - 0.4, "capcom", l("Stage 2 separation", "Tách tầng 2"), l("Stage two separation. Confirmed.", "Tách tầng hai. Đã xác nhận.")),
  c(STAGE3_T, "booster", l("Stage 3 ignition", "Tầng 3 nổ máy"), l("Stage three ignition. Engine burning.", "Tầng ba nổ máy. Động cơ đang cháy.")),
  c(ADAPTER_T, "capcom", l("Adapter open", "Mở vỏ adapter"), l("Adapter panels open.", "Vỏ adapter đã mở.")),
  c(CUTOFF_T, "capcom", l("Orbit", "Vào quỹ đạo"), l("Stage three cutoff. We are in orbit.", "Tầng ba đã tắt. Chúng ta đã vào quỹ đạo.")),
  c(DOCK_T, "capcom", l("Docked", "Đã đối sát"), l("Docking confirmed. Lander captured.", "Đã đối sát. Tàu đổ bộ đã được gắn.")),
];

/** How long a keyword stays on screen. */
export const KEYWORD_SECONDS = 3.6;

/**
 * The calls that fall due between two film times. A call is "due" only while its time is fresh, so
 * skipping ahead does not replay the ones that were jumped over.
 */
export function calloutsDue(from: number, to: number, fresh = 2.5): Callout[] {
  return CALLOUTS.filter((x) => x.t > from && x.t <= to && to - x.t < fresh);
}
