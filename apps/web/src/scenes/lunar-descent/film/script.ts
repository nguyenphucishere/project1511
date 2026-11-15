import type { LocalizedText } from "@/i18n";

/**
 * The two landing films, beat by beat. `approach` runs before the player takes the stick (undocking,
 * powered descent, the 1202 alarm, the pitch-over); `touchdown` runs after a safe landing. Times are
 * seconds of film. The radio lines follow the Apollo 11 air-to-ground transcript (public domain).
 */
export type FilmPart = "approach" | "touchdown";
export type Voice = "collins" | "armstrong" | "aldrin" | "capcom" | "bales";

export const FILM_SECONDS: Record<FilmPart, number> = { approach: 74, touchdown: 46 };

export interface Caption {
  from: number;
  to: number;
  text: LocalizedText;
}

export interface Beat {
  at: number;
  who: Voice;
  line: LocalizedText;
  /** 0 to 1: how strained the voice is. */
  panic?: number;
  /** Performance tag for the recording (see tools/voice). */
  tag?: string;
}

const l = (en: string, vi: string): LocalizedText => ({ en, vi });

export const SPEAKER: Record<Voice, LocalizedText> = {
  collins: l("Columbia · Collins", "Columbia · Collins"),
  armstrong: l("Eagle · Armstrong", "Eagle · Armstrong"),
  aldrin: l("Eagle · Aldrin", "Eagle · Aldrin"),
  capcom: l("Houston · CAPCOM", "Houston · CAPCOM"),
  bales: l("Houston · Guidance", "Houston · Dẫn đường"),
};

export const PHASES: Record<FilmPart, Caption[]> = {
  approach: [
    { from: 0, to: 10, text: l("Lunar orbit: Eagle undocks from Columbia", "Quỹ đạo Mặt Trăng: Eagle tách khỏi Columbia") },
    { from: 10, to: 20, text: l("Behind the Moon: descent orbit burn", "Sau lưng Mặt Trăng: đốt hạ quỹ đạo") },
    { from: 20, to: 36, text: l("Powered descent begins at 50,000 feet", "Bắt đầu hạ cánh có động cơ ở độ cao 15 km") },
    { from: 36, to: 48, text: l("Program alarm 1202: the computer is overloaded", "Báo động chương trình 1202: máy tính quá tải") },
    { from: 48, to: 66, text: l("Pitch-over: the landing site comes into view", "Lật dựng: bãi hạ cánh hiện ra") },
    { from: 66, to: 74, text: l("Armstrong takes the stick", "Armstrong cầm lái") },
  ],
  touchdown: [
    { from: 0, to: 9, text: l("Final seconds: the engine kicks up the dust", "Những giây cuối: động cơ thổi tung bụi") },
    { from: 9, to: 14, text: l("Engine stop", "Tắt động cơ") },
    { from: 14, to: 26, text: l("Tranquility Base", "Căn cứ Tĩnh Lặng") },
    { from: 26, to: 38, text: l("Mission Control, Houston", "Trung tâm điều khiển, Houston") },
    { from: 38, to: 46, text: l("Sea of Tranquility · 20 July 1969 · 20:17 UTC", "Biển Tĩnh Lặng · 20/7/1969 · 20:17 UTC") },
  ],
};

export const BEATS: Record<FilmPart, Beat[]> = {
  approach: [
    { at: 2.5, who: "collins", line: l("Eagle, Columbia. I think you've got a fine-looking flying machine there, despite the fact you're upside down.", "Eagle, Columbia đây. Tôi thấy cỗ máy bay của anh trông tuyệt đấy, dù nó đang lộn ngược.") },
    { at: 8, who: "armstrong", line: l("Somebody's upside down.", "Có người đang lộn ngược đấy.") },
    { at: 12, who: "capcom", line: l("Eagle, Houston. You are go for powered descent.", "Eagle, Houston đây. Các anh được phép hạ cánh có động cơ.") },
    { at: 21, who: "aldrin", line: l("Ignition.", "Đánh lửa."), panic: 0.2 },
    { at: 28, who: "capcom", line: l("Eagle, Houston. You are looking good.", "Eagle, Houston đây. Mọi thứ đang tốt.") },
    { at: 37.5, who: "armstrong", line: l("Program alarm.", "Báo động chương trình."), panic: 0.5, tag: "(breath) " },
    { at: 39.6, who: "armstrong", line: l("Give us a reading on the 1202 program alarm.", "Cho chúng tôi biết báo động 1202 này là gì."), panic: 0.5, tag: "(breath) " },
    { at: 43, who: "bales", line: l("Flight, we are go on that alarm!", "Flight, chúng ta vẫn tiếp tục với báo động này!"), panic: 0.4, tag: "(breath) " },
    { at: 45, who: "capcom", line: l("Roger. We are go on that alarm.", "Rõ. Chúng tôi cho phép tiếp tục với báo động này."), panic: 0.2 },
    { at: 52, who: "aldrin", line: l("Seven thousand feet. We are pitching over.", "Hai nghìn một trăm mét. Chúng ta đang lật dựng."), panic: 0.2 },
    { at: 60, who: "armstrong", line: l("Houston, we are long. I am taking it manual.", "Houston, chúng ta bay quá xa. Tôi sẽ lái tay."), panic: 0.3, tag: "(breath) " },
  ],
  touchdown: [
    { at: 1.5, who: "aldrin", line: l("Forty feet, down two and a half. Picking up some dust.", "Mười hai mét, đang hạ hai mét rưỡi. Bụi bắt đầu bay lên."), panic: 0.2 },
    { at: 6.2, who: "aldrin", line: l("Contact light.", "Đèn tiếp đất sáng."), panic: 0.2 },
    { at: 8.8, who: "armstrong", line: l("Shutdown.", "Tắt máy.") },
    { at: 14.5, who: "armstrong", line: l("Houston, Tranquility Base here. The Eagle has landed.", "Houston, Căn cứ Tĩnh Lặng đây. Eagle đã hạ cánh.") },
    { at: 21, who: "capcom", line: l("Roger, Tranquility. We copy you on the ground. You got a bunch of guys about to turn blue. We are breathing again. Thanks a lot.", "Rõ, Tĩnh Lặng. Chúng tôi nghe các anh trên mặt đất. Ở đây có cả đám người sắp tím tái vì nín thở. Chúng tôi lại thở được rồi. Cảm ơn nhiều."), panic: 0.3 },
  ],
};

/** The instruments the crew read, as piecewise-linear in film time: altitude (ft), speed (ft/s), fuel (%). */
const PROFILE: [number, number, number, number][] = [
  [20, 47000, 5560, 100],
  [28, 40000, 4700, 93],
  [36, 28000, 3500, 80],
  [48, 12000, 1900, 62],
  [56, 7500, 900, 48],
  [66, 500, 60, 32],
  [74, 150, 20, 28],
];

export function readout(t: number) {
  if (t <= PROFILE[0]![0]) return { altFt: PROFILE[0]![1], speed: PROFILE[0]![2], fuel: PROFILE[0]![3] };
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1]!;
    const b = PROFILE[i]!;
    if (t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      return { altFt: a[1] + (b[1] - a[1]) * k, speed: a[2] + (b[2] - a[2]) * k, fuel: a[3] + (b[3] - a[3]) * k };
    }
  }
  const e = PROFILE[PROFILE.length - 1]!;
  return { altFt: e[1], speed: e[2], fuel: e[3] };
}

/** The lamps on the flight controllers' poll, in the order they answer. */
export const POLL: { id: string; label: LocalizedText }[] = [
  { id: "retro", label: l("RETRO", "RETRO") },
  { id: "fido", label: l("FIDO", "FIDO") },
  { id: "guido", label: l("GUIDANCE", "DẪN ĐƯỜNG") },
  { id: "control", label: l("CONTROL", "ĐIỀU KHIỂN") },
  { id: "telcom", label: l("TELCOM", "TELCOM") },
  { id: "gnc", label: l("GNC", "GNC") },
  { id: "eecom", label: l("EECOM", "EECOM") },
];

export const FILM_LINES: LocalizedText[] = Object.values(BEATS).flatMap((b) => b.map((x) => x.line));
