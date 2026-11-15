import type { LocalizedText } from "@/i18n";
import type { ScoreMood } from "@/game/sfx";
import { MAIN_DELAY, T, filmAtMet, hms } from "./flight";

/** A caption shown over the film between two film times. */
export interface Caption {
  from: number;
  to: number;
  text: LocalizedText;
}

/** The title of each stretch of the flight, shown small above the letterbox. */
export const PHASES: Caption[] = [
  { from: 0, to: T.TLI_END, text: { en: "Translunar injection: leaving Earth orbit", vi: "Đốt đẩy rời quỹ đạo Trái Đất" } },
  { from: T.TLI_END, to: T.FLIP_A, text: { en: "Separation: the ship leaves the spent third stage", vi: "Tách khỏi tầng 3 đã cạn nhiên liệu" } },
  { from: T.FLIP_A, to: T.DOCK, text: { en: "Transposition: the ship turns around to face Eagle", vi: "Quay đầu tàu để hướng về Eagle" } },
  { from: T.DOCK, to: T.COAST, text: { en: "Docking: Eagle is drawn out of the adapter", vi: "Ghép nối: Eagle được kéo ra khỏi tầng 3" } },
  { from: T.COAST, to: 66, text: { en: "Three days of silence", vi: "Ba ngày trong im lặng" } },
  { from: 66, to: T.LOS, text: { en: "The Moon fills the sky", vi: "Mặt Trăng choán cả bầu trời" } },
  { from: T.LOS, to: T.AOS, text: { en: "Behind the Moon: orbit insertion burn", vi: "Sau lưng Mặt Trăng: đốt nhập quỹ đạo" } },
  { from: T.AOS, to: T.CABIN, text: { en: "Fourth orbit: the Earth rises", vi: "Vòng quỹ đạo thứ tư: Trái Đất mọc" } },
  { from: T.CABIN, to: T.OUTBOUND_END, text: { en: "Christmas Eve, 1968", vi: "Đêm Giáng Sinh, 1968" } },
  { from: T.OUTBOUND_END, to: T.TEI_END, text: { en: "Trans-Earth injection: homeward", vi: "Đốt về nhà: hướng về Trái Đất" } },
  { from: T.TEI_END, to: T.SM_SEP, text: { en: "Two and a half days home", vi: "Hai ngày rưỡi trên đường về" } },
  { from: T.SM_SEP, to: T.REENTRY, text: { en: "Service module jettisoned", vi: "Thả mô-đun phục vụ" } },
  { from: T.REENTRY, to: T.CHUTES, text: { en: "Reentry: three and a half minutes of radio blackout", vi: "Tái nhập khí quyển: ba phút rưỡi mất liên lạc" } },
  { from: T.CHUTES, to: T.TOUCHDOWN, text: { en: "Splashdown in the Pacific", vi: "Hạ xuống Thái Bình Dương" } },
  { from: T.TOUCHDOWN, to: T.FILM_END, text: { en: "Recovery: swimmers and the carrier Hornet", vi: "Vớt tàu: thợ lặn và tàu sân bay Hornet" } },
];

/** The reading from the cabin on Christmas Eve (Genesis 1:1–4, King James Version, public domain). */
export const READING: Caption[] = [
  { from: 119.5, to: 124.5, text: { en: "In the beginning God created the heaven and the earth.", vi: "Ban đầu, Đức Chúa Trời dựng nên trời và đất." } },
  { from: 124.5, to: 130, text: { en: "And the earth was without form, and void; and darkness was upon the face of the deep.", vi: "Đất còn vô hình và trống không, bóng tối bao trùm mặt vực." } },
  { from: 130, to: 135, text: { en: "And God said, Let there be light: and there was light.", vi: "Đức Chúa Trời phán: Phải có ánh sáng; thì có ánh sáng." } },
  { from: 135, to: 139.6, text: { en: "And God saw the light, that it was good.", vi: "Đức Chúa Trời thấy ánh sáng là tốt lành." } },
];

/** The corner panel for the radio: Houston, the recovery ships and the swimmers. */
export const HOUSTON = {
  title: { en: "Radio · air to ground", vi: "Vô tuyến · không đối đất" } satisfies LocalizedText,
  noSignal: { en: "No signal", vi: "Mất tín hiệu" } satisfies LocalizedText,
  signal: { en: "On the air", vi: "Đang liên lạc" } satisfies LocalizedText,
  waiting: { en: "Expected contact in", vi: "Dự kiến có liên lạc sau" } satisfies LocalizedText,
};

export type RadioWho = "houston" | "armstrong" | "hornet" | "swim1";

export interface RadioLine {
  /** Film time the line is heard. */
  t: number;
  who: RadioWho;
  /** The voice role that reads it (tools/voice/voices.json). */
  role: "capcom" | "armstrong" | "booster" | "bales";
  text: LocalizedText;
}

export const RADIO_WHO: Record<RadioWho, LocalizedText> = {
  houston: { en: "Houston", vi: "Houston" },
  armstrong: { en: "Armstrong", vi: "Armstrong" },
  hornet: { en: "USS Hornet", vi: "USS Hornet" },
  swim1: { en: "Swim 1", vi: "Thợ lặn 1" },
};

/**
 * The real air-to-ground traffic of Apollo 11's entry and recovery, in order (NASA's Technical Air-to-Ground
 * Voice Transcription, GOSS NET 1, tape 125; the Ground Elapsed Times are the transcript's). The first three
 * are before the blackout, so they are pinned to the seconds just ahead of the entry interface, and the
 * exchanges with the Hornet and the swimmers are spaced by how long each is, because in the film's compressed
 * clock they would otherwise fall on top of one another. After the
 * blackout Houston calls through the ARIA aircraft for minutes and hears nothing back. Lines in which the
 * transcript is clipped or garbled are left out.
 */
export const RADIO_LOG: RadioLine[] = [
  { t: T.REENTRY - 15.5, who: "houston", role: "capcom", text: { en: "We'll have you for about 3 or 4 minutes through Redstone, and then pick you up after blackout through ARIA.", vi: "Chúng tôi giữ liên lạc với các bạn khoảng ba đến bốn phút qua trạm Redstone, rồi bắt lại sau thời gian mất liên lạc qua máy bay ARIA." } },
  { t: T.REENTRY - 7, who: "houston", role: "capcom", text: { en: "You're looking mighty fine to us.", vi: "Trông các bạn rất ổn." } },
  { t: T.REENTRY - 4.7, who: "armstrong", role: "armstrong", text: { en: "See you later.", vi: "Hẹn gặp lại." } },
  { t: filmAtMet(hms(195, 7, 15)), who: "houston", role: "capcom", text: { en: "Apollo 11, Houston through ARIA.", vi: "Apollo 11, Houston gọi qua ARIA." } },
  { t: filmAtMet(hms(195, 9, 8)), who: "houston", role: "capcom", text: { en: "Apollo 11, Houston through ARIA. Standing by. Over.", vi: "Apollo 11, Houston gọi qua ARIA. Đang chờ. Hết." } },
  { t: filmAtMet(hms(195, 9, 45)), who: "houston", role: "capcom", text: { en: "Apollo 11, Houston in the blind. Air Boss has visual contact.", vi: "Apollo 11, Houston gọi mà chưa nghe hồi âm. Chỉ huy không lực đã nhìn thấy tàu." } },
  { t: filmAtMet(hms(195, 12, 9)), who: "houston", role: "capcom", text: { en: "Drogues.", vi: "Dù hãm đã mở." } },
  { t: T.CHUTES + 25, who: "hornet", role: "booster", text: { en: "Apollo 11, Apollo 11. This is Hornet. Over.", vi: "Apollo 11, Apollo 11. Hornet đây. Hết." } },
  { t: T.CHUTES + 30.4, who: "armstrong", role: "armstrong", text: { en: "Hello, Hornet. This is Apollo 11, reading you loud and clear.", vi: "Chào Hornet. Apollo 11 đây, nghe rất rõ." } },
  { t: T.CHUTES + 35.7, who: "hornet", role: "booster", text: { en: "11, this is Hornet. What's your error of splashdown and condition of crew? Over.", vi: "11, Hornet đây. Sai số điểm hạ cánh và tình trạng phi hành đoàn thế nào? Hết." } },
  { t: T.CHUTES + 43, who: "hornet", role: "booster", text: { en: "Roger. Twenty-five hundred on chutes.", vi: "Rõ. Hai nghìn năm trăm feet trên dù." } },
  { t: T.CHUTES + 46.6, who: "swim1", role: "bales", text: { en: "Roger. You're looking real good.", vi: "Rõ. Trông các bạn rất tốt." } },
  { t: T.TOUCHDOWN - 0.4, who: "swim1", role: "bales", text: { en: "Splashdown!", vi: "Đã chạm nước!" } },
];

/** How long a radio line stays in the corner panel after it is heard, seconds (or until the next line). */
export const RADIO_HOLD = 7.5;

/** The radio line to show at film time t. */
export function radioLineAt(t: number): RadioLine | undefined {
  const i = RADIO_LOG.findLastIndex((l) => t >= l.t);
  const line = RADIO_LOG[i];
  if (!line) return undefined;
  const next = RADIO_LOG[i + 1]?.t ?? Infinity;
  return t < Math.min(line.t + RADIO_HOLD, next) ? line : undefined;
}

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
  if (t < T.TEI_END) return "ride";
  if (t < T.SM_SEP) return "hush";
  if (t < T.REENTRY) return "dread";
  if (t < T.CHUTES) return "dread";
  return "awe";
}

/** One-shot sounds, fired the first time the film clock passes their time. */
export const CUES: { t: number; id: "ignition" | "pyro" | "unlatch" | "caution" | "chime" | "whoosh" | "touchdown" | "thud" | "clunk" | "hydraulic"; gain?: number }[] = [
  { t: 0.3, id: "ignition" },
  { t: T.SEP - 0.2, id: "pyro", gain: 1.6 },
  { t: T.SEP + 0.3, id: "unlatch", gain: 1.6 },
  { t: T.DOCK - 0.1, id: "clunk", gain: 1.5 },
  { t: T.DOCK + 0.5, id: "hydraulic", gain: 0.9 },
  { t: T.LOS, id: "caution" },
  { t: T.BURN_IN, id: "ignition", gain: 0.6 },
  { t: T.AOS, id: "chime" },
  { t: T.OUTBOUND_END + 0.3, id: "ignition", gain: 0.8 },
  { t: T.SM_SEP, id: "pyro", gain: 1.4 },
  { t: T.SM_SEP + 0.5, id: "unlatch", gain: 1.2 },
  { t: T.REENTRY, id: "whoosh" },
  { t: T.CHUTES, id: "pyro", gain: 1 },
  { t: T.CHUTES + 0.2, id: "whoosh", gain: 0.9 },
  { t: T.CHUTES + MAIN_DELAY, id: "pyro", gain: 0.8 },
  { t: T.CHUTES + MAIN_DELAY + 0.3, id: "thud", gain: 0.7 },
  { t: T.TOUCHDOWN, id: "touchdown", gain: 0.7 },
];
