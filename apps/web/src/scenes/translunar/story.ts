import type { LocalizedText } from "@/i18n";
import type { ScoreMood } from "@/game/sfx";
import { T } from "./flight";

/** A caption shown over the film between two film times. */
export interface Caption {
  from: number;
  to: number;
  text: LocalizedText;
}

/** The title of each stretch of the flight, shown small above the letterbox. */
export const PHASES: Caption[] = [
  { from: 0, to: T.TLI_END, text: { en: "Translunar injection: leaving Earth orbit", vi: "Đốt đẩy rời quỹ đạo Trái Đất" } },
  { from: T.TLI_END, to: T.COAST, text: { en: "Eagle in tow: one last look back", vi: "Eagle đã gắn liền: ngoảnh nhìn lại lần cuối" } },
  { from: T.COAST, to: 66, text: { en: "Three days of silence", vi: "Ba ngày trong im lặng" } },
  { from: 66, to: T.LOS, text: { en: "The Moon fills the sky", vi: "Mặt Trăng choán cả bầu trời" } },
  { from: T.LOS, to: T.AOS, text: { en: "Behind the Moon: orbit insertion burn", vi: "Sau lưng Mặt Trăng: đốt nhập quỹ đạo" } },
  { from: T.AOS, to: T.CABIN, text: { en: "Fourth orbit: the Earth rises", vi: "Vòng quỹ đạo thứ tư: Trái Đất mọc" } },
  { from: T.CABIN, to: T.OUTBOUND_END, text: { en: "Christmas Eve, 1968", vi: "Đêm Giáng Sinh, 1968" } },
  { from: T.OUTBOUND_END, to: T.REENTRY, text: { en: "Trans-Earth injection: homeward", vi: "Đốt về nhà: hướng về Trái Đất" } },
  { from: T.REENTRY, to: T.CHUTES, text: { en: "Reentry: three and a half minutes of radio blackout", vi: "Tái nhập khí quyển: ba phút rưỡi mất liên lạc" } },
  { from: T.CHUTES, to: T.FILM_END, text: { en: "Splashdown in the Pacific", vi: "Hạ xuống Thái Bình Dương" } },
];

/** The reading from the cabin on Christmas Eve (Genesis 1:1–4, King James Version, public domain). */
export const READING: Caption[] = [
  { from: 119.5, to: 124.5, text: { en: "In the beginning God created the heaven and the earth.", vi: "Ban đầu, Đức Chúa Trời dựng nên trời và đất." } },
  { from: 124.5, to: 130, text: { en: "And the earth was without form, and void; and darkness was upon the face of the deep.", vi: "Đất còn vô hình và trống không, bóng tối bao trùm mặt vực." } },
  { from: 130, to: 135, text: { en: "And God said, Let there be light: and there was light.", vi: "Đức Chúa Trời phán: Phải có ánh sáng; thì có ánh sáng." } },
  { from: 135, to: 139.6, text: { en: "And God saw the light, that it was good.", vi: "Đức Chúa Trời thấy ánh sáng là tốt lành." } },
];

export function captionAt(list: Caption[], t: number): Caption | undefined {
  return list.find((c) => t >= c.from && t < c.to);
}

/** Mood of the film score at film time t. */
export function moodAt(t: number): ScoreMood {
  if (t < T.TLI_END) return "ride";
  if (t < T.COAST) return "awe";
  if (t < 66) return "hush";
  if (t < T.LOS) return "awe";
  if (t < T.AOS) return "dread";
  if (t < T.CABIN) return "awe";
  if (t < T.OUTBOUND_END) return "hush";
  if (t < T.REENTRY) return "ride";
  if (t < T.CHUTES) return "dread";
  return "awe";
}

/** One-shot sounds, fired the first time the film clock passes their time. */
export const CUES: { t: number; id: "ignition" | "pyro" | "unlatch" | "caution" | "chime" | "whoosh" | "touchdown" | "thud"; gain?: number }[] = [
  { t: 0.3, id: "ignition" },
  { t: T.SEP - 0.2, id: "pyro", gain: 1.6 },
  { t: T.SEP + 0.3, id: "unlatch", gain: 1.6 },
  { t: T.LOS, id: "caution" },
  { t: T.BURN_IN, id: "ignition", gain: 0.6 },
  { t: T.AOS, id: "chime" },
  { t: T.OUTBOUND_END + 0.3, id: "ignition", gain: 0.8 },
  { t: T.REENTRY, id: "whoosh" },
  { t: T.TOUCHDOWN, id: "touchdown", gain: 0.7 },
];
