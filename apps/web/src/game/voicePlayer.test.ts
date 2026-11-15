import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lookupVoice, type VoiceManifest } from "./voicePlayer";
import { voiceKey } from "./voiceKey";

const manifest: VoiceManifest = {
  version: 1,
  roles: { kranz: { radio: true }, narrator: { radio: false } },
  lines: {
    [voiceKey("en", "Weather is GO.")]: { f: "en/a.mp3", role: "kranz" },
    [voiceKey("vi", "Thời tiết GO.")]: { f: "vi/b.mp3", role: "kranz" },
    [voiceKey("en", "Three days of silence")]: { f: "en/c.mp3", role: "narrator" },
  },
};

describe("lookupVoice", () => {
  it("finds a recording by language and exact words", () => {
    expect(lookupVoice(manifest, "en", "Weather is GO.")).toEqual({ file: "en/a.mp3", role: "kranz", radio: true });
    expect(lookupVoice(manifest, "vi", "Thời tiết GO.")?.file).toBe("vi/b.mp3");
  });

  it("follows the speaker for the radio filter", () => {
    expect(lookupVoice(manifest, "en", "Weather is GO.")?.radio).toBe(true);
    expect(lookupVoice(manifest, "en", "Three days of silence")?.radio).toBe(false);
  });

  it("ignores whitespace differences but not different words or the other language", () => {
    expect(lookupVoice(manifest, "en", "  Weather   is GO. ")).not.toBeNull();
    expect(lookupVoice(manifest, "en", "Weather is NO-GO.")).toBeNull();
    expect(lookupVoice(manifest, "vi", "Weather is GO.")).toBeNull();
  });

  it("returns null without a manifest (the caller falls back)", () => {
    expect(lookupVoice(null, "en", "Weather is GO.")).toBeNull();
  });
});

// The recordings are generated (tools/voice/generate.mjs) and committed. If a line was added or
// reworded and the voices were not regenerated, this fails and says which ones are missing.
describe("recorded voice library", () => {
  const root = resolve(__dirname, "../../../..");
  const voiceDir = resolve(root, "apps/web/public/assets/voice");
  const linesFile = resolve(root, "tools/voice/lines.json");
  const manifestFile = resolve(voiceDir, "manifest.json");
  const ready = existsSync(linesFile) && existsSync(manifestFile);

  it.skipIf(!ready)("has an English and a Vietnamese file for every line in tools/voice/lines.json", () => {
    const lines = (JSON.parse(readFileSync(linesFile, "utf8")) as { lines: { role: string; en: string; vi: string; src: string }[] }).lines;
    const lib = JSON.parse(readFileSync(manifestFile, "utf8")) as VoiceManifest;
    const missing: string[] = [];
    for (const l of lines) {
      for (const loc of ["en", "vi"] as const) {
        const entry = lib.lines[voiceKey(loc, l[loc])];
        if (!entry || !existsSync(resolve(voiceDir, entry.f))) missing.push(`${l.src} [${loc}] ${l[loc].slice(0, 40)}`);
        else if (entry.role !== l.role && loc === "en") missing.push(`${l.src}: recorded for ${entry.role}, now ${l.role}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.skipIf(!ready)("only names roles that exist in the voice config", () => {
    const lib = JSON.parse(readFileSync(manifestFile, "utf8")) as VoiceManifest;
    const cfg = JSON.parse(readFileSync(resolve(root, "tools/voice/voices.json"), "utf8")) as { roles: Record<string, unknown> };
    for (const e of Object.values(lib.lines)) expect(Object.keys(cfg.roles)).toContain(e.role);
  });
});
