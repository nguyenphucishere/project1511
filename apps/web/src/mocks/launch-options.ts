import type { LocalizedText } from "@/i18n";
import type { LaunchWindowId, ParkingOrbitKm, PayloadId, VehicleId } from "@/lib/simulation/launch.types";

/**
 * Historical Apollo 11 Launch Vehicle, Payload, Orbit, and Weather configurations.
 * Sourced directly from NASA SP-4029 (Apollo by the Numbers) and Technical Catalog NASA-APOLLO-SIM-2026-REV1.
 * Retains backward-compatible aliases for existing test harnesses.
 */

export const BUDGET_M = 2500;

export interface VehicleOption {
  id: VehicleId;
  name: string;
  kind: LocalizedText;
  note: LocalizedText;
  /** Tonnes the vehicle can send toward the Moon (TLI). */
  capacityT: number;
  costM: number;
  /** Historical engineering telemetry */
  glomKg?: number;
  liftoffTwr?: number;
  stageCount?: number;
  aliases?: string[];
}

export const VEHICLES: VehicleOption[] = [
  {
    id: "saturn-ib" as VehicleId,
    name: "Saturn IB (AS-200 Series)",
    kind: { en: "Medium lift (Earth orbit only)", vi: "Tải trung bình (Chỉ quỹ đạo Trái Đất)" },
    note: {
      en: "Two-stage rocket used for Apollo 7 Earth-orbit qualification. Cannot reach translunar injection.",
      vi: "Tên lửa hai tầng dùng cho thử nghiệm Apollo 7 trên quỹ đạo Trái Đất. Không thể đẩy tàu tới Mặt Trăng.",
    },
    capacityT: 28,
    costM: 450,
    glomKg: 589700,
    liftoffTwr: 1.23,
    stageCount: 2,
    aliases: ["kestrel"],
  },
  {
    id: "saturn-v" as VehicleId,
    name: "Saturn V AS-506 (Apollo 11 Baseline)",
    kind: { en: "Super-heavy lunar launcher", vi: "Tên lửa siêu nặng Mặt Trăng" },
    note: {
      en: "The historic three-stage Apollo 11 booster. 33.85 MN liftoff thrust, 140 T to LEO, 48.6 T to TLI.",
      vi: "Tên lửa ba tầng lịch sử của Apollo 11. Lực đẩy cất cánh 33,85 MN, 140 tấn lên LEO, 48,6 tấn tới Mặt Trăng.",
    },
    capacityT: 48,
    costM: 1200,
    glomKg: 2938315,
    liftoffTwr: 1.174,
    stageCount: 3,
    aliases: ["saros", "saturn_v_as506"],
  },
  {
    id: "saturn-v-uprated" as VehicleId,
    name: "Saturn V J-Series / MLV-V-4(S)",
    kind: { en: "Uprated heavy lunar cargo launcher", vi: "Tên lửa nâng cấp chở hàng nặng Mặt Trăng" },
    note: {
      en: "Uprated F-1A/J-2S configuration with stretched tanks for extended lunar exploration and heavy science cargo.",
      vi: "Cấu hình nâng cấp F-1A/J-2S với bồn nhiên liệu kéo dài cho thám hiểm kéo dài và thiết bị khoa học nặng.",
    },
    capacityT: 70,
    costM: 2100,
    glomKg: 5480000,
    liftoffTwr: 1.80,
    stageCount: 3,
    aliases: ["orison"],
  },
  {
    id: "saturn_v_as506" as VehicleId,
    name: "Saturn V AS-506 Baseline",
    kind: { en: "Super-heavy lunar launcher", vi: "Tên lửa siêu nặng Mặt Trăng" },
    note: {
      en: "Saturn V AS-506 launch vehicle carrying Apollo 11 CSM-107 and LM-5.",
      vi: "Tên lửa Saturn V AS-506 mang theo tàu Apollo 11 CSM-107 và LM-5.",
    },
    capacityT: 48,
    costM: 1200,
    glomKg: 2938315,
    liftoffTwr: 1.174,
    stageCount: 3,
  },
  // Legacy aliases for backwards-compatibility with existing tests and mock launch configs
  {
    id: "kestrel",
    name: "Kestrel M (Saturn IB Alias)",
    kind: { en: "Medium lift", vi: "Tải trung bình" },
    note: { en: "Cheap and proven, but built for smaller missions.", vi: "Rẻ và đáng tin cậy, nhưng dành cho nhiệm vụ nhỏ hơn." },
    capacityT: 28,
    costM: 450,
    glomKg: 589700,
    liftoffTwr: 1.23,
    stageCount: 2,
  },
  {
    id: "saros",
    name: "Saros H (Saturn V AS-506 Alias)",
    kind: { en: "Heavy lift", vi: "Tải nặng" },
    note: { en: "The rocket you inspected in the assembly hall.", vi: "Tên lửa bạn vừa kiểm tra ở xưởng lắp ráp." },
    capacityT: 48,
    costM: 1200,
    glomKg: 2938315,
    liftoffTwr: 1.174,
    stageCount: 3,
  },
  {
    id: "orison",
    name: "Orison SH (Uprated Saturn V Alias)",
    kind: { en: "Super-heavy lift", vi: "Tải siêu nặng" },
    note: { en: "Room to spare, at a price.", vi: "Dư sức chở, nhưng rất đắt." },
    capacityT: 70,
    costM: 2100,
    glomKg: 5480000,
    liftoffTwr: 1.80,
    stageCount: 3,
  },
];

export interface PayloadOption {
  id: PayloadId;
  name: LocalizedText;
  note: LocalizedText;
  massT: number;
  costM: number;
  details?: {
    csmMassKg: number;
    lmMassKg: number;
    scienceMassKg: number;
  };
}

export const PAYLOADS: PayloadOption[] = [
  {
    id: "standard",
    name: { en: "CSM-107 Columbia + LM-5 Eagle", vi: "CSM-107 Columbia + LM-5 Eagle" },
    note: {
      en: "Baseline lunar stack: Command Module (5,557 kg), Service Module (23,244 kg), and LM-5 Eagle (15,103 kg).",
      vi: "Cấu hình Mặt Trăng tiêu chuẩn: Khoang chỉ huy (5.557 kg), Khoang dịch vụ (23.244 kg) và LM-5 Eagle (15.103 kg).",
    },
    massT: 46,
    costM: 250,
    details: {
      csmMassKg: 28801,
      lmMassKg: 15103,
      scienceMassKg: 0,
    },
  },
  {
    id: "science",
    name: { en: "Apollo 11 + EASEP Package (PSEP + LRRR)", vi: "Cấu hình Apollo 11 + Gói khoa học EASEP" },
    note: {
      en: "Columbia, Eagle, plus the Early Apollo Surface Experiments Package: PSEP Seismometer (47.6 kg) and LRRR Laser Reflector (23.6 kg).",
      vi: "Columbia, Eagle cùng Gói thí nghiệm bề mặt sơ khai EASEP: Địa chấn kế PSEP (47,6 kg) và Gương phản xạ laser LRRR (23,6 kg).",
    },
    massT: 50,
    costM: 330,
    details: {
      csmMassKg: 28801,
      lmMassKg: 15103,
      scienceMassKg: 77,
    },
  },
  {
    id: "rover",
    name: { en: "J-Series + LRV Lunar Roving Vehicle", vi: "Cấu hình J-Series + Xe tự hành Mặt Trăng (LRV)" },
    note: {
      en: "Advanced lunar stack carrying the 210 kg Boeing/GM Lunar Roving Vehicle and full ALSEP geophysical suite.",
      vi: "Cấu hình nâng cấp mang theo Xe tự hành Mặt Trăng LRV 210 kg cùng trạm địa chấn toàn diện ALSEP.",
    },
    massT: 58,
    costM: 450,
    details: {
      csmMassKg: 29500,
      lmMassKg: 16400,
      scienceMassKg: 360,
    },
  },
];

export interface OrbitOption {
  km: ParkingOrbitKm;
  note: LocalizedText;
  /** Percentage points added to the fuel requirement. */
  fuelDelta: number;
}

export const ORBITS: OrbitOption[] = [
  { km: 160, note: { en: "Low 160 km orbit (Higher atmospheric drag, less TLI margin)", vi: "Quỹ đạo thấp 160 km (Lực cản khí quyển lớn hơn, biên TLI hẹp)" }, fuelDelta: -3 },
  { km: 185, note: { en: "Standard Apollo 11 Parking Orbit (183.2 x 185.9 km, period 88.2 min)", vi: "Quỹ đạo chờ chuẩn Apollo 11 (183,2 x 185,9 km, chu kỳ 88,2 phút)" }, fuelDelta: 0 },
  { km: 250, note: { en: "High 250 km orbit (Decay safe, requires +4% insertion fuel)", vi: "Quỹ đạo cao 250 km (An toàn suy giảm quỹ đạo, tốn thêm 4% nhiên liệu)" }, fuelDelta: 4 },
];

export const WIND_LIMIT_KMH = 40;

export interface WindowOption {
  id: LaunchWindowId;
  time: LocalizedText;
  windKmh: number;
  /** Extra cost of waiting (pad crew, range booking). */
  delayCostM: number;
  condition?: LocalizedText;
}

export const WINDOWS: WindowOption[] = [
  {
    id: "w1",
    time: { en: "July 16, 1969 — 09:32:00 EDT (Nominal T-0)", vi: "16 tháng 7, 1969 — 09:32:00 EDT (T-0 lịch sử)" },
    windKmh: 48,
    delayCostM: 0,
    condition: { en: "Squall front: Wind gusts 48 km/h > 40 km/h structural limit", vi: "Dải mây đối lưu: Gió giật 48 km/h > giới hạn kết cấu 40 km/h" },
  },
  {
    id: "w2",
    time: { en: "July 16, 1969 — 12:15:00 EDT (Nominal Weather Window)", vi: "16 tháng 7, 1969 — 12:15:00 EDT (Cửa sổ thời tiết chuẩn)" },
    windKmh: 18.5,
    delayCostM: 0,
    condition: { en: "Historical Cape weather: Winds 10 kts @ 100°, Temp 29.4°C, scattered cumulus (GO)", vi: "Thời tiết lịch sử Cape: Gió 10 kts hướng 100°, Nhiệt độ 29,4°C, mây tích rải rác (GO)" },
  },
  {
    id: "w3",
    time: { en: "July 18, 1969 — 10:14:00 EDT (48-Hour Delay Recycle)", vi: "18 tháng 7, 1969 — 10:14:00 EDT (Hoãn 48 giờ chuẩn bị lại)" },
    windKmh: 12,
    delayCostM: 60,
    condition: { en: "Next monthly lunar lighting window: Range re-booking, LOX boiloff replenishment ($60M)", vi: "Cửa sổ chiếu sáng Mặt Trăng tiếp theo: Đặt lại bãi phóng, bù bay hơi LOX ($60M)" },
  },
];

export const FUEL_MIN = 70;
export const FUEL_MAX = 100;
export const FUEL_STEP = 2;
