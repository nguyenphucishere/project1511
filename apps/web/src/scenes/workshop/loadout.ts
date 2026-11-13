import type { LocalizedText } from "@/i18n";
import type { VehicleId } from "@/lib/simulation/launch.types";

/**
 * Part choices for the assembly hall's last step: which engines and which tanks the first stage
 * gets. The numbers are round, illustrative figures (the same DEMO spirit as the part list), but
 * the arithmetic is the real rocket equation, so the readouts move the way a player expects.
 *
 * The choice carries into mission control: the engine class decides the launch vehicle there and
 * the tank size decides how much propellant the console starts with.
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
  /** Sea-level thrust of one engine, MN. */
  thrustEachMN: number;
  massEachT: number;
  /** Specific impulse, seconds. */
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
    thrustEachMN: 8.2,
    massEachT: 8.4,
    isp: 290,
    vehicle: "kestrel",
    name: { en: "Kestrel quad", vi: "Bộ bốn Kestrel" },
    note: { en: "Four engines. Cheap, but it lifts less.", vi: "Bốn động cơ. Rẻ, nhưng chở được ít hơn." },
  },
  {
    id: "standard",
    count: 5,
    thrustEachMN: 8.2,
    massEachT: 8.4,
    isp: 300,
    vehicle: "saros",
    name: { en: "Saros five-pack", vi: "Cụm năm Saros" },
    note: { en: "Five engines. The balanced heavy-lift choice.", vi: "Năm động cơ. Lựa chọn tải nặng cân bằng." },
  },
  {
    id: "heavy",
    count: 9,
    thrustEachMN: 8.2,
    massEachT: 9.2,
    isp: 305,
    vehicle: "orison",
    name: { en: "Orison nine-cluster", vi: "Cụm chín Orison" },
    note: { en: "Nine engines. Huge thrust, huge bill.", vi: "Chín động cơ. Lực đẩy khổng lồ, hoá đơn cũng khổng lồ." },
  },
];

export const TANKS: TankOption[] = [
  {
    id: "small",
    propellantT: 1500,
    fuelPct: 76,
    name: { en: "Short tanks", vi: "Bồn ngắn" },
    note: { en: "Light, but the burn ends early.", vi: "Nhẹ, nhưng động cơ tắt sớm." },
  },
  {
    id: "medium",
    propellantT: 2150,
    fuelPct: 90,
    name: { en: "Standard tanks", vi: "Bồn tiêu chuẩn" },
    note: { en: "The tanks you inspected on the hall floor.", vi: "Bồn bạn đã kiểm tra dưới sàn xưởng." },
  },
  {
    id: "large",
    propellantT: 2800,
    fuelPct: 100,
    name: { en: "Stretched tanks", vi: "Bồn kéo dài" },
    note: { en: "More fuel, more weight to lift.", vi: "Nhiều nhiên liệu hơn, nhưng nặng hơn để nâng." },
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
