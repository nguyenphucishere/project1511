import type { LocalizedText } from "@/i18n";
import type { PartId } from "@/mocks/rocket-parts";

/**
 * What the scanner shows inside each part, and one question to check the player was paying
 * attention. Three callouts per part are laid out on a blueprint-style cutaway.
 */
export type Cutaway = "engine" | "tank" | "ring" | "stage" | "module" | "capsule" | "tower";

export interface Knowledge {
  cutaway: Cutaway;
  /** Three labels, in the order they appear on the diagram (top to bottom). */
  parts: [LocalizedText, LocalizedText, LocalizedText];
  quiz: {
    question: LocalizedText;
    options: [LocalizedText, LocalizedText, LocalizedText];
    /** Index of the right answer. */
    answer: 0 | 1 | 2;
    why: LocalizedText;
  };
}

export const KNOWLEDGE: Record<PartId, Knowledge> = {
  "stage1-engines": {
    cutaway: "engine",
    parts: [
      { en: "Turbopump: pushes propellant in", vi: "Bơm turbo: ép nhiên liệu vào" },
      { en: "Combustion chamber: where it burns", vi: "Buồng đốt: nơi nhiên liệu cháy" },
      { en: "Nozzle: turns hot gas into thrust", vi: "Ống phun: biến khí nóng thành lực đẩy" },
    ],
    quiz: {
      question: { en: "What does the turbopump do?", vi: "Bơm turbo làm gì?" },
      options: [
        { en: "Steers the rocket", vi: "Lái tên lửa" },
        { en: "Feeds propellant into the chamber at high pressure", vi: "Bơm nhiên liệu vào buồng đốt ở áp suất cao" },
        { en: "Cools the crew cabin", vi: "Làm mát khoang phi hành đoàn" },
      ],
      answer: 1,
      why: {
        en: "Without a turbopump the propellant would trickle in. Pumps push tonnes of it in every second.",
        vi: "Không có bơm turbo, nhiên liệu chỉ nhỏ giọt. Bơm đẩy hàng tấn nhiên liệu vào mỗi giây.",
      },
    },
  },
  "stage1-tanks": {
    cutaway: "tank",
    parts: [
      { en: "Fuel tank (top)", vi: "Bồn nhiên liệu (trên)" },
      { en: "Common bulkhead: keeps them apart", vi: "Vách ngăn chung: giữ hai bồn tách biệt" },
      { en: "Oxidiser tank (bottom)", vi: "Bồn chất oxy hoá (dưới)" },
    ],
    quiz: {
      question: { en: "Why does a rocket carry oxidiser?", vi: "Vì sao tên lửa phải mang chất oxy hoá?" },
      options: [
        { en: "There is no air to burn fuel in space", vi: "Trong không gian không có không khí để đốt nhiên liệu" },
        { en: "To make the rocket heavier", vi: "Để tên lửa nặng hơn" },
        { en: "To cool the hull", vi: "Để làm mát thân tên lửa" },
      ],
      answer: 0,
      why: {
        en: "Fire needs oxygen. A rocket brings its own, so it works above the atmosphere too.",
        vi: "Lửa cần oxy. Tên lửa mang theo oxy của riêng mình, nên vẫn chạy được ở ngoài khí quyển.",
      },
    },
  },
  interstage: {
    cutaway: "ring",
    parts: [
      { en: "Separation bolts: fire to release", vi: "Bu-lông tách: nổ để nhả tầng" },
      { en: "Retro-rockets: push stage 1 away", vi: "Tên lửa hãm: đẩy tầng 1 ra xa" },
      { en: "Structural ring: carries the load", vi: "Vòng kết cấu: chịu tải của cả tầng trên" },
    ],
    quiz: {
      question: { en: "Why drop the interstage?", vi: "Vì sao phải bỏ vòng nối tầng?" },
      options: [
        { en: "It is on fire", vi: "Vì nó đang cháy" },
        { en: "Dead weight slows the upper stage", vi: "Khối lượng thừa làm tầng trên chậm đi" },
        { en: "To save the paint", vi: "Để tiết kiệm sơn" },
      ],
      answer: 1,
      why: {
        en: "Every kilogram carried to orbit costs fuel. Drop what you no longer need.",
        vi: "Mỗi ki-lô-gam mang lên quỹ đạo đều tốn nhiên liệu. Cái gì không cần nữa thì bỏ lại.",
      },
    },
  },
  stage2: {
    cutaway: "stage",
    parts: [
      { en: "Vacuum engine: big nozzle for thin air", vi: "Động cơ chân không: ống phun lớn cho nơi loãng khí" },
      { en: "Propellant tanks", vi: "Các bồn nhiên liệu" },
      { en: "Avionics ring: the rocket's brain", vi: "Vòng điện tử: bộ não của tên lửa" },
    ],
    quiz: {
      question: { en: "Why is the stage 2 nozzle so wide?", vi: "Vì sao ống phun tầng 2 rộng như vậy?" },
      options: [
        { en: "It is tuned for thin air, where the gas can expand more", vi: "Nó được thiết kế cho nơi loãng khí, khí giãn nở nhiều hơn" },
        { en: "To catch the fuel", vi: "Để hứng nhiên liệu" },
        { en: "For decoration", vi: "Để trang trí" },
      ],
      answer: 0,
      why: {
        en: "In near-vacuum the exhaust can expand fully, so a larger bell squeezes out more thrust.",
        vi: "Gần chân không, khí xả giãn nở hết cỡ, nên ống phun to hơn cho lực đẩy nhiều hơn.",
      },
    },
  },
  lander: {
    cutaway: "module",
    parts: [
      { en: "Crew cabin", vi: "Khoang phi hành đoàn" },
      { en: "Descent engine: lands on the Moon", vi: "Động cơ hạ cánh: đáp xuống Mặt Trăng" },
      { en: "Landing legs: fold for launch", vi: "Chân hạ cánh: gập lại khi phóng" },
    ],
    quiz: {
      question: { en: "Why do the lander legs fold?", vi: "Vì sao chân tàu đổ bộ phải gập?" },
      options: [
        { en: "To hide them from the crew", vi: "Để giấu khỏi phi hành đoàn" },
        { en: "To fit inside the adapter during launch", vi: "Để vừa trong khoang chứa lúc phóng" },
        { en: "They are broken", vi: "Vì chúng bị hỏng" },
      ],
      answer: 1,
      why: {
        en: "The adapter is narrow. The legs unfold after the lander leaves it.",
        vi: "Khoang chứa rất hẹp. Chân chỉ bung ra sau khi tàu đổ bộ rời khỏi đó.",
      },
    },
  },
  "service-module": {
    cutaway: "module",
    parts: [
      { en: "Solar arrays and radiators", vi: "Tấm pin mặt trời và tản nhiệt" },
      { en: "Oxygen and water tanks", vi: "Bồn oxy và nước" },
      { en: "Main engine: Moon orbit and the trip home", vi: "Động cơ chính: vào quỹ đạo Mặt Trăng và đường về" },
    ],
    quiz: {
      question: { en: "What must the service module's engine be able to do?", vi: "Động cơ khoang dịch vụ phải làm được điều gì?" },
      options: [
        { en: "Restart in space, more than once", vi: "Khởi động lại trong không gian nhiều lần" },
        { en: "Burn only once", vi: "Chỉ đốt đúng một lần" },
        { en: "Run underwater", vi: "Chạy dưới nước" },
      ],
      answer: 0,
      why: {
        en: "It fires to enter Moon orbit and again to leave it. A one-shot engine would strand the crew.",
        vi: "Nó đốt để vào quỹ đạo Mặt Trăng và đốt lần nữa để rời đi. Động cơ chỉ chạy một lần sẽ bỏ kẹt phi hành đoàn.",
      },
    },
  },
  "crew-capsule": {
    cutaway: "capsule",
    parts: [
      { en: "Docking hatch and parachutes", vi: "Cửa nối tàu và dù" },
      { en: "Crew seats", vi: "Ghế phi hành đoàn" },
      { en: "Heat shield: burns away on re-entry", vi: "Tấm chắn nhiệt: cháy dần khi vào lại khí quyển" },
    ],
    quiz: {
      question: { en: "What does the heat shield do on re-entry?", vi: "Tấm chắn nhiệt làm gì khi vào lại khí quyển?" },
      options: [
        { en: "Reflects radio signals", vi: "Phản xạ sóng vô tuyến" },
        { en: "Slowly burns away, carrying the heat with it", vi: "Cháy dần, mang theo nhiệt đi cùng" },
        { en: "Gives the capsule lift", vi: "Tạo lực nâng cho khoang" },
      ],
      answer: 1,
      why: {
        en: "The ablative layer chars and flakes off, so the heat leaves with it instead of reaching the crew.",
        vi: "Lớp chống nhiệt cháy xém và bong ra, nên nhiệt đi theo nó thay vì truyền tới phi hành đoàn.",
      },
    },
  },
  "escape-tower": {
    cutaway: "tower",
    parts: [
      { en: "Abort motor: pulls the capsule away", vi: "Động cơ thoát hiểm: kéo khoang đi xa" },
      { en: "Steering motors", vi: "Động cơ điều hướng" },
      { en: "Truss: attaches to the capsule", vi: "Giàn đỡ: gắn vào khoang" },
    ],
    quiz: {
      question: { en: "When is the escape tower dropped?", vi: "Khi nào tháp thoát hiểm được bỏ đi?" },
      options: [
        { en: "Once the climb is safe", vi: "Khi cuộc bay lên đã an toàn" },
        { en: "Before the engines start", vi: "Trước khi động cơ khởi động" },
        { en: "Never", vi: "Không bao giờ" },
      ],
      answer: 0,
      why: {
        en: "It is only useful while the rocket might fail low and fast. After that it is dead weight.",
        vi: "Nó chỉ có ích khi tên lửa có thể hỏng lúc còn thấp và nhanh. Sau đó chỉ là khối lượng thừa.",
      },
    },
  },
};
