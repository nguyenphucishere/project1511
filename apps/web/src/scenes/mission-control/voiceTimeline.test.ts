import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { voiceKey } from "@/game/voiceKey";
import manifest from "../../../public/assets/voice/manifest.json";
import { CALLOUTS } from "./callouts";

const M = manifest as unknown as { lines: Record<string, { f: string; d?: number }> };
const VOICE_DIR = resolve(__dirname, "../../../public/assets/voice");

/** How long the recording of a line is, in seconds. */
function secondsOf(locale: "en" | "vi", text: string): number {
  const e = M.lines[voiceKey(locale, text)];
  if (!e) throw new Error(`no recording of "${text}" (${locale})`);
  if (e.d === undefined) throw new Error(`recording of "${text}" (${locale}) has no length in the manifest`);
  return e.d;
}

describe("the launch radio calls against the film", () => {
  for (const locale of ["en", "vi"] as const) {
    it(`every call is recorded, with its length, and finishes before the next one (${locale})`, () => {
      const trouble: string[] = [];
      CALLOUTS.forEach((c, i) => {
        const len = secondsOf(locale, c.line[locale]);
        const next = CALLOUTS[i + 1]?.t ?? Infinity;
        if (c.t + len > next - 0.1) trouble.push(`"${c.line.en}" at ${c.t.toFixed(1)} s runs ${len} s but the next call is at ${next.toFixed(1)} s`);
      });
      expect(trouble).toEqual([]);
    });
  }
});

describe("the voice library", () => {
  it("every recording in the manifest exists on disk and has its length", () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(M.lines)) {
      if (!existsSync(resolve(VOICE_DIR, e.f))) bad.push(`${key}: file ${e.f} is missing`);
      else if (!(typeof e.d === "number" && e.d > 0)) bad.push(`${key}: no length`);
    }
    expect(bad).toEqual([]);
  });
});
