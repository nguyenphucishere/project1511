import { describe, expect, it } from "vitest";
import { voiceKey } from "@/game/voiceKey";
import manifest from "../../../public/assets/voice/manifest.json";
import { PHASES, RADIO_LOG, radioLineAt } from "./story";

const M = manifest as unknown as { lines: Record<string, { d?: number }> };
const seconds = (locale: "en" | "vi", text: string) => {
  const d = M.lines[voiceKey(locale, text)]?.d;
  if (d === undefined) throw new Error(`no recording (or no length) for "${text}" (${locale})`);
  return d;
};

describe("the radio traffic of the entry and recovery", () => {
  for (const locale of ["en", "vi"] as const) {
    it(`every line is recorded and finishes before the next one starts (${locale})`, () => {
      const trouble: string[] = [];
      RADIO_LOG.forEach((l, i) => {
        const next = RADIO_LOG[i + 1]?.t ?? Infinity;
        const len = seconds(locale, l.text[locale]);
        if (l.t + len > next - 0.1) trouble.push(`"${l.text.en}" at ${l.t.toFixed(1)} s runs ${len} s, the next line is at ${next.toFixed(1)} s`);
      });
      expect(trouble).toEqual([]);
    });
  }

  it("shows a line while it is heard and clears before the next", () => {
    const first = RADIO_LOG[0]!;
    expect(radioLineAt(first.t - 0.1)).toBeUndefined();
    expect(radioLineAt(first.t + 0.5)).toBe(first);
    for (let i = 1; i < RADIO_LOG.length; i++) expect(radioLineAt(RADIO_LOG[i]!.t + 0.05)).toBe(RADIO_LOG[i]);
  });

  it("every title of the way home has its recording", () => {
    for (const p of PHASES.filter((x) => x.from >= 140)) {
      expect(seconds("en", p.text.en)).toBeGreaterThan(0);
      expect(seconds("vi", p.text.vi)).toBeGreaterThan(0);
    }
  });
});

describe("the notes read on the glide home", () => {
  it("each is recorded and fits the time it is on screen, in both languages", async () => {
    const { HOME_NOTES } = await import("./story");
    for (const locale of ["en", "vi"] as const)
      for (const n of HOME_NOTES) expect(seconds(locale, n.text[locale])).toBeLessThanOrEqual(n.to - n.from);
  });
});
