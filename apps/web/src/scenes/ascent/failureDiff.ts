import { FLAVOR, SCRIPT, type Cue } from "./failureScript";
import type { FailureCode } from "@/game/ascentFlight";

/**
 * How different two failure films are, from 0 (the same film) to 1 (nothing in common), judged on
 * what a player sees and hears: the words, when the cuts come, what each cut shows, and how the
 * cabin looks and sounds. Used only by the tests, to keep the five failures from drifting back
 * toward one template. It measures sameness, not quality.
 */
export interface Difference {
  /** The lines spoken (a line used by both counts as shared). */
  text: number;
  /** When the cuts come: a cut is shared when the other film cuts at the same moment (within a tenth of a second). */
  rhythm: number;
  /** What each cut shows and does, in order: edit distance between the two sequences of (kind, who, where, how long, effects). */
  cutting: number;
  /** The look and sound of the whole cabin: light, glass, instrument, sound bed, effects. */
  look: number;
  /** The mean of the four. */
  overall: number;
}

/** Two cuts this close count as the same moment: about three frames, the eye does not tell them apart. */
const TOLERANCE_S = 0.1;
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function jaccardDistance<T>(a: Set<T>, b: Set<T>): number {
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  const either = a.size + b.size - both;
  return either === 0 ? 0 : 1 - both / either;
}

function editDistance(a: string[], b: string[]): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

const lenClass = (ms: number) => (ms < 1500 ? "short" : ms < 2500 ? "mid" : "long");
const token = (c: Cue) => {
  const kind = c.shot ?? "helmet";
  return `${c.phase}:${kind}:${kind === "helmet" ? `${c.who}:${c.look}` : "-"}:${lenClass(c.ms)}:${(c.fx ?? []).join("+")}`;
};

/** Every statement about how the whole cabin looks and sounds in this film (what happens at each cut is judged in the cutting), as plain strings so two films can be compared. */
function lookTags(code: FailureCode): Set<string> {
  const f = FLAVOR[code];
  const tags = new Set<string>([
    `cause:${code}`, // each failure has its own effects over the window (cracks, dust, sink-rate, streaks, power loss)
    `glow:${f.glow}`,
    `gauge:${f.gauge}`,
    `helmet:${f.helmet}`,
    `bed:${f.bed}`,
    `shake:${f.shake >= 0.75 ? "hard" : f.shake >= 0.4 ? "medium" : "soft"}`,
  ]);
  if (f.storm) tags.add("storm");
  if (f.sway) tags.add("sway");
  if (f.hush) tags.add("hush");
  if (f.groans) tags.add("groans");
  return tags;
}

export function difference(a: FailureCode, b: FailureCode): Difference {
  const ca = SCRIPT[a];
  const cb = SCRIPT[b];
  const text = jaccardDistance(
    new Set(ca.filter((c) => c.line).map((c) => norm(c.line!.en))),
    new Set(cb.filter((c) => c.line).map((c) => norm(c.line!.en))),
  );
  const matched = (from: Cue[], to: Cue[]) => from.filter((c) => to.some((d) => d.phase === c.phase && Math.abs(d.at - c.at) <= TOLERANCE_S)).length;
  const rhythm = 1 - (matched(ca, cb) + matched(cb, ca)) / (ca.length + cb.length);
  const ta = ca.map(token);
  const tb = cb.map(token);
  const cutting = editDistance(ta, tb) / Math.max(ta.length, tb.length);
  const look = jaccardDistance(lookTags(a), lookTags(b));
  return { text, rhythm, cutting, look, overall: (text + rhythm + cutting + look) / 4 };
}

export const FAILURE_CODES = Object.keys(SCRIPT) as FailureCode[];
