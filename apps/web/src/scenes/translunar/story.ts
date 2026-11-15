import type { LocalizedText } from "@/i18n";
import type { ScoreMood } from "@/game/sfx";
import { MAIN_DELAY, T, filmAtMet, hms, readingFilmTime } from "./flight";

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
  { from: T.CABIN, to: T.OUTBOUND_END, text: { en: "Lunar orbit: a message from the crew", vi: "Quỹ đạo Mặt Trăng: thông điệp từ phi hành đoàn" } },
  { from: T.OUTBOUND_END, to: T.TEI_END, text: { en: "Trans-Earth injection: homeward", vi: "Đốt về nhà: hướng về Trái Đất" } },
  { from: T.TEI_END, to: T.SM_SEP, text: { en: "Two and a half days home", vi: "Hai ngày rưỡi trên đường về" } },
  { from: T.SM_SEP, to: T.REENTRY, text: { en: "Service module jettisoned", vi: "Thả mô-đun phục vụ" } },
  { from: T.REENTRY, to: T.CHUTES, text: { en: "Reentry: three and a half minutes of radio blackout", vi: "Tái nhập khí quyển: ba phút rưỡi mất liên lạc" } },
  { from: T.CHUTES, to: T.TOUCHDOWN, text: { en: "Splashdown in the Pacific", vi: "Hạ xuống Thái Bình Dương" } },
  { from: T.TOUCHDOWN, to: T.FILM_END, text: { en: "Recovery: swimmers and the carrier Hornet", vi: "Vớt tàu: thợ lặn và tàu sân bay Hornet" } },
];

/**
 * The broadcast from lunar orbit, in full: Anders' opening and Genesis 1:1-10 as the crew read it
 * (King James Version; Vietnamese from the 1925 Bible, both public domain), phrase by phrase. Times
 * are seconds into the recording (public/assets/audio/apollo8-genesis.mp3), taken from a word-level
 * transcription of it. Anders reads verses 1-4, Lovell 5-8 and Borman 9-10. The sign-off is not used.
 * While the recording plays, the captions follow the sound itself (see TranslunarScene).
 */
export const READING_AUDIO: Caption[] = [
  { from: 0.3, to: 4.4, text: { en: "We are now approaching lunar sunrise,", vi: "Chúng tôi đang tiến tới bình minh trên Mặt Trăng," } },
  { from: 4.8, to: 8.7, text: { en: "and for all the people back on Earth,", vi: "và gửi tới mọi người trên Trái Đất," } },
  { from: 8.9, to: 13.6, text: { en: "the crew of Apollo 8 has a message that we would like to send to you.", vi: "phi hành đoàn Apollo 8 có một thông điệp muốn gửi đến các bạn." } },
  { from: 14.4, to: 18.9, text: { en: "In the beginning God created the heaven and the earth.", vi: "Ban đầu Đức Chúa Trời dựng nên trời đất." } },
  { from: 19.1, to: 22.8, text: { en: "And the earth was without form, and void;", vi: "Vả, đất là vô hình và trống không," } },
  { from: 22.9, to: 25.8, text: { en: "and darkness was upon the face of the deep.", vi: "sự mờ tối ở trên mặt vực;" } },
  { from: 26.4, to: 30.3, text: { en: "And the Spirit of God moved upon the face of the waters.", vi: "Thần Đức Chúa Trời vận hành trên mặt nước." } },
  { from: 30.4, to: 35.6, text: { en: "And God said, Let there be light: and there was light.", vi: "Đức Chúa Trời phán rằng: Phải có sự sáng; thì có sự sáng." } },
  { from: 36.0, to: 39.4, text: { en: "And God saw the light, that it was good:", vi: "Đức Chúa Trời thấy sự sáng là tốt lành," } },
  { from: 39.5, to: 42.6, text: { en: "and God divided the light from the darkness.", vi: "bèn phân sáng ra cùng tối." } },
  { from: 46.0, to: 50.9, text: { en: "And God called the light Day, and the darkness he called Night.", vi: "Đức Chúa Trời đặt tên sự sáng là ngày; sự tối là đêm." } },
  { from: 51.2, to: 54.6, text: { en: "And the evening and the morning were the first day.", vi: "Vậy, có buổi chiều và buổi mai; ấy là ngày thứ nhứt." } },
  { from: 55.0, to: 58.3, text: { en: "And God said, Let there be a firmament in the midst of the waters,", vi: "Đức Chúa Trời lại phán rằng: Phải có một khoảng không ở giữa nước" } },
  { from: 58.4, to: 61.3, text: { en: "and let it divide the waters from the waters.", vi: "đặng phân rẽ nước cách với nước." } },
  { from: 61.5, to: 67.0, text: { en: "And God made the firmament, and divided the waters which were under the firmament", vi: "Ngài làm nên khoảng không, phân rẽ nước ở dưới khoảng không" } },
  { from: 67.1, to: 71.1, text: { en: "from the waters which were above the firmament: and it was so.", vi: "cách với nước ở trên khoảng không; thì có như vậy." } },
  { from: 71.2, to: 73.6, text: { en: "And God called the firmament Heaven.", vi: "Đức Chúa Trời đặt tên khoảng không là trời." } },
  { from: 73.7, to: 77.8, text: { en: "And the evening and the morning were the second day.", vi: "Vậy, có buổi chiều và buổi mai; ấy là ngày thứ nhì." } },
  { from: 79.9, to: 84.3, text: { en: "And God said, Let the waters under the heavens be gathered together unto one place,", vi: "Đức Chúa Trời lại phán rằng: Những nước ở dưới trời phải tụ lại một nơi," } },
  { from: 84.4, to: 88.0, text: { en: "and let the dry land appear: and it was so.", vi: "và phải có chỗ khô cạn bày ra; thì có như vậy." } },
  { from: 88.3, to: 91.5, text: { en: "And God called the dry land Earth;", vi: "Đức Chúa Trời đặt tên chỗ khô cạn là đất," } },
  { from: 91.6, to: 94.8, text: { en: "and the gathering together of the waters called he Seas:", vi: "còn nơi nước tụ lại là biển." } },
  { from: 94.9, to: 98.2, text: { en: "and God saw that it was good.", vi: "Đức Chúa Trời thấy điều đó là tốt lành." } },
];

/** The same captions in film time (the film's clock runs slow through the cabin to fit the recording). */
export const READING: Caption[] = READING_AUDIO.map((c) => ({ ...c, from: readingFilmTime(c.from), to: readingFilmTime(c.to) }));

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

/**
 * What the crew and the film have to say on the long glide home, so the wait is not empty. The distance is
 * the Earth-Moon distance (about 384,000 km); the 21.55 kg is NASA's figure for Apollo 11's samples; rolling
 * slowly "like a chicken on a spit" is the passive thermal control the Apollo ships used on the way.
 */
export const HOME_NOTES: Caption[] = [
  { from: T.TEI_END + 3, to: T.TEI_END + 8.5, text: { en: "Three men, and 384,000 kilometres of dark to cross.", vi: "Ba con người, và 384.000 km bóng tối phía trước." } },
  { from: T.TEI_END + 9, to: T.TEI_END + 14.5, text: { en: "The ship rolls slowly, like a chicken on a spit, so the Sun heats it evenly.", vi: "Con tàu xoay chậm như quay gà nướng, để Mặt Trời làm nóng đều." } },
  { from: T.TEI_END + 15, to: T.TEI_END + 20, text: { en: "In the cabin: 21.55 kilograms of the Moon.", vi: "Trong khoang có 21,55 kg đá Mặt Trăng." } },
  { from: T.TEI_END + 20.5, to: T.SM_SEP - 0.5, text: { en: "The Earth swells in the window, a little more each hour.", vi: "Trái Đất lớn dần ngoài cửa sổ, mỗi giờ thêm một chút." } },
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
