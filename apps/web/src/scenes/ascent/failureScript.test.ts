import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { voiceKey } from "@/game/voiceKey";
import type { VoiceManifest } from "@/game/voicePlayer";
import { FAIL_BOOM_AT } from "@/game/ascentFlight";
import { difference, FAILURE_CODES } from "./failureDiff";
import { FLAVOR, SCRIPT, type Cue } from "./failureScript";

/** The warnings last about this long before the engines quit. */
const TROUBLE_SECONDS = 15;
/** A line may not run into the blast that ends the film. */
const FAIL_LAST_END = FAIL_BOOM_AT - 0.3;

const root = resolve(__dirname, "../../../../..");
const manifestFile = resolve(root, "apps/web/public/assets/voice/manifest.json");
const ready = existsSync(manifestFile);
const lib = ready ? (JSON.parse(readFileSync(manifestFile, "utf8")) as VoiceManifest) : null;

const voiced = (cues: Cue[]) => cues.filter((c) => c.line);

describe("failure scripts: the voices keep to the picture", () => {
  for (const code of FAILURE_CODES) {
    const cues = SCRIPT[code];

    it(`${code}: cues come in order within each phase`, () => {
      for (const phase of ["trouble", "failing"] as const) {
        const times = cues.filter((c) => c.phase === phase).map((c) => c.at);
        expect(times).toEqual([...times].sort((a, b) => a - b));
      }
    });

    it(`${code}: no shot overlaps the next, and everything ends before the next phase`, () => {
      for (const phase of ["trouble", "failing"] as const) {
        const list = cues.filter((c) => c.phase === phase);
        list.forEach((c, i) => {
          const end = c.at + c.ms / 1000;
          const next = list[i + 1];
          if (next) expect(end, `${code} ${phase}@${c.at} runs into the cut at ${next.at}`).toBeLessThanOrEqual(next.at + 1e-6);
        });
        const last = list[list.length - 1];
        const limit = phase === "trouble" ? TROUBLE_SECONDS : FAIL_LAST_END;
        expect(last.at + last.ms / 1000, `${code} ${phase} ends too late`).toBeLessThanOrEqual(limit);
      }
    });

    it(`${code}: shows its own instrument at least twice`, () => {
      expect(cues.filter((c) => c.shot === "gauge").length).toBeGreaterThanOrEqual(2);
    });

    it.skipIf(!ready)(`${code}: every spoken line has a recording in both languages, and is on screen for all of it`, () => {
      for (const c of voiced(cues)) {
        for (const loc of ["en", "vi"] as const) {
          const entry = lib!.lines[voiceKey(loc, c.line![loc])];
          expect(entry, `${code} ${loc} "${c.line![loc]}" has no recording`).toBeTruthy();
          expect(entry.d, `${code} ${loc} "${c.line![loc]}": run node tools/voice/generate.mjs --durations`).toBeDefined();
          expect(c.ms / 1000, `${code}@${c.at} "${c.line![loc]}" lasts ${entry.d}s but is shown ${c.ms / 1000}s`).toBeGreaterThanOrEqual(entry.d! + 0.04);
        }
      }
    });
  }
});

describe("failure scripts: five different films", () => {
  const pairs = FAILURE_CODES.flatMap((a, i) => FAILURE_CODES.slice(i + 1).map((b) => [a, b] as const));

  it("share no spoken line", () => {
    const seen = new Map<string, string>();
    for (const code of FAILURE_CODES)
      for (const c of voiced(SCRIPT[code])) {
        const key = c.line!.en.toLowerCase();
        expect(seen.has(key), `"${c.line!.en}" is said in both ${seen.get(key)} and ${code}`).toBe(false);
        seen.set(key, code);
      }
  });

  it("each has its own light, glass, instrument and sound", () => {
    for (const field of ["glow", "gauge", "helmet", "bed"] as const) {
      const values = FAILURE_CODES.map((c) => FLAVOR[c][field]);
      expect(new Set(values).size, `${field} repeats: ${values.join(", ")}`).toBe(FAILURE_CODES.length);
    }
  });

  for (const [a, b] of pairs) {
    it(`${a} and ${b} differ by more than 80%`, () => {
      const d = difference(a, b);
      expect(d.overall, JSON.stringify(d)).toBeGreaterThan(0.8);
      // No single side of the film may carry the sameness.
      for (const part of ["text", "rhythm", "cutting", "look"] as const) expect(d[part], `${part}: ${JSON.stringify(d)}`).toBeGreaterThan(0.6);
    });
  }
});
