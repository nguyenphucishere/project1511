import type { LocalizedText } from "@/i18n";
import type { CharacterId } from "@/game/characters";
import type { StationId } from "./checks";
import type { FuelLine } from "./handworkRules";

/**
 * Everything Kai, Chief Bao and the hall's loudspeaker say, plus the labels of the new HUD pieces.
 * Kept here (not in the global dictionaries) because it belongs to this scene alone.
 */
export interface Line {
  who: CharacterId | "pa";
  text: LocalizedText;
}

const bao = (en: string, vi: string): Line => ({ who: "workshop-chief", text: { en, vi } });
const kai = (en: string, vi: string): Line => ({ who: "engineer", text: { en, vi } });

export const SAY = {
  craneIntro: bao(
    "The rocket arrives in three lifts. Bring each section over the pad, let it settle, then ease it down. Go gently: this is a quarter of a billion dollars of steel.",
    "Tên lửa đến theo ba đợt cẩu. Đưa từng đoạn tới đúng trên bệ, để nó hết đung đưa rồi hạ từ từ. Nhẹ tay thôi: đây là cả núi thép đắt tiền.",
  ),
  craneTip: kai(
    "Tap lower in short bursts. If it comes down fast, it will bounce.",
    "Nhấn hạ từng nhịp ngắn thôi. Hạ nhanh là nó nảy lên đấy.",
  ),
  blocked: bao(
    "Not over the axis yet. Line it up with the green beam first.",
    "Chưa thẳng trục đâu. Căn cho thẳng với tia xanh đã.",
  ),
  hardLanding: bao(
    "Easy! You'll crack a flange. Lift it and try again, slower.",
    "Từ từ! Cậu làm nứt mặt bích mất. Nâng lên rồi hạ lại, chậm hơn.",
  ),
  seated: [
    bao(
      "Upper stage seated. Clamps locked. One more section to go.",
      "Tầng trên đã vào vị trí, kẹp đã khoá. Còn hai đoạn nữa.",
    ),
    bao(
      "Spacecraft module seated. That's the lander and the service module on the stack.",
      "Khoang tàu vũ trụ đã vào vị trí: tàu đổ bộ và khoang dịch vụ nằm trên đỉnh.",
    ),
    bao(
      "Capsule and escape tower on. The stack is complete. That's a rocket.",
      "Khoang phi hành đoàn và tháp thoát hiểm đã lên. Cả tên lửa đã dựng xong. Đúng là một con tên lửa.",
    ),
  ] as Line[],
  tourIntro: bao(
    "Walk the hall, take the lifts, and open every part. I'll explain each one. Use the scan button to look inside.",
    "Đi quanh xưởng, đi thang giàn và mở từng bộ phận. Tôi sẽ giải thích từng cái. Bấm nút quét để nhìn vào bên trong.",
  ),
  scanIntro: bao(
    "Quality control found anomalies but not where. Switch on the scanner (Q) and sweep the hull: the ping gets faster as you close in. Four faults, and the clock is running.",
    "Bộ phận kiểm định báo có bất thường nhưng không biết ở đâu. Bật máy quét (Q) và quét thân tên lửa: tiếng bíp càng dồn khi cậu tới gần. Có bốn lỗi, và đồng hồ đang chạy.",
  ),
  scanFirstTip: kai(
    "Check every level. Use the gantry lifts: some faults are only visible from up there.",
    "Nhớ kiểm tra mọi tầng. Đi thang giàn: có lỗi chỉ thấy được ở trên cao.",
  ),
  scanAllFound: kai(
    "All four logged. Maintenance will fix them tonight. Now the pre-flight checklist.",
    "Cả bốn lỗi đã được ghi lại. Đêm nay đội bảo trì sẽ sửa. Giờ đến checklist trước chuyến bay.",
  ),
  scanTimeUp: bao(
    "Time's up. I've flagged the rest for maintenance, and the ones you missed are marked for the next crew.",
    "Hết giờ. Tôi đã báo phần còn lại cho đội bảo trì, những lỗi cậu bỏ sót được đánh dấu cho kíp sau.",
  ),
  checklistIntro: kai(
    "Pre-flight checklist. One: fuel feed lines. Two: electrical bus. Three: tank pressure. In that order, please. The fuel panel is in the fuel bay by the east wall: walk over there.",
    "Checklist trước chuyến bay. Một: đường cấp nhiên liệu. Hai: hệ thống điện. Ba: áp suất bồn. Đúng thứ tự này nhé. Bảng nhiên liệu nằm trong khu nhiên liệu sát tường phía đông: đi bộ sang đó.",
  ),
  tightenIntro: bao(
    "Before we fuel: the flange between stage one and stage two. Take the torque wrench from the bench, ride up to level 2 and tighten all five bolts in a star pattern: A, C, E, B, D. Stop when the wrench clicks, not after.",
    "Trước khi nạp nhiên liệu: mặt bích giữa tầng một và tầng hai. Lấy cờ lê lực trên bàn dụng cụ, đi thang lên tầng giàn 2 và siết cả năm bu-lông theo hình sao: A, C, E, B, D. Dừng khi cờ lê kêu tách, đừng siết quá.",
  ),
  toolPicked: kai(
    "Torque wrench in hand. Level 2, the interstage flange. Hold to turn, let go at the click.",
    "Đã cầm cờ lê lực. Tầng giàn 2, mặt bích giữa hai tầng. Giữ để vặn, nhả tay khi nghe tiếng tách.",
  ),
  wrongTool: (name: LocalizedText): Line =>
    bao(
      `A ${name.en.toLowerCase()} on a flange bolt? Put it back. A torque wrench is the only tool that tells you when to stop.`,
      `${name.vi} mà đòi siết bu-lông mặt bích à? Đặt lại đi. Chỉ cờ lê lực mới báo cho cậu biết khi nào phải dừng.`,
    ),
  boltWrongOrder: (label: string): Line =>
    bao(
      `Not that one. A star pattern, never round the ring: the next bolt is ${label}. Go in a circle and the flange warps.`,
      `Không phải bu-lông đó. Phải siết hình sao, không đi vòng tròn: bu-lông tiếp theo là ${label}. Siết vòng tròn là mặt bích bị vênh.`,
    ),
  boltStripped: bao(
    "It clicked and you kept turning. Thread's stripped. I'll fit a fresh bolt: this time stop at the click.",
    "Nó đã kêu tách mà cậu vẫn vặn tiếp. Hỏng ren rồi. Tôi thay bu-lông mới: lần này dừng ngay khi nghe tách.",
  ),
  boltTight: (label: string, left: number): Line =>
    kai(
      left > 0 ? `Bolt ${label} at torque. ${left} to go.` : `Bolt ${label} at torque.`,
      left > 0 ? `Bu-lông ${label} đạt lực siết. Còn ${left} cái.` : `Bu-lông ${label} đạt lực siết.`,
    ),
  tightenDone: bao(
    "All five at torque, paint stripes on. That flange isn't going anywhere. Now the fuel checklist.",
    "Cả năm bu-lông đạt lực siết, đã sơn vạch kiểm tra. Mặt bích này sẽ không xê dịch nữa. Giờ đến checklist nhiên liệu.",
  ),
  bayEnter: bao(
    "Fuel bay. Cryogenic liquids: oxygen at minus 183, and anything wet that touches it freezes. Gloves on, nothing loose, and no running.",
    "Khu nhiên liệu. Chất lỏng đông lạnh: oxy ở âm 183 độ, thứ gì ướt chạm vào là đóng băng. Đeo găng, không để đồ lỏng lẻo, và không chạy.",
  ),
  fuelTooFar: kai(
    "The fuel panel is in the fuel bay by the east wall. Walk over there first.",
    "Bảng nhiên liệu nằm trong khu nhiên liệu sát tường phía đông. Đi bộ sang đó trước đã.",
  ),
  couplingMiss: kai(
    "Cross-threaded. Back it off and line the coupling up again.",
    "Khớp nối bị lệch ren. Rút ra và căn lại khớp nối.",
  ),
  couplingHit: (line: FuelLine): Line =>
    kai(
      line === "oxidizer" ? "Oxidizer line locked." : "Fuel line locked.",
      line === "oxidizer" ? "Đã khoá đường oxy hoá." : "Đã khoá đường nhiên liệu.",
    ),
  fillStarted: bao(
    "Both lines on. Opening the valves. Frost on the fittings is the cold working, not a leak.",
    "Cả hai đường đã nối. Mở van. Sương giá trên khớp nối là do lạnh, không phải rò rỉ.",
  ),
  checklistDone: bao(
    "Checklist complete, in the right order. Now: what are we flying with?",
    "Checklist hoàn tất, đúng thứ tự. Giờ chọn xem mình sẽ bay bằng gì nhé?",
  ),
  stationDone: {
    fuel: kai("Tanks fed, umbilical connected. No leaks on the feed lines.", "Bồn đã nạp, ống cấp đã nối. Đường nhiên liệu không rò rỉ."),
    electrical: kai("Bus A and bus B nominal. Power is clean.", "Nguồn A và B bình thường. Điện sạch."),
    pressure: kai("Tank pressure holding steady in the window.", "Áp suất bồn giữ ổn định trong khoảng cho phép."),
  } satisfies Record<StationId, Line>,
  loadoutIntro: bao(
    "Last decision: engines and tanks. Watch the numbers. It needs enough thrust to lift off, and enough tank to reach orbit.",
    "Quyết định cuối: động cơ và bồn nhiên liệu. Nhìn các con số: phải đủ lực đẩy để rời bệ, và đủ nhiên liệu để lên quỹ đạo.",
  ),
  loadoutLocked: bao("I won't sign that. Fix the red numbers.", "Tôi không ký bản này. Sửa các con số đỏ đi."),
  wrongOrder: (expected: StationId): Line =>
    bao(
      `Hold on, Kai. We do ${STATION_NAME[expected].en.toLowerCase()} first. Order matters: a pressurised tank on a dead bus is a bad day.`,
      `Khoan đã, Kai. Mình làm ${STATION_NAME[expected].vi.toLowerCase()} trước. Thứ tự rất quan trọng: bồn có áp suất mà điện chết là rắc rối to đấy.`,
    ),
} as const;

export type ToolId = "torque" | "hammer" | "pipe" | "driver";

export const TOOL_NAME: Record<ToolId, LocalizedText> = {
  torque: { en: "Torque wrench", vi: "Cờ lê lực" },
  hammer: { en: "Claw hammer", vi: "Búa nhổ đinh" },
  pipe: { en: "Pipe wrench", vi: "Mỏ lết ống" },
  driver: { en: "Screwdriver", vi: "Tua vít" },
};

export const STATION_NAME: Record<StationId, LocalizedText> = {
  fuel: { en: "Fuel feed panel", vi: "Bảng cấp nhiên liệu" },
  electrical: { en: "Electrical bus panel", vi: "Bảng nguồn điện" },
  pressure: { en: "Pressure manifold", vi: "Cụm áp suất" },
};

export const CHECKLIST_TEXT: Record<StationId, { step: LocalizedText; detail: LocalizedText }> = {
  fuel: {
    step: { en: "Fuel", vi: "Nhiên liệu" },
    detail: { en: "Connect the umbilical and confirm the feed lines are sealed", vi: "Nối ống cấp và xác nhận đường nhiên liệu kín" },
  },
  electrical: {
    step: { en: "Electrical", vi: "Điện" },
    detail: { en: "Power the buses and confirm both are in range", vi: "Cấp điện và xác nhận hai nguồn đều trong ngưỡng" },
  },
  pressure: {
    step: { en: "Pressure", vi: "Áp suất" },
    detail: { en: "Bring tank pressure into the green window and hold it", vi: "Đưa áp suất bồn vào vùng xanh và giữ ổn định" },
  },
};

/** Loudspeaker lines, played at random while the player works. */
export const PA_LINES: LocalizedText[] = [
  { en: "Attention, bay one. Crane operations in progress. Keep clear of the pad.", vi: "Chú ý khu một. Đang vận hành cầu trục. Tránh xa bệ phóng." },
  { en: "Reminder: hard hats and safety glasses are mandatory inside the high bay.", vi: "Nhắc nhở: bắt buộc đội mũ cứng và đeo kính bảo hộ trong nhà cao." },
  { en: "Cryogenic transfer at the east wall. Personnel, stay behind the yellow line.", vi: "Đang chuyển nhiên liệu đông lạnh ở tường phía đông. Mọi người đứng sau vạch vàng." },
  { en: "Forklift in motion on the west aisle. Watch for the backup alarm.", vi: "Xe nâng đang di chuyển ở lối phía tây. Chú ý còi lùi xe." },
  { en: "Quality control to the stage one skirt, please. Quality control to the skirt.", vi: "Kiểm định chất lượng xin tới váy tầng một. Kiểm định chất lượng tới váy tầng một." },
  { en: "Weather update: launch window stays green. Winds are picking up after noon.", vi: "Cập nhật thời tiết: cửa sổ phóng vẫn xanh. Gió sẽ mạnh lên sau buổi trưa." },
];

export const UI = {
  paLabel: { en: "Hall loudspeaker", vi: "Loa xưởng" },
  objectives: {
    crane: { en: "Stack the rocket with the gantry crane", vi: "Dựng tên lửa bằng cầu trục giàn" },
    levels: { en: "Move around the assembly hall", vi: "Di chuyển quanh xưởng lắp ráp" },
    parts: { en: "Inspect every rocket part", vi: "Kiểm tra mọi bộ phận tên lửa" },
    faults: { en: "Find the hidden faults with the scanner", vi: "Tìm các lỗi ẩn bằng máy quét" },
    tighten: { en: "Torque the flange bolts in a star pattern", vi: "Siết các bu-lông mặt bích theo hình sao" },
    checklist: { en: "Run the pre-flight checklist in order", vi: "Chạy checklist trước chuyến bay đúng thứ tự" },
    loadout: { en: "Choose the engines and tanks", vi: "Chọn động cơ và bồn nhiên liệu" },
  },
  crane: {
    lift: { en: "Lift {n} of {total}", vi: "Cẩu {n}/{total}" },
    sections: [
      { en: "Upper stage", vi: "Tầng trên" },
      { en: "Spacecraft module", vi: "Khoang tàu vũ trụ" },
      { en: "Capsule and escape tower", vi: "Khoang phi hành đoàn và tháp thoát hiểm" },
    ] as LocalizedText[],
    alignment: { en: "Alignment", vi: "Độ thẳng trục" },
    aligned: { en: "Aligned", vi: "Thẳng trục" },
    off: { en: "Off-axis {cm} cm", vi: "Lệch {cm} cm" },
    speed: { en: "Descent speed", vi: "Tốc độ hạ" },
    clearance: { en: "Height above seat", vi: "Cao hơn vị trí đặt" },
    controls: {
      en: "A D: bridge   W S: trolley   Space: lower (hold briefly)   E: raise",
      vi: "A D: cầu   W S: xe con   Space: hạ (nhấn từng nhịp)   E: nâng",
    },
    lower: { en: "Lower", vi: "Hạ" },
    raise: { en: "Raise", vi: "Nâng" },
    bumps: { en: "Rough landings: {n}", vi: "Lần hạ mạnh: {n}" },
  },
  scan: {
    toggle: { en: "Scanner", vi: "Máy quét" },
    on: { en: "Scanner on (Q)", vi: "Đã bật máy quét (Q)" },
    off: { en: "Switch on the scanner (Q)", vi: "Bật máy quét (Q)" },
    signal: { en: "Signal", vi: "Tín hiệu" },
    found: { en: "Faults found {n}/{total}", vi: "Đã tìm {n}/{total} lỗi" },
    time: { en: "Time left", vi: "Còn lại" },
    foundTitle: { en: "Fault logged", vi: "Đã ghi nhận lỗi" },
    fix: { en: "Repair", vi: "Cách sửa" },
    hint: { en: "Sweep the hull. The ping speeds up when you are close. Click the glow.", vi: "Quét dọc thân tên lửa. Tiếng bíp dồn lại khi tới gần. Bấm vào chỗ phát sáng." },
    missed: { en: "Missed", vi: "Bỏ sót" },
  },
  inside: {
    open: { en: "Scan inside", vi: "Quét bên trong" },
    close: { en: "Back to the briefing", vi: "Quay lại phần giới thiệu" },
    title: { en: "Inside view", vi: "Nhìn bên trong" },
    quiz: { en: "Quick check", vi: "Kiểm tra nhanh" },
    correct: { en: "Correct!", vi: "Chính xác!" },
    wrong: { en: "Not quite.", vi: "Chưa đúng." },
  },
  station: {
    connecting: { en: "Connecting umbilical…", vi: "Đang nối ống cấp…" },
    powering: { en: "Powering buses…", vi: "Đang cấp điện…" },
    pump: { en: "Hold to pump", vi: "Giữ để bơm" },
    pumpKeys: { en: "Hold Space or the button. Keep the needle in the green.", vi: "Giữ phím Space hoặc nút. Giữ kim trong vùng xanh." },
    bar: { en: "{value} bar", vi: "{value} bar" },
    window: { en: "Target {min}–{max} bar", vi: "Mục tiêu {min}–{max} bar" },
    checklist: { en: "Pre-flight checklist", vi: "Checklist trước chuyến bay" },
    mistakes: { en: "Order mistakes: {n}", vi: "Sai thứ tự: {n}" },
  },
  fuelGame: {
    title: { en: "Fuel bay: connect the lines", vi: "Khu nhiên liệu: nối các đường ống" },
    hint: { en: "Press Space or Connect when the marker is in the green.", vi: "Nhấn Space hoặc Nối khi vạch chạy vào vùng xanh." },
    connect: { en: "Connect", vi: "Nối" },
    line: {
      oxidizer: { en: "Oxidizer line (liquid oxygen)", vi: "Đường oxy hoá (oxy lỏng)" },
      fuel: { en: "Fuel line (kerosene)", vi: "Đường nhiên liệu (dầu hoả)" },
    } satisfies Record<FuelLine, LocalizedText>,
    linked: { en: "Connected", vi: "Đã nối" },
    slips: { en: "Cross-threaded: {n}", vi: "Lệch ren: {n}" },
    filling: { en: "Transferring propellant", vi: "Đang chuyển nhiên liệu" },
    flow: { en: "{value}% loaded", vi: "Đã nạp {value}%" },
  },
  tighten: {
    title: { en: "Flange bolts", vi: "Bu-lông mặt bích" },
    needTool: { en: "Take the torque wrench from the bench.", vi: "Lấy cờ lê lực trên bàn dụng cụ." },
    needLevel: { en: "Ride the lift to gantry level 2.", vi: "Đi thang giàn lên tầng giàn 2." },
    next: { en: "Next in the star pattern: bolt {label}", vi: "Tiếp theo theo hình sao: bu-lông {label}" },
    held: { en: "In hand: torque wrench", vi: "Đang cầm: cờ lê lực" },
    hold: { en: "Hold to turn", vi: "Giữ để vặn" },
    holdKeys: { en: "Hold Space or the button. Let go right after the click.", vi: "Giữ phím Space hoặc nút. Nhả ngay sau tiếng tách." },
    torque: { en: "Torque", vi: "Lực siết" },
    click: { en: "Click", vi: "Tách" },
    strip: { en: "Stripped", vi: "Hỏng ren" },
    bolt: { en: "Bolt {label}", vi: "Bu-lông {label}" },
    done: { en: "At torque", vi: "Đạt lực siết" },
  },
  loadout: {
    title: { en: "Build the first stage", vi: "Dựng tầng một" },
    engines: { en: "Engines", vi: "Động cơ" },
    tanks: { en: "Propellant tanks", vi: "Bồn nhiên liệu" },
    thrust: { en: "Thrust", vi: "Lực đẩy" },
    mass: { en: "Liftoff mass", vi: "Khối lượng cất cánh" },
    twr: { en: "Thrust-to-weight", vi: "Tỉ số đẩy/trọng lượng" },
    dv: { en: "Stage 1 velocity gain", vi: "Vận tốc tầng 1 tạo ra" },
    vehicle: { en: "Launch vehicle", vi: "Phương tiện phóng" },
    fuel: { en: "Starting fuel load", vi: "Nhiên liệu ban đầu" },
    mn: { en: "{value} MN", vi: "{value} MN" },
    tonnes: { en: "{value} t", vi: "{value} t" },
    kms: { en: "{value} km/s", vi: "{value} km/s" },
    twrLow: { en: "Too heavy: it would sit on the pad", vi: "Quá nặng: nó sẽ nằm yên trên bệ" },
    twrHigh: { en: "Too much thrust: the crew would be crushed", vi: "Lực đẩy quá lớn: phi hành đoàn sẽ bị nén nát" },
    dvLow: { en: "Not enough velocity to reach orbit", vi: "Không đủ vận tốc để lên quỹ đạo" },
    good: { en: "Within limits", vi: "Trong giới hạn" },
    confirm: { en: "Lock the build and send to configuration", vi: "Chốt cấu hình và chuyển sang bàn cấu hình phóng" },
    blocked: { en: "Fix the red numbers to continue", vi: "Sửa các con số đỏ để tiếp tục" },
    rulesNote: { en: "Illustrative figures with the real rocket equation.", vi: "Số liệu minh hoạ, dùng phương trình tên lửa thật." },
  },
  done: {
    title: { en: "Rocket built and checked", vi: "Tên lửa đã dựng và kiểm tra xong" },
    body: {
      en: "Stacked, scanned, checked and fitted out. {name} signs off, and the rocket rolls out to the pad.",
      vi: "Đã dựng, quét, kiểm tra và lắp xong. {name} ký duyệt, và tên lửa lăn ra bệ phóng.",
    },
    faults: { en: "Hidden faults found", vi: "Lỗi ẩn đã tìm" },
    quiz: { en: "Inside-view questions right", vi: "Câu hỏi bên trong trả lời đúng" },
    rough: { en: "Rough crane landings", vi: "Lần cẩu hạ mạnh" },
    order: { en: "Checklist order mistakes", vi: "Lần sai thứ tự checklist" },
    bolts: { en: "Bolt mistakes (order or stripped)", vi: "Lỗi bu-lông (sai thứ tự hoặc hỏng ren)" },
    build: { en: "Build", vi: "Cấu hình" },
  },
  skip: { en: "Skip this step", vi: "Bỏ qua bước này" },
  continue: { en: "Continue", vi: "Tiếp tục" },
} as const;
