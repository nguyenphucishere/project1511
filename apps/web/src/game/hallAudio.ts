import { audio, burst, enabled, liveLoops, noise, tone } from "./sfx";

/**
 * The living assembly hall, all procedural (Web Audio, no files): room tone and lamp hum, the
 * crane's motor and winch, welding sizzle and pops, a forklift with its backup beeper, a far-off
 * clang or air-tool hiss now and then, and clusters of synthetic chatter. The caller feeds `set`
 * every frame with levels it worked out from distance.
 */

export interface HallLevels {
  /** 0..1 loudness of each source as heard from the listener (the caller applies distance). */
  crane: number;
  hoist: number;
  weld: number;
  fork: number;
  voice: number;
  /** Stereo position of each source, -1 (left) .. 1 (right). */
  weldPan: number;
  forkPan: number;
  voicePan: number;
  /** The forklift is manoeuvring: it sounds its backup beeper. */
  beep: boolean;
}

export interface HallAmbience {
  set: (levels: Partial<HallLevels>) => void;
  stop: () => void;
}

/** Formant pairs (Hz) for a few vowels, so synthetic chatter reads as speech. */
const VOWELS: [number, number][] = [
  [730, 1090],
  [530, 1840],
  [270, 2290],
  [570, 840],
  [300, 870],
];

export function startHallAmbience(): HallAmbience {
  const none: HallAmbience = { set: () => {}, stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;
  const bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(out);
  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const L: HallLevels = { crane: 0, hoist: 0, weld: 0, fork: 0, voice: 0, weldPan: 0, forkPan: 0, voicePan: 0, beep: false };

  const panner = (target: AudioNode) => {
    const p = c.createStereoPanner();
    p.connect(target);
    return p;
  };
  const noiseLoop = (type: BiquadFilterType, freq: number, q: number, dest: AudioNode, gain = 1) => {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start(0, Math.random());
    sources.push(src);
    return { g, f };
  };
  const osc = (type: OscillatorType, freq: number, filterFreq: number, dest: AudioNode) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.value = 0;
    o.connect(f).connect(g).connect(dest);
    o.start();
    sources.push(o);
    return { o, g };
  };

  // Room tone: big-hall low rumble, a thin air hiss, and the 100 Hz buzz of the lamps.
  noiseLoop("lowpass", 170, 0.5, bus, 0.05);
  noiseLoop("highpass", 5200, 0.5, bus, 0.004);
  const hum = osc("sine", 100, 400, bus);
  hum.g.gain.value = 0.012;

  // Crane: bridge/trolley motor (pitch follows speed) and the winch.
  const motor = osc("sawtooth", 60, 420, bus);
  const whine = noiseLoop("bandpass", 1800, 6, bus, 0);
  const winch = osc("sawtooth", 38, 220, bus);
  const winchGrind = noiseLoop("bandpass", 850, 2, bus, 0);

  // Welding: a continuous sizzle that crackles, placed in the stereo field.
  const weldPan = panner(bus);
  const sizzle = noiseLoop("bandpass", 4200, 0.8, weldPan, 0);

  // Forklift: diesel idle and a backup beeper.
  const forkPan = panner(bus);
  const engine = osc("sawtooth", 46, 190, forkPan);
  const engineNoise = noiseLoop("lowpass", 320, 0.7, forkPan, 0);

  const voicePan = panner(bus);

  const every = (ms: () => number, fn: () => void) => {
    const run = () => {
      fn();
      timers.push(window.setTimeout(run, ms()));
    };
    timers.push(window.setTimeout(run, ms()));
  };

  every(
    () => 45 + Math.random() * 70,
    () => {
      const t = c.currentTime;
      sizzle.g.gain.setTargetAtTime(L.weld * (0.015 + Math.random() * 0.075), t, 0.012);
      if (L.weld > 0.05 && Math.random() < 0.18) {
        burst(c, weldPan, t, { dur: 0.03, gain: L.weld * 0.16, filter: "highpass", freq: 2500, q: 0.6, attack: 0.002 });
      }
    },
  );

  every(
    () => 480,
    () => {
      if (L.beep && L.fork > 0.03) tone(c, forkPan, c.currentTime, { type: "square", freq: 1020, dur: 0.2, gain: L.fork * 0.05, attack: 0.004 });
    },
  );

  // A far-off clang or an air-tool hiss every so often.
  every(
    () => 5000 + Math.random() * 8000,
    () => {
      const t = c.currentTime;
      const p = c.createStereoPanner();
      p.pan.value = Math.random() * 2 - 1;
      p.connect(bus);
      if (Math.random() < 0.55) {
        const f = 520 + Math.random() * 420;
        tone(c, p, t, { type: "triangle", freq: f, freqEnd: f * 0.97, dur: 1.1, gain: 0.02 });
        tone(c, p, t, { type: "square", freq: f * 2.76, dur: 0.25, gain: 0.006 });
        burst(c, p, t, { dur: 0.05, gain: 0.03, filter: "bandpass", freq: 2200, q: 1 });
      } else {
        burst(c, p, t, { dur: 0.35, gain: 0.018, filter: "highpass", freq: 3500, q: 0.5, attack: 0.02 });
      }
    },
  );

  // Chatter: short phrases of syllables, each phrase from a "speaker" with their own pitch.
  const syllable = (dest: AudioNode, at: number, pitch: number, dur: number) => {
    const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(pitch * (1 + Math.random() * 0.1), at);
    o.frequency.linearRampToValueAtTime(pitch * (0.88 + Math.random() * 0.2), at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(1, at + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    for (const [fc, q, w] of [
      [f1, 7, 1],
      [f2, 9, 0.55],
    ] as const) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = fc * (0.94 + Math.random() * 0.12);
      bp.Q.value = q;
      const gw = c.createGain();
      gw.gain.value = w;
      o.connect(bp).connect(gw).connect(g);
    }
    g.connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
  };
  const phrase = () => {
    if (L.voice > 0.04) {
      const pitch = 95 + Math.random() * 120;
      const count = 3 + Math.floor(Math.random() * 5);
      let t = c.currentTime;
      const vol = c.createGain();
      vol.gain.value = L.voice * 0.07;
      vol.connect(voicePan);
      for (let i = 0; i < count; i++) {
        const dur = 0.09 + Math.random() * 0.1;
        syllable(vol, t, pitch, dur);
        t += dur + 0.03 + Math.random() * 0.09;
      }
      timers.push(window.setTimeout(() => vol.disconnect(), 3000));
    }
    timers.push(window.setTimeout(phrase, 1400 + Math.random() * 3200));
  };
  timers.push(window.setTimeout(phrase, 1500));

  const set = (next: Partial<HallLevels>) => {
    Object.assign(L, next);
    const t = c.currentTime;
    motor.o.frequency.setTargetAtTime(52 + L.crane * 55, t, 0.15);
    motor.g.gain.setTargetAtTime(L.crane * 0.1, t, 0.12);
    whine.g.gain.setTargetAtTime(L.crane * 0.03, t, 0.12);
    winch.g.gain.setTargetAtTime(L.hoist * 0.11, t, 0.12);
    winchGrind.g.gain.setTargetAtTime(L.hoist * 0.025, t, 0.12);
    weldPan.pan.setTargetAtTime(L.weldPan, t, 0.1);
    forkPan.pan.setTargetAtTime(L.forkPan, t, 0.1);
    voicePan.pan.setTargetAtTime(L.voicePan, t, 0.2);
    engine.g.gain.setTargetAtTime(L.fork * 0.07, t, 0.2);
    engineNoise.g.gain.setTargetAtTime(L.fork * 0.05, t, 0.2);
  };

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stop);
    for (const id of timers) window.clearTimeout(id);
    const now = c.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0, now + 0.6);
    for (const s of sources) {
      try {
        s.stop(now + 0.65);
      } catch {
        /* already stopped */
      }
    }
  };
  liveLoops.add(stop);
  return { set, stop };
}
