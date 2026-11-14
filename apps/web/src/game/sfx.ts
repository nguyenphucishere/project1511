import { useSettingsStore } from "./settingsStore";
import { createVoicePlayer, type PlayOptions, type PlayResult } from "./voicePlayer";

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
  | "touchdown"
  | "chime"
  | "caution"
  | "bang"
  | "whoosh"
  | "unlatch"
  | "boom"
  | "groan"
  | "sputter"
  | "servo"
  | "clunk"
  | "hiss"
  | "pyro"
  | "relay"
  | "clank"
  | "hydraulic"
  | "ratchet"
  | "thud"
  | "retro"
  | "gas";

export type LoopId = "engine";

const MASTER_VOLUME = 0.5;
let masterVolume = MASTER_VOLUME;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voiceBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
export const liveLoops = new Set<() => void>();

export function enabled() {
  return useSettingsStore.getState().sound;
}

export function audio(): { c: AudioContext; out: GainNode; voice: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = masterVolume;
    // A gentle limiter, so loud hardware hits can be boosted without clipping the roar and score.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);
    // Voices have their own way in, past the master level, so that everything else can be ducked under them.
    voiceBus = ctx.createGain();
    voiceBus.gain.value = 0.5;
    voiceBus.connect(limiter);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { c: ctx, out: master!, voice: voiceBus! };
}

/**
 * Sets how loud everything the game makes is (the limiter after it keeps loud moments from
 * clipping). Scenes with a lot going on at once raise it; call with no argument to go back.
 */
export function setMasterVolume(volume = MASTER_VOLUME) {
  masterVolume = volume;
  if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
}

/** Two seconds of white noise, made once and shared by every noise-based sound. */
export function noise(c: AudioContext): AudioBuffer {
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

export function tone(
  c: AudioContext,
  out: AudioNode,
  at: number,
  o: ToneOptions,
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, at);
  if (o.freqEnd)
    osc.frequency.exponentialRampToValueAtTime(o.freqEnd, at + o.dur);
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

export function burst(
  c: AudioContext,
  out: AudioNode,
  at: number,
  o: NoiseOptions,
) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q ?? 0.7;
  f.frequency.setValueAtTime(o.freq, at);
  if (o.freqEnd)
    f.frequency.exponentialRampToValueAtTime(o.freqEnd, at + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.gain, at + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random());
  src.stop(at + o.dur + 0.05);
}

/** Each recipe schedules its sound starting at `t` (AudioContext time). */
const RECIPES: Record<
  SfxId,
  (c: AudioContext, out: AudioNode, t: number) => void
> = {
  // Interface: short and quiet, so they never compete with the story sounds.
  click: (c, out, t) =>
    tone(c, out, t, {
      type: "square",
      freq: 880,
      freqEnd: 660,
      dur: 0.05,
      gain: 0.05,
    }),
  hover: (c, out, t) =>
    tone(c, out, t, { type: "sine", freq: 1400, dur: 0.03, gain: 0.025 }),
  // Medical bay: the sliding door hisses open and thuds into its frame.
  door: (c, out, t) => {
    burst(c, out, t, {
      dur: 0.75,
      gain: 0.25,
      filter: "bandpass",
      freq: 400,
      freqEnd: 1800,
      q: 1.2,
      attack: 0.08,
    });
    tone(c, out, t + 0.65, { freq: 80, freqEnd: 40, dur: 0.3, gain: 0.35 });
  },
  scan: (c, out, t) => {
    for (let i = 0; i < 3; i++)
      tone(c, out, t + i * 0.13, { freq: 1320, dur: 0.07, gain: 0.08 });
  },
  // A rising major arpeggio: someone signs off on your work.
  success: (c, out, t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(c, out, t + i * 0.09, {
        type: "triangle",
        freq: f,
        dur: 0.45,
        gain: 0.12,
      }),
    );
  },
  lift: (c, out, t) => {
    tone(c, out, t, {
      type: "triangle",
      freq: 90,
      freqEnd: 190,
      dur: 1.1,
      gain: 0.12,
      attack: 0.15,
    });
    burst(c, out, t, {
      dur: 1.1,
      gain: 0.05,
      filter: "lowpass",
      freq: 600,
      attack: 0.15,
    });
  },
  go: (c, out, t) => tone(c, out, t, { freq: 988, dur: 0.14, gain: 0.1 }),
  noGo: (c, out, t) =>
    tone(c, out, t, { type: "square", freq: 160, dur: 0.35, gain: 0.1 }),
  tick: (c, out, t) => tone(c, out, t, { freq: 1000, dur: 0.07, gain: 0.08 }),
  tickFinal: (c, out, t) =>
    tone(c, out, t, { freq: 1500, dur: 0.12, gain: 0.11 }),
  // Ignition: a roar that opens up, over a low thump.
  ignition: (c, out, t) => {
    burst(c, out, t, {
      dur: 3,
      gain: 0.55,
      filter: "lowpass",
      freq: 1400,
      freqEnd: 220,
      attack: 0.15,
    });
    tone(c, out, t, {
      freq: 55,
      freqEnd: 32,
      dur: 1.2,
      gain: 0.5,
      attack: 0.05,
    });
  },
  alarm: (c, out, t) => {
    for (let i = 0; i < 4; i++)
      tone(c, out, t + i * 0.2, {
        type: "square",
        freq: i % 2 ? 660 : 880,
        dur: 0.17,
        gain: 0.07,
      });
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
  // Ship's computer announcement: a soft two-note chime before the voice/caption.
  chime: (c, out, t) => {
    tone(c, out, t, { type: "sine", freq: 880, dur: 0.22, gain: 0.1 });
    tone(c, out, t + 0.16, { type: "sine", freq: 1174.7, dur: 0.3, gain: 0.1 });
  },
  // Master caution: three urgent descending beeps.
  caution: (c, out, t) => {
    for (let i = 0; i < 3; i++)
      tone(c, out, t + i * 0.16, {
        type: "square",
        freq: 1050 - i * 120,
        dur: 0.12,
        gain: 0.07,
      });
  },
  // Pyrotechnic separation: a hard crack with a low thud, then a short rush of gas.
  bang: (c, out, t) => {
    burst(c, out, t, { dur: 0.12, gain: 0.55, filter: "highpass", freq: 1200 });
    tone(c, out, t, {
      freq: 110,
      freqEnd: 38,
      dur: 0.5,
      gain: 0.7,
      attack: 0.004,
    });
    burst(c, out, t + 0.05, {
      dur: 0.9,
      gain: 0.22,
      filter: "bandpass",
      freq: 3000,
      freqEnd: 500,
      q: 0.8,
    });
  },
  whoosh: (c, out, t) =>
    burst(c, out, t, {
      dur: 1.2,
      gain: 0.18,
      filter: "bandpass",
      freq: 300,
      freqEnd: 2600,
      q: 0.9,
      attack: 0.3,
    }),
  // Harness buckle: metal clack, then the webbing springing loose.
  unlatch: (c, out, t) => {
    burst(c, out, t, { dur: 0.04, gain: 0.35, filter: "highpass", freq: 3000 });
    tone(c, out, t, { type: "square", freq: 180, dur: 0.06, gain: 0.09 });
    burst(c, out, t + 0.12, {
      dur: 0.35,
      gain: 0.08,
      filter: "bandpass",
      freq: 1800,
      freqEnd: 900,
    });
  },
  // Vehicle lost: a huge blast that rolls and fades, with debris crackle behind it.
  boom: (c, out, t) => {
    burst(c, out, t, { dur: 0.25, gain: 0.9, filter: "highpass", freq: 600 });
    tone(c, out, t, {
      freq: 90,
      freqEnd: 24,
      dur: 2.2,
      gain: 0.95,
      attack: 0.004,
    });
    burst(c, out, t + 0.03, {
      dur: 3.4,
      gain: 0.7,
      filter: "lowpass",
      freq: 2200,
      freqEnd: 90,
      attack: 0.02,
    });
    for (let i = 0; i < 9; i++)
      burst(c, out, t + 0.5 + i * 0.22, {
        dur: 0.12,
        gain: 0.12,
        filter: "highpass",
        freq: 1800,
      });
  },
  // A room full of people breathing out: slow, low, falling.
  groan: (c, out, t) => {
    burst(c, out, t, {
      dur: 2.6,
      gain: 0.16,
      filter: "bandpass",
      freq: 520,
      freqEnd: 260,
      q: 1.6,
      attack: 0.5,
    });
    burst(c, out, t + 0.2, {
      dur: 2.2,
      gain: 0.1,
      filter: "bandpass",
      freq: 340,
      freqEnd: 190,
      q: 1.2,
      attack: 0.5,
    });
  },
  // Engine losing its fuel: coughs and stutters.
  sputter: (c, out, t) => {
    [0, 0.22, 0.4, 0.7, 0.85, 1.2].forEach((d) =>
      burst(c, out, t + d, {
        dur: 0.16,
        gain: 0.35,
        filter: "lowpass",
        freq: 700,
        freqEnd: 150,
        attack: 0.01,
      }),
    );
  },
  // Hardware, the way it sounds on a real vehicle: sharp, dry, short, with no musical pitch to it.
  // A pyrotechnic cut: a supersonic crack, a thump through the structure, a ringing tail.
  pyro: (c, out, t) => {
    burst(c, out, t, {
      dur: 0.05,
      gain: 0.8,
      filter: "highpass",
      freq: 1800,
      attack: 0.001,
    });
    tone(c, out, t, {
      freq: 95,
      freqEnd: 38,
      dur: 0.4,
      gain: 0.55,
      attack: 0.002,
    });
    tone(c, out, t, {
      type: "triangle",
      freq: 2300,
      freqEnd: 1900,
      dur: 0.28,
      gain: 0.05,
      attack: 0.001,
    });
    burst(c, out, t + 0.02, {
      dur: 0.55,
      gain: 0.14,
      filter: "bandpass",
      freq: 1200,
      q: 1,
      attack: 0.01,
    });
  },
  // A relay or contactor: two tiny dry clicks.
  relay: (c, out, t) => {
    burst(c, out, t, {
      dur: 0.012,
      gain: 0.3,
      filter: "bandpass",
      freq: 3500,
      q: 4,
      attack: 0.001,
    });
    burst(c, out, t + 0.028, {
      dur: 0.01,
      gain: 0.22,
      filter: "bandpass",
      freq: 4200,
      q: 4,
      attack: 0.001,
    });
    tone(c, out, t, {
      type: "square",
      freq: 190,
      dur: 0.012,
      gain: 0.04,
      attack: 0.001,
    });
  },
  // Metal on metal: a noise transient and inharmonic ringing partials.
  clank: (c, out, t) => {
    burst(c, out, t, {
      dur: 0.03,
      gain: 0.4,
      filter: "bandpass",
      freq: 2500,
      q: 1.2,
      attack: 0.001,
    });
    tone(c, out, t, { freq: 380, dur: 0.35, gain: 0.16, attack: 0.001 });
    tone(c, out, t, { freq: 1050, dur: 0.25, gain: 0.09, attack: 0.001 });
    tone(c, out, t, { freq: 2050, dur: 0.15, gain: 0.05, attack: 0.001 });
  },
  // A hydraulic actuator pushing: a rush of fluid and a low motor whine under it.
  hydraulic: (c, out, t) => {
    burst(c, out, t, {
      dur: 0.7,
      gain: 0.1,
      filter: "bandpass",
      freq: 420,
      freqEnd: 700,
      q: 2,
      attack: 0.12,
    });
    tone(c, out, t, {
      type: "sawtooth",
      freq: 70,
      freqEnd: 105,
      dur: 0.7,
      gain: 0.03,
      attack: 0.15,
    });
  },
  // A ratchet or latch mechanism running: a quick row of tiny clicks.
  ratchet: (c, out, t) => {
    for (let i = 0; i < 8; i++)
      burst(c, out, t + i * 0.045, {
        dur: 0.012,
        gain: 0.18,
        filter: "bandpass",
        freq: 2600,
        q: 5,
        attack: 0.001,
      });
  },
  thud: (c, out, t) => {
    tone(c, out, t, {
      freq: 72,
      freqEnd: 32,
      dur: 0.45,
      gain: 0.7,
      attack: 0.003,
    });
    burst(c, out, t, {
      dur: 0.3,
      gain: 0.3,
      filter: "lowpass",
      freq: 200,
      attack: 0.002,
    });
  },
  // A solid rocket motor: a hard whoosh with crackle.
  retro: (c, out, t) => {
    burst(c, out, t, {
      dur: 0.9,
      gain: 0.4,
      filter: "lowpass",
      freq: 600,
      freqEnd: 2200,
      attack: 0.02,
    });
    burst(c, out, t, {
      dur: 0.9,
      gain: 0.12,
      filter: "highpass",
      freq: 2500,
      attack: 0.02,
    });
    for (let i = 0; i < 14; i++)
      burst(c, out, t + Math.random() * 0.8, {
        dur: 0.01,
        gain: 0.2,
        filter: "highpass",
        freq: 3200,
        attack: 0.001,
      });
  },
  gas: (c, out, t) =>
    burst(c, out, t, {
      dur: 0.5,
      gain: 0.12,
      filter: "highpass",
      freq: 2500,
      freqEnd: 5000,
      attack: 0.03,
    }),
  // The old names, now mapped onto the real hardware sounds.
  servo: (c, out, t) => RECIPES.hydraulic(c, out, t),
  clunk: (c, out, t) => RECIPES.clank(c, out, t),
  hiss: (c, out, t) => RECIPES.gas(c, out, t),
  touchdown: (c, out, t) => {
    tone(c, out, t, {
      freq: 70,
      freqEnd: 35,
      dur: 0.6,
      gain: 0.6,
      attack: 0.01,
    });
    burst(c, out, t, {
      dur: 1,
      gain: 0.3,
      filter: "lowpass",
      freq: 500,
      freqEnd: 150,
    });
  },
};

/** `gain` scales the whole sound (a bus gain in front of the recipe), for the film's hardware. */
export function playSfx(id: SfxId, gain = 1) {
  if (!enabled()) return;
  const a = audio();
  if (!a) return;
  if (gain === 1) {
    RECIPES[id](a.c, a.out, a.c.currentTime);
    return;
  }
  const bus = a.c.createGain();
  bus.gain.value = gain;
  bus.connect(a.out);
  RECIPES[id](a.c, bus, a.c.currentTime);
  // The bus is garbage-collected once the recipe's nodes have finished.
}

/**
 * Starts a continuous sound and returns its stop function (fades out). Safe to call stop more
 * than once. Turning sound off in settings stops every running loop.
 */
export function startLoop(
  id: LoopId,
  { gain = 0.22 }: { gain?: number } = {},
): () => void {
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

export interface Rumble {
  /** 0..1: loudness and brightness of the roar. Smoothed, so it can be set every frame. */
  setLevel: (level: number) => void;
  stop: () => void;
}

/**
 * The sound of riding a rocket from inside the cabin: a deep, band-limited roar whose weight
 * follows `setLevel`, with a slow rattle on top. Returns a no-op handle when muted or unsupported.
 */
export function startRumble(): Rumble {
  const none: Rumble = { setLevel: () => {}, stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 120;
  const body = c.createOscillator();
  body.type = "sawtooth";
  body.frequency.value = 38;
  const bodyGain = c.createGain();
  bodyGain.gain.value = 0;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 11;
  lfoGain.gain.value = 30;
  lfo.connect(lfoGain).connect(f.frequency);
  const g = c.createGain();
  g.gain.value = 0.0001;
  src.connect(f).connect(g);
  body.connect(bodyGain).connect(g);
  g.connect(out);
  src.start();
  body.start();
  lfo.start();

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    const now = c.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setTargetAtTime(0.0001, now, 0.25);
    src.stop(now + 1.5);
    body.stop(now + 1.5);
    lfo.stop(now + 1.5);
  };
  liveLoops.add(stop);
  return {
    setLevel: (level) => {
      if (stopped) return;
      const l = Math.min(1, Math.max(0, level));
      const now = c.currentTime;
      g.gain.setTargetAtTime(Math.max(0.0001, l * 0.55), now, 0.15);
      f.frequency.setTargetAtTime(110 + l * 700, now, 0.2);
      bodyGain.gain.setTargetAtTime(l * 0.25, now, 0.2);
      body.frequency.setTargetAtTime(32 + l * 22, now, 0.3);
    },
    stop,
  };
}

/** While a voice speaks, everything else drops under it, so a line is heard over the roar, the score and the alarm. */
function duckForVoice(on: boolean) {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(on ? masterVolume * 0.35 : masterVolume, ctx.currentTime, on ? 0.05 : 0.6);
}

const voicePlayer = createVoicePlayer({ audio, enabled, noise, duck: duckForVoice });
let speakToken = 0;

export interface SpeakOptions {
  /** Wait for the line that is playing instead of cutting it off. */
  queue?: boolean;
  /** Called when a recorded line finishes (browser speech does not report it). */
  onEnd?: () => void;
  /** Force the radio filter on or off; by default it follows the speaker. */
  radio?: boolean;
  /** Playback speed of a recorded line, 1 = as recorded. */
  rate?: number;
  /** 0 to 1: a voice in panic (see PlayOptions). */
  panic?: number;
}

/** The fallback: the browser's speech synthesis, for a line with no recording. */
function speakWithBrowser(text: string, locale: "en" | "vi") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale === "vi" ? "vi-VN" : "en-US";
  u.rate = 1.05;
  u.pitch = 0.85;
  u.volume = 0.8;
  synth.cancel();
  synth.speak(u);
}

/**
 * Says a line aloud: the recorded voice (public/assets/voice, found by the language and exact
 * words) when there is one, otherwise the browser's speech synthesis. Muted sound says nothing.
 * Returns an id for stopSpeaking(id), so a caller can cut off only its own line.
 */
export function speak(text: string, locale: "en" | "vi", opts: SpeakOptions = {}): number {
  if (!enabled() || typeof window === "undefined") return 0;
  const id = ++speakToken;
  void voicePlayer.play(text, locale, opts).then((result) => {
    // Only when the recorded library itself is unavailable does the browser voice step in; a line
    // that simply has no recording (a live number, say) stays silent rather than switch voices.
    if (result === "unavailable" && id === speakToken) speakWithBrowser(text, locale);
  });
  return id;
}

/** Stops the voice. With an id, only if that line is still the latest one. */
export function stopSpeaking(id?: number) {
  if (id !== undefined && id !== speakToken) return;
  speakToken++;
  voicePlayer.stop();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Plays only the recording of a line (no browser fallback). */
export function playVoiceLine(text: string, locale: "en" | "vi", opts: PlayOptions = {}): Promise<PlayResult> {
  return voicePlayer.play(text, locale, opts);
}

export function stopVoiceLine() {
  voicePlayer.stop();
}

export type ScoreMood = "ride" | "awe" | "dread" | "hush";

/** Chord voices per mood: [frequency, gain]. Four slow oscillators crossfade between them. */
const CHORDS: Record<ScoreMood, [number, number][]> = {
  ride: [
    [55, 0.5],
    [82.4, 0.4],
    [110, 0.35],
    [164.8, 0.2],
  ],
  awe: [
    [73.4, 0.4],
    [146.8, 0.4],
    [220, 0.35],
    [370, 0.28],
  ],
  dread: [
    [55, 0.55],
    [58.3, 0.45],
    [77.8, 0.35],
    [233, 0.15],
  ],
  hush: [
    [55, 0.06],
    [82.4, 0.05],
    [110, 0.04],
    [164.8, 0.03],
  ],
};

export interface Score {
  setMood: (mood: ScoreMood) => void;
  stop: () => void;
}

/**
 * A procedural film-score pad: four soft oscillators through a moving low-pass filter. It cannot
 * play a tune, but it sets the mood the way a held string chord does (rising dread, then awe).
 */
export function startScore(initial: ScoreMood = "ride"): Score {
  const none: Score = { setMood: () => {}, stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;
  const master = c.createGain();
  master.gain.value = 0.0001;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  filter.Q.value = 0.8;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(filter.frequency);
  const voices = CHORDS[initial].map(([f], i) => {
    const o = c.createOscillator();
    o.type = i % 2 ? "triangle" : "sawtooth";
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 6;
    const g = c.createGain();
    g.gain.value = 0;
    o.connect(g).connect(filter);
    o.start();
    return { o, g };
  });
  filter.connect(master).connect(out);
  lfo.start();
  master.gain.setTargetAtTime(0.5, c.currentTime, 1.5);

  let stopped = false;
  const apply = (mood: ScoreMood) => {
    const now = c.currentTime;
    CHORDS[mood].forEach(([f, g], i) => {
      voices[i].o.frequency.setTargetAtTime(f, now, 1.2);
      voices[i].g.gain.setTargetAtTime(g * 0.5, now, 1.6);
    });
    filter.frequency.setTargetAtTime(
      mood === "awe"
        ? 1800
        : mood === "dread"
          ? 380
          : mood === "hush"
            ? 250
            : 650,
      now,
      2,
    );
  };
  apply(initial);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    const now = c.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0.0001, now, 0.5);
    for (const v of voices) v.o.stop(now + 2.5);
    lfo.stop(now + 2.5);
  };
  liveLoops.add(stop);
  return { setMood: (m) => !stopped && apply(m), stop };
}

/** A pulsing klaxon for the master alarm. Returns its stop function. */
export function startAlarm(): () => void {
  if (!enabled()) return () => {};
  const a = audio();
  if (!a) return () => {};
  const { c, out } = a;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = 820;
  const pulse = c.createGain();
  pulse.gain.value = 0;
  const lfo = c.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 2.4;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.06;
  const bias = c.createConstantSource();
  bias.offset.value = 0.06;
  lfo.connect(lfoGain).connect(pulse.gain);
  bias.connect(pulse.gain);
  osc.connect(pulse).connect(out);
  osc.start();
  lfo.start();
  bias.start();
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    const now = c.currentTime;
    pulse.gain.cancelScheduledValues(now);
    bias.stop(now + 0.05);
    lfo.stop(now + 0.05);
    osc.stop(now + 0.05);
  };
  liveLoops.add(stop);
  return stop;
}

export interface Pulse {
  /** Beats (or breaths) per minute. */
  setRate: (perMinute: number) => void;
  /** How loud, 0 to 1. */
  setLevel: (level: number) => void;
  stop: () => void;
}

/** One soft thump: a short low sine that falls in pitch, the sound of a pulse in the ears. */
function thump(c: AudioContext, out: AudioNode, when: number, level: number) {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(70, when);
  o.frequency.exponentialRampToValueAtTime(38, when + 0.14);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + 0.24);
}

/**
 * A heartbeat in the ears (lub-dub), for the moments when everything else goes quiet. The rate
 * can climb as the danger does. Scheduled a beat at a time, so a rate change takes effect at once.
 */
export function startHeartbeat(): Pulse {
  const none: Pulse = { setRate: () => {}, setLevel: () => {}, stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;
  const bus = c.createGain();
  bus.gain.value = 0.0001;
  bus.connect(out);
  let bpm = 70;
  let stopped = false;
  let timer = 0;
  const beat = () => {
    if (stopped) return;
    const now = c.currentTime;
    thump(c, bus, now, 0.9);
    thump(c, bus, now + 0.17, 0.6);
    timer = window.setTimeout(beat, (60 / bpm) * 1000);
  };
  beat();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    window.clearTimeout(timer);
    bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
  };
  liveLoops.add(stop);
  return {
    setRate: (v) => (bpm = Math.min(200, Math.max(40, v))),
    setLevel: (v) => bus.gain.setTargetAtTime(Math.max(0.0001, v * 1.4), c.currentTime, 0.08),
    stop,
  };
}

/** Breathing inside a helmet: filtered noise swelling in and out, quick and shallow when afraid. */
export function startBreathing(): Pulse {
  const none: Pulse = { setRate: () => {}, setLevel: () => {}, stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 900;
  band.Q.value = 0.7;
  const swell = c.createGain();
  swell.gain.value = 0.0001;
  const bus = c.createGain();
  bus.gain.value = 0.0001;
  src.connect(band).connect(swell).connect(bus).connect(out);
  src.start();
  let perMin = 18;
  let level = 0;
  let stopped = false;
  let timer = 0;
  const breathe = () => {
    if (stopped) return;
    const now = c.currentTime;
    const period = 60 / perMin;
    swell.gain.cancelScheduledValues(now);
    swell.gain.setValueAtTime(0.0001, now);
    swell.gain.linearRampToValueAtTime(1, now + period * 0.4);
    swell.gain.linearRampToValueAtTime(0.0001, now + period * 0.95);
    timer = window.setTimeout(breathe, period * 1000);
  };
  breathe();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    window.clearTimeout(timer);
    bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
    src.stop(c.currentTime + 0.6);
  };
  liveLoops.add(stop);
  return {
    setRate: (v) => (perMin = Math.min(70, Math.max(10, v))),
    setLevel: (v) => {
      level = v;
      bus.gain.setTargetAtTime(Math.max(0.0001, level * 0.16), c.currentTime, 0.1);
    },
    stop,
  };
}

export interface Suspense {
  /** 0 = a held dread, 1 = everything at once: the pulse races, the riser screams. */
  setIntensity: (k: number) => void;
  /** A sudden low blow: the moment it goes wrong. */
  stinger: () => void;
  /** Everything but the low drone drops out for a moment: the breath before the worst. */
  silence: (ms: number) => void;
  stop: (fadeSec?: number) => void;
}

/**
 * The score of a flight going wrong: a low drone that never resolves, a pulse of clashing notes that
 * speeds up and climbs as the danger does, and a riser that tightens until something gives. Made of
 * oscillators, so it cannot play a tune, but it holds the dread of one.
 */
export function startSuspense(): Suspense {
  const none: Suspense = { setIntensity: () => {}, stinger: () => {}, silence: () => {}, stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;
  const bus = c.createGain();
  bus.gain.value = 0.0001;
  bus.gain.setTargetAtTime(1, c.currentTime, 0.8);
  bus.connect(out);

  // The drone: two saws a hair apart (they beat against each other) over a sub-bass.
  const droneGain = c.createGain();
  droneGain.gain.value = 0.07;
  const droneFilter = c.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 180;
  const drones = [55, 55.9, 82.4].map((f, i) => {
    const o = c.createOscillator();
    o.type = i === 2 ? "triangle" : "sawtooth";
    o.frequency.value = f;
    o.connect(droneFilter);
    o.start();
    return o;
  });
  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 27.5;
  sub.connect(droneGain);
  sub.start();
  droneFilter.connect(droneGain).connect(bus);

  // The riser: noise through a band that climbs, and a sweeping tone under it.
  const riseNoise = c.createBufferSource();
  riseNoise.buffer = noise(c);
  riseNoise.loop = true;
  const riseBand = c.createBiquadFilter();
  riseBand.type = "bandpass";
  riseBand.Q.value = 2.2;
  riseBand.frequency.value = 400;
  const riseGain = c.createGain();
  riseGain.gain.value = 0.0001;
  riseNoise.connect(riseBand).connect(riseGain).connect(bus);
  riseNoise.start();
  const riseTone = c.createOscillator();
  riseTone.type = "triangle";
  riseTone.frequency.value = 220;
  const riseToneGain = c.createGain();
  riseToneGain.gain.value = 0.0001;
  riseTone.connect(riseToneGain).connect(bus);
  riseTone.start();

  // The pulse: eighth notes on a root and its flat second, with a tritone leap at the end of the bar.
  const PATTERN = [0, 0, 1, 0, 0, 1, 0, 6];
  const pulseBus = c.createGain();
  pulseBus.gain.value = 0.0001;
  const pulseFilter = c.createBiquadFilter();
  pulseFilter.type = "lowpass";
  pulseFilter.frequency.value = 900;
  pulseBus.connect(pulseFilter).connect(bus);
  let k = 0;
  let step = 0;
  let stopped = false;
  let timer = 0;
  const note = () => {
    if (stopped) return;
    const bpm = 92 + k * 90;
    const eighth = 60 / bpm / 2;
    const semis = PATTERN[step % PATTERN.length]! + (k > 0.7 && step % 2 === 1 ? 12 : 0);
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 110 * Math.pow(2, semis / 12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + eighth * 0.9);
    o.connect(g).connect(pulseBus);
    o.start(now);
    o.stop(now + eighth);
    step++;
    timer = window.setTimeout(note, eighth * 1000);
  };
  note();

  const apply = (v: number) => {
    k = Math.min(1, Math.max(0, v));
    const now = c.currentTime;
    droneFilter.frequency.setTargetAtTime(180 + k * 520, now, 0.4);
    droneGain.gain.setTargetAtTime(0.07 + k * 0.1, now, 0.4);
    pulseBus.gain.setTargetAtTime(k < 0.05 ? 0.0001 : 0.05 + k * 0.17, now, 0.3);
    pulseFilter.frequency.setTargetAtTime(700 + k * 2400, now, 0.3);
    riseBand.frequency.setTargetAtTime(400 + k * k * 4200, now, 0.3);
    riseGain.gain.setTargetAtTime(Math.max(0.0001, k * k * 0.09), now, 0.3);
    riseTone.frequency.setTargetAtTime(220 + k * k * 1500, now, 0.3);
    riseToneGain.gain.setTargetAtTime(Math.max(0.0001, k * k * 0.035), now, 0.3);
  };
  apply(0);

  const stinger = () => {
    const now = c.currentTime;
    const hit = c.createGain();
    hit.gain.setValueAtTime(0.0001, now);
    hit.gain.exponentialRampToValueAtTime(0.55, now + 0.02);
    hit.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    hit.connect(bus);
    for (const f of [55, 58.3, 82.4, 116.5]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * 1.5, now);
      o.frequency.exponentialRampToValueAtTime(f, now + 0.25);
      o.connect(hit);
      o.start(now);
      o.stop(now + 2.3);
    }
    const n = c.createBufferSource();
    n.buffer = noise(c);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.5, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    n.connect(ng).connect(hit);
    n.start(now);
    n.stop(now + 0.6);
  };

  const silence = (ms: number) => {
    const now = c.currentTime;
    for (const g of [pulseBus.gain, riseGain.gain, riseToneGain.gain]) {
      g.cancelScheduledValues(now);
      g.setTargetAtTime(0.0001, now, 0.04);
    }
    window.setTimeout(() => !stopped && apply(k), ms);
  };

  const stop = (fadeSec = 0.4) => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    window.clearTimeout(timer);
    const now = c.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setTargetAtTime(0.0001, now, Math.max(0.05, fadeSec / 3));
    const end = now + fadeSec + 0.6;
    for (const o of [...drones, sub, riseNoise, riseTone]) o.stop(end);
  };
  liveLoops.add(() => stop(0.1));

  return { setIntensity: apply, stinger, silence, stop };
}

/**
 * A rocket exploding: a crack that hurts, a thump you feel in the chest, a rolling roar that
 * decays over seconds with crackling debris in it, and, up close, a ringing in the ears. `far`
 * is the same blast as heard across a field, a beat later: lower, rounder, no ringing.
 */
export function playExplosion(distance: "close" | "far" = "close", gain = 1) {
  if (!enabled()) return;
  const a = audio();
  if (!a) return;
  const { c, out } = a;
  const now = c.currentTime;
  const near = distance === "close";
  const bus = c.createGain();
  bus.gain.value = gain * (near ? 1 : 0.85);
  bus.connect(out);

  // 1. The crack: broadband noise, gone in a tenth of a second.
  if (near) {
    const n = c.createBufferSource();
    n.buffer = noise(c);
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(1.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    n.connect(hp).connect(g).connect(bus);
    n.start(now);
    n.stop(now + 0.2);
  }

  // 2. The thump: a sine that falls through the floor.
  const thumpOsc = c.createOscillator();
  thumpOsc.type = "sine";
  thumpOsc.frequency.setValueAtTime(near ? 110 : 80, now);
  thumpOsc.frequency.exponentialRampToValueAtTime(24, now + 0.9);
  const thumpGain = c.createGain();
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.exponentialRampToValueAtTime(1.3, now + 0.015);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  thumpOsc.connect(thumpGain).connect(bus);
  thumpOsc.start(now);
  thumpOsc.stop(now + 1.5);

  // 3. The roar: noise through a low-pass that closes slowly as the sound rolls away.
  const roar = c.createBufferSource();
  roar.buffer = noise(c);
  roar.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(near ? 2600 : 900, now);
  lp.frequency.exponentialRampToValueAtTime(70, now + 4.5);
  const roarGain = c.createGain();
  roarGain.gain.setValueAtTime(0.0001, now);
  roarGain.gain.exponentialRampToValueAtTime(near ? 0.95 : 0.8, now + 0.05);
  roarGain.gain.exponentialRampToValueAtTime(0.0001, now + 5);
  roar.connect(lp).connect(roarGain).connect(bus);
  roar.start(now);
  roar.stop(now + 5.2);

  // 4. Debris and fire: little pops and crackles scattered over the next few seconds.
  for (let i = 0; i < 22; i++) {
    const t = now + 0.15 + Math.random() * 3.6;
    const n = c.createBufferSource();
    n.buffer = noise(c);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 600 + Math.random() * 3400;
    bp.Q.value = 1.4;
    const g = c.createGain();
    const peak = (0.35 + Math.random() * 0.45) * (1 - (t - now) / 5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.09);
    n.connect(bp).connect(g).connect(bus);
    n.start(t, Math.random());
    n.stop(t + 0.2);
  }

  // 5. Close up, the ears ring.
  if (near) {
    const ring = c.createOscillator();
    ring.type = "sine";
    ring.frequency.value = 3400;
    const rg = c.createGain();
    rg.gain.setValueAtTime(0.0001, now + 0.1);
    rg.gain.exponentialRampToValueAtTime(0.045, now + 0.4);
    rg.gain.exponentialRampToValueAtTime(0.0001, now + 4);
    ring.connect(rg).connect(bus);
    ring.start(now + 0.1);
    ring.stop(now + 4.2);
  }
}
