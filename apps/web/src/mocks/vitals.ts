import type { LocalizedText } from "@/i18n";

/**
 * DEMO medical readings for Scene 1. Fixed values, not measurements or a medical model:
 * the scene only shows them to explain why astronauts are checked before flight.
 */
export type StationId = "heart" | "pressure" | "vision";

export interface VitalStation {
  id: StationId;
  name: LocalizedText;
  why: LocalizedText;
  /** Final reading as shown, e.g. "64". */
  value: string;
  unit: string;
  /** Numeric target the readout counts up to; null for non-numeric readings. */
  countTo: number[] | null;
  normalRange: LocalizedText;
  /** What the doctor says once the reading is in. */
  verdict: LocalizedText;
}

export const VITAL_STATIONS: VitalStation[] = [
  {
    id: "heart",
    name: { en: "Heart rate monitor", vi: "Máy đo nhịp tim" },
    why: {
      en: "Launch pushes the body to several times its weight. A steady resting heart rate shows the heart can handle the load.",
      vi: "Khi phóng, cơ thể chịu lực gấp nhiều lần trọng lượng. Nhịp tim lúc nghỉ ổn định cho thấy tim chịu được tải đó.",
    },
    value: "64",
    unit: "bpm",
    countTo: [64],
    normalRange: { en: "50–100 bpm at rest", vi: "50–100 nhịp/phút lúc nghỉ" },
    verdict: {
      en: "Sixty-four beats a minute. That is a calm, strong heart, just what a launch demands. Well done.",
      vi: "Sáu mươi bốn nhịp một phút. Một trái tim khoẻ và bình tĩnh, đúng thứ mà chuyến phóng cần. Làm tốt lắm.",
    },
  },
  {
    id: "pressure",
    name: { en: "Blood pressure cuff", vi: "Máy đo huyết áp" },
    why: {
      en: "In microgravity, blood shifts toward the head. Doctors record a baseline on the ground to compare against in flight.",
      vi: "Trong môi trường vi trọng lực, máu dồn lên đầu. Bác sĩ ghi lại chỉ số gốc trên mặt đất để so sánh khi đang bay.",
    },
    value: "118/76",
    unit: "mmHg",
    countTo: [118, 76],
    normalRange: { en: "Below 130/85 mmHg", vi: "Dưới 130/85 mmHg" },
    verdict: {
      en: "One eighteen over seventy-six. Textbook blood pressure, and now we have a baseline for flight. Excellent.",
      vi: "Một trăm mười tám trên bảy mươi sáu. Huyết áp chuẩn sách giáo khoa, và giờ ta có chỉ số gốc cho chuyến bay. Tuyệt vời.",
    },
  },
  {
    id: "vision",
    name: { en: "Vision chart", vi: "Bảng đo thị lực" },
    why: {
      en: "Pilots read small cockpit displays during landing. Sharp vision is a hard requirement.",
      vi: "Phi hành gia phải đọc màn hình nhỏ trong buồng lái khi hạ cánh. Thị lực tốt là yêu cầu bắt buộc.",
    },
    value: "20/20",
    unit: "",
    countTo: null,
    normalRange: { en: "20/20 with or without glasses", vi: "20/20, có hoặc không đeo kính" },
    verdict: {
      en: "Twenty-twenty. Eyes like a hawk. You will read every display on the way down.",
      vi: "Hai mươi trên hai mươi. Mắt như mắt diều hâu. Bạn sẽ đọc rõ mọi màn hình trên đường hạ cánh.",
    },
  },
];
