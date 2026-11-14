import type { LocalizedText } from "@/i18n";
import type { TraceCode } from "@/lib/simulation/launch.types";

/**
 * The control room when the vehicle is lost, beat by beat: what the consoles report as it goes
 * wrong, the flash, the silence, the calls into a dead channel, and the order to hold. Times are
 * seconds after the cutaway starts (the flash comes at FLY_SECONDS, 1.9 s in). The first calls are
 * shouted over the radio; the Flight Director's order to hold is the one calm voice in the room.
 */
export type RoomVoice = "kranz" | "capcom" | "booster" | "bales";

export interface RoomBeat {
  at: number;
  voice: RoomVoice;
  line: LocalizedText;
  /** Playback speed: urgent calls are quick, the long silence is slow. */
  rate?: number;
  /** 0 to 1: how close to panic the voice is. */
  panic?: number;
}

export const ROOM_SPEAKER: Record<RoomVoice, LocalizedText> = {
  kranz: { en: "Flight Director", vi: "Chỉ huy bay" },
  capcom: { en: "CAPCOM", vi: "CAPCOM" },
  booster: { en: "Booster", vi: "Booster" },
  bales: { en: "Guidance", vi: "Dẫn đường" },
};

const l = (en: string, vi: string): LocalizedText => ({ en, vi });

/** What the consoles see go wrong, in the first two seconds, for each way a vehicle can be lost. */
const OPENING: Record<TraceCode, RoomBeat[]> = {
  structural: [
    { at: 0.1, voice: "booster", line: l("Flight, Booster! Vibration! Vibration over limits!", "Flight, Booster! Rung! Rung vượt giới hạn!"), rate: 1.1, panic: 0.8 },
    { at: 1.1, voice: "kranz", line: l("All stations, Flight! Report! Report!", "Toàn trung tâm, Flight đây! Báo cáo! Báo cáo!"), rate: 1.1, panic: 0.6 },
  ],
  "fuel-depleted": [
    { at: 0.1, voice: "booster", line: l("Flight, Booster! Stage two is starving! Fuel is gone!", "Flight, Booster! Tầng hai cạn rồi! Hết nhiên liệu!"), rate: 1.1, panic: 0.8 },
    { at: 1.1, voice: "kranz", line: l("Copy! Crew, abort! Abort, abort!", "Rõ! Phi hành đoàn, huỷ bỏ! Huỷ bỏ, huỷ bỏ!"), rate: 1.1, panic: 0.6 },
  ],
  "slow-climb": [
    { at: 0.1, voice: "booster", line: l("Flight, Booster! She is not climbing! She is not climbing!", "Flight, Booster! Nó không leo lên! Nó không leo lên!"), rate: 1.1, panic: 0.8 },
    { at: 1.1, voice: "kranz", line: l("Too low! Abort, abort!", "Quá thấp! Huỷ bỏ, huỷ bỏ!"), rate: 1.1, panic: 0.6 },
  ],
  "wind-shear": [
    { at: 0.1, voice: "bales", line: l("Flight, Guidance! She is off course! Off course!", "Flight, Dẫn đường! Nó lệch hướng rồi! Lệch hướng!"), rate: 1.1, panic: 0.8 },
    { at: 1.1, voice: "kranz", line: l("Say again, Guidance! Say again!", "Nói lại, Dẫn đường! Nói lại!"), rate: 1.1, panic: 0.6 },
  ],
  lightning: [
    { at: 0.1, voice: "bales", line: l("Flight, Guidance! We lost telemetry! All of it!", "Flight, Dẫn đường! Mất dữ liệu! Mất hết!"), rate: 1.1, panic: 0.8 },
    { at: 1.1, voice: "kranz", line: l("Say again! Say again!", "Nói lại! Nói lại!"), rate: 1.1, panic: 0.6 },
  ],
};

/** After the flash it is the same in every room: the horror, a dead channel, and the order to hold. */
const AFTER: RoomBeat[] = [
  { at: 3.4, voice: "booster", line: l("Flight, Booster! We have lost the vehicle! Vehicle lost!", "Flight, Booster! Chúng ta mất tàu rồi! Mất tàu!"), rate: 1.08, panic: 0.9 },
  { at: 6, voice: "bales", line: l("Flight, Guidance! No tracking! No signal! Nothing!", "Flight, Dẫn đường! Không bám được! Không tín hiệu! Không còn gì!"), rate: 1.08, panic: 0.9 },
  { at: 8.4, voice: "capcom", line: l("Columbia! Columbia, Houston! Do you read? Come in!", "Columbia! Columbia, Houston! Có nghe không? Trả lời đi!"), rate: 1.1, panic: 1 },
  { at: 11.4, voice: "capcom", line: l("Columbia, Houston! Please, come in! Columbia!", "Columbia, Houston! Làm ơn, trả lời đi! Columbia!"), rate: 1.1, panic: 1 },
  { at: 14.6, voice: "kranz", line: l("Capcom! Keep calling! Keep calling!", "Capcom! Cứ gọi tiếp! Cứ gọi tiếp!"), rate: 1.05, panic: 0.6 },
  { at: 17.6, voice: "booster", line: l("Flight, debris is falling in the water!", "Flight, mảnh vỡ đang rơi xuống nước!"), rate: 1.05, panic: 0.7 },
  { at: 21, voice: "kranz", line: l("All stations, Flight. Hold your data. Nobody leaves a console.", "Toàn trung tâm, Flight đây. Giữ nguyên dữ liệu. Không ai rời vị trí."), rate: 0.95, panic: 0.1 },
  { at: 25, voice: "kranz", line: l("Remember what you saw. We will find out why.", "Hãy nhớ những gì các bạn thấy. Chúng ta sẽ tìm ra vì sao."), rate: 0.92, panic: 0 },
  { at: 28.2, voice: "capcom", line: l("Columbia... Houston...", "Columbia... Houston..."), rate: 0.9, panic: 0 },
];

export function roomScript(cause: string): RoomBeat[] {
  return [...(OPENING[cause as TraceCode] ?? OPENING.structural), ...AFTER];
}

export const ROOM_SCRIPT_ALL: RoomBeat[] = [...Object.values(OPENING).flat(), ...AFTER];
