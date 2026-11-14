import type { LocalizedText } from "@/i18n";
import type { TraceCode } from "@/lib/simulation/launch.types";

/**
 * How a launch can end badly, one ending for each way it goes wrong. Each is a short film card:
 * a radio call from Flight, then the story told a line at a time over black and a sad pad of strings.
 */
export type LaunchEndingId = TraceCode | "budget-cut";

export interface LaunchEnding {
  id: LaunchEndingId;
  title: LocalizedText;
  /** One line under the title: what happened, in a few words. */
  tagline: LocalizedText;
  /** What Flight says over the loop, first. */
  call: LocalizedText;
  /** The story, a line at a time. */
  lines: LocalizedText[];
  /** The mission is over (no replacement vehicle): the only way on is the title screen or the inquiry. */
  final: boolean;
  /** Colour of the title: red for a loss, amber for a lost programme. */
  tone: "loss" | "programme";
}

const l = (en: string, vi: string): LocalizedText => ({ en, vi });

export const LAUNCH_ENDINGS: Record<LaunchEndingId, LaunchEnding> = {
  structural: {
    id: "structural",
    title: l("Loss of Vehicle", "Mất tàu"),
    tagline: l("Max Q: the structure gave way", "Max Q: kết cấu không chịu nổi"),
    call: l("All stations, Flight. We have lost the vehicle. I repeat, vehicle lost.", "Toàn trung tâm, Flight đây. Chúng ta đã mất tàu. Nhắc lại, mất tàu."),
    lines: [
      l("Max Q: the hardest minute of the climb. The stack was asked to carry more than it was built for.", "Max Q: phút khắc nghiệt nhất của chặng bay. Con tàu phải gánh nhiều hơn mức nó được thiết kế."),
      l("One seam gave way first. The rest of the structure followed in less than a second.", "Một mối nối bung ra trước. Phần còn lại sụp theo chưa đầy một giây."),
      l("The sky over the Cape lit up, and then it was quiet.", "Bầu trời trên mũi Canaveral bừng sáng, rồi tất cả im bặt."),
      l("In the control room nobody spoke. Every engineer there already knew why.", "Trong phòng điều khiển không ai nói gì. Mọi kỹ sư ở đó đều đã biết vì sao."),
    ],
    final: false,
    tone: "loss",
  },
  "fuel-depleted": {
    id: "fuel-depleted",
    title: l("Dry Tanks", "Cạn nhiên liệu"),
    tagline: l("The engines quit short of orbit", "Động cơ tắt khi chưa tới quỹ đạo"),
    call: l("Flight, Booster. Stage two is out. Propellant depleted. We are not making orbit.", "Flight, Booster đây. Tầng hai đã tắt. Hết nhiên liệu. Chúng ta không tới được quỹ đạo."),
    lines: [
      l("The engines shut down early, in silence, with the Earth still pulling at everything.", "Động cơ tắt sớm, trong im lặng, khi Trái Đất vẫn đang kéo mọi thứ xuống."),
      l("A rocket does not argue with arithmetic. The tanks held less than the climb required.", "Tên lửa không cãi được với phép tính. Bình chứa ít hơn những gì chặng bay cần."),
      l("The capsule coasted upward for a minute, then began to fall.", "Khoang tàu trôi lên thêm một phút, rồi bắt đầu rơi."),
      l("The last sound in the cabin was the crew breathing.", "Âm thanh cuối cùng trong khoang là tiếng thở của phi hành đoàn."),
    ],
    final: false,
    tone: "loss",
  },
  "slow-climb": {
    id: "slow-climb",
    title: l("Too Heavy", "Quá nặng"),
    tagline: l("Full thrust was not enough", "Dù hết công suất vẫn không đủ"),
    call: l("Flight, we are not accelerating. Altitude is not building. The vehicle is too heavy.", "Flight đây, tàu không tăng tốc. Độ cao không lên. Tàu quá nặng."),
    lines: [
      l("The engines burned at full thrust. It was not enough.", "Động cơ cháy hết công suất. Vẫn không đủ."),
      l("Too much weight, too little push. The rocket hung low over the Atlantic, struggling.", "Quá nhiều khối lượng, quá ít lực đẩy. Tên lửa lơ lửng thấp trên Đại Tây Dương, vật lộn."),
      l("It never reached the speed that holds a spacecraft in orbit.", "Nó không bao giờ đạt được tốc độ giữ một con tàu ở lại quỹ đạo."),
      l("Somewhere in the dark water, the pieces came down.", "Ở đâu đó trên mặt nước tối, các mảnh vỡ rơi xuống."),
    ],
    final: false,
    tone: "loss",
  },
  "wind-shear": {
    id: "wind-shear",
    title: l("Torn by the Wind", "Xé toạc bởi gió"),
    tagline: l("Launched past the weather limits", "Phóng vượt giới hạn thời tiết"),
    call: l("Flight, severe wind shear. We have lost guidance. We have lost the vehicle.", "Flight đây, gió cắt cực mạnh. Mất dẫn đường. Chúng ta mất tàu."),
    lines: [
      l("The wind aloft was stronger than the limits allowed. The warning was on the console.", "Gió trên cao mạnh hơn giới hạn cho phép. Cảnh báo đã hiện sẵn trên bảng điều khiển."),
      l("The vehicle turned sideways in the shear, and the air did the rest.", "Con tàu xoay ngang trong lớp gió cắt, và phần còn lại là việc của không khí."),
      l("Launch commit criteria exist for a reason. They are written in lost vehicles.", "Tiêu chí phóng tồn tại là có lý do. Chúng được viết bằng những con tàu đã mất."),
      l("There is no second rocket on the pad. The inquiry opens in the morning.", "Không có tên lửa thứ hai trên bệ. Cuộc điều tra sẽ mở vào sáng mai."),
    ],
    final: true,
    tone: "loss",
  },
  lightning: {
    id: "lightning",
    title: l("Struck from the Sky", "Bị sét đánh"),
    tagline: l("A storm on the pad, and a rocket in it", "Giông bão trên bệ phóng, và tên lửa lao vào giữa"),
    call: l("Flight, we have lost telemetry. All of it. Lightning. We have lost the vehicle.", "Flight đây, mất toàn bộ dữ liệu. Sét. Chúng ta mất tàu."),
    lines: [
      l("Storm clouds hung over the pad. The rocket's own exhaust gave the lightning a path.", "Mây giông phủ kín bệ phóng. Chính luồng khí thải của tên lửa đã mở đường cho tia sét."),
      l("A bolt followed the plume up. Every system went dark at once.", "Một tia sét theo luồng lửa chạy lên. Mọi hệ thống tắt ngúm cùng lúc."),
      l("Apollo 12 survived a strike like this, by luck. This crew had less of it.", "Apollo 12 từng sống sót sau một cú sét như vậy, nhờ may mắn. Phi hành đoàn này không may mắn đến thế."),
      l("There is no second rocket on the pad. The inquiry opens in the morning.", "Không có tên lửa thứ hai trên bệ. Cuộc điều tra sẽ mở vào sáng mai."),
    ],
    final: true,
    tone: "loss",
  },
  "budget-cut": {
    id: "budget-cut",
    title: l("Funding Withdrawn", "Bị cắt kinh phí"),
    tagline: l("Orbit reached. The programme did not survive", "Lên được quỹ đạo. Chương trình thì không"),
    call: l("All stations, Flight. Good orbit. Crew is safe. But I am told the money has run out.", "Toàn trung tâm, Flight đây. Quỹ đạo tốt. Phi hành đoàn an toàn. Nhưng tôi nghe nói tiền đã hết."),
    lines: [
      l("The vehicle reached orbit. The crew was safe, and the flight was perfect.", "Con tàu lên tới quỹ đạo. Phi hành đoàn an toàn, chuyến bay hoàn hảo."),
      l("But the programme had spent far more than it was ever given.", "Nhưng chương trình đã tiêu nhiều hơn rất nhiều so với những gì được cấp."),
      l("The vote came the following week. The Moon landings were cancelled.", "Cuộc bỏ phiếu diễn ra tuần sau đó. Các chuyến đổ bộ Mặt Trăng bị huỷ."),
      l("We reached orbit. We never went any further.", "Chúng ta đã lên được quỹ đạo. Và không đi xa hơn nữa."),
    ],
    final: true,
    tone: "programme",
  },
};

/**
 * Which ending a failed flight gets. An overweight vehicle fails twice (it cannot climb, then runs dry),
 * and the first is the real cause, so the order below is by cause rather than by time.
 */
const CAUSE_ORDER: TraceCode[] = ["lightning", "wind-shear", "slow-climb", "structural", "fuel-depleted"];
export function endingForFailure(trace: { code: TraceCode }[]): LaunchEnding {
  const cause = CAUSE_ORDER.find((c) => trace.some((s) => s.code === c));
  return LAUNCH_ENDINGS[cause ?? "structural"];
}
