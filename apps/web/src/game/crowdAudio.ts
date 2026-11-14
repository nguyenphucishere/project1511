import { audio, enabled, liveLoops } from "./sfx";

/**
 * The crowd that came to watch the launch: a murmur that never quite stops, a gasp when the
 * rocket clears the tower, a cheer when it reaches orbit. Three tiny public-domain clips (about
 * 230 KB in all, see assets/CREDITS.md), fetched once and decoded on first use, so the cost on
 * the page is a few hundred KB of memory and no per-frame work beyond one gain ramp.
 */

export type CrowdClip = "murmur" | "awe" | "cheer";

const FILES: Record<CrowdClip, string> = {
  murmur: "/assets/audio/crowd-murmur.mp3",
  awe: "/assets/audio/crowd-awe.mp3",
  cheer: "/assets/audio/crowd-cheer.mp3",
};

/** One decode per clip per page load, shared by every bed that starts later. */
const buffers = new Map<CrowdClip, Promise<AudioBuffer | null>>();

function load(clip: CrowdClip): Promise<AudioBuffer | null> {
  const a = audio();
  if (!a) return Promise.resolve(null);
  let pending = buffers.get(clip);
  if (!pending) {
    pending = fetch(FILES[clip])
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => a.c.decodeAudioData(data))
      .catch(() => {
        // A missing file or a browser without MP3 decoding is silence, not a crash; try again next time.
        buffers.delete(clip);
        return null;
      });
    buffers.set(clip, pending);
  }
  return pending;
}

/** Fetches and decodes all three clips ahead of the launch, so nothing stalls at ignition. */
export function preloadCrowd(): void {
  if (!enabled()) return;
  for (const clip of Object.keys(FILES) as CrowdClip[]) void load(clip);
}

export interface CrowdBed {
  /** 0..1: how close the listener is to the crowd. Far is quiet and muffled, close is loud and bright. */
  setLevel: (level: number) => void;
  /** A one-shot reaction on top of the murmur. */
  react: (clip: Exclude<CrowdClip, "murmur">, gain?: number) => void;
  stop: (fade?: number) => void;
}

const NONE: CrowdBed = { setLevel: () => {}, react: () => {}, stop: () => {} };

/** Starts the murmur loop (silent until `setLevel` raises it) and returns its controls. */
export function startCrowdBed(): CrowdBed {
  if (!enabled()) return NONE;
  const a = audio();
  if (!a) return NONE;
  const { c, out } = a;

  // Everything the crowd makes passes through one low-pass and one gain: distance is a darker, quieter crowd.
  const bus = c.createGain();
  bus.gain.value = 0.0001;
  const air = c.createBiquadFilter();
  air.type = "lowpass";
  air.frequency.value = 900;
  air.connect(bus).connect(out);

  let stopped = false;
  let loop: AudioBufferSourceNode | null = null;

  void load("murmur").then((buffer) => {
    if (!buffer || stopped) return;
    loop = c.createBufferSource();
    loop.buffer = buffer;
    loop.loop = true;
    loop.connect(air);
    loop.start();
  });

  const stop = (fade = 0.8) => {
    if (stopped) return;
    stopped = true;
    liveLoops.delete(stopNow);
    const now = c.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), now);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    loop?.stop(now + fade + 0.05);
    window.setTimeout(() => bus.disconnect(), (fade + 0.2) * 1000);
  };
  const stopNow = () => stop(0.1);
  // Muting in settings silences it like every other loop.
  liveLoops.add(stopNow);

  return {
    setLevel: (level) => {
      if (stopped) return;
      const l = Math.min(1, Math.max(0, level));
      const now = c.currentTime;
      // Squared, so the quiet end of the range is quiet; the time constant smooths cuts between shots.
      bus.gain.setTargetAtTime(0.0001 + 0.9 * l * l, now, 0.5);
      air.frequency.setTargetAtTime(700 + 6500 * l, now, 0.5);
    },
    react: (clip, gain = 1) => {
      if (stopped) return;
      void load(clip).then((buffer) => {
        if (!buffer || stopped) return;
        const src = c.createBufferSource();
        src.buffer = buffer;
        const g = c.createGain();
        g.gain.value = gain;
        src.connect(g).connect(bus);
        src.start();
      });
    },
    stop,
  };
}
