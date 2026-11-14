import type { LocalizedText } from "@/i18n";

export type EndingId =
  | "ending-1"
  | "ending-2"
  | "ending-3"
  | "ending-4"
  | "ending-5"
  | "ENDING-1"
  | "ENDING-2"
  | "ENDING-3"
  | "ENDING-4"
  | "ENDING-5";

export interface EndingDebriefTelemetry {
  getTouchdown: string;
  coordinates?: string;
  terminalVxMs: number;
  terminalVzMs: number;
  surfaceTiltDeg: number;
  fuelRemainingPct: number;
  fuelHoverMarginSeconds: number;
  lunarSamplesKg: number;
  scienceDeployed: boolean;
}

export interface EndingDefinition {
  id: string;
  normalizedId: "ending-1" | "ending-2" | "ending-3" | "ending-4" | "ending-5";
  title: LocalizedText;
  subtitle: LocalizedText;
  quote: string;
  quoteAttribution: string;
  status: "success" | "partial" | "fatal";
  badgeText: LocalizedText;
  score: number;
  failureReason?: string;
  contingencyAddress?: string;
  contingencySpeechText?: LocalizedText;
  telemetry: EndingDebriefTelemetry;
  debriefReport: LocalizedText[];
}

export const ENDINGS_CATALOG: Record<string, EndingDefinition> = {
  "ending-1": {
    id: "ending-1",
    normalizedId: "ending-1",
    title: {
      en: "Ending 1: Tranquility Base — Historic Lunar Landing",
      vi: "Kết thúc 1: Căn cứ Yên Bình — Cuộc đổ bộ Mặt Trăng lịch sử",
    },
    subtitle: {
      en: "Apollo 11 Mission Complete: Man Walked on the Moon",
      vi: "Nhiệm vụ Apollo 11 hoàn thành: Con người đã bước đi trên Mặt Trăng",
    },
    quote: "Houston, Tranquility Base here. The Eagle has landed.",
    quoteAttribution: "Neil A. Armstrong, CDR — GET 102:45:58 (July 20, 1969)",
    status: "success",
    badgeText: { en: "100% Mission Success", vi: "Nhiệm vụ Thành công 100%" },
    score: 98,
    telemetry: {
      getTouchdown: "102:45:40 GET (20:17:40 UTC)",
      coordinates: "0.67408° N, 23.47297° E (Mare Tranquillitatis)",
      terminalVxMs: 0.5,
      terminalVzMs: -0.45,
      surfaceTiltDeg: 4.5,
      fuelRemainingPct: 5.6,
      fuelHoverMarginSeconds: 25.0,
      lunarSamplesKg: 21.55,
      scienceDeployed: true,
    },
    debriefReport: [
      {
        en: "At 20:17:40 UTC on July 20, 1969, Lunar Module Eagle touched down on Mare Tranquillitatis. Overcoming 1201 and 1202 computer overload alarms and manual P66 redesignation past West Crater, Commander Neil Armstrong and LMP Buzz Aldrin achieved humanity's first lunar landing with only 25 seconds of usable hover fuel remaining.",
        vi: "Vào lúc 20:17:40 UTC ngày 20 tháng 7 năm 1969, Tàu đổ bộ Eagle đã đáp xuống Biển Yên Bình. Vượt qua chuỗi báo động máy tính 1201/1202 và tự điều khiển P66 qua hố West Crater, Neil Armstrong và Buzz Aldrin đã hoàn thành cuộc đổ bộ đầu tiên của nhân loại với vỏn vẹn 25 giây nhiên liệu dự trữ.",
      },
      {
        en: "The crew deployed the Early Apollo Scientific Experiments Package (EASEP) including the PSEP seismometer and Laser Ranging Retroreflector (LRRR), gathered 21.55 kg of lunar regolith and breccia, planted the American flag, and prepared for safe lunar ascent and rendezvous with Michael Collins aboard Columbia.",
        vi: "Phi hành đoàn đã triển khai gói thí nghiệm khoa học EASEP gồm máy đo địa chấn PSEP và gương phản xạ laser LRRR, thu thập 21,55 kg mẫu đất đá Mặt Trăng, cắm quốc kỳ và chuẩn bị cho chuyến bay lên kết nối an toàn với Michael Collins trên tàu Columbia.",
      },
    ],
  },

  "ending-2": {
    id: "ending-2",
    normalizedId: "ending-2",
    title: {
      en: "Ending 2: Powered Descent Abort to Orbit — Safe in Lunar Orbit",
      vi: "Kết thúc 2: Hủy hạ cánh có động cơ — An toàn trên quỹ đạo Mặt Trăng",
    },
    subtitle: {
      en: "Ascent Stage Fired to Orbit: Crew Saved, Landing Scrubbed",
      vi: "Tầng bay lên kích hoạt: Phi hành đoàn an toàn, Hủy đổ bộ",
    },
    quote: "Houston, Eagle is Abort Stage. Separation confirmed, APS burning steady to orbit.",
    quoteAttribution: "Neil A. Armstrong, CDR — GET 102:39:12",
    status: "partial",
    badgeText: { en: "Mission Aborted / Crew Safe", vi: "Hủy nhiệm vụ / Phi hành đoàn an toàn" },
    score: 72,
    telemetry: {
      getTouchdown: "N/A (Aborted at 33,500 ft AGL)",
      terminalVxMs: 152.4,
      terminalVzMs: 12.0,
      surfaceTiltDeg: 0.0,
      fuelRemainingPct: 84.0,
      fuelHoverMarginSeconds: 0,
      lunarSamplesKg: 0.0,
      scienceDeployed: false,
    },
    debriefReport: [
      {
        en: "In response to recurrent guidance computer overload alarms during the final braking phase, Commander Armstrong activated the ABORT STAGE switch. Pyrotechnic bolts severed the descent stage, and the Bell Aerosystems Ascent Engine ignited immediately.",
        vi: "Trước các đợt báo động quá tải máy tính dẫn đường liên tục ở giai đoạn hãm cuối, Chỉ huy Armstrong đã kích hoạt công tắc ABORT STAGE. Bu-lông nổ cắt rời tầng đáp và động cơ bay lên đã điểm hoả tức thì.",
      },
      {
        en: "Eagle climbed back into an elliptical 15 x 111 km lunar orbit and performed a textbook co-elliptic rendezvous with Michael Collins aboard Columbia. While no lunar surface exploration was achieved, all three astronauts returned safely to Earth.",
        vi: "Eagle bay ngược trở lại quỹ đạo elip 15 x 111 km quanh Mặt Trăng và thực hiện ghép nối quỹ đạo chuẩn mực với Michael Collins trên tàu Columbia. Dù không thám hiểm được bề mặt, cả ba phi hành gia đã trở về Trái Đất an toàn.",
      },
    ],
  },

  "ending-3": {
    id: "ending-3",
    normalizedId: "ending-3",
    title: {
      en: "Ending 3: Catastrophic Touchdown — Stranded on Tranquility",
      vi: "Kết thúc 3: Tiếp đất thảm hoạ — Kẹt lại Biển Yên Bình",
    },
    subtitle: {
      en: "Boulder Impact Structural Failure: The Safire Contingency",
      vi: "Va chạm đá tảng gãy kết cấu: Phương án dự phòng Safire",
    },
    quote: "Fate has ordained that the men who went to the Moon to explore in peace will stay on the Moon to rest in peace.",
    quoteAttribution: "William Safire, Presidential Contingency Address for President Nixon (July 18, 1969)",
    status: "fatal",
    badgeText: { en: "Catastrophic Failure / Crew Stranded", vi: "Thất bại thảm hoạ / Phi hành gia mắc kẹt" },
    score: 28,
    contingencyAddress:
      "Fate has ordained that the men who went to the Moon to explore in peace will stay on the Moon to rest in peace. These brave men, Neil Armstrong and Edwin Aldrin, know that there is no hope for their recovery. But they also know that there is hope for mankind in their sacrifice. In ancient days, men looked at stars and saw their heroes in the constellations. In modern times, we do much the same, but our heroes are epic men of flesh and blood. Every human being who looks up at the Moon in the nights to come will know that there is some corner of another world that is forever mankind.",
    contingencySpeechText: {
      en: "Fate has ordained that the men who went to the Moon to explore in peace will stay on the Moon to rest in peace. These brave men, Neil Armstrong and Edwin Aldrin, know that there is no hope for their recovery. But they also know that there is hope for mankind in their sacrifice. In ancient days, men looked at stars and saw their heroes in the constellations. In modern times, we do much the same, but our heroes are epic men of flesh and blood. Every human being who looks up at the Moon in the nights to come will know that there is some corner of another world that is forever mankind.",
      vi: "Định mệnh đã an bài rằng những người con lên Mặt Trăng để thám hiểm trong hoà bình sẽ ở lại Mặt Trăng để an nghỉ trong bình yên. Những con người quả cảm ấy, Neil Armstrong và Edwin Aldrin, biết rằng không còn hy vọng nào để trở về. Nhưng họ cũng hiểu rằng sự hy sinh của mình thắp lên hy vọng cho toàn nhân loại. Xưa kia, con người ngắm sao trời và thấy các vị anh hùng trong những chòm sao. Ngày nay, chúng ta cũng làm như vậy, nhưng anh hùng của chúng ta là những con người bằng xương bằng thịt. Từng người một khi nhìn lên Mặt Trăng trong những đêm tới sẽ luôn biết rằng có một góc của thế giới xa xôi ấy sẽ mãi mãi thuộc về con người.",
    },
    telemetry: {
      getTouchdown: "102:45:22 GET",
      coordinates: "0.6712° N, 23.4680° E (West Crater Rim)",
      terminalVxMs: 2.4,
      terminalVzMs: -3.8,
      surfaceTiltDeg: 19.5,
      fuelRemainingPct: 1.2,
      fuelHoverMarginSeconds: 0,
      lunarSamplesKg: 0.0,
      scienceDeployed: false,
    },
    debriefReport: [
      {
        en: "Attempting an immediate touchdown inside the boulder field of West Crater, Eagle impacted an 18-degree slope at 2.4 m/s lateral velocity. The starboard primary landing gear strut sheared off, causing the vehicle to tip onto its side. The Ascent Engine nozzle was crushed against an angular lunar boulder.",
        vi: "Khi cố gắng hạ cánh khẩn cấp xuống bãi đá hố West Crater, tàu Eagle đã va vào triền dốc 18 độ với vận tốc ngang 2,4 m/s. Chân đế mạn phải bị gãy tiện, khiến tàu lật nghiêng sang một bên. Loa phụt động cơ bay lên bị bẹp nát khi va vào khối đá tảng sắc nhọn.",
      },
      {
        en: "With ascent propulsion destroyed and cabin pressure leaking, Mission Control was forced to implement the solemn contingency protocol prepared by presidential speechwriter William Safire.",
        vi: "Động cơ bay lên bị phá huỷ và khoang đổ bộ rò rỉ dưỡng khí, Trung tâm điều khiển buộc phải kích hoạt quy trình dự phòng trang nghiêm do người soạn diễn văn cho Tổng thống William Safire chuẩn bị sẵn.",
      },
    ],
  },

  "ending-4": {
    id: "ending-4",
    normalizedId: "ending-4",
    title: {
      en: "Ending 4: Bingo Fuel Abort — Low Propellant Wave-Off",
      vi: "Kết thúc 4: Hủy hạ cánh do chạm ngưỡng Bingo Fuel — Kéo tàu lên an toàn",
    },
    subtitle: {
      en: "Abort Stage at 40 Feet: Engines Cut with Zero Seconds to Bingo",
      vi: "Hủy hạ cánh ở độ cao 12m: Hết nhẵn nhiên liệu trước khi chạm đất",
    },
    quote: "Bingo fuel, Houston! We are Abort Stage! Pulling up past the crater!",
    quoteAttribution: "Neil A. Armstrong, CDR — GET 102:45:32",
    status: "partial",
    badgeText: { en: "Wave-Off / Safe Orbital Recovery", vi: "Kéo tàu lên / Cứu hộ an toàn trên quỹ đạo" },
    score: 60,
    telemetry: {
      getTouchdown: "N/A (Aborted at 40 ft AGL)",
      terminalVxMs: 4.8,
      terminalVzMs: 8.5,
      surfaceTiltDeg: 3.0,
      fuelRemainingPct: 0.1,
      fuelHoverMarginSeconds: 0.0,
      lunarSamplesKg: 0.0,
      scienceDeployed: false,
    },
    debriefReport: [
      {
        en: "With hover propellant depleted while searching for clear terrain beyond West Crater, Armstrong respected the hard Bingo Fuel flight rule at 40 feet (12 meters) altitude. He triggered Abort Stage just two seconds before descent propellant exhaustion.",
        vi: "Khi nhiên liệu lơ lửng cạn kiệt trong lúc tìm bãi đáp vượt qua hố West Crater, Armstrong đã tuân thủ nghiêm ngặt quy tắc bay Bingo Fuel ở độ cao 12 mét. Ông nhấn nút Abort Stage chỉ 2 giây trước khi bồn nhiên liệu cạn đáy.",
      },
      {
        en: "The Ascent Stage blasted off directly from the descending stack, clearing the crater rim and reaching orbital safety. Collins rendezvoused with Eagle 4 hours later. The mission demonstrated heroic pilot discipline, bringing the crew home safely.",
        vi: "Tầng bay lên nổ máy bứt thẳng khỏi tầng đáp đang rơi, vượt qua vành miệng hố và vươn tới quỹ đạo an toàn. Collins đón tàu Eagle sau 4 giờ. Nhiệm vụ thể hiện kỷ luật phi công phi thường, đưa trọn vẹn phi hành đoàn về nhà bình an.",
      },
    ],
  },

  "ending-5": {
    id: "ending-5",
    normalizedId: "ending-5",
    title: {
      en: "Ending 5: Ascent Catastrophe — Max-Q Structural Breakup",
      vi: "Kết thúc 5: Thảm hoạ cất cánh — Vỡ nát kết cấu tại Max-Q",
    },
    subtitle: {
      en: "Extreme Aerodynamic Shear: Loss of Vehicle AS-506 at T+83s",
      vi: "Lực cản khí động cực đại: Mất tên lửa AS-506 ở giây thứ 83",
    },
    quote: "Flight, Booster: We have severe cryogenic pressure loss on S-IC Engine 1... structural shear telemetry at T+83 seconds.",
    quoteAttribution: "Booster Systems Engineer, Mission Control — T+83s (Altitude 13.4 km)",
    status: "fatal",
    badgeText: { en: "Catastrophic Launch Vehicle Loss", vi: "Mất tên lửa phóng thảm hoạ" },
    score: 5,
    failureReason: "Max-Q aerodynamic shear structural breakup: Launching in severe wind (>40 km/h) exceeded Saturn V S-IC gimbal margin.",
    telemetry: {
      getTouchdown: "N/A (Lost during atmospheric ascent)",
      terminalVxMs: 650.0,
      terminalVzMs: 420.0,
      surfaceTiltDeg: 45.0,
      fuelRemainingPct: 82.0,
      fuelHoverMarginSeconds: 0,
      lunarSamplesKg: 0.0,
      scienceDeployed: false,
    },
    debriefReport: [
      {
        en: "Passing through Maximum Dynamic Pressure (Max-Q, 34.3 kPa) at 13.4 km altitude and Mach 1.7, the vehicle encountered severe wind shear that exceeded the structural limit of the forward interstage skirt.",
        vi: "Khi bay qua điểm Áp suất động cực đại (Max-Q, 34,3 kPa) ở độ cao 13,4 km và vận tốc Mach 1,7, tên lửa gặp phải luồng gió đứt cực mạnh vượt quá giới hạn chịu lực của vành nối tầng.",
      },
      {
        en: "Vehicle AS-506 broke up aerodynamically in the high-altitude supersonic slipstream. Flight controllers logged all telemetry data for causal accident review.",
        vi: "Tên lửa AS-506 bị lực khí động xé toạc trong luồng khí siêu thanh tầng cao. Các kiểm soát viên bay đã lưu lại toàn bộ dữ liệu viễn trắc để điều tra tai nạn.",
      },
    ],
  },
};

// Map uppercase aliases as well (e.g. ENDING-1 -> ending-1)
export const ENDINGS: Record<string, EndingDefinition> = {
  ...ENDINGS_CATALOG,
  "ENDING-1": ENDINGS_CATALOG["ending-1"],
  "ENDING-2": ENDINGS_CATALOG["ending-2"],
  "ENDING-3": ENDINGS_CATALOG["ending-3"],
  "ENDING-4": ENDINGS_CATALOG["ending-4"],
  "ENDING-5": ENDINGS_CATALOG["ending-5"],
};

export function getEnding(id: string | null | undefined): EndingDefinition | undefined {
  if (!id) return undefined;
  return ENDINGS[id] ?? ENDINGS[id.toLowerCase()] ?? ENDINGS[id.toUpperCase()];
}
