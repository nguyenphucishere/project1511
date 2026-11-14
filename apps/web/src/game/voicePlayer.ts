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
  lines: Record<string, { f: string; role: string }>;
}

export interface VoiceEntry {
  file: string;
  role: string;
  /** This speaker comes over a radio, so the game filters the voice like one. */
  radio: boolean;
}

/** Pure lookup, kept separate from the audio so it can be tested. */
export function lookupVoice(manifest: VoiceManifest | null, locale: VoiceLocale, text: string): VoiceEntry | null {
  if (!manifest) return null;
  const hit = manifest.lines[voiceKey(locale, text)];
  if (!hit) return null;
  return { file: hit.f, role: hit.role, radio: manifest.roles[hit.role]?.radio ?? false };
}

export interface VoiceDeps {
  audio: () => { c: AudioContext; out: AudioNode } | null;
  enabled: () => boolean;
  noise: (c: AudioContext) => AudioBuffer;
}

/**
 * played      a recording started (or was queued)
 * missing     the voice library loaded, but there is no recording of this line: stay silent
 * unavailable the library could not be loaded, or the browser would not play it: the caller may fall back
 */
export type PlayResult = "played" | "missing" | "unavailable";

export interface PlayOptions {
  /** true / false forces the radio filter; undefined follows the speaker (kranz, capcom... are on the radio). */
  radio?: boolean;
  /** The open-channel hiss under a radio voice. Default on whenever the radio filter is on. */
  hiss?: boolean;
  /** Wait for the line that is playing instead of cutting it off. */
  queue?: boolean;
  /** Called when the recording ends (not when it is cut off). */
  onEnd?: () => void;
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
  let token = 0;
  let current: { stop: () => void } | null = null;
  let waiting: Array<() => void> = [];

  function load(): Promise<VoiceManifest | null> {
    if (manifest) return Promise.resolve(manifest);
    loading ??= fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<VoiceManifest>) : null))
      .then((m) => (manifest = m))
      .catch(() => null);
    return loading;
  }

  function stop() {
    token++;
    waiting = [];
    const c = current;
    current = null;
    c?.stop();
  }

  function begin(entry: VoiceEntry, opts: PlayOptions, my: number): Promise<PlayResult> {
    const a = deps.audio();
    if (!a) return Promise.resolve("unavailable");
    const { c, out } = a;
    const el = new Audio(`${BASE}${entry.file}`);
    el.preload = "auto";
    const nodes: AudioNode[] = [];
    let hiss: AudioBufferSourceNode | null = null;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      try { hiss?.stop(); } catch { /* already stopped */ }
      for (const n of nodes) n.disconnect();
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
    const self = {
      stop: () => {
        cleanup();
      },
    };
    const ended = () => {
      const wasCurrent = current === self;
      cleanup();
      if (wasCurrent) current = null;
      opts.onEnd?.();
      if (my === token) waiting.shift()?.();
    };

    try {
      const src = c.createMediaElementSource(el);
      const gain = c.createGain();
      gain.gain.value = VOICE_GAIN;
      nodes.push(src, gain);
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
        ws.curve = radioCurve(10);
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
          hg.gain.value = 0.01;
          hiss.connect(band).connect(hg).connect(out);
          hiss.start();
          nodes.push(band, hg);
        }
      } else {
        src.connect(gain).connect(out);
      }
    } catch {
      cleanup();
      return Promise.resolve("unavailable");
    }

    current = self;
    el.onended = ended;
    el.onerror = () => {
      const wasCurrent = current === self;
      cleanup();
      if (wasCurrent) current = null;
    };
    return el.play().then(
      (): PlayResult => "played",
      (): PlayResult => {
        if (current === self) current = null;
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
    if (!entry) return "missing";
    if (opts.queue && current) {
      const my = token;
      waiting.push(() => {
        if (my === token && deps.enabled()) void begin(entry, opts, my);
      });
      return "played";
    }
    if (!opts.queue) stop();
    return begin(entry, opts, ++token);
  }

  /** True when a recording of this line exists (the manifest must have loaded, which play() does first). */
  async function has(text: string, locale: VoiceLocale): Promise<boolean> {
    return lookupVoice(await load(), locale, text) !== null;
  }

  return { play, stop, has, load };
}

export type VoicePlayer = ReturnType<typeof createVoicePlayer>;
