import type { LocalizedText } from "@/i18n";

/**
 * DEMO rocket for Scene 2: a three-part Moon stack (two stages + spacecraft). Masses are
 * rounded, illustrative figures for a heavy-lift Moon rocket, not engineering data, and
 * nothing is computed from them except a displayed total.
 */
export type PartId =
  | "stage1-engines"
  | "stage1-tanks"
  | "interstage"
  | "stage2"
  | "lander"
  | "service-module"
  | "crew-capsule"
  | "escape-tower";

/** Which gantry level a part is inspected from. */
export type LevelId = "floor" | "level2" | "level3";

export interface RocketPart {
  id: PartId;
  level: LevelId;
  name: LocalizedText;
  /** Section of the stack, shown above the name. */
  section: LocalizedText;
  /** What the part does, in Chief Bao's words. */
  role: LocalizedText;
  /** DEMO mass in tonnes, propellant included where the part carries it. */
  massT: number;
  /** One extra fact about when or how the part is used. */
  fact: { label: LocalizedText; value: LocalizedText };
}

/** Bottom-to-top order, which is also the order the HUD lists them. */
export const ROCKET_PARTS: RocketPart[] = [
  {
    id: "stage1-engines",
    level: "floor",
    name: { en: "First-stage engines", vi: "Động cơ tầng 1" },
    section: { en: "Stage 1", vi: "Tầng 1" },
    role: {
      en: "Five engines fire together at liftoff. They lift the whole rocket off the pad and through the thickest part of the air.",
      vi: "Năm động cơ cùng khai hoả lúc cất cánh. Chúng nâng cả tên lửa rời bệ phóng và vượt qua lớp khí quyển dày nhất.",
    },
    massT: 42,
    fact: { label: { en: "Burn time", vi: "Thời gian đốt" }, value: { en: "About 2.5 minutes", vi: "Khoảng 2,5 phút" } },
  },
  {
    id: "stage1-tanks",
    level: "floor",
    name: { en: "First-stage tanks", vi: "Bồn nhiên liệu tầng 1" },
    section: { en: "Stage 1", vi: "Tầng 1" },
    role: {
      en: "Fuel on top, oxidiser below. Most of the rocket's weight at liftoff is the propellant in these two tanks.",
      vi: "Nhiên liệu ở trên, chất oxy hoá ở dưới. Phần lớn khối lượng tên lửa lúc cất cánh là nhiên liệu trong hai bồn này.",
    },
    massT: 2150,
    fact: { label: { en: "Holds", vi: "Chứa" }, value: { en: "Fuel and oxidiser", vi: "Nhiên liệu và chất oxy hoá" } },
  },
  {
    id: "interstage",
    level: "level2",
    name: { en: "Interstage", vi: "Vòng nối tầng" },
    section: { en: "Between stages", vi: "Giữa hai tầng" },
    role: {
      en: "The ring that joins stage 1 to stage 2. It drops away after separation so the upper stage doesn't carry dead weight.",
      vi: "Vòng nối tầng 1 với tầng 2. Nó tách rời sau khi tách tầng để tầng trên không phải mang khối lượng thừa.",
    },
    massT: 5,
    fact: { label: { en: "Released", vi: "Tách rời" }, value: { en: "Just after stage 1 shuts down", vi: "Ngay sau khi tầng 1 tắt máy" } },
  },
  {
    id: "stage2",
    level: "level2",
    name: { en: "Second stage", vi: "Tầng 2" },
    section: { en: "Stage 2", vi: "Tầng 2" },
    role: {
      en: "Takes over high above the ground, where the air is thin, and pushes the spacecraft up to orbital speed.",
      vi: "Tiếp quản ở độ cao lớn, nơi không khí loãng, và đẩy tàu vũ trụ lên tới tốc độ quỹ đạo.",
    },
    massT: 480,
    fact: { label: { en: "Burn time", vi: "Thời gian đốt" }, value: { en: "About 6 minutes", vi: "Khoảng 6 phút" } },
  },
  {
    id: "lander",
    level: "level3",
    name: { en: "Lunar lander", vi: "Tàu đổ bộ Mặt Trăng" },
    section: { en: "Spacecraft adapter", vi: "Khoang chứa tàu đổ bộ" },
    role: {
      en: "Rides folded inside the adapter. Near the Moon, it carries two astronauts down to the surface and back up to orbit.",
      vi: "Nằm gập trong khoang chứa. Khi tới gần Mặt Trăng, nó đưa hai phi hành gia xuống bề mặt rồi trở lại quỹ đạo.",
    },
    massT: 15,
    fact: { label: { en: "Crew", vi: "Phi hành đoàn" }, value: { en: "2 astronauts", vi: "2 phi hành gia" } },
  },
  {
    id: "service-module",
    level: "level3",
    name: { en: "Service module", vi: "Khoang dịch vụ" },
    section: { en: "Spacecraft", vi: "Tàu vũ trụ" },
    role: {
      en: "Power, oxygen, and water for the crew, plus the engine that puts the spacecraft into Moon orbit and brings it home.",
      vi: "Cung cấp điện, oxy và nước cho phi hành đoàn, cùng động cơ đưa tàu vào quỹ đạo Mặt Trăng và đưa tàu về nhà.",
    },
    massT: 25,
    fact: { label: { en: "Main engine", vi: "Động cơ chính" }, value: { en: "1, restartable", vi: "1, khởi động lại được" } },
  },
  {
    id: "crew-capsule",
    level: "level3",
    name: { en: "Crew capsule", vi: "Khoang phi hành đoàn" },
    section: { en: "Spacecraft", vi: "Tàu vũ trụ" },
    role: {
      en: "Where the crew sits for launch, and the only part that comes back to Earth. A heat shield protects it on re-entry.",
      vi: "Nơi phi hành đoàn ngồi khi phóng, và là phần duy nhất trở về Trái Đất. Tấm chắn nhiệt bảo vệ nó khi vào lại khí quyển.",
    },
    massT: 6,
    fact: { label: { en: "Crew", vi: "Phi hành đoàn" }, value: { en: "3 astronauts", vi: "3 phi hành gia" } },
  },
  {
    id: "escape-tower",
    level: "level3",
    name: { en: "Launch escape tower", vi: "Tháp thoát hiểm" },
    section: { en: "Safety", vi: "An toàn" },
    role: {
      en: "If something goes wrong on the pad or early in flight, its motor pulls the capsule clear of the rocket. It is dropped once the climb is safe.",
      vi: "Nếu có sự cố trên bệ phóng hoặc lúc mới bay, động cơ của nó kéo khoang phi hành đoàn ra xa tên lửa. Tháp được bỏ đi khi đã lên cao an toàn.",
    },
    massT: 4,
    fact: { label: { en: "Dropped", vi: "Tách bỏ" }, value: { en: "About 3 minutes after liftoff", vi: "Khoảng 3 phút sau khi cất cánh" } },
  },
];

export const TOTAL_MASS_T = ROCKET_PARTS.reduce((sum, p) => sum + p.massT, 0);
