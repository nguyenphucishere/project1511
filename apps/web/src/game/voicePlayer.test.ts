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

// ---- channels: a narrator and a crew member must be heard together, not one after the other
describe("voice channels", () => {
  class FakeAudio {
    static all: FakeAudio[] = [];
    paused = false;
    playbackRate = 1;
    preservesPitch = true;
    preload = "";
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public src: string) {
      FakeAudio.all.push(this);
    }
    play() {
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute() {}
    load() {}
    /** The recording ran to its end. */
    finish() {
      this.onended?.();
    }
  }
  const node = (): any => ({ connect: (x: unknown) => x, disconnect() {}, gain: { value: 0 }, frequency: { value: 0 }, start() {}, stop() {} });
  const ctx: any = { createMediaElementSource: node, createGain: node, createBiquadFilter: node, createWaveShaper: node, createOscillator: node, createBufferSource: node };
  const lines = {
    [voiceKey("en", "Computer line")]: { f: "en/guide.m4a", role: "narrator" },
    [voiceKey("en", "Crew line one")]: { f: "en/crew1.m4a", role: "armstrong" },
    [voiceKey("en", "Crew line two")]: { f: "en/crew2.m4a", role: "aldrin" },
  };
  const lib = { version: 1, roles: { narrator: { radio: false }, armstrong: { radio: false }, aldrin: { radio: false } }, lines };

  async function setup() {
    FakeAudio.all = [];
    (globalThis as any).Audio = FakeAudio;
    (globalThis as any).fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(lib) });
    const { createVoicePlayer } = await import("./voicePlayer");
    const duck: boolean[] = [];
    const player = createVoicePlayer({ audio: () => ({ c: ctx, out: node(), voice: node() }), enabled: () => true, noise: () => ({}) as AudioBuffer, duck: (on) => duck.push(on) });
    return { player, duck };
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("plays two channels at the same time", async () => {
    const { player } = await setup();
    await player.play("Computer line", "en", { channel: "guide" });
    await player.play("Crew line one", "en", { channel: "crew" });
    await flush();
    expect(FakeAudio.all).toHaveLength(2);
    expect(FakeAudio.all.every((a) => !a.paused)).toBe(true);
  });

  it("starts a crew line at once even while the guide is still speaking", async () => {
    const { player } = await setup();
    await player.play("Computer line", "en", { channel: "guide", queue: true });
    await player.play("Crew line one", "en", { channel: "crew", queue: true });
    expect(FakeAudio.all.map((a) => a.src)).toEqual(["/assets/voice/en/guide.m4a", "/assets/voice/en/crew1.m4a"]);
  });

  it("lets a new line in a channel replace the one it is saying, without touching other channels", async () => {
    const { player } = await setup();
    await player.play("Computer line", "en", { channel: "guide" });
    await player.play("Crew line one", "en", { channel: "crew" });
    await player.play("Crew line two", "en", { channel: "crew" });
    const [guide, one, two] = FakeAudio.all;
    expect(guide.paused).toBe(false);
    expect(one.paused).toBe(true);
    expect(two.paused).toBe(false);
  });

  it("makes queued lines in one channel wait for each other", async () => {
    const { player } = await setup();
    await player.play("Crew line one", "en", { channel: "crew", queue: true });
    await player.play("Crew line two", "en", { channel: "crew", queue: true });
    expect(FakeAudio.all).toHaveLength(1);
    FakeAudio.all[0].finish();
    await flush();
    expect(FakeAudio.all).toHaveLength(2);
  });

  it("keeps the rest of the mix ducked until every channel has finished", async () => {
    const { player, duck } = await setup();
    await player.play("Computer line", "en", { channel: "guide" });
    await player.play("Crew line one", "en", { channel: "crew" });
    FakeAudio.all[0].finish();
    expect(duck.at(-1)).toBe(true); // the crew line is still going
    FakeAudio.all[1].finish();
    expect(duck.at(-1)).toBe(false);
  });

  it("stops one channel, or all of them", async () => {
    const { player } = await setup();
    await player.play("Computer line", "en", { channel: "guide" });
    await player.play("Crew line one", "en", { channel: "crew" });
    player.stop("crew");
    expect(FakeAudio.all.map((a) => a.paused)).toEqual([false, true]);
    player.stop();
    expect(FakeAudio.all.every((a) => a.paused)).toBe(true);
  });

  it("reports how long a recording is", async () => {
    const { player } = await setup();
    (lib.lines as Record<string, { f: string; role: string; d?: number }>)[voiceKey("en", "Crew line one")].d = 2.4;
    expect(await player.duration("Crew line one", "en")).toBe(2.4);
    expect(await player.duration("No such line", "en")).toBeNull();
  });
});
