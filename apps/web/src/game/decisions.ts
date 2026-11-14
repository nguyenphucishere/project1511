import type { LocalizedText } from "@/i18n";
import type { CharacterId } from "./characters";

export type DecisionPointId =
  | "inspection"
  | "weather"
  | "trajectory"
  | "agc_alarm"
  | "landing_approach"
  // Aliases for compatibility
  | "agcAlarm"
  | "landing";

export type DecisionId =
  | "workshop-decision"
  | "weather-decision"
  | "trajectory-decision"
  | "agc-alarm-decision"
  | "landing-decision";

export interface DecisionOption {
  id: string;
  keyLabel: string; // "A", "B", "C" or "1", "2", "3"
  title: LocalizedText;
  description: LocalizedText;
  tacticalBadge: LocalizedText;
  historical?: boolean;
}

export interface DecisionDefinition {
  id: DecisionId;
  pointId: DecisionPointId;
  speaker: CharacterId;
  title: LocalizedText;
  prompt: LocalizedText;
  context: LocalizedText;
  options: DecisionOption[];
}

export const DECISIONS: Record<DecisionId, DecisionDefinition> = {
  "workshop-decision": {
    id: "workshop-decision",
    pointId: "inspection",
    speaker: "workshop-chief",
    title: {
      en: "Decision 1: Workshop LOX Valve Rigor",
      vi: "Quyết định 1: Kiểm định van oxy lỏng LOX",
    },
    context: {
      en: "Cryogenic LOX valves operate at -183°C under extreme vibration. A rushed check saves 6 hours of pad rollout schedule but risks seal leakage at Max-Q dynamic pressure.",
      vi: "Van oxy lỏng làm việc ở -183°C dưới rung động cực lớn. Bỏ qua kiểm tra tiết kiệm 6 giờ nhưng có nguy cơ rò rỉ gioăng khi qua vùng áp suất động cực đại Max-Q.",
    },
    prompt: {
      en: "Transducer on the S-IC LOX fill line valve shows borderline pressure decay. Perform complete valve teardown or expedite rollout to meet today's window?",
      vi: "Cảm biến van nạp oxy lỏng S-IC báo giảm áp suất ở ngưỡng biên. Đo độ kín toàn diện hay duyệt nhanh để kịp giờ lăn bánh?",
    },
    options: [
      {
        id: "thorough",
        keyLabel: "A",
        title: {
          en: "Option A: Full Pneumatic & Torque Inspection (Historical)",
          vi: "Lựa chọn A: Đo áp suất & siết lực toàn diện (Lịch sử)",
        },
        description: {
          en: "Execute full 145 ft-lb star-pattern torque verification and helium leak decay test. Zero risk of cryogenic blowby at Max-Q.",
          vi: "Siết đúng lực 145 ft-lb theo hình sao và thử độ kín khí heli. Đảm bảo không rò rỉ khi chịu lực Max-Q.",
        },
        tacticalBadge: {
          en: "Nominal Reliability (0% Fuel Penalty)",
          vi: "Độ tin cậy tối đa (0% Phạt nhiên liệu)",
        },
        historical: true,
      },
      {
        id: "rushed",
        keyLabel: "B",
        title: {
          en: "Option B: Fast-Track Visual Sign-off (Schedule Expedited)",
          vi: "Lựa chọn B: Duyệt nhanh trực quan (Đẩy nhanh tiến độ)",
        },
        description: {
          en: "Skip torque re-check on Engine #1 LOX flange to meet rollout ceremony. Micro-leak penalty applies (-5% fuel reserve at descent).",
          vi: "Bỏ qua siết lại bu-lông động cơ 1 để kịp lễ lăn bánh. Phạt rò rỉ vi mô (-5% nhiên liệu dự trữ khi đổ bộ).",
        },
        tacticalBadge: {
          en: "Expedited Rollout (-5% Fuel Reserve Penalty)",
          vi: "Lăn bánh nhanh (-5% Nhiên liệu dự trữ)",
        },
        historical: false,
      },
    ],
  },

  "weather-decision": {
    id: "weather-decision",
    pointId: "weather",
    speaker: "kranz",
    title: {
      en: "Decision 2: Pad 39A Launch Weather Commit Call",
      vi: "Quyết định 2: Quyết định thời tiết bệ phóng 39A",
    },
    context: {
      en: "Launch commit criteria require crosswinds below 40 km/h during tower clearance yaw maneuver. Radar tracks a squall front off Cape Canaveral.",
      vi: "Tiêu chuẩn cam kết phóng yêu cầu gió ngang dưới 40 km/h trong thời gian tên lửa nghiêng tránh tháp. Radar ghi nhận dải mây đối lưu áp sát.",
    },
    prompt: {
      en: "T-15 minutes. Radar tracks squall line off Pad 39A. Launch rules specify 40 km/h maximum surface wind for Saturn V structural loads. Give me your launch recommendation.",
      vi: "T-15 phút. Radar phát hiện dải mây đối lưu ngoài bệ 39A. Quy tắc phóng yêu cầu gió mặt đất dưới 40 km/h cho kết cấu Saturn V. Cho tôi khuyến nghị phóng.",
    },
    options: [
      {
        id: "go",
        keyLabel: "A",
        title: {
          en: "Option A: GO for Terminal Countdown (Historical — Wind 18.5 km/h)",
          vi: "Lựa chọn A: GO cho đếm ngược chót (Lịch sử — Gió 18,5 km/h)",
        },
        description: {
          en: "Historical Cape weather: Winds 10 kts (18.5 km/h) @ 100°, clear of shear. Nominal tower clearance and ascent trajectory.",
          vi: "Thời tiết Cape lịch sử: Gió 10 hải lý (18,5 km/h) hướng 100°, không có gió đứt. Rời tháp an toàn và bay đúng quỹ đạo.",
        },
        tacticalBadge: {
          en: "Nominal Ascent (Weather GO)",
          vi: "Bay lên chuẩn (Thời tiết GO)",
        },
        historical: true,
      },
      {
        id: "hold",
        keyLabel: "B",
        title: {
          en: "Option B: HOLD at T-9 Minutes (Recycle Countdown)",
          vi: "Lựa chọn B: Dừng ở T-9 phút (Hoãn đếm ngược)",
        },
        description: {
          en: "Hold for 48 hours to await next lunar lighting window. Incurs $60M range delay and propellant replenishment costs.",
          vi: "Hoãn 48 giờ chờ cửa sổ chiếu sáng Mặt Trăng tiếp theo. Tốn $60M chi phí duy trì bãi phóng và bổ sung nhiên liệu.",
        },
        tacticalBadge: {
          en: "Recycle Delay (+$60M Range Cost)",
          vi: "Hoãn đếm ngược (+$60M Chi phí)",
        },
        historical: false,
      },
      {
        id: "severe_wind",
        keyLabel: "C",
        title: {
          en: "Option C: Force Launch in Severe Wind (>40 km/h)",
          vi: "Lựa chọn C: Cưỡng bức phóng trong gió mạnh (>40 km/h)",
        },
        description: {
          en: "Launch directly into 48 km/h wind gusts. Extreme aerodynamic shear at Max-Q exceeds structural gimbal margin (Triggers ENDING-5).",
          vi: "Phóng thẳng vào luồng gió giật 48 km/h. Lực cản khí động cực đại tại Max-Q vượt quá giới hạn chịu lực kết cấu (Kích hoạt KẾT THÚC 5).",
        },
        tacticalBadge: {
          en: "Catastrophic Risk (Max-Q Structural Breakup)",
          vi: "Nguy cơ thảm hoạ (Vỡ kết cấu Max-Q)",
        },
        historical: false,
      },
    ],
  },

  "trajectory-decision": {
    id: "trajectory-decision",
    pointId: "trajectory",
    speaker: "armstrong",
    title: {
      en: "Decision 3: Translunar Trajectory Profile Call",
      vi: "Quyết định 3: Chọn quỹ đạo bay sang Mặt Trăng",
    },
    context: {
      en: "S-IVB cutoff confirmed; Apollo 11 is in translunar coast. Houston requests confirmation of trajectory geometry.",
      vi: "Động cơ tầng 3 S-IVB đã tắt; Apollo 11 đang trên hành trình tới Mặt Trăng. Houston yêu cầu xác nhận hình học quỹ đạo.",
    },
    prompt: {
      en: "Apollo 11 mission rules recommend a Circumlunar Free-Return trajectory. If the SPS engine fails behind the Moon, lunar gravity automatically slingshots the crew home. Confirm trajectory profile.",
      vi: "Quy tắc nhiệm vụ Apollo 11 đề xuất quỹ đạo tự do quay về (Free-Return). Nếu động cơ SPS hỏng phía sau Mặt Trăng, trọng lực sẽ tự đưa phi hành đoàn về. Xác nhận quỹ đạo.",
    },
    options: [
      {
        id: "free_return",
        keyLabel: "A",
        title: {
          en: "Option A: Circumlunar Free-Return Trajectory (Historical)",
          vi: "Lựa chọn A: Quỹ đạo tự do quay về Free-Return (Lịch sử)",
        },
        description: {
          en: "Passive safety corridor targeting Mare Tranquillitatis. Complete passive abort return capability even under total propulsion loss.",
          vi: "Hành lang an toàn thụ động hướng tới Biển Yên Bình. Đảm bảo quay về an toàn kể cả khi mất toàn bộ động cơ.",
        },
        tacticalBadge: {
          en: "Passive Abort Guaranteed (Nominal Delta-V)",
          vi: "Đảm bảo hủy thụ động (Delta-V chuẩn)",
        },
        historical: true,
      },
      {
        id: "direct",
        keyLabel: "B",
        title: {
          en: "Option B: Direct High-Energy Non-Free-Return",
          vi: "Lựa chọn B: Quỹ đạo năng lượng cao không tự do quay về",
        },
        description: {
          en: "High-energy transit shaving 4 hours off flight time. Precludes passive return; requires active DPS burn if LOI fails (-8% reserve penalty).",
          vi: "Quỹ đạo bay nhanh rút ngắn 4 giờ. Không thể tự quay về; bắt buộc dùng động cơ đổ bộ nếu hỏng hãm quỹ đạo (-8% nhiên liệu).",
        },
        tacticalBadge: {
          en: "Fast Transit (-8% Delta-V Penalty / No Passive Abort)",
          vi: "Bay nhanh (-8% Phạt Delta-V / Mất hủy thụ động)",
        },
        historical: false,
      },
    ],
  },

  "agc-alarm-decision": {
    id: "agc-alarm-decision",
    pointId: "agc_alarm",
    speaker: "bales",
    title: {
      en: "Decision 4: AGC 1201/1202 Program Alarm Call",
      vi: "Quyết định 4: Báo động máy tính AGC 1201/1202",
    },
    context: {
      en: "At 33,500 ft during powered descent braking, rendezvous radar counter pulses overload the Apollo Guidance Computer memory buffer.",
      vi: "Ở độ cao 33.500 ft trong giai đoạn hãm hạ cánh, xung từ radar tiếp cận làm tràn bộ đệm bộ nhớ máy tính AGC.",
    },
    prompt: {
      en: "1202 PROGRAM ALARM! CPU overload in Apollo Guidance Computer at 33,500 ft! Radar data overflowing core memory! Flight Director requests immediate call: GO or ABORT?",
      vi: "BÁO ĐỘNG CHƯƠNG TRÌNH 1202! Quá tải CPU máy tính AGC ở độ cao 33.500 ft! Bộ nhớ lõi bị tràn! Chỉ huy bay yêu cầu quyết định ngay: GO hay ABORT?",
    },
    options: [
      {
        id: "go",
        keyLabel: "A",
        title: {
          en: "Option A: Accept Bales/Garman Call — GO on Alarm (Historical)",
          vi: "Lựa chọn A: Theo lệnh Bales/Garman — GO vượt báo động (Lịch sử)",
        },
        description: {
          en: "Jack Garman / Steve Bales rule: 'The alarm is intermittent; guidance equations are running uninterrupted. We are GO!' Powered descent continues.",
          vi: "Quy tắc Jack Garman / Steve Bales: 'Báo động chỉ ngắt quãng; phương trình dẫn đường vẫn chạy đều. Cho GO!' Tiếp tục hạ cánh.",
        },
        tacticalBadge: {
          en: "Continue Descent to P66 Approach",
          vi: "Tiếp tục hạ cánh đến mốc tiếp cận P66",
        },
        historical: true,
      },
      {
        id: "abort_stage",
        keyLabel: "B",
        title: {
          en: "Option B: Hit ABORT STAGE (Guidance Officer Conservative Call)",
          vi: "Lựa chọn B: Bấm ABORT STAGE (Theo quy tắc an toàn nghiêm ngặt)",
        },
        description: {
          en: "Pyrotechnic bolts sever descent stage; Bell Ascent Engine ignites to climb back to Columbia in lunar orbit (Triggers ENDING-2).",
          vi: "Bu-lông nổ cắt rời tầng đổ bộ; động cơ bay lên khai hoả đưa tàu trở lại kết nối với Columbia trên quỹ đạo (Kích hoạt KẾT THÚC 2).",
        },
        tacticalBadge: {
          en: "Emergency Staging (Safe Abort to Orbit)",
          vi: "Tách tầng khẩn cấp (Hủy an toàn lên quỹ đạo)",
        },
        historical: false,
      },
    ],
  },

  "landing-decision": {
    id: "landing-decision",
    pointId: "landing_approach",
    speaker: "armstrong",
    title: {
      en: "Decision 5: Final Approach & Landing Call",
      vi: "Quyết định 5: Quyết định tiếp đất chót",
    },
    context: {
      en: "At 150 ft altitude, automatic targeting directs LM Eagle into the boulder-strewn crater rim of West Crater. Fuel quantity low-level warning is flashing.",
      vi: "Ở độ cao 150 ft, máy tính tự động hướng tàu Eagle vào bãi đá tảng hiểm trở tại hố West Crater. Đèn cảnh báo nhiên liệu thấp đang nhấp nháy.",
    },
    prompt: {
      en: "Looking out the triangular window... West Crater is choked with 10-foot boulders! Fuel quantity sensor indicates 60 seconds to mandatory Bingo Fuel abort. What is Commander Armstrong's command?",
      vi: "Nhìn qua cửa sổ tam giác... hố West Crater đầy đá tảng cao 3 mét! Cảm biến nhiên liệu báo chỉ còn 60 giây trước khi bắt buộc hủy Bingo Fuel. Chỉ huy Armstrong ra lệnh gì?",
    },
    options: [
      {
        id: "p66_redesignation",
        keyLabel: "A",
        title: {
          en: "Option A: Engage P66 Manual Redesignation past West Crater (Historical)",
          vi: "Lựa chọn A: Bật P66 bay lướt thủ công vượt hố West Crater (Lịch sử)",
        },
        description: {
          en: "Take manual control, pitch forward to fly long over boulder field, kick up surface dust, and touch down smoothly at Tranquility Base with 25s fuel margin (Triggers ENDING-1).",
          vi: "Lấy quyền điều khiển thủ công, bay lướt qua bãi đá, thổi tung bụi cát và tiếp đất êm ái tại Căn cứ Yên Bình với 25 giây nhiên liệu (Kích hoạt KẾT THÚC 1).",
        },
        tacticalBadge: {
          en: "Historic Lunar Landing (Tranquility Base)",
          vi: "Đổ bộ lịch sử (Căn cứ Yên Bình)",
        },
        historical: true,
      },
      {
        id: "boulder_field",
        keyLabel: "B",
        title: {
          en: "Option B: Touchdown Immediately in West Crater Boulder Field",
          vi: "Lựa chọn B: Tiếp đất khẩn cấp ngay trên bãi đá hố West Crater",
        },
        description: {
          en: "Drop straight down to conserve fuel. Eagle strikes an 18-degree boulder slope; landing strut shears off, ascent engine crushed (Triggers ENDING-3).",
          vi: "Hạ thẳng xuống để tiết kiệm nhiên liệu. Tàu đập vào dốc đá 18 độ; chân đế gãy, động cơ bay lên bẹp nát (Kích hoạt KẾT THÚC 3).",
        },
        tacticalBadge: {
          en: "Catastrophic Impact (Crew Stranded / Safire Contingency)",
          vi: "Va chạm thảm hoạ (Mắc kẹt / Kế hoạch Safire)",
        },
        historical: false,
      },
      {
        id: "bingo_abort",
        keyLabel: "C",
        title: {
          en: "Option C: Bingo Fuel Wave-Off at 40 Feet (Abort Stage)",
          vi: "Lựa chọn C: Hủy hạ cánh do chạm ngưỡng Bingo Fuel ở 40 feet",
        },
        description: {
          en: "Low-fuel clock expires. Armstrong hits Abort Stage at 40 feet, staging away from descent stage to rendezvous safely with Columbia (Triggers ENDING-4).",
          vi: "Hết đồng hồ nhiên liệu an toàn. Armstrong bấm Abort Stage ở độ cao 12m, tách tầng đáp bay lên hội quân an toàn với Columbia (Kích hoạt KẾT THÚC 4).",
        },
        tacticalBadge: {
          en: "Wave-Off Abort (Safe Orbital Recovery)",
          vi: "Kéo tàu lên hủy đáp (Cứu hộ an toàn trên quỹ đạo)",
        },
        historical: false,
      },
    ],
  },
};
