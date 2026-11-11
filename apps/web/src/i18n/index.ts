import { en, type Dictionary } from "./en";
import { vi } from "./vi";

export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const dictionaries: Record<Locale, Dictionary> = { en, vi };

/** Bilingual text attached to game data (dialogue lines, part descriptions). */
export type LocalizedText = Record<Locale, string>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export type { Dictionary };
