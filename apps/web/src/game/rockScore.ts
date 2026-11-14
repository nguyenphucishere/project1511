import { audio, enabled, liveLoops, noise } from "./sfx";

/**
 * A procedural rock-and-orchestra score for the launch (Web Audio, no files): a band (kick,
 * snare, hats, bass, distorted power chords) under an orchestra (strings, choir, timpani) with an
 * organ arpeggio on top. Written in A minor on the progression Am – F – C – G.
 *
 * One number, `setIntensity(0..1)`, drives the arrangement, so a scene only has to say how
 * dramatic the moment is: a held organ and a heartbeat at low levels, then hats and bass, the full
 * kit, open guitars with strings and timpani, and finally the choir and a crash on every bar.
 * Everything is an original arrangement written for this game.
 */

const BPM = 132;
const STEP = 60 / BPM / 4; // a sixteenth note, seconds
const BAR_STEPS = 16;

/** Chord roots (Hz) for the four bars: A, F, C, G (low octave). */
const ROOTS = [55, 43.65, 65.41, 49];
/** Chord tones above the root, as semitone offsets, for the strings and the arpeggio. */
const MINOR = [0, 7, 12, 15];
const MAJOR = [0, 7, 12, 16];
const TONES = [MINOR, MAJOR, MAJOR, MAJOR];

const semitone = (root: number, n: number) => root * Math.pow(2, n / 12);

export interface RockScore {
  /** 0 = held organ and heartbeat; 1 = everything. Smoothed, so it can be set freely. */
  setIntensity: (level: number) => void;
  /** An orchestral hit: cymbal swell and timpani, for the moment of ignition or a big cut. */
  hit: () => void;
  /** A rising sweep of noise, strings and a pitched tone, building for `seconds` to the next hit. */
  riser: (seconds: number) => void;
  /** Fades out over `seconds` and stops. */
  stop: (seconds?: number) => void;
}

export function startRockScore(initial = 0.15): RockScore {
  const none: RockScore = { setIntensity: () => {}, hit: () => {}, riser: () => {}, stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;

  // Everything runs through a compressor so a full band never clips.
  const master = c.createGain();
  master.gain.value = 0.0001;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  master.connect(comp).connect(out);
  master.gain.setTargetAtTime(0.85, c.currentTime, 1.2);

  const noiseBuf = noise(c);
  const shaper = c.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 9);
  }
  shaper.curve = curve;
  shaper.oversample = "2x";
  const cab = c.createBiquadFilter(); // a guitar cabinet: no fizz above ~3.5 kHz
  cab.type = "lowpass";
  cab.frequency.value = 3400;
  cab.Q.value = 0.7;
  const mid = c.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 900;
  mid.gain.value = 5;
  const guitarBus = c.createGain();
  guitarBus.gain.value = 0.22;
  guitarBus.connect(shaper).connect(mid).connect(cab).connect(master);

  const env = (g: GainNode, t: number, peak: number, attack: number, dur: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  const osc = (type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode, peak: number, attack = 0.005, detune = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = c.createGain();
    env(g, t, peak, attack, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const burst = (t: number, dur: number, peak: number, type: BiquadFilterType, freq: number, dest: AudioNode = master, q = 0.7) => {
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    env(g, t, peak, 0.002, dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  };

  /* ---- the instruments ---- */
  const kick = (t: number, v: number) => {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = c.createGain();
    env(g, t, 0.9 * v, 0.003, 0.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.35);
    burst(t, 0.02, 0.25 * v, "highpass", 2500);
  };
  const snare = (t: number, v: number) => {
    burst(t, 0.2, 0.5 * v, "bandpass", 1900, master, 0.8);
    osc("triangle", 190, t, 0.12, master, 0.35 * v);
  };
  const hat = (t: number, v: number, open = false) => burst(t, open ? 0.22 : 0.04, 0.12 * v, "highpass", 7500);
  const crash = (t: number, v: number) => burst(t, 2.2, 0.35 * v, "highpass", 4200);
  const timpani = (t: number, freq: number, v: number) => {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(freq * 1.25, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.2);
    const g = c.createGain();
    env(g, t, 0.9 * v, 0.004, 1.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 1.4);
    burst(t, 0.08, 0.3 * v, "lowpass", 600);
  };
  const bass = (t: number, f: number, dur: number, v: number) => {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    lp.connect(master);
    osc("sawtooth", f, t, dur, lp, 0.42 * v, 0.004);
    osc("square", f, t, dur, lp, 0.18 * v, 0.004);
  };
  const power = (t: number, root: number, dur: number, v: number, muted: boolean) => {
    const f = root * 2;
    const d = muted ? 0.11 : dur;
    for (const [m, det] of [[0, -6], [7, 5], [12, 0]] as const) {
      osc("sawtooth", semitone(f, m), t, d, guitarBus, v, 0.004, det);
    }
  };
  const strings = (t: number, root: number, tones: number[], dur: number, v: number) => {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    lp.connect(master);
    for (const n of tones) {
      for (const det of [-9, 0, 9]) osc("sawtooth", semitone(root * 4, n), t, dur, lp, 0.05 * v, dur * 0.4, det);
    }
  };
  const choir = (t: number, root: number, tones: number[], dur: number, v: number) => {
    // Two formant filters turn raw saws into a held "aah".
    const bus = c.createGain();
    bus.gain.value = 1;
    for (const [fc, q] of [[700, 6], [1150, 8]] as const) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = fc;
      bp.Q.value = q;
      bus.connect(bp).connect(master);
    }
    for (const n of tones) for (const det of [-7, 7]) osc("sawtooth", semitone(root * 8, n), t, dur, bus, 0.09 * v, dur * 0.45, det);
  };
  const organ = (t: number, f: number, dur: number, v: number) => {
    osc("sine", f, t, dur, master, 0.12 * v, 0.01);
    osc("triangle", f * 2, t, dur, master, 0.07 * v, 0.01);
    osc("sine", f * 3, t, dur, master, 0.03 * v, 0.01);
  };

  /* ---- the arrangement ---- */
  let level = initial;
  let target = initial;
  let step = 0;
  let nextTime = c.currentTime + 0.1;
  let stopped = false;

  const play = (s: number, t: number) => {
    const bar = Math.floor(s / BAR_STEPS) % 4;
    const i = s % BAR_STEPS;
    const root = ROOTS[bar]!;
    const tones = TONES[bar]!;
    const L = level;

    // Organ arpeggio and heartbeat: always there, the arpeggio quickening with the intensity.
    const arpEvery = L < 0.35 ? 2 : 1;
    if (i % arpEvery === 0) {
      const n = tones[(i / arpEvery) % tones.length]! + (i % 8 >= 4 ? 12 : 0);
      organ(t, semitone(root * 4, n), STEP * 2.2, 0.55 + L * 0.3);
    }
    if (i === 0 || i === 6) kick(t, 0.45 + L * 0.3); // a slow double heartbeat
    if (i === 0) organ(t, root * 2, STEP * 15, 0.9);

    // Hats and bass join early.
    if (L >= 0.2 && i % 2 === 0) hat(t, 0.5 + L * 0.5, i % 8 === 6);
    if (L >= 0.28 && i % 2 === 0) bass(t, root * 2, STEP * 1.8, 0.6 + L * 0.4);

    // Full kit.
    if (L >= 0.45) {
      if (i === 0 || i === 4 * 2 || i === 10 || (L >= 0.8 && i === 14)) kick(t, 0.9);
      if (i === 4 || i === 12) snare(t, 0.9);
      if (i % 2 === 1) hat(t, 0.4);
    }

    // Guitars: palm-muted chugging, then open chords that ring through the bar.
    if (L >= 0.45 && L < 0.7 && i % 2 === 0) power(t, root, STEP, 0.5, true);
    if (L >= 0.7) {
      if (i === 0) power(t, root, STEP * 8, 0.55, false);
      if (i === 8) power(t, root, STEP * 8, 0.5, false);
      if (i % 4 === 2 && L < 0.9) power(t, root, STEP, 0.4, true);
    }

    // The orchestra swells in over the second half of the climb.
    if (L >= 0.6 && i === 0) strings(t, root, tones, STEP * 16, 0.7 + (L - 0.6));
    if (L >= 0.6 && (i === 0 || i === 8)) timpani(t, root * 2, 0.7);
    if (L >= 0.88) {
      if (i === 0) {
        crash(t, 0.9);
        choir(t, root, tones.slice(0, 3), STEP * 16, 1);
      }
      if (i === 8) crash(t, 0.4);
    }
  };

  const tick = () => {
    if (stopped) return;
    level += (target - level) * 0.12;
    while (nextTime < c.currentTime + 0.14) {
      play(step, nextTime);
      step += 1;
      nextTime += STEP;
    }
  };
  const timer = window.setInterval(tick, 30);

  const stop = (seconds = 1.5) => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stopNow);
    window.clearInterval(timer);
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(master.gain.value, c.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, c.currentTime + seconds);
    window.setTimeout(() => master.disconnect(), seconds * 1000 + 300);
  };
  const stopNow = () => stop(0.2);
  liveLoops.add(stopNow);

  return {
    setIntensity: (v) => {
      target = Math.min(1, Math.max(0, v));
    },
    hit: () => {
      if (stopped) return;
      const t = c.currentTime + 0.02;
      crash(t, 1);
      timpani(t, 55, 1);
      timpani(t + STEP * 2, 55, 0.8);
      level = Math.max(level, 0.5);
      // Sub-bass boom and a low brass "braam": detuned saws through a falling filter.
      osc("sine", 38, t, 2.4, master, 1.0, 0.01);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(1800, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + 1.6);
      lp.connect(master);
      for (const det of [-14, -5, 5, 14]) {
        osc("sawtooth", 55, t, 1.8, lp, 0.22, 0.03, det);
        osc("sawtooth", 82.4, t, 1.8, lp, 0.14, 0.03, det);
      }
    },
    riser: (seconds) => {
      if (stopped) return;
      const t = c.currentTime + 0.02;
      const end = t + seconds;
      // Filtered noise sweeping up
      const s = c.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(7000, end);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, end);
      g.gain.linearRampToValueAtTime(0.0001, end + 0.03);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random());
      s.stop(end + 0.1);
      // Tremolo strings climbing an octave and a half, getting faster
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(330, end);
      const trem = c.createGain();
      const lfo = c.createOscillator();
      lfo.frequency.setValueAtTime(5, t);
      lfo.frequency.linearRampToValueAtTime(22, end);
      const depth = c.createGain();
      depth.gain.value = 0.2;
      lfo.connect(depth).connect(trem.gain);
      trem.gain.value = 0.25;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.exponentialRampToValueAtTime(4000, end);
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.22, end);
      og.gain.linearRampToValueAtTime(0.0001, end + 0.03);
      o.connect(lp).connect(trem).connect(og).connect(master);
      o.start(t);
      lfo.start(t);
      o.stop(end + 0.1);
      lfo.stop(end + 0.1);
      // Timpani roll that tightens
      for (let k = 0, at = t; at < end; k++) {
        timpani(at, 55, 0.25 + 0.55 * ((at - t) / seconds));
        at += Math.max(0.07, 0.3 - k * 0.018);
      }
    },
    stop,
  };
}

/**
 * The quiet after the last step: a slow, spacious pad, a deep drone and a few high bell notes with
 * long tails. Meant for the stretch where nothing happens but the Earth in the window.
 */
export function startCalmScore(): { stop: (seconds?: number) => void } {
  const none = { stop: () => {} };
  if (!enabled()) return none;
  const a = audio();
  if (!a) return none;
  const { c, out } = a;

  const master = c.createGain();
  master.gain.value = 0.0001;
  master.gain.setTargetAtTime(0.75, c.currentTime, 1.6);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1800;
  lp.Q.value = 0.5;
  // A long, dark reverb made of a few feedback delays
  const wet = c.createGain();
  wet.gain.value = 0.45;
  for (const [time, fb] of [[0.37, 0.5], [0.53, 0.45], [0.71, 0.4]] as const) {
    const d = c.createDelay(1.5);
    d.delayTime.value = time;
    const g = c.createGain();
    g.gain.value = fb;
    const damp = c.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1600;
    lp.connect(d);
    d.connect(damp).connect(g).connect(d);
    d.connect(wet);
  }
  wet.connect(master);
  lp.connect(master);
  master.connect(out);

  const note = (freq: number, t: number, dur: number, peak: number, attack: number, type: OscillatorType = "sine", detune = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  // Am9, Fmaj7, Cmaj9, Gadd9: six seconds each
  const CHORDS: number[][] = [
    [55, 82.41, 110, 164.81, 246.94],
    [43.65, 65.41, 87.31, 130.81, 220],
    [65.41, 98, 130.81, 196, 293.66],
    [49, 73.42, 98, 146.83, 246.94],
  ];
  const BELLS = [880, 987.77, 1174.66, 1318.51, 1567.98];
  const SPAN = 6;
  let bar = 0;
  let next = c.currentTime + 0.05;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    while (next < c.currentTime + 1) {
      const chord = CHORDS[bar % CHORDS.length]!;
      chord.forEach((f, i) => {
        note(f, next, SPAN + 2.5, i === 0 ? 0.3 : 0.1, 2.4, i < 2 ? "sine" : "triangle", i % 2 ? 5 : -5);
        if (i >= 2) note(f * 2, next + 0.3, SPAN + 1, 0.025, 2.6, "sine", 4);
      });
      // A few bell notes, unhurried
      for (let k = 0; k < 3; k++) {
        const at = next + 0.8 + k * 1.9 + (bar % 2) * 0.4;
        note(BELLS[(bar * 2 + k * 3) % BELLS.length]!, at, 4.5, 0.05, 0.01);
      }
      next += SPAN;
      bar += 1;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 500);

  const stop = (seconds = 2) => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stopNow);
    window.clearInterval(timer);
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), c.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, c.currentTime + seconds);
    window.setTimeout(() => master.disconnect(), seconds * 1000 + 400);
  };
  const stopNow = () => stop(0.2);
  liveLoops.add(stopNow);
  return { stop };
}
