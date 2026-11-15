import { describe, expect, it } from "vitest";
import { analyze, createTracer, type TraceEvent } from "./voiceTrace";

const req = (id: number, t: number, extra: Partial<Extract<TraceEvent, { k: "request" }>> = {}): TraceEvent => ({ k: "request", id, text: `line ${id}`, ch: "main", t, queued: false, ...extra });

describe("the independent voice watcher", () => {
  it("is quiet when lines start promptly, finish, and do not overlap", () => {
    const events: TraceEvent[] = [req(1, 0, { d: 2 }), { k: "start", id: 1, t: 80 }, { k: "end", id: 1, t: 2080 }, req(2, 2500, { d: 1 }), { k: "start", id: 2, t: 2560 }, { k: "end", id: 2, t: 3560 }];
    expect(analyze(events)).toEqual([]);
  });

  it("flags a line that started late (a download in the way)", () => {
    const issues = analyze([req(1, 0, { d: 2 }), { k: "start", id: 1, t: 900 }, { k: "end", id: 1, t: 2900 }]);
    expect(issues.map((i) => i.kind)).toEqual(["late"]);
  });

  it("does not count a queued line's wait as lateness", () => {
    const events: TraceEvent[] = [req(2, 0, { d: 2, queued: true }), { k: "ready", id: 2, t: 5000 }, { k: "start", id: 2, t: 5050 }, { k: "end", id: 2, t: 7050 }];
    expect(analyze(events)).toEqual([]);
  });

  it("flags a line cut off before it finished, but not one cut in its last moments", () => {
    const cut = analyze([req(1, 0, { d: 3.3 }), { k: "start", id: 1, t: 50 }, { k: "cut", id: 1, t: 1150 }]);
    expect(cut.map((i) => i.kind)).toEqual(["cut"]);
    const tail = analyze([req(1, 0, { d: 3.3 }), { k: "start", id: 1, t: 50 }, { k: "cut", id: 1, t: 3250 }]);
    expect(tail).toEqual([]);
  });

  it("flags two lines heard together on one channel, but not on different ones", () => {
    const same = analyze([req(1, 0, { d: 3 }), { k: "start", id: 1, t: 10 }, req(2, 1000, { d: 2 }), { k: "start", id: 2, t: 1010 }]);
    expect(same.map((i) => i.kind)).toContain("overlap");
    const other = analyze([req(1, 0, { d: 3 }), { k: "start", id: 1, t: 10 }, req(2, 1000, { d: 2, ch: "crew" }), { k: "start", id: 2, t: 1010 }]);
    expect(other.map((i) => i.kind)).not.toContain("overlap");
  });

  it("flags a line that outlived its scene", () => {
    const events: TraceEvent[] = [req(1, 0, { d: 6 }), { k: "start", id: 1, t: 50 }, { k: "scene", name: "ascent-scene", t: 1000 }, { k: "end", id: 1, t: 6050 }];
    const issues = analyze(events);
    expect(issues.map((i) => i.kind)).toEqual(["leak"]);
    expect(issues[0]!.message).toContain("ascent-scene");
  });

  it("does not flag a line that ended just after the scene changed", () => {
    expect(analyze([req(1, 0, { d: 1 }), { k: "start", id: 1, t: 50 }, { k: "scene", name: "next", t: 900 }, { k: "end", id: 1, t: 1050 }])).toEqual([]);
  });

  it("reports a line with no recording", () => {
    expect(analyze([{ k: "missing", text: "hello there", ch: "main", t: 5 }]).map((i) => i.kind)).toEqual(["missing"]);
  });

  it("the live tracer warns once per problem and can be cleared", () => {
    const heard: string[] = [];
    let now = 0;
    const tracer = createTracer(() => now, { warn: (i) => heard.push(i.kind) });
    tracer.record(req(1, 0, { d: 3 }));
    tracer.record({ k: "start", id: 1, t: 10 });
    now = 700;
    tracer.record({ k: "cut", id: 1, t: 700 });
    tracer.record({ k: "missing", text: "x", ch: "main", t: 800 });
    expect(heard).toEqual(["cut", "missing"]);
    tracer.clear();
    expect(tracer.events()).toEqual([]);
  });
});
