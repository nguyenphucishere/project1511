import type { TraceEvent } from "./voiceTrace";
import { voiceKey, type VoiceLocale } from "./voiceKey";

/**
 * Plays the recorded voice lines in public/assets/voice (made by tools/voice). A line is found by
 * its language and exact words, so anything that already says speak("some text") gets the
 * recording; a line with no recording simply returns false and the caller falls back to the
 * browser's speech synthesis.
 */

export interface VoiceManifest {
  version: number;
  roles: Record<string, { radio: boolean }>;
  /** `d` is the length of the recording in seconds (see tools/voice: `generate.mjs --durations`). */
  lines: Record<string, { f: string; role: string; d?: number }>;
}

export interface VoiceEntry {
  file: string;
  /** Length of the recording in seconds, when the manifest says. */
  duration?: number;
  role: string;
  /** This speaker comes over a radio, so the game filters the voice like one. */
  radio: boolean;
}

/** Pure lookup, kept separate from the audio so it can be tested. */
export function lookupVoice(manifest: VoiceManifest | null, locale: VoiceLocale, text: string): VoiceEntry | null {
  if (!manifest) return null;
  const hit = manifest.lines[voiceKey(locale, text)];
  if (!hit) return null;
  return { file: hit.f, role: hit.role, radio: manifest.roles[hit.role]?.radio ?? false, duration: hit.d };
}

export interface VoiceDeps {
  audio: () => { c: AudioContext; out: AudioNode; voice?: AudioNode } | null;
  /** Called with true while a voice is speaking and false once none is: the rest of the mix ducks. */
  duck?: (on: boolean) => void;
  enabled: () => boolean;
  noise: (c: AudioContext) => AudioBuffer;
  /** Hears everything the player does, for the independent watcher (see ./voiceTrace.ts). */
  trace?: (e: TraceEvent) => void;
  now?: () => number;
}

/**
 * played      a recording started (or was queued)
 * missing     the voice library loaded, but there is no recording of this line: stay silent
 * unavailable the library could not be loaded, or the browser would not play it: the caller may fall back
 */
export type PlayResult = "played" | "missing" | "unavailable";

export interface PlayOptions {
  /**
   * Which line of voices this one belongs to. Lines in the same channel take turns (or cut each other off);
   * lines in different channels play at the same time, so a narrator and a crew member are both heard.
   * Default "main".
   */
  channel?: string;
  /** true / false forces the radio filter; undefined follows the speaker (kranz, capcom... are on the radio). */
  radio?: boolean;
  /** The open-channel hiss under a radio voice. Default on whenever the radio filter is on. */
  hiss?: boolean;
  /** Wait for the line that is playing instead of cutting it off. */
  queue?: boolean;
  /** Called when the recording ends (not when it is cut off). */
  onEnd?: () => void;
  /** Playback speed, 1 = as recorded (the pitch is kept): the crew in a crisis talk fast. */
  rate?: number;
  /** 0 to 1: a voice in panic. Higher and faster, shaking, strained and distorted; on the radio, rougher and hissing. */
  panic?: number;
}

const BASE = "/assets/voice/";
/** The master bus sits at half volume for the effects; a voice has to be heard over them. */
const VOICE_GAIN = 1.8;

function radioCurve(k: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

export function createVoicePlayer(deps: VoiceDeps) {
  let manifest: VoiceManifest | null = null;
  let loading: Promise<VoiceManifest | null> | null = null;
  /** One channel is one speaker line-up: its own current line, its own waiting list. */
  interface Channel {
    token: number;
    current: { stop: () => void } | null;
    waiting: Array<() => void>;
  }
  const channels = new Map<string, Channel>();
  const channel = (name = "main"): Channel => {
    let c = channels.get(name);
    if (!c) channels.set(name, (c = { token: 0, current: null, waiting: [] }));
    return c;
  };
  let activeVoices = 0;
  let lastId = 0;
  const clock = () => (deps.now ?? (() => performance.now()))();
  /** Recordings already downloaded, as in-memory blobs: playing one never waits on the network. */
  const cached = new Map<string, string>();
  const fetching = new Map<string, Promise<void>>();

  /** Downloads one recording into memory (once). A failure leaves it to be fetched when it is played. */
  function fetchFile(file: string): Promise<void> {
    if (cached.has(file)) return Promise.resolve();
    let p = fetching.get(file);
    if (!p) {
      p = fetch(`${BASE}${file}`)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((b) => void cached.set(file, URL.createObjectURL(b)))
        .catch(() => undefined)
        .finally(() => fetching.delete(file));
      fetching.set(file, p);
    }
    return p;
  }

  function load(): Promise<VoiceManifest | null> {
    if (manifest) return Promise.resolve(manifest);
    loading ??= fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<VoiceManifest>) : null))
      .then((m) => (manifest = m))
      .catch(() => null);
    return loading;
  }

  function stopChannel(ch: Channel) {
    ch.token++;
    ch.waiting = [];
    const c = ch.current;
    ch.current = null;
    c?.stop();
  }
  /** Stops one channel, or every channel when none is named. */
  function stop(name?: string) {
    if (name !== undefined) stopChannel(channel(name));
    else for (const ch of channels.values()) stopChannel(ch);
  }

  function begin(entry: VoiceEntry, opts: PlayOptions, my: number, ch: Channel, id: number): Promise<PlayResult> {
    const a = deps.audio();
    if (!a) return Promise.resolve("unavailable");
    const { c } = a;
    const out = a.voice ?? a.out;
    const el = new Audio(cached.get(entry.file) ?? `${BASE}${entry.file}`);
    el.preload = "auto";
    const panic = Math.min(1, Math.max(0, opts.panic ?? 0));
    if (opts.rate || panic > 0) {
      el.playbackRate = (opts.rate ?? 1) * (1 + 0.2 * panic);
      // Faster and higher: the pitch rises with the speed, as a voice does when the throat tightens.
      if (panic > 0) el.preservesPitch = false;
    }
    const nodes: AudioNode[] = [];
    let hiss: AudioBufferSourceNode | null = null;
    let finished = false;

    activeVoices++;
    deps.duck?.(true);
    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (--activeVoices <= 0) {
        activeVoices = 0;
        deps.duck?.(false);
      }
      try { hiss?.stop(); } catch { /* already stopped */ }
      for (const n of nodes) n.disconnect();
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
    const self = {
      stop: () => {
        if (!finished) deps.trace?.({ k: "cut", id, t: clock() });
        cleanup();
      },
    };
    const ended = () => {
      const wasCurrent = ch.current === self;
      if (!finished) deps.trace?.({ k: "end", id, t: clock() });
      cleanup();
      if (wasCurrent) ch.current = null;
      opts.onEnd?.();
      if (my === ch.token) ch.waiting.shift()?.();
    };

    try {
      const raw = c.createMediaElementSource(el);
      let src: AudioNode = raw;
      if (panic > 0) {
        // Strained: pushed into soft clipping, with a tremble in the level like a shaking voice.
        const drive = c.createWaveShaper();
        drive.curve = radioCurve(2 + panic * 14);
        const tremble = c.createGain();
        tremble.gain.value = 1 - 0.22 * panic;
        const lfo = c.createOscillator();
        lfo.frequency.value = 6 + panic * 4;
        const depth = c.createGain();
        depth.gain.value = 0.22 * panic;
        lfo.connect(depth).connect(tremble.gain);
        lfo.start();
        raw.connect(drive).connect(tremble);
        src = tremble;
        nodes.push(drive, tremble, lfo, depth);
      }
      const gain = c.createGain();
      gain.gain.value = VOICE_GAIN;
      nodes.push(raw, gain);
      const radio = opts.radio ?? entry.radio;
      if (radio) {
        // Band-limited like a transmitter: a narrow band, a presence bump, a touch of saturation.
        const hp = Object.assign(c.createBiquadFilter(), { type: "highpass" as BiquadFilterType });
        hp.frequency.value = 380;
        const lp = Object.assign(c.createBiquadFilter(), { type: "lowpass" as BiquadFilterType });
        lp.frequency.value = 3200;
        const mid = Object.assign(c.createBiquadFilter(), { type: "peaking" as BiquadFilterType });
        mid.frequency.value = 1500;
        mid.gain.value = 5;
        const ws = c.createWaveShaper();
        ws.curve = radioCurve(10 + panic * 14);
        ws.oversample = "2x";
        src.connect(hp).connect(lp).connect(mid).connect(ws).connect(gain).connect(out);
        nodes.push(hp, lp, mid, ws);
        if (opts.hiss ?? true) {
          hiss = c.createBufferSource();
          hiss.buffer = deps.noise(c);
          hiss.loop = true;
          const band = Object.assign(c.createBiquadFilter(), { type: "bandpass" as BiquadFilterType });
          band.frequency.value = 1900;
          band.Q.value = 0.7;
          const hg = c.createGain();
          hg.gain.value = 0.01 + 0.05 * panic;
          hiss.connect(band).connect(hg).connect(out);
          hiss.start();
          nodes.push(band, hg);
        }
      } else {
        src.connect(gain).connect(out);
      }
    } catch (e) {
      console.warn("[voice] could not build the audio chain", e);
      cleanup();
      return Promise.resolve("unavailable");
    }

    ch.current = self;
    el.onended = ended;
    el.onerror = () => {
      const wasCurrent = ch.current === self;
      if (!finished) deps.trace?.({ k: "cut", id, t: clock() });
      cleanup();
      if (wasCurrent) ch.current = null;
    };
    return el.play().then(
      (): PlayResult => {
        deps.trace?.({ k: "start", id, t: clock() });
        return "played";
      },
      (): PlayResult => {
        if (ch.current === self) ch.current = null;
        cleanup();
        return "unavailable";
      },
    );
  }

  /** Plays the recording of `text`, if there is one. */
  async function play(text: string, locale: VoiceLocale, opts: PlayOptions = {}): Promise<PlayResult> {
    if (!deps.enabled()) return "unavailable";
    const m = await load();
    if (!m) return "unavailable";
    const entry = lookupVoice(m, locale, text);
    if (!entry) {
      deps.trace?.({ k: "missing", text, ch: opts.channel ?? "main", t: clock() });
      return "missing";
    }
    const ch = channel(opts.channel);
    const id = ++lastId;
    deps.trace?.({ k: "request", id, text, ch: opts.channel ?? "main", t: clock(), d: entry.duration, queued: Boolean(opts.queue && ch.current) });
    if (opts.queue && ch.current) {
      const my = ch.token;
      ch.waiting.push(() => {
        if (my === ch.token && deps.enabled()) {
          deps.trace?.({ k: "ready", id, t: clock() });
          void begin(entry, opts, my, ch, id);
        }
      });
      return "played";
    }
    // A line that does not queue replaces what its own channel is saying; other channels carry on.
    if (!opts.queue) stopChannel(ch);
    return begin(entry, opts, ++ch.token, ch, id);
  }

  /** Downloads the recording of a line ahead of time, so it starts the instant it is wanted. */
  async function prefetch(text: string, locale: VoiceLocale): Promise<void> {
    const entry = lookupVoice(await load(), locale, text);
    if (!entry) return;
    await fetchFile(entry.file);
  }

  /**
   * Downloads every recording of one language into memory, a few at a time, so no line is ever fetched
   * while the game is running. Resolves when all are in (or have failed: those are fetched on demand).
   */
  async function warmAll(locale: VoiceLocale, onProgress?: (done: number, total: number) => void, concurrency = 6): Promise<{ total: number; failed: number }> {
    const m = await load();
    if (!m) return { total: 0, failed: 0 };
    const files = [...new Set(Object.values(m.lines).map((l) => l.f).filter((f) => f.startsWith(`${locale}/`)))];
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const f = files[next++]!;
        await fetchFile(f);
        onProgress?.(++done, files.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
    return { total: files.length, failed: files.filter((f) => !cached.has(f)).length };
  }

  /** How long the recording of this line is, in seconds (null when unknown or there is none). */
  async function duration(text: string, locale: VoiceLocale): Promise<number | null> {
    return lookupVoice(await load(), locale, text)?.duration ?? null;
  }

  /** True when a recording of this line exists (the manifest must have loaded, which play() does first). */
  async function has(text: string, locale: VoiceLocale): Promise<boolean> {
    return lookupVoice(await load(), locale, text) !== null;
  }

  return { play, stop, has, load, duration, prefetch, warmAll };
}

export type VoicePlayer = ReturnType<typeof createVoicePlayer>;
