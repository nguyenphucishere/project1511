import type { LocalizedText } from "@/i18n";

export type CharacterId = "astronaut" | "engineer" | "flight-director" | "doctor" | "workshop-chief";

/** Shape of the built-in pixel placeholder until the artist's PNG is delivered. */
export type PlaceholderHead = "helmet" | "cap" | "headset";

export interface Character {
  id: CharacterId;
  /** Key in assets.json "portraits". */
  portraitId: string;
  name: LocalizedText;
  role: LocalizedText;
  placeholder: PlaceholderHead;
}

// Names other than ArmStrong are working names until the team confirms them.
export const CHARACTERS: Record<CharacterId, Character> = {
  astronaut: {
    id: "astronaut",
    portraitId: "astronaut",
    name: { en: "ArmStrong", vi: "ArmStrong" },
    role: { en: "Astronaut", vi: "Phi hành gia" },
    placeholder: "helmet",
  },
  engineer: {
    id: "engineer",
    portraitId: "engineer",
    name: { en: "Kai", vi: "Kai" },
    role: { en: "Launch engineer", vi: "Kỹ sư phóng" },
    placeholder: "cap",
  },
  "flight-director": {
    id: "flight-director",
    portraitId: "flight-director",
    name: { en: "Director Vega", vi: "Chỉ huy Vega" },
    role: { en: "Flight director", vi: "Chỉ huy bay" },
    placeholder: "headset",
  },
  doctor: {
    id: "doctor",
    portraitId: "doctor",
    name: { en: "Dr. Lin", vi: "Bác sĩ Lin" },
    role: { en: "Flight surgeon", vi: "Bác sĩ hàng không" },
    placeholder: "headset",
  },
  "workshop-chief": {
    id: "workshop-chief",
    portraitId: "workshop-chief",
    name: { en: "Chief Bao", vi: "Trưởng xưởng Bảo" },
    role: { en: "Workshop chief", vi: "Trưởng xưởng" },
    placeholder: "cap",
  },
};
