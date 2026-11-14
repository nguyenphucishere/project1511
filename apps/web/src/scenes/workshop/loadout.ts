import type { LocalizedText } from "@/i18n";
import type { VehicleId } from "@/lib/simulation/launch.types";

/**
 * Historical Apollo 11 Saturn V S-IC Stage Workshop Loadout.
 * Based on Technical Catalog NASA-APOLLO-SIM-2026-REV1 §1.1.
 * First stage features 5x Rocketdyne F-1 engine clusters generating 33.85 MN sea-level thrust
 * and 2,077 T standard cryogenic LOX/RP-1 propellant tanks.
 */
export type EngineId = "light" | "standard" | "heavy";
export type TankId = "small" | "medium" | "large";

export interface Loadout {
  engine: EngineId;
  tank: TankId;
}

export interface EngineOption {
  id: EngineId;
  count: number;
  /** Sea-level thrust of one engine, MN. Rocketdyne F-1 = 6.77 MN (1.522M lbf) */
  thrustEachMN: number;
  massEachT: number;
  /** Specific impulse, seconds. F-1 = 263s SL, 304s Vac; effective flight average ~300s */
  isp: number;
  vehicle: VehicleId;
  name: LocalizedText;
  note: LocalizedText;
}

export interface TankOption {
  id: TankId;
  propellantT: number;
  /** Propellant load the launch console starts from, percent of a full load. */
  fuelPct: number;
  name: LocalizedText;
  note: LocalizedText;
}

export const ENGINES: EngineOption[] = [
  {
    id: "light",
    count: 4,
    thrustEachMN: 6.77,
    massEachT: 8.4,
    isp: 290,
    vehicle: "kestrel",
    name: { en: "Sub-scale 4x F-1 Cluster", vi: "Cụm 4 động cơ F-1 thử nghiệm" },
    note: { en: "4 engines (27.08 MN). Insufficient thrust-to-weight for full Saturn V stack.", vi: "4 động cơ (27,08 MN). Tỷ lệ lực đẩy trên trọng lượng không đủ cho cả tên lửa Saturn V." },
  },
  {
    id: "standard",
    count: 5,
    thrustEachMN: 6.77,
    massEachT: 8.4,
    isp: 300,
    vehicle: "saros",
    name: { en: "Saturn V S-IC 5x Rocketdyne F-1", vi: "Saturn V S-IC 5x Rocketdyne F-1" },
    note: { en: "Historical AS-506 configuration. 33.85 MN liftoff thrust burning LOX/RP-1.", vi: "Cấu hình lịch sử AS-506. Lực đẩy cất cánh 33,85 MN đốt LOX/RP-1." },
  },
  {
    id: "heavy",
    count: 9,
    thrustEachMN: 6.77,
    massEachT: 8.4,
    isp: 305,
    vehicle: "orison",
    name: { en: "Uprated 9-Engine Super-Heavy Cluster", vi: "Cụm 9 động cơ nâng cấp siêu nặng" },
    note: { en: "60.93 MN liftoff thrust. Exceeds max acceleration tolerance for small tank configurations.", vi: "Lực đẩy cất cánh 60,93 MN. Vượt quá ngưỡng gia tốc tối đa đối với cấu hình bồn nhỏ." },
  },
];

export const TANKS: TankOption[] = [
  {
    id: "small",
    propellantT: 1500,
    fuelPct: 76,
    name: { en: "Short S-IC Tanks (1,500 T)", vi: "Bồn S-IC ngắn (1.500 tấn)" },
    note: { en: "Underfilled tanks: burns out early, unable to reach staging velocity (4.0 km/s).", vi: "Thiếu nhiên liệu: động cơ tắt sớm, không đạt vận tốc tách tầng (4,0 km/s)." },
  },
  {
    id: "medium",
    propellantT: 2077,
    fuelPct: 90,
    name: { en: "Standard S-IC Flight Tanks (2,077 T)", vi: "Bồn S-IC tiêu chuẩn (2.077 tấn)" },
    note: { en: "Authoritative Apollo 11 load: 1,463 T liquid oxygen + 614 T RP-1 kerosene.", vi: "Tải chuẩn Apollo 11: 1.463 tấn oxy lỏng + 614 tấn dầu RP-1." },
  },
  {
    id: "large",
    propellantT: 2800,
    fuelPct: 100,
    name: { en: "Stretched J-Series Tanks (2,800 T)", vi: "Bồn kéo dài J-Series (2.800 tấn)" },
    note: { en: "Extended propellant capacity for higher payload margin, heavier structure.", vi: "Tăng dung tích nhiên liệu cho khối lượng hàng lớn hơn, kết cấu nặng hơn." },
  },
];

/** Everything on the stack that is not engines or propellant: stage 2, spacecraft, structure. */
export const STRUCTURE_T = 535;
const G0 = 9.81;

/** Below this thrust-to-weight ratio the rocket sits on the pad; above the cap the crew is crushed. */
export const TWR_MIN = 1.2;
export const TWR_MAX = 2.5;
/** Velocity the first stage must add for the staging to work (game rule). */
export const DELTA_V_MIN_KMS = 4;

export const DEFAULT_LOADOUT: Loadout = { engine: "standard", tank: "medium" };

export interface LoadoutStats {
  engine: EngineOption;
  tank: TankOption;
  thrustMN: number;
  liftoffMassT: number;
  /** Thrust-to-weight ratio at liftoff. */
  twr: number;
  /** First-stage velocity gain, km/s (rocket equation). */
  deltaVKms: number;
  twrTooLow: boolean;
  twrTooHigh: boolean;
  deltaVLow: boolean;
  /** True when this build would fly and the chief signs it off. */
  ok: boolean;
}

export function engineOption(id: EngineId): EngineOption {
  return ENGINES.find((e) => e.id === id) ?? ENGINES[1];
}

export function tankOption(id: TankId): TankOption {
  return TANKS.find((t) => t.id === id) ?? TANKS[1];
}

export function assessLoadout(l: Loadout): LoadoutStats {
  const engine = engineOption(l.engine);
  const tank = tankOption(l.tank);
  const thrustMN = engine.count * engine.thrustEachMN;
  const engineMassT = engine.count * engine.massEachT;
  const liftoffMassT = STRUCTURE_T + engineMassT + tank.propellantT;
  const twr = (thrustMN * 1000) / (liftoffMassT * G0);
  const burnoutT = liftoffMassT - tank.propellantT;
  const deltaVKms = (engine.isp * G0 * Math.log(liftoffMassT / burnoutT)) / 1000;
  const twrTooLow = twr < TWR_MIN;
  const twrTooHigh = twr > TWR_MAX;
  const deltaVLow = deltaVKms < DELTA_V_MIN_KMS;
  return {
    engine,
    tank,
    thrustMN,
    liftoffMassT,
    twr,
    deltaVKms,
    twrTooLow,
    twrTooHigh,
    deltaVLow,
    ok: !twrTooLow && !twrTooHigh && !deltaVLow,
  };
}

/** What the launch console starts from after this build. */
export function consoleSeed(l: Loadout): { vehicle: VehicleId; fuelPct: number } {
  return { vehicle: engineOption(l.engine).vehicle, fuelPct: tankOption(l.tank).fuelPct };
}

export function isLoadout(x: unknown): x is Loadout {
  const l = x as Partial<Loadout> | null | undefined;
  return !!l && ENGINES.some((e) => e.id === l.engine) && TANKS.some((t) => t.id === l.tank);
}
