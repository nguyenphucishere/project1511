import type { LocalizedText } from "@/i18n";
import type { BriefingId } from "./script";
import type { CharacterId } from "./characters";

/**
 * A short spoken moment shown just before a chapter's briefing: one person, a few lines, and
 * one number that sums up the weight of what is about to be asked of the player.
 */
export interface Interlude {
  speaker: CharacterId;
  /** A real photograph of the speaker, shown instead of the illustrated portrait. */
  photo?: { src: string; credit: string };
  /** The figure shown big beside the portrait, and what it counts. */
  stat?: { value: string; label: LocalizedText };
  lines: LocalizedText[];
}

const l = (en: string, vi: string): LocalizedText => ({ en, vi });

export const INTERLUDES: Partial<Record<BriefingId, Interlude>> = {
  "mission-control": {
    speaker: "armstrong",
    photo: { src: "/assets/characters/armstrong.webp", credit: "NASA S69-31741" },
    // Ranger 1 to 6 (1961-1964): six lunar probes in a row, none of which sent back a picture.
    stat: { value: "6", label: l("failures: Ranger 1 to 6, 1961 to 1964", "lần thất bại: Ranger 1 đến 6, 1961 đến 1964") },
    lines: [
      l(
        "To reach the Moon, we failed six times in a row. Six Ranger probes, and not one sent back a picture.",
        "Để bay tới Mặt Trăng, chúng tôi đã thất bại sáu lần liên tiếp. Sáu tàu thăm dò Ranger, không chiếc nào gửi về được một bức ảnh.",
      ),
      l("Then a fire on the pad took three of my friends.", "Rồi một đám cháy trên bệ phóng đã lấy đi ba người bạn của tôi."),
      l("Every time we fell, we got up and did it better.", "Mỗi lần ngã xuống, chúng tôi lại đứng dậy và làm tốt hơn."),
      l("And you? How long will it take you to reach the Moon?", "Còn bạn? Bạn sẽ mất bao lâu để lên được Mặt Trăng?"),
    ],
  },
};
