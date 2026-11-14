import type { LocalizedText } from "@/i18n";
import type { FailureCode } from "@/game/ascentFlight";

/**
 * The cabin cutaways of a flight that goes wrong: who we cut to, where they look, and what they say.
 * Times are real seconds, counted from the first warning ("trouble") or from the moment the engines
 * fail ("failing"); the scene's own clock decides when each one plays. Lines are short and said fast:
 * people in a crisis do not make speeches.
 */
export type CrewId = "armstrong" | "aldrin" | "collins";

/** Things that happen around a cutaway: a low blow on the score, sparks, the lights failing, fire at the window. */
export type Fx = "stinger" | "silence" | "sparks" | "flicker" | "fire";

export interface Cue {
  phase: "trouble" | "failing";
  /** Seconds into the phase. */
  at: number;
  who: CrewId;
  /** Where the helmet turns: toward the camera, or to the crewmate on the left or right. */
  look: "front" | "left" | "right";
  /** How long the shot stays, in ms. */
  ms: number;
  /** What he says; none for a look held in silence. */
  line?: LocalizedText;
  /** What happens in the cabin as the shot cuts in. */
  fx?: Fx[];
}

/** What the whole cabin does for this kind of failure, on top of the cutaways. */
export interface Flavor {
  /** Camera shake while the cutaways run, 0 to 1. */
  shake: number;
  /** The light that floods the cabin: the red of the alarm, the amber of a falling vehicle, the blue of a storm. */
  glow: "red" | "amber" | "blue";
  /** Lightning flashes through the window and the lights fail. */
  storm?: boolean;
  /** The whole view rolls from side to side, as in a wind shear. */
  sway?: boolean;
  /** When the engines quit, everything goes eerily quiet. */
  hush?: boolean;
  /** Seconds (in the failing phase) at which metal groans. */
  groans?: number[];
}

const l = (en: string, vi: string): LocalizedText => ({ en, vi });

export const FLAVOR: Record<FailureCode, Flavor> = {
  structural: { shake: 1, glow: "red", groans: [0.6, 2.2, 4.4, 7, 9.5, 13] },
  "fuel-depleted": { shake: 0.35, glow: "red", hush: true },
  "slow-climb": { shake: 0.6, glow: "amber" },
  "wind-shear": { shake: 0.8, glow: "red", sway: true },
  lightning: { shake: 0.7, glow: "blue", storm: true },
};

export const CREW_NAME: Record<CrewId, LocalizedText> = {
  armstrong: l("Neil Armstrong", "Neil Armstrong"),
  aldrin: l("Buzz Aldrin", "Buzz Aldrin"),
  collins: l("Michael Collins", "Michael Collins"),
};

export const SCRIPT: Record<FailureCode, Cue[]> = {
  structural: [
    { phase: "trouble", at: 1, who: "armstrong", look: "front", ms: 1500, line: l("Houston! Houston, heavy vibration!", "Houston! Houston, rung rất mạnh!") },
    { phase: "trouble", at: 3, who: "aldrin", look: "left", ms: 1400, line: l("Neil! That is not right!", "Neil! Không ổn rồi!") },
    { phase: "trouble", at: 5, who: "collins", look: "right", ms: 1400, line: l("Loads are off the scale!", "Tải vượt thang đo!"), fx: ["sparks"] },
    { phase: "trouble", at: 7, who: "armstrong", look: "front", ms: 1400, line: l("Stay with it! Stay with it!", "Giữ vững! Giữ vững!") },
    { phase: "trouble", at: 8.8, who: "aldrin", look: "left", ms: 1300, line: l("She is shaking apart!", "Nó đang rung nát ra!") },
    { phase: "trouble", at: 10.6, who: "collins", look: "right", ms: 1200, line: l("Master alarm!", "Báo động chính!"), fx: ["flicker"] },
    { phase: "trouble", at: 12.2, who: "armstrong", look: "front", ms: 1200, line: l("Houston, we are losing her! Losing her!", "Houston, sắp mất nó rồi! Mất nó rồi!") },
    { phase: "failing", at: 0.3, who: "armstrong", look: "front", ms: 1500, line: l("Something broke! Something just broke!", "Có gì đó vỡ rồi! Vừa vỡ rồi!"), fx: ["stinger", "sparks"] },
    { phase: "failing", at: 1.8, who: "aldrin", look: "left", ms: 1000, fx: ["sparks"] },
    { phase: "failing", at: 2.8, who: "aldrin", look: "left", ms: 1300, line: l("Abort! Abort!", "Huỷ bỏ! Huỷ bỏ!") },
    { phase: "failing", at: 4.2, who: "collins", look: "right", ms: 1300, line: l("Houston, Columbia! Mayday! Mayday!", "Houston, Columbia! Cấp cứu! Cấp cứu!"), fx: ["flicker"] },
    { phase: "failing", at: 5.8, who: "armstrong", look: "right", ms: 1400, line: l("Buzz, look at me.", "Buzz, nhìn tôi này.") },
    { phase: "failing", at: 7.4, who: "collins", look: "front", ms: 1200, fx: ["fire"] },
    { phase: "failing", at: 8.8, who: "aldrin", look: "left", ms: 1300, line: l("Neil. I am here.", "Neil. Tôi ở đây.") },
    { phase: "failing", at: 10.4, who: "armstrong", look: "front", ms: 1700, line: l("It has been an honor.", "Thật vinh dự."), fx: ["silence"] },
    { phase: "failing", at: 12.4, who: "aldrin", look: "front", ms: 1400 },
    { phase: "failing", at: 14, who: "armstrong", look: "right", ms: 1500, line: l("Gentlemen. Thank you.", "Các quý ông. Cảm ơn."), fx: ["fire"] },
    { phase: "failing", at: 15.4, who: "collins", look: "front", ms: 900 },
  ],
  "fuel-depleted": [
    { phase: "trouble", at: 1, who: "armstrong", look: "front", ms: 1500, line: l("Houston! Fuel flow is dropping!", "Houston! Lưu lượng nhiên liệu đang giảm!") },
    { phase: "trouble", at: 3, who: "collins", look: "left", ms: 1400, line: l("Gauge reads low! Neil, it reads low!", "Đồng hồ báo thấp! Neil, nó báo thấp!") },
    { phase: "trouble", at: 5, who: "aldrin", look: "right", ms: 1300, line: l("How low?", "Thấp cỡ nào?") },
    { phase: "trouble", at: 6.8, who: "collins", look: "left", ms: 1300, line: l("Too low! Too low!", "Quá thấp! Quá thấp!") },
    { phase: "trouble", at: 8.6, who: "armstrong", look: "front", ms: 1400, line: l("Check the tank pressures.", "Kiểm tra áp suất bình.") },
    { phase: "trouble", at: 10.6, who: "aldrin", look: "right", ms: 1300, line: l("Neil, we are short! Short!", "Neil, thiếu rồi! Thiếu rồi!"), fx: ["flicker"] },
    { phase: "trouble", at: 12.2, who: "armstrong", look: "front", ms: 1200, line: l("Come on! Come on!", "Nào! Nào!") },
    { phase: "failing", at: 0.3, who: "armstrong", look: "front", ms: 1500, line: l("Engines out! Engines are out!", "Động cơ tắt rồi! Tắt hết rồi!"), fx: ["stinger", "silence"] },
    { phase: "failing", at: 2, who: "aldrin", look: "left", ms: 1500, line: l("It is so quiet.", "Yên lặng quá.") },
    { phase: "failing", at: 3.8, who: "collins", look: "right", ms: 1400, line: l("We are falling! We are falling!", "Chúng ta đang rơi! Đang rơi!") },
    { phase: "failing", at: 5.6, who: "armstrong", look: "front", ms: 2000 },
    { phase: "failing", at: 7.8, who: "aldrin", look: "front", ms: 1400, line: l("Houston, do you read? Houston!", "Houston, có nghe không? Houston!"), fx: ["flicker"] },
    { phase: "failing", at: 9.4, who: "collins", look: "left", ms: 1200, line: l("Houston? Anyone?", "Houston? Có ai không?") },
    { phase: "failing", at: 10.8, who: "armstrong", look: "right", ms: 1800, line: l("We did everything right.", "Chúng ta đã làm đúng mọi thứ.") },
    { phase: "failing", at: 12.8, who: "aldrin", look: "right", ms: 1300 },
    { phase: "failing", at: 14.2, who: "collins", look: "front", ms: 1400, line: l("Neil...", "Neil..."), fx: ["fire"] },
    { phase: "failing", at: 15.5, who: "armstrong", look: "front", ms: 900 },
  ],
  "slow-climb": [
    { phase: "trouble", at: 1, who: "armstrong", look: "front", ms: 1500, line: l("We are not accelerating! Houston!", "Chúng ta không tăng tốc! Houston!") },
    { phase: "trouble", at: 3, who: "aldrin", look: "right", ms: 1400, line: l("Altitude is not building.", "Độ cao không lên.") },
    { phase: "trouble", at: 5, who: "collins", look: "left", ms: 1400, line: l("Too heavy, Neil! Too heavy!", "Quá nặng, Neil! Quá nặng!") },
    { phase: "trouble", at: 7, who: "armstrong", look: "front", ms: 1400, line: l("Full thrust. Give her everything.", "Hết công suất. Dồn hết cho nó.") },
    { phase: "trouble", at: 8.9, who: "aldrin", look: "right", ms: 1300, line: l("Climb rate zero!", "Tốc độ leo bằng không!"), fx: ["sparks"] },
    { phase: "trouble", at: 10.6, who: "collins", look: "left", ms: 1200, line: l("Master alarm!", "Báo động chính!"), fx: ["flicker"] },
    { phase: "trouble", at: 12.2, who: "armstrong", look: "front", ms: 1200, line: l("Come on, lift! Lift!", "Nào, bay lên! Bay lên!") },
    { phase: "failing", at: 0.3, who: "armstrong", look: "front", ms: 1500, line: l("She cannot lift it! She cannot!", "Nó không nhấc nổi! Không nổi!"), fx: ["stinger"] },
    { phase: "failing", at: 1.9, who: "aldrin", look: "left", ms: 1300, line: l("We are coming down!", "Chúng ta đang rơi xuống!") },
    { phase: "failing", at: 3.4, who: "collins", look: "right", ms: 1300, line: l("Houston, Columbia! Mayday! Mayday!", "Houston, Columbia! Cấp cứu! Cấp cứu!"), fx: ["flicker", "sparks"] },
    { phase: "failing", at: 5, who: "armstrong", look: "front", ms: 1300, line: l("Brace! Brace!", "Giữ chặt! Giữ chặt!") },
    { phase: "failing", at: 6.6, who: "aldrin", look: "left", ms: 1300, fx: ["fire"] },
    { phase: "failing", at: 8.2, who: "collins", look: "front", ms: 1400, line: l("Neil, the water!", "Neil, mặt nước!") },
    { phase: "failing", at: 9.9, who: "armstrong", look: "right", ms: 1500, line: l("Hold on, boys.", "Bám chắc, các chàng trai."), fx: ["silence"] },
    { phase: "failing", at: 11.8, who: "aldrin", look: "front", ms: 1500 },
    { phase: "failing", at: 13.4, who: "aldrin", look: "right", ms: 1600, line: l("Neil. It was an honor.", "Neil. Thật vinh dự khi bay cùng anh.") },
    { phase: "failing", at: 15.2, who: "armstrong", look: "front", ms: 900, fx: ["fire"] },
  ],
  "wind-shear": [
    { phase: "trouble", at: 1, who: "armstrong", look: "front", ms: 1500, line: l("The winds are throwing us!", "Gió đang quăng chúng ta!") },
    { phase: "trouble", at: 3, who: "collins", look: "left", ms: 1400, line: l("Yawing! I am losing the horizon!", "Lệch hướng! Tôi mất chân trời!") },
    { phase: "trouble", at: 5, who: "aldrin", look: "right", ms: 1400, line: l("Guidance cannot hold!", "Dẫn đường không giữ nổi!") },
    { phase: "trouble", at: 7, who: "armstrong", look: "front", ms: 1300, line: l("Correct! Correct!", "Chỉnh lại! Chỉnh lại!"), fx: ["sparks"] },
    { phase: "trouble", at: 8.8, who: "collins", look: "left", ms: 1300, line: l("The stick is fighting me!", "Cần lái đang chống lại tôi!") },
    { phase: "trouble", at: 10.6, who: "collins", look: "left", ms: 1200, line: l("Master alarm!", "Báo động chính!"), fx: ["flicker"] },
    { phase: "trouble", at: 12.2, who: "armstrong", look: "front", ms: 1200, line: l("We are out of control! Out of control!", "Chúng ta mất kiểm soát! Mất kiểm soát!") },
    { phase: "failing", at: 0.3, who: "armstrong", look: "front", ms: 1500, line: l("She is tumbling! We are tumbling!", "Nó đang lật nhào! Chúng ta đang lật!"), fx: ["stinger", "sparks"] },
    { phase: "failing", at: 1.8, who: "aldrin", look: "left", ms: 1300, line: l("Abort! Abort!", "Huỷ bỏ! Huỷ bỏ!") },
    { phase: "failing", at: 3.3, who: "collins", look: "right", ms: 1400, line: l("I cannot tell up from down!", "Tôi không phân biệt được trên dưới!"), fx: ["flicker"] },
    { phase: "failing", at: 5, who: "armstrong", look: "front", ms: 1200, line: l("Hold on!", "Bám chắc!") },
    { phase: "failing", at: 6.5, who: "aldrin", look: "left", ms: 1200, fx: ["fire"] },
    { phase: "failing", at: 8, who: "collins", look: "right", ms: 1500, line: l("Tell them we tried.", "Hãy nói với họ là chúng tôi đã cố.") },
    { phase: "failing", at: 9.8, who: "armstrong", look: "right", ms: 1200, line: l("Buzz!", "Buzz!"), fx: ["silence"] },
    { phase: "failing", at: 11.3, who: "aldrin", look: "left", ms: 1200, line: l("Neil!", "Neil!") },
    { phase: "failing", at: 12.8, who: "collins", look: "front", ms: 1500 },
    { phase: "failing", at: 14.6, who: "armstrong", look: "front", ms: 1100, fx: ["fire"] },
  ],
  lightning: [
    { phase: "trouble", at: 1, who: "armstrong", look: "front", ms: 1500, line: l("Lightning all around us.", "Sét loé quanh chúng ta.") },
    { phase: "trouble", at: 3, who: "collins", look: "left", ms: 1400, line: l("Static on every channel.", "Mọi kênh đều nhiễu.") },
    { phase: "trouble", at: 5, who: "aldrin", look: "right", ms: 1400, line: l("That flash. We have been hit!", "Tia chớp đó. Chúng ta bị đánh trúng!"), fx: ["flicker", "sparks"] },
    { phase: "trouble", at: 7, who: "armstrong", look: "front", ms: 1300, line: l("Status! Report!", "Báo cáo tình trạng!") },
    { phase: "trouble", at: 8.8, who: "collins", look: "left", ms: 1300, line: l("Telemetry is dropping!", "Dữ liệu đang mất!") },
    { phase: "trouble", at: 10.6, who: "aldrin", look: "right", ms: 1200, line: l("Neil, the lights!", "Neil, đèn!"), fx: ["flicker"] },
    { phase: "trouble", at: 12.2, who: "armstrong", look: "front", ms: 1200, line: l("Houston? Houston! Come in, Houston!", "Houston? Houston! Trả lời đi, Houston!") },
    { phase: "failing", at: 0.3, who: "armstrong", look: "front", ms: 1500, line: l("We lost everything! Everything!", "Chúng ta mất hết rồi! Mất hết!"), fx: ["stinger", "flicker"] },
    { phase: "failing", at: 1.8, who: "aldrin", look: "left", ms: 1300, line: l("Abort! No guidance!", "Huỷ bỏ! Mất dẫn đường!") },
    { phase: "failing", at: 3.3, who: "collins", look: "right", ms: 1300, line: l("The radio is dead!", "Radio chết rồi!"), fx: ["sparks"] },
    { phase: "failing", at: 4.9, who: "armstrong", look: "front", ms: 1200, line: l("Stay calm.", "Bình tĩnh.") },
    { phase: "failing", at: 6.4, who: "aldrin", look: "left", ms: 1200, fx: ["flicker"] },
    { phase: "failing", at: 7.9, who: "collins", look: "right", ms: 1400, line: l("Is anyone there?", "Có ai không?") },
    { phase: "failing", at: 9.7, who: "armstrong", look: "front", ms: 1700, line: l("Stay calm. Stay calm.", "Bình tĩnh. Bình tĩnh."), fx: ["silence"] },
    { phase: "failing", at: 11.7, who: "aldrin", look: "front", ms: 1400 },
    { phase: "failing", at: 13.3, who: "collins", look: "left", ms: 1400, fx: ["fire"] },
    { phase: "failing", at: 15, who: "armstrong", look: "right", ms: 1000 },
  ],
};
