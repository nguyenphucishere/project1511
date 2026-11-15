import { audio, enabled, liveLoops, noise } from "./sfx";

/**
 * The sound that runs under a failing flight, a different one for each way it can fail, so the five
 * films are not just five sets of words over the same alarm. All procedural (Web Audio), like the rest
 * of the effects:
 *   strain  the stack groaning: a low shudder with metal creaking at uneven moments
 *   drain   the tanks emptying: a hum that sinks, and a slow tick that gets slower
 *   sink    a ground-proximity warning: two alternating beeps
 *   wind    a gale: noise swept through a filter, in gusts
 *   static  a dead radio and arcing wiring: hiss with crackles and pops
 */
export type CauseBedKind = "strain" | "drain" | "sink" | "wind" | "static";

export interface CauseBed {
  /** 0 to 1: how hard the failure is (the bed swells with it). */
  setLevel: (level: number) => void;
  stop: (fade?: number) => void;
}

const NONE: CauseBed = { setLevel: () => {}, stop: () => {} };

export function startCauseBed(kind: CauseBedKind): CauseBed {
  if (!enabled()) return NONE;
  const a = audio();
  if (!a) return NONE;
  const { c, out } = a;

  const bus = c.createGain();
  bus.gain.value = 0.0001;
  bus.connect(out);
  const stoppables: { stop: (t?: number) => void }[] = [];
  const timers: number[] = [];
  let stopped = false;
  let level = 0.2;

  /** A short filtered noise burst through the bed's bus. */
  const burst = (type: BiquadFilterType, freq: number, q: number, dur: number, gain: number) => {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  };
  const beep = (freq: number, dur: number, gain: number, type: OscillatorType = "sine") => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.setValueAtTime(gain, t + dur - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  /** Calls `fn` at uneven intervals until the bed stops. */
  const every = (min: number, max: number, fn: () => void) => {
    const tick = () => {
      if (stopped) return;
      fn();
      timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000));
    };
    timers.push(window.setTimeout(tick, min * 400));
  };
  const steady = (type: OscillatorType, freq: number, gain: number, wobble?: { hz: number; depth: number }) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    o.connect(g).connect(bus);
    o.start();
    stoppables.push(o);
    if (wobble) {
      const lfo = c.createOscillator();
      lfo.frequency.value = wobble.hz;
      const d = c.createGain();
      d.gain.value = wobble.depth;
      lfo.connect(d).connect(g.gain);
      lfo.start();
      stoppables.push(lfo);
    }
    return o;
  };
  const looped = (filter: BiquadFilterType, freq: number, q: number, gain: number) => {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(bus);
    src.start();
    stoppables.push(src);
    return { f, g };
  };

  switch (kind) {
    case "strain": {
      steady("sine", 38, 0.5, { hz: 9, depth: 0.25 });
      steady("sawtooth", 52, 0.07, { hz: 13, depth: 0.05 });
      every(0.25, 1.1, () => burst("bandpass", 600 + Math.random() * 1400, 14, 0.12 + Math.random() * 0.18, 0.5 + Math.random() * 0.4));
      break;
    }
    case "drain": {
      const hum = steady("sine", 60, 0.35, { hz: 0.25, depth: 0.1 });
      hum.frequency.setTargetAtTime(32, c.currentTime + 2, 9);
      let gap = 1.1;
      const tick = () => {
        if (stopped) return;
        beep(2100, 0.04, 0.14, "square");
        gap = Math.min(3.2, gap * 1.18);
        timers.push(window.setTimeout(tick, gap * 1000));
      };
      timers.push(window.setTimeout(tick, 600));
      break;
    }
    case "sink": {
      steady("sine", 46, 0.28, { hz: 6, depth: 0.12 });
      let high = false;
      const alarm = () => {
        if (stopped) return;
        beep(high ? 660 : 990, 0.2, 0.2, "square");
        high = !high;
        timers.push(window.setTimeout(alarm, 520));
      };
      timers.push(window.setTimeout(alarm, 300));
      break;
    }
    case "wind": {
      const { f, g } = looped("bandpass", 500, 0.9, 0.7);
      const sweep = c.createOscillator();
      sweep.frequency.value = 0.33;
      const depth = c.createGain();
      depth.gain.value = 650;
      sweep.connect(depth).connect(f.frequency);
      sweep.start();
      stoppables.push(sweep);
      const gust = c.createOscillator();
      gust.frequency.value = 0.18;
      const gd = c.createGain();
      gd.gain.value = 0.35;
      gust.connect(gd).connect(g.gain);
      gust.start();
      stoppables.push(gust);
      looped("lowpass", 180, 0.7, 0.5);
      break;
    }
    case "static": {
      looped("highpass", 3500, 0.5, 0.18);
      looped("bandpass", 1200, 4, 0.05);
      every(0.06, 0.4, () => burst("highpass", 1500 + Math.random() * 4000, 1, 0.02 + Math.random() * 0.06, 0.4 + Math.random() * 0.5));
      every(1.4, 3.2, () => burst("lowpass", 160, 1, 0.35, 0.7));
      break;
    }
  }

  const setLevel = (l: number) => {
    level = Math.min(1, Math.max(0, l));
    bus.gain.setTargetAtTime(0.0001 + 0.32 * level, c.currentTime, 0.4);
  };
  setLevel(level);

  const stop = (fade = 0.6) => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stopNow);
    for (const id of timers) window.clearTimeout(id);
    const now = c.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), now);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    for (const s of stoppables) {
      try {
        s.stop(now + fade + 0.05);
      } catch {
        /* already stopped */
      }
    }
    window.setTimeout(() => bus.disconnect(), (fade + 0.2) * 1000);
  };
  const stopNow = () => stop(0.1);
  // Muting in settings silences it like every other loop.
  liveLoops.add(stopNow);

  return { setLevel, stop };
}
