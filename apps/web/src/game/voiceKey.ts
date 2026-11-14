/**
 * Recorded voice lines are looked up by what is being said, not by an id threaded through every
 * scene: the key is a hash of the language and the exact words. The generator (tools/voice) and
 * the game both import this file, so a line that is generated is a line that is found, and any
 * place that already calls speak(text) gets the recorded voice for free.
 */

export type VoiceLocale = "en" | "vi";

/** Whitespace differences must not change which recording a line maps to. */
export function normalizeVoiceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function fnv1a(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const hex8 = (n: number) => n.toString(16).padStart(8, "0");

/** "en-3fa91c20b7d4e815": 64 bits from two differently seeded FNV-1a passes. */
export function voiceKey(locale: VoiceLocale, text: string): string {
  const t = `${locale}|${normalizeVoiceText(text)}`;
  return `${locale}-${hex8(fnv1a(t, 0x811c9dc5))}${hex8(fnv1a(t, 0x9747b28c))}`;
}
