import { audio, enabled, liveLoops, noise, playVoiceLine, stopVoiceLine } from "./sfx";

/**
 * Launch-control chatter over the radio. The browser's speech synthesis cannot be run through an
 * audio filter, so the radio is built around the voice instead: the key-up and key-down "Quindar"
 * beeps NASA used to switch a transmitter on and off, a faint hiss of open channel while the
 * voice speaks, and a tight, slightly fast delivery. Without speech synthesis (or with sound off)
 * a call is simply silent; the on-screen keyword carries the information either way.
 */

export type RadioVoice = "capcom" | "booster";

const VOICE_STYLE: Record<RadioVoice, { pitch: number; rate: number }> = {
  /** The Capsule Communicator: calm and even. */
  capcom: { pitch: 0.82, rate: 1.05 },
  /** The booster systems engineer: lower and more clipped. */
  booster: { pitch: 0.68, rate: 1.18 },
};

/** Safety net: a call never holds the channel open longer than this. */
const MAX_CALL_MS = 9000;

let stopCurrent: (() => void) | null = null;

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** Whether this browser has a voice for the language (voices load late, so ask at call time). */
export function hasVoice(locale: "en" | "vi"): boolean {
  const s = synth();
  if (!s) return false;
  return s.getVoices().some((v) => v.lang.toLowerCase().startsWith(locale));
}

/** A steady, low English voice when the system has one. */
function pickVoice(lang: "en" | "vi"): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (lang === "vi") return voices[0] ?? null;
  const preferred = /david|mark|guy|daniel|alex|fred|google us english|male/i;
  return voices.find((v) => preferred.test(v.name) && /en[-_]us/i.test(v.lang)) ?? voices.find((v) => /en[-_]us/i.test(v.lang)) ?? voices[0] ?? null;
}

/** A short sine beep, the radio's transmit switch. */
function beep(c: AudioContext, out: AudioNode, freq: number, at: number, dur: number) {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.07, at + 0.01);
  g.gain.setValueAtTime(0.07, at + dur - 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Cuts off whatever call is on the air. */
export function stopRadio() {
  stopCurrent?.();
  stopCurrent = null;
}

/**
 * Puts one line on the air: beep, voice over a faint hiss, beep. The language falls back to
 * English when the system has no voice for `locale`, as the chatter of real launches was English.
 */
export function radioCall(text: Record<"en" | "vi", string>, locale: "en" | "vi", voice: RadioVoice = "capcom") {
  const s = synth();
  // A recorded voice needs no speech synthesis; the browser voice is only the fallback for a line with no recording.
  if (!enabled()) return;
  const a = audio();
  if (!a) return;
  stopRadio();
  const { c, out } = a;
  const lang = locale === "vi" && hasVoice("vi") ? "vi" : "en";

  // The open channel: band-limited noise, a hair above silence while the voice is up.
  const hiss = c.createBufferSource();
  hiss.buffer = noise(c);
  hiss.loop = true;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2100;
  band.Q.value = 0.9;
  const hissGain = c.createGain();
  hissGain.gain.value = 0.0001;
  hiss.connect(band).connect(hissGain).connect(out);
  hiss.start();

  const now = c.currentTime;
  beep(c, out, 2525, now, 0.13);
  hissGain.gain.setTargetAtTime(0.012, now + 0.05, 0.03);

  let done = false;
  let timer = 0;
  let safety = 0;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    window.clearTimeout(safety);
    liveLoops.delete(stop);
    const t = c.currentTime;
    beep(c, out, 2475, t + 0.04, 0.1);
    hissGain.gain.setTargetAtTime(0.0001, t + 0.12, 0.04);
    hiss.stop(t + 0.4);
  };
  const stop = () => {
    if (done) return;
    s?.cancel();
    stopVoiceLine();
    finish();
  };
  liveLoops.add(stop);
  stopCurrent = stop;

  // The voice starts a beat after the key-up beep.
  timer = window.setTimeout(async () => {
    if (done) return;
    // The recorded voice first: the radio already supplies the beeps and the hiss, so the voice only gets the band-limited filter.
    const result = await playVoiceLine(text[locale], locale, { radio: true, hiss: false, onEnd: finish });
    if (done) {
      if (result === "played") stopVoiceLine();
      return;
    }
    if (result === "played") return;
    // No recording for this call: close the channel quietly (the browser voice only steps in if the library is unavailable).
    if (result === "missing" || !s) return finish();
    const u = new SpeechSynthesisUtterance(text[lang]);
    u.lang = lang === "vi" ? "vi-VN" : "en-US";
    const style = VOICE_STYLE[voice];
    u.pitch = style.pitch;
    u.rate = style.rate;
    u.volume = 0.95;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.onend = finish;
    u.onerror = finish;
    s.speak(u);
  }, 190);
  safety = window.setTimeout(stop, MAX_CALL_MS);
}
