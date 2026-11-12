import { useSettingsStore } from "./settingsStore";

/**
 * Procedural sound effects (Web Audio, no files). Every sound is a small recipe of oscillators
 * and filtered noise, so it fits the retro look, ships with no licensing questions, and costs
 * nothing to load. Sounds play only after a user gesture (browsers keep the AudioContext
 * suspended until then), which is always the case here: every sound answers a click or follows one.
 *
 * Usage: playSfx("click") for one-shots; const stop = startLoop("engine") for continuous sounds.
 */

export type SfxId =
  | "click"
  | "hover"
  | "door"
  | "scan"
  | "success"
  | "lift"
  | "go"
  | "noGo"
  | "tick"
  | "tickFinal"
  | "ignition"
  | "alarm"
  | "switch"
  | "contact"
  | "touchdown";

export type LoopId = "engine";

const MASTER_VOLUME = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const liveLoops = new Set<() => void>();

function enabled() {
  return useSettingsStore.getState().sound;
}

function audio(): { c: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { c: ctx, out: master! };
}

/** Two seconds of white noise, made once and shared by every noise-based sound. */
function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over the duration. */
  freqEnd?: number;
  dur: number;
  gain: number;
  attack?: number;
}

function tone(c: AudioContext, out: AudioNode, at: number, o: ToneOptions) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, at);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, at + o.dur);
  const attack = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

interface NoiseOptions {
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
}

function burst(c: AudioContext, out: AudioNode, at: number, o: NoiseOptions) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q ?? 0.7;
  f.frequency.setValueAtTime(o.freq, at);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, at + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.gain, at + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random());
  src.stop(at + o.dur + 0.05);
}

/** Each recipe schedules its sound starting at `t` (AudioContext time). */
const RECIPES: Record<SfxId, (c: AudioContext, out: AudioNode, t: number) => void> = {
  // Interface: short and quiet, so they never compete with the story sounds.
  click: (c, out, t) => tone(c, out, t, { type: "square", freq: 880, freqEnd: 660, dur: 0.05, gain: 0.05 }),
  hover: (c, out, t) => tone(c, out, t, { type: "sine", freq: 1400, dur: 0.03, gain: 0.025 }),
  // Medical bay: the sliding door hisses open and thuds into its frame.
  door: (c, out, t) => {
    burst(c, out, t, { dur: 0.75, gain: 0.25, filter: "bandpass", freq: 400, freqEnd: 1800, q: 1.2, attack: 0.08 });
    tone(c, out, t + 0.65, { freq: 80, freqEnd: 40, dur: 0.3, gain: 0.35 });
  },
  scan: (c, out, t) => {
    for (let i = 0; i < 3; i++) tone(c, out, t + i * 0.13, { freq: 1320, dur: 0.07, gain: 0.08 });
  },
  // A rising major arpeggio: someone signs off on your work.
  success: (c, out, t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(c, out, t + i * 0.09, { type: "triangle", freq: f, dur: 0.45, gain: 0.12 }),
    );
  },
  lift: (c, out, t) => {
    tone(c, out, t, { type: "triangle", freq: 90, freqEnd: 190, dur: 1.1, gain: 0.12, attack: 0.15 });
    burst(c, out, t, { dur: 1.1, gain: 0.05, filter: "lowpass", freq: 600, attack: 0.15 });
  },
  go: (c, out, t) => tone(c, out, t, { freq: 988, dur: 0.14, gain: 0.1 }),
  noGo: (c, out, t) => tone(c, out, t, { type: "square", freq: 160, dur: 0.35, gain: 0.1 }),
  tick: (c, out, t) => tone(c, out, t, { freq: 1000, dur: 0.07, gain: 0.08 }),
  tickFinal: (c, out, t) => tone(c, out, t, { freq: 1500, dur: 0.12, gain: 0.11 }),
  // Ignition: a roar that opens up, over a low thump.
  ignition: (c, out, t) => {
    burst(c, out, t, { dur: 3, gain: 0.55, filter: "lowpass", freq: 1400, freqEnd: 220, attack: 0.15 });
    tone(c, out, t, { freq: 55, freqEnd: 32, dur: 1.2, gain: 0.5, attack: 0.05 });
  },
  alarm: (c, out, t) => {
    for (let i = 0; i < 4; i++)
      tone(c, out, t + i * 0.2, { type: "square", freq: i % 2 ? 660 : 880, dur: 0.17, gain: 0.07 });
  },
  // A guarded toggle being thrown: a sharp click with a little body.
  switch: (c, out, t) => {
    burst(c, out, t, { dur: 0.03, gain: 0.2, filter: "highpass", freq: 2500 });
    tone(c, out, t, { type: "square", freq: 240, dur: 0.03, gain: 0.06 });
  },
  contact: (c, out, t) => {
    tone(c, out, t, { freq: 1760, dur: 0.1, gain: 0.08 });
    tone(c, out, t + 0.16, { freq: 1760, dur: 0.1, gain: 0.08 });
  },
  touchdown: (c, out, t) => {
    tone(c, out, t, { freq: 70, freqEnd: 35, dur: 0.6, gain: 0.6, attack: 0.01 });
    burst(c, out, t, { dur: 1, gain: 0.3, filter: "lowpass", freq: 500, freqEnd: 150 });
  },
};

export function playSfx(id: SfxId) {
  if (!enabled()) return;
  const a = audio();
  if (!a) return;
  RECIPES[id](a.c, a.out, a.c.currentTime);
}

/**
 * Starts a continuous sound and returns its stop function (fades out). Safe to call stop more
 * than once. Turning sound off in settings stops every running loop.
 */
export function startLoop(id: LoopId, { gain = 0.22 }: { gain?: number } = {}): () => void {
  const noop = () => {};
  if (!enabled() || id !== "engine") return noop;
  const a = audio();
  if (!a) return noop;
  const { c, out } = a;
  // Engine: low-passed noise with a slow wobble, like a burn heard through the hull.
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 260;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 7;
  lfoGain.gain.value = 40;
  lfo.connect(lfoGain).connect(f.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.4);
  src.connect(f).connect(g).connect(out);
  src.start();
  lfo.start();

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    const now = c.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    src.stop(now + 0.55);
    lfo.stop(now + 0.55);
  };
  liveLoops.add(stop);
  return stop;
}

// Muting mid-scene silences loops right away; one-shots are short enough to finish.
useSettingsStore.subscribe((s, prev) => {
  if (prev.sound && !s.sound) for (const stop of [...liveLoops]) stop();
});
