import type { LocalizedText } from "@/i18n";
import type { CharacterId } from "./characters";

export type DecisionPointId =
  | "inspection"
  | "weather"
  | "trajectory"
  | "agc_alarm"
  | "landing_approach"
  // Aliases for compatibility
  | "agcAlarm"
  | "landing";

export type DecisionId =
  | "workshop-decision"
  | "weather-decision"
  | "trajectory-decision"
  | "agc-alarm-decision"
  | "landing-decision";

export interface DecisionOption {
  id: string;
  keyLabel: string; // "A", "B", "C"
  title: LocalizedText;
  /** One short line on what the choice costs or risks. */
  hint: LocalizedText;
  historical?: boolean;
}

export interface DecisionDefinition {
  id: DecisionId;
  pointId: DecisionPointId;
  speaker: CharacterId;
  title: LocalizedText;
  /** One or two short sentences: the situation and the question. */
  prompt: LocalizedText;
  options: DecisionOption[];
}

const t = (en: string, vi: string): LocalizedText => ({ en, vi });

/** The five calls of the mission. Kept deliberately short: a decision is a moment, not a reading. */
export const DECISIONS: Record<DecisionId, DecisionDefinition> = {
  "workshop-decision": {
    id: "workshop-decision",
    pointId: "inspection",
    speaker: "workshop-chief",
    title: t("The LOX valve", "Van oxy lỏng"),
    prompt: t(
      "The LOX fill valve shows a slight pressure drop. Check it properly, or sign off and roll out?",
      "Van nạp oxy lỏng hơi tụt áp. Kiểm tra kỹ hay duyệt nhanh để lăn bánh?",
    ),
    options: [
      { id: "thorough", keyLabel: "A", title: t("Check it properly", "Kiểm tra kỹ"), hint: t("Slower, safest", "Chậm hơn, an toàn nhất"), historical: true },
      { id: "rushed", keyLabel: "B", title: t("Sign off fast", "Duyệt nhanh"), hint: t("Faster, −5% fuel reserve", "Nhanh hơn, −5% nhiên liệu dự trữ") },
    ],
  },

  "weather-decision": {
    id: "weather-decision",
    pointId: "weather",
    speaker: "kranz",
    title: t("Launch weather", "Thời tiết phóng"),
    prompt: t(
      "T−15 minutes and a squall line is building over the Cape. Launch, or hold?",
      "T−15 phút, dải mây giông đang hình thành trên mũi Cape. Phóng hay hoãn?",
    ),
    options: [
      { id: "go", keyLabel: "A", title: t("GO in the lull", "GO khi gió lặng"), hint: t("Wind 18 km/h at the pad", "Gió 18 km/h tại bãi phóng"), historical: true },
      { id: "hold", keyLabel: "B", title: t("Hold 48 hours", "Hoãn 48 giờ"), hint: t("Next opportunity, +$60M", "Cơ hội tiếp theo, +$60M") },
      { id: "severe_wind", keyLabel: "C", title: t("GO now, into the squall", "GO ngay, vào dải giông"), hint: t("Wind 48 km/h, gusts 63 km/h at the pad", "Gió 48 km/h, giật 63 km/h tại bãi phóng") },
    ],
  },

  "trajectory-decision": {
    id: "trajectory-decision",
    pointId: "trajectory",
    speaker: "armstrong",
    title: t("Course to the Moon", "Quỹ đạo tới Mặt Trăng"),
    prompt: t(
      "Third stage is off and we are coasting. Which course do we take?",
      "Tầng ba đã tắt, tàu đang trôi. Ta chọn quỹ đạo nào?",
    ),
    options: [
      { id: "free_return", keyLabel: "A", title: t("Free-return", "Tự quay về"), hint: t("The Moon's gravity brings us home if the engine fails", "Nếu động cơ hỏng, trọng lực Mặt Trăng đưa ta về"), historical: true },
      { id: "direct", keyLabel: "B", title: t("Direct", "Bay thẳng"), hint: t("4 hours faster, −8% fuel, no free way home", "Nhanh hơn 4 giờ, −8% nhiên liệu, không tự quay về") },
    ],
  },

  "agc-alarm-decision": {
    id: "agc-alarm-decision",
    pointId: "agc_alarm",
    speaker: "bales",
    title: t("Alarm 1202", "Báo động 1202"),
    prompt: t(
      "The guidance computer throws a 1202 alarm during descent. Keep going, or abort?",
      "Máy tính dẫn đường báo lỗi 1202 khi đang hạ cánh. Tiếp tục hay hủy?",
    ),
    options: [
      { id: "go", keyLabel: "A", title: t("GO, keep descending", "GO, tiếp tục hạ"), hint: t("The alarm is on and off; guidance still runs", "Báo động chỉ ngắt quãng, dẫn đường vẫn chạy"), historical: true },
      { id: "abort_stage", keyLabel: "B", title: t("ABORT", "ABORT, bay lên"), hint: t("Back to lunar orbit; no landing", "Về quỹ đạo Mặt Trăng, không đáp") },
    ],
  },

  "landing-decision": {
    id: "landing-decision",
    pointId: "landing_approach",
    speaker: "armstrong",
    title: t("Where to land", "Chọn chỗ đáp"),
    prompt: t(
      "Boulders right below us and about 60 seconds of fuel. What is the call?",
      "Bãi đá tảng ngay bên dưới, nhiên liệu còn khoảng 60 giây. Ra lệnh gì?",
    ),
    options: [
      { id: "p66_redesignation", keyLabel: "A", title: t("Fly past the boulders", "Bay lướt qua bãi đá"), hint: t("Manual control, burns hover fuel", "Điều khiển thủ công, tốn nhiên liệu lơ lửng"), historical: true },
      { id: "boulder_field", keyLabel: "B", title: t("Land right here", "Đáp ngay tại đây"), hint: t("Saves fuel, but the rocks are deadly", "Tiết kiệm nhiên liệu nhưng đá rất nguy hiểm") },
      { id: "bingo_abort", keyLabel: "C", title: t("Wave off", "Hủy hạ cánh"), hint: t("Fuel's nearly out: climb back to orbit", "Sắp hết nhiên liệu: bay lên quỹ đạo") },
    ],
  },
};
