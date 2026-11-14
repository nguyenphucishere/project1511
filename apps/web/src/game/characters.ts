import type { LocalizedText } from "@/i18n";

export type CharacterId =
  | "armstrong"
  | "aldrin"
  | "collins"
  | "kranz"
  | "bales"
  | "garman"
  // Legacy aliases for backwards compatibility
  | "astronaut"
  | "engineer"
  | "flight-director"
  | "doctor"
  | "workshop-chief";

export type PlaceholderHead = "helmet" | "cap" | "headset";

export interface Character {
  id: CharacterId;
  /** Key in assets.json "portraits". */
  portraitId: string;
  name: LocalizedText;
  role: LocalizedText;
  placeholder: PlaceholderHead;
  title?: string;
  callsign?: string;
  bio?: LocalizedText;
}

export const CHARACTERS: Record<CharacterId, Character> = {
  armstrong: {
    id: "armstrong",
    portraitId: "astronaut",
    name: { en: "Neil A. Armstrong", vi: "Neil A. Armstrong" },
    role: { en: "Mission Commander (CDR)", vi: "Chỉ huy nhiệm vụ (CDR)" },
    placeholder: "helmet",
    title: "Commander, Apollo 11",
    callsign: "Eagle / CDR",
    bio: {
      en: "Naval aviator, NACA/NASA X-15 research pilot, and Gemini 8 commander. Calm under extreme pressure; piloted LM Eagle manually past West Crater with under 30 seconds of fuel remaining.",
      vi: "Phi công hải quân, phi công thử nghiệm X-15 của NASA, chỉ huy Gemini 8. Bình tĩnh trước áp lực tột độ; tự tay điều khiển tàu Eagle vượt qua hố West Crater khi còn chưa đầy 30 giây nhiên liệu.",
    },
  },
  aldrin: {
    id: "aldrin",
    portraitId: "astronaut",
    name: { en: "Edwin 'Buzz' Aldrin Jr.", vi: "Edwin 'Buzz' Aldrin Jr." },
    role: { en: "Lunar Module Pilot (LMP)", vi: "Phi công tàu đổ bộ (LMP)" },
    placeholder: "helmet",
    title: "Lunar Module Pilot, LM-5 Eagle",
    callsign: "Eagle / LMP / Dr. Rendezvous",
    bio: {
      en: "USAF fighter pilot and MIT Sc.D. in Astronautics specializing in orbital rendezvous. Managed Eagle's systems, radar, and altitude/velocity callouts during the harrowing final descent.",
      vi: "Phi công tiêm kích Không quân và Tiến sĩ Du hành vũ trụ MIT chuyên về tiếp cận quỹ đạo. Quản lý hệ thống, radar và đọc thông số độ cao/vận tốc cho Armstrong khi hạ cánh.",
    },
  },
  collins: {
    id: "collins",
    portraitId: "astronaut",
    name: { en: "Michael Collins", vi: "Michael Collins" },
    role: { en: "Command Module Pilot (CMP)", vi: "Phi công khoang chỉ huy (CMP)" },
    placeholder: "helmet",
    title: "Command Module Pilot, CSM-107 Columbia",
    callsign: "Columbia / CMP",
    bio: {
      en: "USAF test pilot and Gemini 10 veteran. Maintained sole custody of Columbia in lunar orbit, prepared for emergency orbital rescue and the critical rendezvous upon lunar ascent.",
      vi: "Phi công thử nghiệm Không quân và cựu binh Gemini 10. Một mình điều khiển tàu Columbia trên quỹ đạo Mặt Trăng, sẵn sàng giải cứu khẩn cấp và đón đồng đội khi rời bề mặt.",
    },
  },
  kranz: {
    id: "kranz",
    portraitId: "flight-director",
    name: { en: "Eugene 'Gene' F. Kranz", vi: "Eugene 'Gene' F. Kranz" },
    role: { en: "Flight Director (White Team)", vi: "Chỉ huy chuyến bay (Đội Trắng)" },
    placeholder: "headset",
    title: "Lead Flight Director, Mission Control",
    callsign: "Flight",
    bio: {
      en: "Fighter pilot, aerospace engineer, and leader of the White Team in Mission Control. Architect of the 'Tough and Competent' philosophy. Led the team through the 1201/1202 alarms to touchdown.",
      vi: "Phi công tiêm kích, kỹ sư hàng không và trưởng Đội Trắng tại Trung tâm điều khiển. Tác giả triết lý 'Bản lĩnh và Thành thạo'. Dẫn dắt cả kíp trực vượt qua chuỗi báo động máy tính để đáp xuống thành công.",
    },
  },
  bales: {
    id: "bales",
    portraitId: "flight-director",
    name: { en: "Steve Bales", vi: "Steve Bales" },
    role: { en: "Guidance Officer (GUIDO)", vi: "Sĩ quan dẫn đường (GUIDO)" },
    placeholder: "headset",
    title: "Guidance Officer, Trench",
    callsign: "GUIDO",
    bio: {
      en: "26-year-old guidance controller responsible for the Apollo Guidance Computer. Made the split-second historical 'GO' call during the 1201 and 1202 executive overflow program alarms.",
      vi: "Sĩ quan dẫn đường 26 tuổi phụ trách máy tính AGC. Đã đưa ra quyết định 'GO' lịch sử trong tích tắc khi máy tính gặp sự cố tràn lệnh 1201 và 1202.",
    },
  },
  garman: {
    id: "garman",
    portraitId: "engineer",
    name: { en: "Jack Garman", vi: "Jack Garman" },
    role: { en: "Guidance Backroom Computer Specialist", vi: "Chuyên viên máy tính phòng hỗ trợ (Trench Backroom)" },
    placeholder: "headset",
    title: "NASA / MIT Draper Guidance Systems Specialist",
    callsign: "Guidance Backroom",
    bio: {
      en: "NASA computer engineer who memorized all AGC software error codes with MIT's software team. Memorized the rule: if 1201/1202 alarms are non-continuous, the computer is clearing lower-priority tasks and descent is safe.",
      vi: "Kỹ sư máy tính NASA thuộc nhóm viết mã MIT. Người đã ghi nhớ quy tắc then chốt: nếu báo động 1201/1202 ngắt quãng, máy tính đang tự lọc tác vụ phụ và việc hạ cánh vẫn an toàn.",
    },
  },

  // Legacy mappings for backwards-compatibility
  astronaut: {
    id: "astronaut",
    portraitId: "astronaut",
    name: { en: "Neil A. Armstrong", vi: "Neil A. Armstrong" },
    role: { en: "Mission Commander (CDR)", vi: "Chỉ huy nhiệm vụ (CDR)" },
    placeholder: "helmet",
    title: "Commander, Apollo 11",
    callsign: "Eagle / CDR",
    bio: {
      en: "Naval aviator and Apollo 11 Commander.",
      vi: "Phi công hải quân và Chỉ huy Apollo 11.",
    },
  },
  engineer: {
    id: "engineer",
    portraitId: "engineer",
    name: { en: "Jack Garman", vi: "Jack Garman" },
    role: { en: "Guidance Specialist", vi: "Chuyên viên dẫn đường" },
    placeholder: "headset",
    title: "Guidance Specialist, Mission Control",
    callsign: "Guidance Support",
    bio: {
      en: "Guidance backroom engineer specializing in the Apollo Guidance Computer.",
      vi: "Kỹ sư phòng hỗ trợ chuyên về Máy tính Dẫn đường Apollo.",
    },
  },
  "flight-director": {
    id: "flight-director",
    portraitId: "flight-director",
    name: { en: "Gene Kranz", vi: "Gene Kranz" },
    role: { en: "Flight Director", vi: "Chỉ huy chuyến bay" },
    placeholder: "headset",
    title: "Lead Flight Director, White Team",
    callsign: "Flight",
    bio: {
      en: "Flight Director for the Apollo 11 lunar landing.",
      vi: "Chỉ huy chuyến bay cho cuộc đổ bộ Apollo 11.",
    },
  },
  doctor: {
    id: "doctor",
    portraitId: "doctor",
    name: { en: "Dr. Lin", vi: "Bác sĩ Lin" },
    role: { en: "Director of Medical Operations", vi: "Giám đốc Y tế Hàng không" },
    placeholder: "headset",
    title: "Flight Surgeon, Apollo Program",
    callsign: "Surgeon",
    bio: {
      en: "Monitored the crew's biomedical telemetry, heart rates, and physical clearance for flight.",
      vi: "Theo dõi dữ liệu y sinh, nhịp tim và ký duyệt y tế cho phi hành đoàn trước giờ bay.",
    },
  },
  "workshop-chief": {
    id: "workshop-chief",
    portraitId: "workshop-chief",
    name: { en: "Arthur Rudolph", vi: "Arthur Rudolph" },
    role: { en: "Saturn V Project Director", vi: "Giám đốc dự án Saturn V" },
    placeholder: "cap",
    title: "Saturn V Vehicle Project Director",
    callsign: "VAB Chief",
    bio: {
      en: "Directed the assembly, checkout, and gantry integration of AS-506 in the Vehicle Assembly Building.",
      vi: "Chỉ đạo việc lắp ráp, kiểm tra và tích hợp tên lửa AS-506 tại Toà nhà Lắp ráp Tên lửa VAB.",
    },
  },
};
