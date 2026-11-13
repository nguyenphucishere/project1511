import type { LocalizedText } from "@/i18n";
import type { LevelId } from "@/mocks/rocket-parts";
import { facingTheta } from "./layout";

/**
 * Hidden faults the player hunts with the scanner. Each one sits on the hull at a cylindrical
 * position (angle around the axis, height, radius) so the 3D model and the scanner's aiming maths
 * agree on where it is.
 */
export type FaultId = "crack" | "valve" | "heatshield" | "bolt";

export interface Fault {
  id: FaultId;
  /** Gantry level it is easiest to see from. */
  level: LevelId;
  theta: number;
  y: number;
  r: number;
  name: LocalizedText;
  /** What Chief Bao says once it is found. */
  explain: LocalizedText;
  /** What the repair is. */
  fix: LocalizedText;
}

export const FAULTS: Fault[] = [
  {
    id: "crack",
    level: "floor",
    theta: facingTheta("floor") + 0.55,
    y: 6.3,
    r: 1.6,
    name: { en: "Hairline crack in the stage 1 skin", vi: "Vết nứt chân tóc trên vỏ tầng 1" },
    explain: {
      en: "A fatigue crack. Under full tank pressure it would grow and tear the hull open. Good catch.",
      vi: "Một vết nứt do mỏi kim loại. Khi bồn đủ áp suất, nó sẽ lan ra và xé toạc thân tên lửa. Phát hiện tốt lắm.",
    },
    fix: { en: "Weld patch and X-ray the seam", vi: "Hàn vá và chụp X-quang đường hàn" },
  },
  {
    id: "valve",
    level: "floor",
    theta: facingTheta("floor") - 0.72,
    y: 2.95,
    r: 1.78,
    name: { en: "Leaking propellant valve", vi: "Van nhiên liệu bị rò rỉ" },
    explain: {
      en: "Frost on the line means super-cold oxidiser is escaping. A leak near the engines is how fires start.",
      vi: "Sương giá trên ống nghĩa là chất oxy hoá siêu lạnh đang thoát ra. Rò rỉ gần động cơ là cách các vụ cháy bắt đầu.",
    },
    fix: { en: "Replace the valve seal", vi: "Thay gioăng của van" },
  },
  {
    id: "bolt",
    level: "level2",
    theta: facingTheta("level2") - 0.34,
    y: 12.22,
    r: 1.68,
    name: { en: "Loose separation bolt", vi: "Bu-lông tách tầng bị lỏng" },
    explain: {
      en: "One interstage bolt is backing out. Vibration at liftoff would shake it free and the stages could part early.",
      vi: "Một bu-lông ở vòng nối tầng đang tự nới ra. Rung động lúc cất cánh sẽ làm nó rơi ra và các tầng có thể tách sớm.",
    },
    fix: { en: "Re-torque to specification", vi: "Siết lại đúng lực quy định" },
  },
  {
    id: "heatshield",
    level: "level3",
    theta: facingTheta("level3") + 0.6,
    y: 24.45,
    r: 1.02,
    name: { en: "Peeling heat-shield tile", vi: "Tấm chắn nhiệt bị bong" },
    explain: {
      en: "The shield burns away on re-entry, but only evenly. A loose edge would let 1,600 degrees reach the crew.",
      vi: "Tấm chắn cháy dần khi trở lại khí quyển, nhưng phải cháy đều. Một mép bong sẽ để 1.600 độ lọt vào khoang phi hành đoàn.",
    },
    fix: { en: "Re-bond the tile and cure", vi: "Dán lại tấm chắn và hấp cứng" },
  },
];

export const SCAN_SECONDS = 150;

/** World position of a fault. */
export function faultPosition(f: Fault): [number, number, number] {
  return [Math.sin(f.theta) * f.r, f.y, Math.cos(f.theta) * f.r];
}

/**
 * Scanner signal 0..1: how close the view direction is to a fault. The ping rate follows it, so
 * the player can hunt by ear as well as by eye.
 */
export function scannerSignal(
  cam: [number, number, number],
  forward: [number, number, number],
  target: [number, number, number],
): number {
  const dx = target[0] - cam[0];
  const dy = target[1] - cam[1];
  const dz = target[2] - cam[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const dot = (dx * forward[0] + dy * forward[1] + dz * forward[2]) / len;
  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
  const s = Math.max(0, 1 - angle / 0.4);
  return s * s;
}
