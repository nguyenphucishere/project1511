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
  },
];
