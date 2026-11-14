import type { LocalizedText } from "@/i18n";
import type {
  LaunchSite,
  LaunchWindow,
  LaunchWindowsData,
  ParkingOrbitKm,
  PayloadId,
  VehicleId,
} from "@/lib/simulation/launch.types";

/**
 * The mission-control console's options. Vehicle performance (capacity, fuel needed, TWR, Max-Q)
 * is not stored here: the engine computes it from each vehicle's stage data (`engineId` →
 * sim-core `launch_vehicle_presets`). Payload masses are the sum of their parts. Launch sites
 * and windows come from the server (`/api/launch/...`); the copies below are the offline
 * fallback. Legacy vehicle aliases stay for saved games and test harnesses but are not offered.
 */

export const BUDGET_M = 2500;

export interface VehicleOption {
  id: VehicleId;
  name: string;
  kind: LocalizedText;
  note: LocalizedText;
  /** Published TLI capacity (t), shown nowhere: the console asks the engine instead. */
  capacityT?: number;
  costM: number;
  /** sim-core launch vehicle preset this option flies as. */
  engineId: "saturn-ib" | "saturn-v" | "saturn-v-uprated";
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
    engineId: "saturn-ib",
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
    engineId: "saturn-v",
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
    engineId: "saturn-v-uprated",
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
    engineId: "saturn-v",
    glomKg: 2938315,
    liftoffTwr: 1.174,
    stageCount: 3,
  },
  // The three vehicles the console offers (ids kept for saved games and the assembly-hall loadout).
  {
    id: "kestrel",
    name: "Saturn IB",
    kind: { en: "Two-stage, Earth-orbit launcher", vi: "Tên lửa hai tầng, quỹ đạo Trái Đất" },
    note: {
      en: "Flew Apollo 7 and the Skylab crews. S-IB + S-IVB-200, 7.1 MN at liftoff.",
      vi: "Đã phóng Apollo 7 và các phi hành đoàn Skylab. S-IB + S-IVB-200, lực đẩy cất cánh 7,1 MN.",
    },
    costM: 450,
    engineId: "saturn-ib",
    stageCount: 2,
  },
  {
    id: "saros",
    name: "Saturn V (AS-506)",
    kind: { en: "Three-stage lunar launcher", vi: "Tên lửa ba tầng lên Mặt Trăng" },
    note: {
      en: "The Apollo 11 booster you inspected in the assembly hall. S-IC + S-II + S-IVB, 33.85 MN at liftoff.",
      vi: "Tên lửa Apollo 11 bạn đã kiểm tra ở xưởng lắp ráp. S-IC + S-II + S-IVB, lực đẩy cất cánh 33,85 MN.",
    },
    costM: 1200,
    engineId: "saturn-v",
    stageCount: 3,
  },
  {
    id: "orison",
    name: "Saturn V uprated (MLV-V-4(S))",
    kind: { en: "Study concept: F-1A / J-2S, stretched tanks", vi: "Bản nghiên cứu: F-1A / J-2S, bồn kéo dài" },
    note: {
      en: "A 1960s NASA upgrade study that never flew. Performance figures are approximate.",
      vi: "Một nghiên cứu nâng cấp của NASA thập niên 1960, chưa từng bay. Số liệu chỉ gần đúng.",
    },
    costM: 2100,
    engineId: "saturn-v-uprated",
    stageCount: 3,
  },
];

/** What the console lists: one card per real vehicle (the long-id aliases above stay hidden). */
export const CONSOLE_VEHICLES: VehicleOption[] = VEHICLES.filter((v) => ["kestrel", "saros", "orison"].includes(v.id));

export interface PayloadComponent {
  name: LocalizedText;
  massKg: number;
}

export interface PayloadOption {
  id: PayloadId;
  name: LocalizedText;
  note: LocalizedText;
  /** Sum of `components`, in tonnes. */
  massT: number;
  costM: number;
  components: PayloadComponent[];
}

const payload = (o: Omit<PayloadOption, "massT">): PayloadOption => ({
  ...o,
  massT: o.components.reduce((m, c) => m + c.massKg, 0) / 1000,
});

const CM_107 = { name: { en: "Command Module Columbia", vi: "Khoang chỉ huy Columbia" }, massKg: 5_557 };
const SM_107 = { name: { en: "Service Module (fuelled)", vi: "Khoang dịch vụ (đầy nhiên liệu)" }, massKg: 23_244 };
const LM_5 = { name: { en: "Lunar Module Eagle", vi: "Mô-đun Mặt Trăng Eagle" }, massKg: 15_103 };

/** Apollo 11 masses: NASA SP-4029; EASEP as served by /api/nasa/mission-design/easep. */
export const PAYLOADS: PayloadOption[] = [
  payload({
    id: "standard",
    name: { en: "CSM-107 Columbia + LM-5 Eagle", vi: "CSM-107 Columbia + LM-5 Eagle" },
    note: {
      en: "Crew and spacecraft only: CM 5,557 kg + SM 23,244 kg + LM 15,103 kg = 43,904 kg.",
      vi: "Chỉ phi hành đoàn và tàu: CM 5.557 kg + SM 23.244 kg + LM 15.103 kg = 43.904 kg.",
    },
    costM: 250,
    components: [CM_107, SM_107, LM_5],
  }),
  payload({
    id: "science",
    name: { en: "Apollo 11 as flown (+ EASEP)", vi: "Apollo 11 như đã bay (+ EASEP)" },
    note: {
      en: "The same stack plus the EASEP surface experiments: 43,904 kg + 77 kg (seismometer 48 kg, laser reflector 21 kg, solar-wind foil, pallet) = 43,981 kg.",
      vi: "Cùng cấu hình cộng gói thí nghiệm bề mặt EASEP: 43.904 kg + 77 kg (địa chấn kế 48 kg, gương laser 21 kg, lá gió Mặt Trời, khung) = 43.981 kg.",
    },
    costM: 330,
    components: [CM_107, SM_107, LM_5, { name: { en: "EASEP science package", vi: "Gói khoa học EASEP" }, massKg: 77 }],
  }),
  payload({
    id: "rover",
    name: { en: "J-mission stack + Lunar Roving Vehicle", vi: "Cấu hình J-mission + Xe tự hành Mặt Trăng" },
    note: {
      en: "Extended CSM 29,500 kg + extended LM 16,400 kg + rover and ALSEP 360 kg = 46,260 kg (approximate J-mission masses).",
      vi: "CSM mở rộng 29.500 kg + LM mở rộng 16.400 kg + xe tự hành và ALSEP 360 kg = 46.260 kg (khối lượng J-mission gần đúng).",
    },
    costM: 450,
    components: [
      { name: { en: "Extended CSM", vi: "CSM mở rộng" }, massKg: 29_500 },
      { name: { en: "Extended LM", vi: "LM mở rộng" }, massKg: 16_400 },
      { name: { en: "Rover + ALSEP", vi: "Xe tự hành + ALSEP" }, massKg: 360 },
    ],
  }),
];

export interface OrbitOption {
  km: ParkingOrbitKm;
  note: LocalizedText;
}

/** The Δv each orbit costs is the engine's (sim-core `delta_v_required`). */
export const ORBITS: OrbitOption[] = [
  { km: 160, note: { en: "Low parking orbit: a little less climb, but more drag and a shorter orbital life.", vi: "Quỹ đạo chờ thấp: leo ít hơn một chút, nhưng lực cản lớn hơn và tuổi thọ quỹ đạo ngắn hơn." } },
  { km: 185, note: { en: "Apollo 11's parking orbit (183.2 × 185.9 km, 88.2 min).", vi: "Quỹ đạo chờ của Apollo 11 (183,2 × 185,9 km, 88,2 phút)." } },
  { km: 250, note: { en: "High parking orbit: long orbital life, but more Δv to get there.", vi: "Quỹ đạo chờ cao: tuổi thọ dài, nhưng tốn thêm Δv để lên tới." } },
];

/* ------------------------------------------------------------ launch sites (offline copy) */

/** Mirror of the server's LAUNCH_SITES (apps/server/src/services/launchSiteService.ts). */
export const LAUNCH_SITES: LaunchSite[] = [
  { id: "ksc-39a", name: "Kennedy Space Center", pad: "LC-39A", operator: "NASA", country: "USA", latitude_deg: 28.6084, longitude_deg: -80.6043, elevation_m: 3, time_zone: "America/New_York", windows: "historical" },
  { id: "vandenberg-slc6", name: "Vandenberg", pad: "SLC-6", operator: "US Space Force", country: "USA", latitude_deg: 34.5813, longitude_deg: -120.6266, elevation_m: 120, time_zone: "America/Los_Angeles", windows: "live" },
  { id: "baikonur-110", name: "Baikonur Cosmodrome", pad: "Site 110", operator: "Roscosmos", country: "Kazakhstan", latitude_deg: 45.9655, longitude_deg: 63.3052, elevation_m: 90, time_zone: "Asia/Almaty", windows: "live" },
  { id: "kourou-ela", name: "Guiana Space Centre", pad: "ELA-3", operator: "ESA / CNES", country: "French Guiana", latitude_deg: 5.239, longitude_deg: -52.7684, elevation_m: 15, time_zone: "America/Cayenne", windows: "live" },
  { id: "tanegashima", name: "Tanegashima Space Center", pad: "Yoshinobu LP-1", operator: "JAXA", country: "Japan", latitude_deg: 30.4009, longitude_deg: 130.9749, elevation_m: 30, time_zone: "Asia/Tokyo", windows: "live" },
  { id: "wenchang", name: "Wenchang", pad: "LC-101", operator: "CNSA", country: "China", latitude_deg: 19.6145, longitude_deg: 110.951, elevation_m: 10, time_zone: "Asia/Shanghai", windows: "live" },
  { id: "sriharikota", name: "Satish Dhawan Space Centre", pad: "SLP", operator: "ISRO", country: "India", latitude_deg: 13.7199, longitude_deg: 80.2304, elevation_m: 5, time_zone: "Asia/Kolkata", windows: "live" },
];
export const DEFAULT_SITE_ID = "ksc-39a";

/**
 * Apollo 11's three July 1969 opportunities at LC-39A with the ERA5 weather for those hours, as
 * the server serves them. Used offline, and for any site until its windows arrive.
 */
export const WINDOWS: LaunchWindow[] = [
  {
    id: "w1",
    opens_at: "1969-07-16T13:32:00Z",
    label: "July 16, 1969 — Apollo 11 T-0",
    delay_cost_m: 0,
    weather: { temperature_c: 28.1, humidity_pct: 81, wind_speed_kmh: 9.1, wind_gust_kmh: 16.6, wind_direction_deg: 156, precipitation_mm: 0.1, cloud_cover_pct: 100, weather_code: 3, thunderstorm: false },
  },
  {
    id: "w2",
    opens_at: "1969-07-18T13:32:00Z",
    label: "July 18, 1969 — first backup opportunity",
    delay_cost_m: 60,
    weather: { temperature_c: 28.1, humidity_pct: 78, wind_speed_kmh: 15.3, wind_gust_kmh: 28.1, wind_direction_deg: 117, precipitation_mm: 0.2, cloud_cover_pct: 72, weather_code: 51, thunderstorm: false },
  },
  {
    id: "w3",
    opens_at: "1969-07-21T13:32:00Z",
    label: "July 21, 1969 — second backup opportunity",
    delay_cost_m: 120,
    weather: { temperature_c: 27.1, humidity_pct: 83, wind_speed_kmh: 13.4, wind_gust_kmh: 22.7, wind_direction_deg: 172, precipitation_mm: 0, cloud_cover_pct: 50, weather_code: 2, thunderstorm: false },
  },
];

export const OFFLINE_KSC_WINDOWS: LaunchWindowsData = {
  site: LAUNCH_SITES[0]!,
  kind: "historical",
  provider: "Apollo 11 archive (offline)",
  windows: WINDOWS,
  source: "offline_fallback",
};

export const FUEL_MIN = 70;
export const FUEL_MAX = 100;
export const FUEL_STEP = 1;
