import type { LocalizedText } from "@/i18n";
import type { CharacterId } from "./characters";

/**
 * Narrative content only: who says what. How it is shown (portrait, box, transitions)
 * lives in the components. The story is linear, so a script is an ordered list of lines.
 */
export interface ScriptLine {
  speaker: CharacterId;
  text: LocalizedText;
}

export interface Briefing {
  /** The character the player becomes in this chapter. */
  pov: CharacterId;
  lines: ScriptLine[];
  /** Short task list shown with the final line, before the scene starts. */
  objectives: LocalizedText[];
}

export type BriefingId = "medical" | "workshop" | "mission-control" | "ascent" | "lunar-descent" | "epilogue";

export const BRIEFINGS: Record<BriefingId, Briefing> = {
  medical: {
    pov: "astronaut",
    lines: [
      {
        speaker: "astronaut",
        text: {
          en: "Morning. I'm ArmStrong, and today you'll see through my eyes.",
          vi: "Chào buổi sáng. Tôi là ArmStrong, và hôm nay bạn sẽ nhìn qua đôi mắt của tôi.",
        },
      },
      {
        speaker: "astronaut",
        text: {
          en: "No one flies until the flight surgeon signs off. Let's get the medical check done.",
          vi: "Không ai được bay nếu bác sĩ chưa ký duyệt. Mình đi khám sức khoẻ trước nhé.",
        },
      },
    ],
    objectives: [
      { en: "Open the medical bay door", vi: "Mở cửa phòng y tế" },
      { en: "Check heart rate, blood pressure, and vision", vi: "Đo nhịp tim, huyết áp và thị lực" },
    ],
  },
  workshop: {
    pov: "engineer",
    lines: [
      {
        speaker: "engineer",
        text: {
          en: "I'm Kai, launch engineer. This rocket is my responsibility until it leaves the pad.",
          vi: "Tôi là Kai, kỹ sư phóng. Tên lửa này thuộc trách nhiệm của tôi cho đến khi rời bệ phóng.",
        },
      },
      {
        speaker: "engineer",
        text: {
          en: "Chief Bao and I will stack the rocket, check every part, hunt for hidden faults and run the checklist before we roll it out.",
          vi: "Trưởng xưởng Bảo và tôi sẽ dựng tên lửa, kiểm tra từng bộ phận, tìm lỗi ẩn và chạy checklist trước khi đưa ra bệ phóng.",
        },
      },
    ],
    objectives: [
      { en: "Stack the rocket with the gantry crane", vi: "Dựng tên lửa bằng cầu trục giàn" },
      { en: "Move around the assembly hall", vi: "Di chuyển quanh xưởng lắp ráp" },
      { en: "Inspect every rocket part", vi: "Kiểm tra mọi bộ phận tên lửa" },
      { en: "Find the hidden faults with the scanner", vi: "Tìm các lỗi ẩn bằng máy quét" },
      { en: "Run the pre-flight checklist in order", vi: "Chạy checklist trước chuyến bay đúng thứ tự" },
      { en: "Choose the engines and tanks", vi: "Chọn động cơ và bồn nhiên liệu" },
    ],
  },
  "mission-control": {
    pov: "flight-director",
    lines: [
      {
        speaker: "flight-director",
        text: {
          en: "Director Vega, Mission Control. From this console, every launch decision is ours.",
          vi: "Chỉ huy Vega, Trung tâm điều khiển. Mọi quyết định phóng đều được đưa ra từ bàn điều khiển này.",
        },
      },
      {
        speaker: "flight-director",
        text: {
          en: "Pick the vehicle, the payload, and the fuel. If the numbers are wrong, we'll find out in flight.",
          vi: "Chọn phương tiện phóng, khối hàng và nhiên liệu. Nếu tính sai, chúng ta sẽ biết ngay khi đang bay.",
        },
      },
    ],
    objectives: [
      { en: "Configure the launch", vi: "Thiết lập thông số phóng" },
      { en: "Run the countdown and launch", vi: "Đếm ngược và phóng" },
    ],
  },
  ascent: {
    pov: "astronaut",
    lines: [
      {
        speaker: "astronaut",
        text: {
          en: "Strapped in, helmet sealed. The countdown ended and the whole rocket is alive under my back.",
          vi: "Đã thắt dây, đã đóng mũ. Đếm ngược xong rồi, cả con tên lửa đang rung lên ngay dưới lưng tôi.",
        },
      },
      {
        speaker: "astronaut",
        text: {
          en: "Nine minutes to orbit. Hold on through Max Q, then unbuckle and take a look at home.",
          vi: "Chín phút nữa là tới quỹ đạo. Giữ chắc qua Max Q, rồi tháo dây và ngắm nhìn quê nhà.",
        },
      },
    ],
    objectives: [
      { en: "Ride the rocket to orbit", vi: "Cưỡi tên lửa lên quỹ đạo" },
      { en: "Release your harness", vi: "Tháo dây an toàn" },
      { en: "Float to the window and look at Earth", vi: "Bơi tới cửa sổ và ngắm Trái Đất" },
    ],
  },
  "lunar-descent": {
    pov: "astronaut",
    lines: [
      {
        speaker: "astronaut",
        text: {
          en: "Three days out, and the Moon fills the window. It's me again.",
          vi: "Ba ngày bay, và Mặt Trăng đã choán hết ô cửa sổ. Lại là tôi đây.",
        },
      },
      {
        speaker: "astronaut",
        text: {
          en: "Follow the descent checklist step by step and we'll set down softly.",
          vi: "Làm đúng từng bước trong danh sách hạ cánh, chúng ta sẽ đáp xuống nhẹ nhàng.",
        },
      },
    ],
    objectives: [{ en: "Complete the descent checklist", vi: "Hoàn thành danh sách hạ cánh" }],
  },
  epilogue: {
    pov: "astronaut",
    lines: [
      {
        speaker: "astronaut",
        text: {
          en: "The flag is up. Look back: that blue marble is home.",
          vi: "Lá cờ đã được cắm. Nhìn lại kìa: viên bi xanh ấy là nhà.",
        },
      },
      {
        speaker: "astronaut",
        text: {
          en: "Getting here was half the mission. Next comes the trip back to Earth.",
          vi: "Đến được đây mới là một nửa nhiệm vụ. Tiếp theo là hành trình trở về Trái Đất.",
        },
      },
    ],
    objectives: [],
  },
};
