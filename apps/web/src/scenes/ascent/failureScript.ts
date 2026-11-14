import type { LocalizedText } from "@/i18n";
import type { FailureCode } from "@/game/ascentFlight";

/**
 * The cabin cutaways of a flight that goes wrong: who we cut to, where they look, what they say, and
 * what the instruments show. Times are real seconds, counted from the first warning ("trouble", about 15
 * seconds long) or from the moment the engines fail ("failing", the vehicle is lost at 16).
 *
 * Two rules keep the picture and the voices together, and failureScript.test.ts enforces both:
 *  - a voiced cue stays on screen for the whole recording (`ms` is at least the length of the line in
 *    both languages), and no two voiced cues overlap, so a line is heard exactly while it is shown;
 *  - the five failures are different films, not one film with different words: they share no line,
 *    cut at different moments, in a different order, and look and sound different (see failureDiff.ts).
 */
export type CrewId = "armstrong" | "aldrin" | "collins";

/** Things that happen around a cutaway: a low blow on the score, sparks, the lights failing, fire at the window. */
export type Fx = "stinger" | "silence" | "sparks" | "flicker" | "fire";

/** What a cutaway looks at: a crewman's helmet, or the instrument that tells the story of this failure. */
export type ShotKind = "helmet" | "gauge";

export interface Cue {
  phase: "trouble" | "failing";
  /** Seconds into the phase. */
  at: number;
  /** A helmet close-up (default) or the failure's own instrument. */
  shot?: ShotKind;
  who: CrewId;
  /** Where the helmet turns: toward the camera, or to the crewmate on the left or right. */
  look: "front" | "left" | "right";
  /** How long the shot stays, in ms. For a voiced cue, at least as long as the recording. */
  ms: number;
  /** What he says; none for a look held in silence. */
  line?: LocalizedText;
  /** What happens in the cabin as the shot cuts in. */
  fx?: Fx[];
}

/** The instruments the gauge shots show, one for each way a flight can go wrong. */
export type GaugeKind = "strain" | "fuel" | "altitude" | "horizon" | "power";
/** What happens to the glass of the helmet: it cracks, stays calm, tilts, rolls, or flashes with the storm. */
export type HelmetStyle = "cracked" | "calm" | "tilt" | "roll" | "flash";
/** The sound that runs under the whole film. */
export type SoundBed = "strain" | "drain" | "sink" | "wind" | "static";
export type Glow = "red" | "amber" | "blue" | "green" | "white";

/** What the whole cabin does for this kind of failure, on top of the cutaways. */
export interface Flavor {
  /** Camera shake while the cutaways run, 0 to 1. */
  shake: number;
  /** The light that floods the cabin: the red of the alarm, the amber of a falling vehicle, the blue of a storm, the cold green of dead instruments, the white of cloud. */
  glow: Glow;
  /** The instrument the gauge shots show. */
  gauge: GaugeKind;
  /** How the helmet glass behaves in the helmet shots. */
  helmet: HelmetStyle;
  /** The sound under the film. */
  bed: SoundBed;
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
  structural: { shake: 1, glow: "red", gauge: "strain", helmet: "cracked", bed: "strain", groans: [0.6, 2.2, 4.4, 7, 9.5, 13] },
  "fuel-depleted": { shake: 0.2, glow: "green", gauge: "fuel", helmet: "calm", bed: "drain", hush: true },
  "slow-climb": { shake: 0.55, glow: "amber", gauge: "altitude", helmet: "tilt", bed: "sink" },
  "wind-shear": { shake: 0.8, glow: "white", gauge: "horizon", helmet: "roll", bed: "wind", sway: true },
  lightning: { shake: 0.65, glow: "blue", gauge: "power", helmet: "flash", bed: "static", storm: true },
};

export const CREW_NAME: Record<CrewId, LocalizedText> = {
  armstrong: l("Neil Armstrong", "Neil Armstrong"),
  aldrin: l("Buzz Aldrin", "Buzz Aldrin"),
  collins: l("Michael Collins", "Michael Collins"),
};

type Look = Cue["look"];
/** A voiced helmet shot in the warning phase. */
const warn = (at: number, who: CrewId, look: Look, ms: number, en: string, vi: string, fx?: Fx[]): Cue => ({ phase: "trouble", at, who, look, ms, line: l(en, vi), fx });
/** A voiced helmet shot after the engines fail. */
const fail = (at: number, who: CrewId, look: Look, ms: number, en: string, vi: string, fx?: Fx[]): Cue => ({ phase: "failing", at, who, look, ms, line: l(en, vi), fx });
/** A silent helmet shot: a look held. */
const hold = (phase: Cue["phase"], at: number, who: CrewId, look: Look, ms: number, fx?: Fx[]): Cue => ({ phase, at, who, look, ms, fx });
/** The instrument of this failure, silent. */
const dial = (phase: Cue["phase"], at: number, ms: number, fx?: Fx[]): Cue => ({ phase, at, shot: "gauge", who: "armstrong", look: "front", ms, fx });

export const SCRIPT: Record<FailureCode, Cue[]> = {
  /* Violent and fast: short shots cut hard against the shaking, the airframe gauge in the red, cracks across the glass. */
  structural: [
    dial("trouble", 0.4, 900),
    warn(1.4, "aldrin", "left", 2450, "Neil! That is not right!", "Neil! Không ổn rồi!"),
    warn(3.9, "collins", "right", 2350, "Loads are off the scale!", "Tải vượt thang đo!", ["sparks"]),
    warn(6.4, "armstrong", "front", 2850, "Stay with it! Stay with it!", "Giữ vững! Giữ vững!"),
    warn(9.5, "collins", "right", 2100, "Master alarm!", "Báo động chính!", ["flicker"]),
    warn(11.8, "aldrin", "left", 2100, "She is shaking apart!", "Nó đang rung nát ra!"),
    dial("trouble", 14, 900, ["sparks"]),
    fail(0.2, "armstrong", "front", 3150, "Something broke! Something just broke!", "Có gì đó vỡ rồi! Vừa vỡ rồi!", ["stinger", "sparks"]),
    fail(3.5, "aldrin", "left", 2400, "Abort! Abort!", "Huỷ bỏ! Huỷ bỏ!", ["sparks"]),
    fail(6, "collins", "right", 3900, "Houston, Columbia! Mayday! Mayday!", "Houston, Columbia! Cấp cứu! Cấp cứu!", ["flicker"]),
    fail(10, "armstrong", "right", 2250, "Buzz, look at me.", "Buzz, nhìn tôi này."),
    fail(12.3, "armstrong", "front", 2000, "It has been an honor.", "Thật vinh dự.", ["silence"]),
    dial("failing", 14.4, 1100, ["fire"]),
  ],
  /* Slow and quiet: long holds on faces, tanks draining on the gauge, the cabin gone still and cold green. */
  "fuel-depleted": [
    warn(1, "armstrong", "front", 3350, "Houston! Fuel flow is dropping!", "Houston! Lưu lượng nhiên liệu đang giảm!"),
    dial("trouble", 4.5, 2600),
    warn(7.3, "armstrong", "left", 2500, "Check the tank pressures.", "Kiểm tra áp suất bình."),
    warn(10, "aldrin", "right", 2800, "Neil, we are short! Short!", "Neil, thiếu rồi! Thiếu rồi!", ["flicker"]),
    warn(12.9, "armstrong", "front", 2050, "Come on! Come on!", "Nào! Nào!"),
    fail(0.3, "armstrong", "front", 3000, "Engines out! Engines are out!", "Động cơ tắt rồi! Tắt hết rồi!", ["stinger", "silence"]),
    hold("failing", 3.4, "collins", "left", 2300),
    fail(5.8, "aldrin", "right", 1850, "It is so quiet.", "Yên lặng quá."),
    dial("failing", 7.8, 1900),
    fail(9.8, "collins", "front", 3150, "We are falling! We are falling!", "Chúng ta đang rơi! Đang rơi!"),
    fail(13, "collins", "front", 2650, "Houston? Anyone?", "Houston? Có ai không?", ["fire"]),
  ],
  /* Instrument-led: the altimeter and the vertical-speed tape keep taking the screen as the vehicle sinks. */
  "slow-climb": [
    dial("trouble", 0.4, 1200),
    warn(1.8, "armstrong", "front", 2800, "We are not accelerating! Houston!", "Chúng ta không tăng tốc! Houston!"),
    dial("trouble", 4.8, 1400),
    warn(6.4, "aldrin", "right", 1850, "Altitude is not building.", "Độ cao không lên."),
    dial("trouble", 8.4, 1200, ["sparks"]),
    warn(9.8, "collins", "left", 2800, "Too heavy, Neil! Too heavy!", "Quá nặng, Neil! Quá nặng!"),
    warn(12.7, "aldrin", "right", 2050, "Climb rate zero!", "Tốc độ leo bằng không!", ["flicker"]),
    fail(0.3, "armstrong", "front", 2750, "She cannot lift it! She cannot!", "Nó không nhấc nổi! Không nổi!", ["stinger"]),
    dial("failing", 3.2, 2000),
    fail(5.3, "aldrin", "left", 2600, "We are coming down!", "Chúng ta đang rơi xuống!", ["sparks"]),
    fail(8.2, "armstrong", "front", 2500, "Brace! Brace!", "Giữ chặt! Giữ chặt!", ["flicker"]),
    fail(11, "collins", "right", 1900, "Neil, the water!", "Neil, mặt nước!"),
    fail(13.1, "armstrong", "right", 2100, "Hold on, boys.", "Bám chắc, các chàng trai.", ["silence", "fire"]),
  ],
  /* Whip pans and short barks: the artificial horizon rolls and spins, the view swings, no one finishes a sentence. */
  "wind-shear": [
    warn(0.8, "armstrong", "front", 2800, "The winds are throwing us!", "Gió đang quăng chúng ta!"),
    dial("trouble", 3.7, 1000),
    warn(4.9, "aldrin", "left", 2000, "Guidance cannot hold!", "Dẫn đường không giữ nổi!", ["sparks"]),
    warn(7, "armstrong", "front", 2100, "Correct! Correct!", "Chỉnh lại! Chỉnh lại!"),
    warn(9.2, "collins", "right", 2050, "The stick is fighting me!", "Cần lái đang chống lại tôi!", ["flicker"]),
    dial("trouble", 11.4, 1200),
    hold("trouble", 12.7, "collins", "left", 1000),
    fail(0.3, "armstrong", "front", 2700, "She is tumbling! We are tumbling!", "Nó đang lật nhào! Chúng ta đang lật!", ["stinger", "sparks"]),
    fail(3.2, "collins", "right", 2200, "I cannot tell up from down!", "Tôi không phân biệt được trên dưới!", ["flicker"]),
    dial("failing", 5.5, 1600),
    fail(7.2, "armstrong", "front", 1450, "Hold on!", "Bám chắc!"),
    fail(8.7, "collins", "left", 2000, "Tell them we tried.", "Hãy nói với họ là chúng tôi đã cố."),
    fail(10.9, "armstrong", "right", 1450, "Buzz!", "Buzz!", ["silence"]),
    fail(12.4, "aldrin", "left", 1350, "Neil!", "Neil!"),
    hold("failing", 13.9, "collins", "front", 900, ["fire"]),
  ],
  /* Blackouts: strobes of lightning, the power bus going out lamp by lamp, then a dark cabin and a dead radio. */
  lightning: [
    warn(1.2, "armstrong", "front", 2500, "Lightning all around us.", "Sét loé quanh chúng ta."),
    warn(4, "collins", "left", 2500, "Static on every channel.", "Mọi kênh đều nhiễu."),
    warn(6.8, "aldrin", "right", 3000, "That flash. We have been hit!", "Tia chớp đó. Chúng ta bị đánh trúng!", ["flicker", "sparks"]),
    dial("trouble", 10, 1400, ["flicker"]),
    warn(11.6, "aldrin", "right", 2000, "Neil, the lights!", "Neil, đèn!", ["flicker"]),
    hold("trouble", 13.8, "armstrong", "front", 1000, ["flicker"]),
    fail(0.3, "armstrong", "front", 2850, "We lost everything! Everything!", "Chúng ta mất hết rồi! Mất hết!", ["stinger", "flicker"]),
    dial("failing", 3.4, 2000),
    fail(5.6, "collins", "left", 2000, "The radio is dead!", "Radio chết rồi!", ["sparks"]),
    hold("failing", 7.8, "aldrin", "right", 1600, ["flicker"]),
    fail(9.6, "collins", "front", 1800, "Is anyone there?", "Có ai không?"),
    fail(11.6, "armstrong", "front", 2000, "Stay calm.", "Bình tĩnh.", ["silence"]),
    hold("failing", 13.8, "aldrin", "left", 1000, ["fire"]),
  ],
};
