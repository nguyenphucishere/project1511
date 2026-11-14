import type { LocalizedText } from "@/i18n";
import type { CharacterId } from "./characters";
import type { DecisionPointId } from "./decisions";

/**
 * Consequence layer for the five decision nodes. Pure data + pure functions:
 *  - what the player sees right after a call (the "beat"),
 *  - how early calls carry forward (hover-fuel margin, subtle callbacks),
 *  - why the run ended the way it did (cause chain).
 */

/** The slice of narrative state these rules read. Structural, so the store type satisfies it. */
export interface NarrativeLike {
  decisions: Record<string, string>;
}

export type PointKey = "inspection" | "weather" | "trajectory" | "agc_alarm" | "landing_approach";
export type BeatTone = "calm" | "tense" | "critical";

export interface ConsequenceLine {
  /** Who is heard. Omit for cabin / ambient narration. */
  speaker?: CharacterId;
  text: LocalizedText;
}

export interface Consequence {
  /** Mission clock stamp shown on the beat. */
  met: string;
  tone: BeatTone;
  lines: ConsequenceLine[];
}

export interface CauseEntry {
  id: string;
  title: LocalizedText;
  effect: LocalizedText;
  impact: "positive" | "neutral" | "negative";
}

/** Landing with a hover margin below this forces the Bingo wave-off. */
export const MIN_LANDING_MARGIN_S = 10;
export const BASE_HOVER_MARGIN_S = 25;
const RUSHED_INSPECTION_COST_S = 8;
const DIRECT_TRAJECTORY_COST_S = 8;

const POINT_ALIASES: Record<string, PointKey> = {
  inspection: "inspection",
  weather: "weather",
  trajectory: "trajectory",
  agc_alarm: "agc_alarm",
  agcAlarm: "agc_alarm",
  landing_approach: "landing_approach",
  landing: "landing_approach",
};

const CHOICE_ALIASES: Record<string, string> = {
  "severe-wind": "severe_wind",
  "free-return": "free_return",
  abort: "abort_stage",
  "p66-redesignate": "p66_redesignation",
  "west-crater": "boulder_field",
  "bingo-abort": "bingo_abort",
  nominal: "go",
};

export function normalizePoint(point: string): PointKey | null {
  return POINT_ALIASES[point] ?? null;
}

export function normalizeChoice(choice: string): string {
  return CHOICE_ALIASES[choice] ?? choice;
}

function choiceOf(narrative: NarrativeLike, point: PointKey): string | undefined {
  const d = narrative.decisions;
  const raw =
    point === "agc_alarm"
      ? (d.agc_alarm ?? d.agcAlarm)
      : point === "landing_approach"
        ? (d.landing_approach ?? d.landing)
        : d[point];
  return raw ? normalizeChoice(raw) : undefined;
}

/** Seconds of hover fuel left at the 60-second call, after the earlier shortcuts. */
export function hoverMarginSeconds(narrative: NarrativeLike): number {
  let margin = BASE_HOVER_MARGIN_S;
  if (choiceOf(narrative, "inspection") === "rushed") margin -= RUSHED_INSPECTION_COST_S;
  if (choiceOf(narrative, "trajectory") === "direct") margin -= DIRECT_TRAJECTORY_COST_S;
  return margin;
}

/** Which ending the final-approach call produces, given what the player did earlier. */
export function resolveLanding(narrative: NarrativeLike, choice: string): "ending-1" | "ending-3" | "ending-4" | null {
  switch (normalizeChoice(choice)) {
    case "p66_redesignation":
      return hoverMarginSeconds(narrative) >= MIN_LANDING_MARGIN_S ? "ending-1" : "ending-4";
    case "boulder_field":
      return "ending-3";
    case "bingo_abort":
      return "ending-4";
    default:
      return null;
  }
}

const L = (en: string, vi: string): LocalizedText => ({ en, vi });

export const CONSEQUENCES: Record<string, Consequence> = {
  "inspection:thorough": {
    met: "T-06:00:00",
    tone: "calm",
    lines: [
      { speaker: "workshop-chief", text: L("Helium holds. Not a single bubble on the flange. Torque it down again, star pattern, one more time.", "Heli giữ kín. Không một bọt khí nào ở mặt bích. Siết lại theo hình sao, thêm một lần nữa.") },
      { text: L("Six hours of the rollout schedule go into a valve nobody will ever see again.", "Sáu giờ của lịch lăn bánh được dành cho một chiếc van mà sẽ không ai nhìn thấy lần nữa.") },
    ],
  },
  "inspection:rushed": {
    met: "T-06:00:00",
    tone: "tense",
    lines: [
      { speaker: "workshop-chief", text: L("Signed off. The reading's inside the line... barely. Rollout ceremony starts on time.", "Đã ký duyệt. Chỉ số nằm trong vạch... sát nút. Lễ lăn bánh bắt đầu đúng giờ.") },
      { text: L("The flange is still warm under the paint. Nobody looks at it twice.", "Mặt bích vẫn còn ấm dưới lớp sơn. Không ai nhìn nó lần thứ hai.") },
    ],
  },
  "weather:go": {
    met: "T-00:09:00",
    tone: "calm",
    lines: [
      { speaker: "kranz", text: L("Weather is GO. All stations, we are proceeding with the terminal count.", "Thời tiết GO. Toàn bộ các trạm, tiếp tục đếm ngược chót.") },
      { text: L("The squall line slides east. The flags at the pad hang almost still.", "Dải mây dông trôi về phía đông. Những lá cờ ở bệ phóng gần như đứng yên.") },
    ],
  },
  "weather:hold": {
    met: "T-00:09:00",
    tone: "tense",
    lines: [
      { speaker: "kranz", text: L("Hold, hold, hold. We are recycling. Range, give me a number on the delay.", "Dừng, dừng, dừng. Chúng ta hoãn đếm ngược. Range, báo chi phí trễ cho tôi.") },
      { text: L("Sixty million dollars of range time dissolves. The wind drops by dawn, and the countdown restarts.", "Sáu mươi triệu đô la thời gian bãi phóng tan biến. Gió lặng dần khi trời sáng, và đếm ngược bắt đầu lại.") },
    ],
  },
  "weather:severe_wind": {
    met: "T+00:01:23",
    tone: "critical",
    lines: [
      { speaker: "kranz", text: L("Understood. Launch commit... overridden. Ignition sequence start.", "Rõ. Cam kết phóng... bị bỏ qua. Bắt đầu chuỗi đánh lửa.") },
      { text: L("The stack leans into the gust as it clears the tower. Gimbals chase it, and chase it.", "Tòa tháp tên lửa nghiêng theo cơn gió khi rời tháp phóng. Các gimbal đuổi theo, rồi lại đuổi theo.") },
      { speaker: "flight-director", text: L("Flight, Booster. We are losing pressure on engine one...", "Flight, Booster. Chúng ta đang mất áp suất ở động cơ số một...") },
    ],
  },
  "trajectory:free_return": {
    met: "GET 003:20:00",
    tone: "calm",
    lines: [
      { speaker: "armstrong", text: L("Houston, confirm free-return. Aim point looks good.", "Houston, xác nhận quỹ đạo tự do quay về. Điểm ngắm tốt.") },
      { text: L("The trajectory bends a little slower and a little safer. Behind the Moon, a door stays open toward home.", "Quỹ đạo uốn chậm hơn một chút và an toàn hơn một chút. Sau Mặt Trăng, cánh cửa về nhà vẫn mở.") },
    ],
  },
  "trajectory:direct": {
    met: "GET 003:20:00",
    tone: "tense",
    lines: [
      { speaker: "armstrong", text: L("Houston, go with the direct profile. We'll take the four hours.", "Houston, chọn quỹ đạo trực tiếp. Chúng tôi lấy bốn giờ đó.") },
      { text: L("Time is saved. A margin of propellant and a safety net are quietly spent to pay for it.", "Thời gian được tiết kiệm. Một phần nhiên liệu dự trữ và tấm lưới an toàn lặng lẽ bị tiêu hao để trả giá.") },
    ],
  },
  "agc_alarm:go": {
    met: "GET 102:38:22",
    tone: "tense",
    lines: [
      { speaker: "bales", text: L("Same type. We are GO on that alarm.", "Cùng loại. Chúng ta GO với báo động đó.") },
      { speaker: "garman", text: L("It's coming and going. The numbers are still updating on guidance.", "Nó lúc có lúc không. Các chỉ số dẫn đường vẫn đang cập nhật.") },
      { text: L("Another flash on the display. Eagle keeps falling toward the surface.", "Lại một lần nhấp nháy trên màn hình. Eagle tiếp tục rơi về phía bề mặt.") },
    ],
  },
  "agc_alarm:abort_stage": {
    met: "GET 102:38:22",
    tone: "critical",
    lines: [
      { speaker: "armstrong", text: L("Abort Stage. Abort Stage.", "Abort Stage. Abort Stage.") },
      { text: L("Bolts fire with a crack. The descent stage falls away and the ascent engine lights the cabin orange.", "Bu-lông nổ vang. Tầng đáp rơi đi, động cơ bay lên nhuộm khoang tàu một màu cam.") },
      { speaker: "collins", text: L("Eagle, Columbia. I have you in sight. Come on home.", "Eagle, Columbia. Tôi đã thấy các bạn. Về nhà thôi.") },
    ],
  },
  "landing_approach:p66_redesignation": {
    met: "GET 102:44:55",
    tone: "tense",
    lines: [
      { speaker: "armstrong", text: L("P66. Rate of descent. Taking it manual.", "P66. Tốc độ hạ. Tôi chuyển sang điều khiển thủ công.") },
      { speaker: "aldrin", text: L("Seventy-five feet. Picking up some dust. Thirty seconds.", "Bảy mươi lăm feet. Bụi bắt đầu bốc lên. Ba mươi giây.") },
      { text: L("The boulders slide under the windows. Ahead, a smooth patch. The fuel clock keeps running.", "Những tảng đá trượt dưới cửa sổ. Phía trước, một mảng đất phẳng. Đồng hồ nhiên liệu vẫn chạy.") },
    ],
  },
  // Same call, but the earlier shortcuts have already spent the margin.
  "landing_approach:p66_low_margin": {
    met: "GET 102:45:05",
    tone: "critical",
    lines: [
      { speaker: "armstrong", text: L("P66. Rate of descent. Manual... looking for a clear patch.", "P66. Tốc độ hạ. Thủ công... tìm một mảng đất trống.") },
      { speaker: "flight-director", text: L("Sixty seconds.", "Sáu mươi giây.") },
      { text: L("The patch is still too far downrange. The reserve you thought you had is not on the gauge.", "Mảng đất đó vẫn còn quá xa. Phần nhiên liệu dự trữ bạn tưởng có thì không còn trên đồng hồ.") },
      { speaker: "armstrong", text: L("Bingo. We have to stage.", "Bingo. Chúng ta phải tách tầng.") },
    ],
  },
  "landing_approach:boulder_field": {
    met: "GET 102:45:22",
    tone: "critical",
    lines: [
      { speaker: "armstrong", text: L("Dropping it here. Throttle down.", "Hạ xuống ngay đây. Giảm ga.") },
      { text: L("The slope is steeper than it looked from 150 feet. A boulder fills the left window, closing fast.", "Triền dốc dốc hơn so với lúc nhìn từ độ cao 150 feet. Một tảng đá choán cửa sổ bên trái, đang áp sát rất nhanh.") },
      { speaker: "aldrin", text: L("Contact... Neil, we're tipping.", "Tiếp xúc... Neil, tàu đang nghiêng.") },
    ],
  },
  "landing_approach:bingo_abort": {
    met: "GET 102:45:32",
    tone: "critical",
    lines: [
      { speaker: "flight-director", text: L("Sixty seconds. Bingo is at thirty.", "Sáu mươi giây. Ngưỡng Bingo là ba mươi.") },
      { speaker: "armstrong", text: L("Bingo fuel. We are Abort Stage.", "Hết nhiên liệu an toàn. Chúng tôi Abort Stage.") },
      { text: L("The ground drops away. The dust cloud thins behind the ascent stage as it climbs.", "Mặt đất lùi xa. Đám bụi mỏng dần phía sau tầng bay lên khi nó leo cao.") },
    ],
  },
};

/** The beat shown after a decision. Falls back to a generic line for unknown ids. */
export function getConsequence(point: string, choice: string, narrative: NarrativeLike): Consequence {
  const key = normalizePoint(point);
  const id = normalizeChoice(choice);
  let lookup = key ? `${key}:${id}` : "";

  // `narrative` already includes the call being resolved when the store has applied it.
  if (key === "landing_approach" && id === "p66_redesignation") {
    const withChoice = { decisions: { ...narrative.decisions, landing_approach: id } };
    if (hoverMarginSeconds(withChoice) < MIN_LANDING_MARGIN_S) lookup = "landing_approach:p66_low_margin";
  }

  const base = CONSEQUENCES[lookup] ?? {
    met: "",
    tone: "calm" as const,
    lines: [{ text: L("The call is made. The mission moves on.", "Quyết định đã được đưa ra. Nhiệm vụ tiếp tục.") }],
  };

  // Delayed, unannounced callback: a free-return profile softens the abort.
  if (key === "agc_alarm" && id === "abort_stage" && choiceOf(narrative, "trajectory") === "direct") {
    return {
      ...base,
      lines: [
        ...base.lines,
        { text: L("With no free-return behind them, the clean staging is the only way back.", "Không còn quỹ đạo tự do quay về phía sau, lần tách tầng gọn gàng là con đường duy nhất để trở về.") },
      ],
    };
  }
  return base;
}

/**
 * Subtle lines added to later decisions when an earlier shortcut is still in play. They hint at
 * the cause without naming it; the explicit link only appears on the end screen.
 */
export function getCallbackLines(point: string, narrative: NarrativeLike): LocalizedText[] {
  const key = normalizePoint(point);
  if (key !== "agc_alarm" && key !== "landing_approach") return [];
  const lines: LocalizedText[] = [];
  if (choiceOf(narrative, "inspection") === "rushed") {
    lines.push(
      L(
        "Descent propellant quantity is reading a little lower than the plan.",
        "Lượng nhiên liệu hạ cánh đang thấp hơn một chút so với kế hoạch.",
      ),
    );
  }
  if (choiceOf(narrative, "trajectory") === "direct") {
    lines.push(
      L(
        "The fast transit left the burn schedule with very little slack.",
        "Chuyến bay nhanh khiến lịch đốt động cơ gần như không còn chỗ trống.",
      ),
    );
  }
  return lines;
}

/** One short in-world opinion from a second voice, shown before the options. */
export const ADVICE: Record<string, { speaker: CharacterId; text: LocalizedText }> = {
  inspection: {
    speaker: "engineer",
    text: L(
      "It's inside spec, but it has been sliding all shift. I can't tell you if that means anything.",
      "Chỉ số vẫn trong giới hạn, nhưng nó cứ tụt dần suốt ca. Tôi không dám nói điều đó có nghĩa gì không.",
    ),
  },
  weather: {
    speaker: "collins",
    text: L(
      "I'm the one on top of it, Gene. Your call, but I've felt this stack sway in lighter wind than this.",
      "Tôi là người ngồi trên đỉnh, Gene ạ. Quyết định là của anh, nhưng tôi từng cảm nhận tòa tháp này lắc trong gió nhẹ hơn thế.",
    ),
  },
  trajectory: {
    speaker: "aldrin",
    text: L(
      "Fast gets us there with more daylight on the site. Slow keeps something behind us if the engine misses.",
      "Nhanh thì tới nơi với nhiều ánh sáng hơn trên bãi đáp. Chậm thì vẫn còn đường lui nếu động cơ trục trặc.",
    ),
  },
  agc_alarm: {
    speaker: "garman",
    text: L(
      "It's the same type as before. It comes and goes, and the guidance numbers are still moving.",
      "Cùng loại với lần trước. Nó lúc có lúc không, và các chỉ số dẫn đường vẫn đang chạy.",
    ),
  },
  landing_approach: {
    speaker: "aldrin",
    text: L(
      "Fuel's counting down, Neil. Out there, your eyes are better than the computer's.",
      "Nhiên liệu đang đếm ngược, Neil. Ngoài kia, mắt của anh tốt hơn máy tính.",
    ),
  },
};

const CAUSE_TEXT: Record<string, Pick<CauseEntry, "title" | "effect" | "impact">> = {
  "inspection:thorough": {
    title: L("Full LOX valve inspection", "Kiểm định đầy đủ van LOX"),
    effect: L("No propellant margin lost.", "Không mất nhiên liệu dự trữ."),
    impact: "positive",
  },
  "inspection:rushed": {
    title: L("Fast-track LOX sign-off", "Duyệt nhanh van LOX"),
    effect: L(`Cost ${RUSHED_INSPECTION_COST_S} s of hover fuel at touchdown.`, `Mất ${RUSHED_INSPECTION_COST_S} giây nhiên liệu lơ lửng khi tiếp đất.`),
    impact: "negative",
  },
  "weather:go": {
    title: L("Launched inside wind limits", "Phóng trong giới hạn gió"),
    effect: L("Clean tower clearance and Max-Q.", "Rời tháp và qua Max-Q an toàn."),
    impact: "positive",
  },
  "weather:hold": {
    title: L("Held the countdown", "Hoãn đếm ngược"),
    effect: L("+$60M range cost, no structural risk.", "+$60M chi phí bãi phóng, không rủi ro kết cấu."),
    impact: "neutral",
  },
  "weather:severe_wind": {
    title: L("Launched into severe wind", "Phóng trong gió mạnh"),
    effect: L("Shear at Max-Q exceeded the gimbal margin.", "Lực cắt tại Max-Q vượt biên độ gimbal."),
    impact: "negative",
  },
  "trajectory:free_return": {
    title: L("Free-return trajectory", "Quỹ đạo tự do quay về"),
    effect: L("Kept the passive abort corridor.", "Giữ được hành lang hủy thụ động."),
    impact: "positive",
  },
  "trajectory:direct": {
    title: L("Direct high-energy trajectory", "Quỹ đạo trực tiếp năng lượng cao"),
    effect: L(`Cost ${DIRECT_TRAJECTORY_COST_S} s of hover fuel and the passive abort.`, `Mất ${DIRECT_TRAJECTORY_COST_S} giây nhiên liệu lơ lửng và khả năng hủy thụ động.`),
    impact: "negative",
  },
  "agc_alarm:go": {
    title: L("GO on the 1202 alarm", "GO với báo động 1202"),
    effect: L("Powered descent continued.", "Tiếp tục hạ cánh có động cơ."),
    impact: "positive",
  },
  "agc_alarm:abort_stage": {
    title: L("Abort Stage on the alarm", "Abort Stage khi có báo động"),
    effect: L("Landing scrubbed, crew safe in orbit.", "Hủy đổ bộ, phi hành đoàn an toàn trên quỹ đạo."),
    impact: "neutral",
  },
  "landing_approach:p66_redesignation": {
    title: L("Manual P66 past West Crater", "P66 thủ công vượt West Crater"),
    effect: L("Flew to a clear landing site.", "Bay tới bãi đáp trống."),
    impact: "positive",
  },
  "landing_approach:boulder_field": {
    title: L("Touched down in the boulder field", "Tiếp đất trên bãi đá"),
    effect: L("Slope and boulders exceeded the gear limits.", "Triền dốc và đá tảng vượt giới hạn chân đế."),
    impact: "negative",
  },
  "landing_approach:bingo_abort": {
    title: L("Bingo wave-off at 40 ft", "Hủy hạ cánh Bingo ở độ cao 12 m"),
    effect: L("Respected the fuel rule, no landing.", "Tuân thủ quy tắc nhiên liệu, không đáp."),
    impact: "neutral",
  },
};

/** Ordered list of the player's calls and what each one cost or bought. */
export function causeChain(narrative: NarrativeLike): CauseEntry[] {
  const order: PointKey[] = ["inspection", "weather", "trajectory", "agc_alarm", "landing_approach"];
  const entries: CauseEntry[] = [];
  for (const point of order) {
    const choice = choiceOf(narrative, point);
    if (!choice) continue;
    const text = CAUSE_TEXT[`${point}:${choice}`];
    if (text) entries.push({ id: `${point}:${choice}`, ...text });
  }

  const landing = choiceOf(narrative, "landing_approach");
  if (landing === "p66_redesignation" && resolveLanding(narrative, landing) === "ending-4") {
    entries.push({
      id: "landing_approach:margin",
      title: L("Margin ran out at the 60-second call", "Hết dự trữ ở mốc 60 giây"),
      effect: L(
        `Only ${hoverMarginSeconds(narrative)} s of hover fuel left (${MIN_LANDING_MARGIN_S} s needed): forced wave-off.`,
        `Chỉ còn ${hoverMarginSeconds(narrative)} giây nhiên liệu lơ lửng (cần ${MIN_LANDING_MARGIN_S} giây): buộc phải hủy hạ cánh.`,
      ),
      impact: "negative",
    });
  }
  return entries;
}
