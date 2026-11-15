import { audio, enabled, holdDuck, stopSpeaking } from "./sfx";

/**
 * A recording from the mission itself, played on the voice bus (the score and the rest duck under
 * it). Used for the Apollo 8 crew's reading of Genesis from lunar orbit (NASA, public domain; see
 * assets/CREDITS.md). Fetched and decoded once; a missing file or a muted game is silence.
 */

const buffers = new Map<string, Promise<AudioBuffer | null>>();

function load(url: string): Promise<AudioBuffer | null> {
  const a = audio();
  if (!a) return Promise.resolve(null);
  let pending = buffers.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => a.c.decodeAudioData(data))
      .catch(() => {
        buffers.delete(url);
        return null;
      });
    buffers.set(url, pending);
  }
  return pending;
}

/** Fetches and decodes a recording ahead of time, so it starts on cue. */
export function preloadBroadcast(url: string): void {
  if (enabled()) void load(url);
}

export interface Broadcast {
  stop: (fade?: number) => void;
  /** Seconds into the recording now, as heard; null before it has started (or when muted). */
  position: () => number | null;
}

/**
 * Plays a recording from `offsetS` seconds in (to join it part-way, after a skip or a late start). A
 * function is read once the recording is ready, so a slow download still starts in step with the film.
 */
export function playBroadcast(url: string, offsetS: number | (() => number) = 0, gain = 1.8): Broadcast {
  let stopped = false;
  let source: AudioBufferSourceNode | null = null;
  let level: GainNode | null = null;
  let started: { ctxAt: number; offset: number } | null = null;
  const end = () => {
    if (!stopped && started) holdDuck(null);
    stopped = true;
  };
  const position = () => {
    const a = audio();
    if (!started || !a || stopped) return null;
    return started.offset + (a.c.currentTime - started.ctxAt);
  };
  const stop = (fade = 0.4) => {
    if (stopped) return;
    const a = audio();
    if (a && source && level) {
      level.gain.setTargetAtTime(0.0001, a.c.currentTime, fade / 3);
      source.stop(a.c.currentTime + fade);
    }
    end();
  };
  if (!enabled()) return { stop: () => {}, position: () => null };
  void load(url).then((buffer) => {
    const a = audio();
    const at = typeof offsetS === "function" ? offsetS() : offsetS;
    if (stopped || !a || !buffer || at >= buffer.duration) return;
    source = a.c.createBufferSource();
    source.buffer = buffer;
    level = a.c.createGain();
    level.gain.value = gain;
    source.connect(level).connect(a.voice);
    source.onended = end;
    // Nothing else speaks over the crew: cut any line still playing and keep the rest of the sound low.
    stopSpeaking();
    holdDuck(0.12);
    started = { ctxAt: a.c.currentTime, offset: Math.max(0, at) };
    source.start(0, Math.max(0, at));
  });
  return { stop, position };
}
