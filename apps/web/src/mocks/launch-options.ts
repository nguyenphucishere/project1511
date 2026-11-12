import type { LocalizedText } from "@/i18n";
import type { LaunchWindowId, ParkingOrbitKm, PayloadId, VehicleId } from "@/lib/simulation/launch.types";

/**
 * DEMO choices for the Scene 3 launch console. Vehicles are fictional; capacities, costs and
 * the fuel rule are made-up round numbers chosen so that some combinations fail in flight.
 * They are game rules, not rocket science, and the console says so.
 */

export const BUDGET_M = 2500;

export interface VehicleOption {
  id: VehicleId;
  name: string;
  kind: LocalizedText;
  note: LocalizedText;
  /** Tonnes the vehicle can send toward the Moon. */
  capacityT: number;
  costM: number;
}

export const VEHICLES: VehicleOption[] = [
  {
    id: "kestrel",
    name: "Kestrel M",
    kind: { en: "Medium lift", vi: "Tải trung bình" },
    note: { en: "Cheap and proven, but built for smaller missions.", vi: "Rẻ và đáng tin cậy, nhưng dành cho nhiệm vụ nhỏ hơn." },
    capacityT: 28,
    costM: 450,
  },
  {
    id: "saros",
    name: "Saros H",
    kind: { en: "Heavy lift", vi: "Tải nặng" },
    note: { en: "The rocket you inspected in the assembly hall.", vi: "Tên lửa bạn vừa kiểm tra ở xưởng lắp ráp." },
    capacityT: 48,
    costM: 1200,
  },
  {
    id: "orison",
    name: "Orison SH",
    kind: { en: "Super-heavy lift", vi: "Tải siêu nặng" },
    note: { en: "Room to spare, at a price.", vi: "Dư sức chở, nhưng rất đắt." },
    capacityT: 70,
    costM: 2100,
  },
];

export interface PayloadOption {
  id: PayloadId;
  name: LocalizedText;
  note: LocalizedText;
  massT: number;
  costM: number;
}

export const PAYLOADS: PayloadOption[] = [
  {
    id: "standard",
    name: { en: "Crew ship + lander", vi: "Tàu phi hành đoàn + tàu đổ bộ" },
    note: { en: "Capsule, service module, and lander: what the landing needs.", vi: "Khoang phi hành đoàn, khoang dịch vụ và tàu đổ bộ: đủ cho việc hạ cánh." },
    massT: 46,
    costM: 250,
  },
  {
    id: "science",
    name: { en: "+ Science kit", vi: "+ Bộ thiết bị khoa học" },
    note: { en: "Adds seismometers and sample boxes.", vi: "Thêm máy đo địa chấn và hộp lấy mẫu." },
    massT: 50,
    costM: 330,
  },
  {
    id: "rover",
    name: { en: "+ Lunar rover", vi: "+ Xe tự hành Mặt Trăng" },
    note: { en: "Lets the crew drive kilometres from the lander.", vi: "Cho phi hành đoàn đi xa tàu đổ bộ hàng cây số." },
    massT: 58,
    costM: 450,
  },
];

export interface OrbitOption {
  km: ParkingOrbitKm;
  note: LocalizedText;
  /** Percentage points added to the fuel requirement. */
  fuelDelta: number;
}

export const ORBITS: OrbitOption[] = [
  { km: 160, note: { en: "Less fuel, more air drag", vi: "Ít nhiên liệu hơn, lực cản không khí lớn hơn" }, fuelDelta: -3 },
  { km: 185, note: { en: "Standard parking orbit", vi: "Quỹ đạo chờ tiêu chuẩn" }, fuelDelta: 0 },
  { km: 250, note: { en: "Safer, but costs fuel", vi: "An toàn hơn, nhưng tốn nhiên liệu" }, fuelDelta: 4 },
];

export const WIND_LIMIT_KMH = 40;

export interface WindowOption {
  id: LaunchWindowId;
  time: LocalizedText;
  windKmh: number;
  /** Extra cost of waiting (pad crew, range booking). */
  delayCostM: number;
}

export const WINDOWS: WindowOption[] = [
  { id: "w1", time: { en: "Today 06:12", vi: "Hôm nay 06:12" }, windKmh: 48, delayCostM: 0 },
  { id: "w2", time: { en: "Today 06:47", vi: "Hôm nay 06:47" }, windKmh: 24, delayCostM: 0 },
  { id: "w3", time: { en: "Tomorrow 06:05", vi: "Ngày mai 06:05" }, windKmh: 12, delayCostM: 60 },
];

export const FUEL_MIN = 70;
export const FUEL_MAX = 100;
export const FUEL_STEP = 2;
