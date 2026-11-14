import type { LocalizedText } from "@/i18n";

/**
 * On-screen text for liftoff and rendezvous. Captions only: none of these lines has a recording
 * yet, so they stay silent until the voice library is generated (see docs/return-chapter.md).
 */
const L = (en: string, vi: string): LocalizedText => ({ en, vi });

export const HOMEWARD = {
  liftoff: {
    label: L("Liftoff from Tranquility Base: the Eagle's ascent stage climbs from the Moon", "Cất cánh từ Căn cứ Tĩnh Lặng: tầng bay lên của Eagle rời Mặt Trăng"),
    title: L("Liftoff", "Cất cánh"),
    intro: L(
      "One engine, no spare. If it does not light, we stay here.",
      "Một động cơ, không có dự phòng. Nếu nó không nổ, chúng ta ở lại đây.",
    ),
    arm: L("Arm the ascent engine", "Kích hoạt động cơ bay lên"),
    armed: L("Armed", "Đã sẵn sàng"),
    fire: L("Fire", "Đốt"),
    burning: L("Burn", "Đang đốt"),
    stageSep: L("Stages separate: the descent stage stays behind as the launch pad", "Tách tầng: tầng hạ cánh ở lại làm bệ phóng"),
    flag: L("The exhaust blows over the flag. (Aldrin's account)", "Luồng khí phụt làm đổ lá cờ. (Lời kể của Aldrin)"),
    alt: L("Altitude", "Độ cao"),
    speed: L("Speed", "Tốc độ"),
    orbit: L("Orbit reached. Columbia is waiting.", "Đã vào quỹ đạo. Columbia đang chờ."),
    done: L("Continue home", "Tiếp tục về nhà"),
    met: L("Mission time", "Thời gian nhiệm vụ"),
  },
} satisfies Record<string, Record<string, LocalizedText>>;
