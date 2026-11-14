/**
 * An independent watcher for the spoken lines: it records what the voice player does (a line asked for,
 * started, ended, cut off) and the scene changes around it, and then says what went wrong, without the
 * scenes having to know it exists. The same checks run on a live session (window.__voiceTrace.issues()
 * in development, and the console warns as they happen) and on recorded events in tests.
 *
 * What it flags:
 *   late     a line started long after it was asked for (a download or decode in the way)
 *   cut      a line was stopped well before its recording ended (the next call, a scene change)
 *   overlap  two lines on one channel were heard at the same time
 *   leak     a line kept playing after the scene it belongs to had already changed
 *   missing  a line with no recording stayed silent
 */

export type TraceEvent =
  | { k: "request"; id: number; text: string; ch: string; t: number; d?: number; queued: boolean }
  /** A queued line's turn has come: lateness is counted from here, not from the request. */
  | { k: "ready"; id: number; t: number }
  | { k: "start"; id: number; t: number }
  | { k: "end"; id: number; t: number }
  | { k: "cut"; id: number; t: number }
  | { k: "missing"; text: string; ch: string; t: number }
  | { k: "scene"; name: string; t: number };

export type IssueKind = "late" | "cut" | "overlap" | "leak" | "missing";

export interface Issue {
  kind: IssueKind;
  /** Milliseconds on the tracer's clock. */
  at: number;
  message: string;
}

export interface TraceLimits {
  /** A line later than this (ms) between being due and being heard is late. */
  lateMs: number;
  /** A line cut off with more than this (ms) of its recording unplayed is cut. */
  cutMs: number;
  /** Two lines on a channel overlapping by more than this (ms) overlap. */
  overlapMs: number;
  /** A line still heard this long (ms) after its scene ended is a leak. */
  leakMs: number;
}

export const DEFAULT_LIMITS: TraceLimits = { lateMs: 300, cutMs: 250, overlapMs: 120, leakMs: 1000 };

interface Row {
  id: number;
  text: string;
  ch: string;
  d?: number;
  due: number;
  start?: number;
  stop?: number;
  how?: "end" | "cut";
  /** Scene change times (ms) the line started before. */
}

const short = (s: string) => (s.length > 48 ? `${s.slice(0, 45)}...` : s);

/** Reads a list of events and returns what went wrong. Pure: the same events always give the same issues. */
export function analyze(events: TraceEvent[], limits: Partial<TraceLimits> = {}): Issue[] {
  const L = { ...DEFAULT_LIMITS, ...limits };
  const issues: Issue[] = [];
  const rows = new Map<number, Row>();
  const scenes: { name: string; t: number }[] = [];
  for (const e of events) {
    switch (e.k) {
      case "request":
        rows.set(e.id, { id: e.id, text: e.text, ch: e.ch, d: e.d, due: e.t });
        break;
      case "ready": {
        const r = rows.get(e.id);
        if (r) r.due = e.t;
        break;
      }
      case "start": {
        const r = rows.get(e.id);
        if (r) r.start = e.t;
        break;
      }
      case "end":
      case "cut": {
        const r = rows.get(e.id);
        if (r) {
          r.stop = e.t;
          r.how = e.k;
        }
        break;
      }
      case "missing":
        issues.push({ kind: "missing", at: e.t, message: `no recording, stayed silent: "${short(e.text)}"` });
        break;
      case "scene":
        scenes.push({ name: e.name, t: e.t });
        break;
    }
  }

  const played = [...rows.values()].filter((r) => r.start !== undefined);
  for (const r of played) {
    const start = r.start!;
    if (start - r.due > L.lateMs) issues.push({ kind: "late", at: start, message: `started ${Math.round(start - r.due)} ms late: "${short(r.text)}"` });
    if (r.how === "cut" && r.d !== undefined && r.stop !== undefined) {
      const left = r.d * 1000 - (r.stop - start);
      if (left > L.cutMs) issues.push({ kind: "cut", at: r.stop, message: `cut off with ${(left / 1000).toFixed(1)} s unsaid: "${short(r.text)}"` });
    }
    // A line that is still going (no stop recorded) is judged by its recording's length.
    const stop = r.stop ?? (r.d !== undefined ? start + r.d * 1000 : undefined);
    if (stop === undefined) continue;
    for (const s of scenes) {
      if (s.t > start && stop - s.t > L.leakMs) {
        issues.push({ kind: "leak", at: s.t, message: `"${short(r.text)}" kept playing ${((stop - s.t) / 1000).toFixed(1)} s into "${s.name}"` });
      }
    }
  }
  // Overlap on one channel.
  const byChannel = new Map<string, Row[]>();
  for (const r of played) (byChannel.get(r.ch) ?? byChannel.set(r.ch, []).get(r.ch)!).push(r);
  for (const list of byChannel.values()) {
    list.sort((a, b) => a.start! - b.start!);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const prevStop = prev.stop ?? (prev.d !== undefined ? prev.start! + prev.d * 1000 : prev.start!);
      const over = prevStop - list[i]!.start!;
      if (over > L.overlapMs) issues.push({ kind: "overlap", at: list[i]!.start!, message: `"${short(prev.text)}" and "${short(list[i]!.text)}" overlapped by ${Math.round(over)} ms on ${prev.ch}` });
    }
  }
  return issues.sort((a, b) => a.at - b.at);
}

export interface Tracer {
  record: (e: TraceEvent) => void;
  scene: (name: string) => void;
  events: () => TraceEvent[];
  issues: (limits?: Partial<TraceLimits>) => Issue[];
  clear: () => void;
}

/** Keeps the last `max` events. `warn` hears each new issue as it appears (a console in development). */
export function createTracer(now: () => number, opts: { max?: number; warn?: (i: Issue) => void } = {}): Tracer {
  const max = opts.max ?? 2000;
  let events: TraceEvent[] = [];
  const seen = new Set<string>();
  const record = (e: TraceEvent) => {
    events.push(e);
    if (events.length > max) events = events.slice(-max);
    if (opts.warn && (e.k === "end" || e.k === "cut" || e.k === "start" || e.k === "missing" || e.k === "scene")) {
      for (const i of analyze(events)) {
        const key = `${i.kind}|${i.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        opts.warn(i);
      }
    }
  };
  return {
    record,
    scene: (name) => record({ k: "scene", name, t: now() }),
    events: () => events,
    issues: (limits) => analyze(events, limits),
    clear: () => {
      events = [];
      seen.clear();
    },
  };
}
