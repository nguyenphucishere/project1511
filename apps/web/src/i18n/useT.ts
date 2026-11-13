"use client";

import { useSettingsStore } from "@/game/settingsStore";
import { dictionaries, type Dictionary, type LocalizedText } from "./index";

/** UI strings for the current locale: `const t = useT(); t.common.close`. */
export function useT(): Dictionary {
  return dictionaries[useSettingsStore((s) => s.locale)];
}

/** Picks the current-locale string from bilingual game data. */
export function useLocalized(): (text: LocalizedText) => string {
  const locale = useSettingsStore((s) => s.locale);
  return (text) => text[locale];
}
