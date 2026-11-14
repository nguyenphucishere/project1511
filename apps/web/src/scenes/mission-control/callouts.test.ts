import { describe, expect, it } from "vitest";
import { CALLOUTS, MAX_Q_T, calloutsDue } from "./callouts";
import { FILM_END, HOLD_DOWN, SEPARATION_T } from "./ascent";

describe("launch callouts", () => {
  it("come in time order, inside the film, with a keyword and a line in both languages", () => {
    for (let i = 1; i < CALLOUTS.length; i++) expect(CALLOUTS[i].t).toBeGreaterThan(CALLOUTS[i - 1].t);
    for (const x of CALLOUTS) {
      expect(x.t).toBeGreaterThan(0);
      expect(x.t).toBeLessThan(FILM_END);
      for (const lang of ["en", "vi"] as const) {
        expect(x.keyword[lang].length).toBeGreaterThan(0);
        expect(x.line[lang].length).toBeGreaterThan(0);
      }
    }
  });

  it("puts liftoff at the release and max-Q before the first staging", () => {
    expect(CALLOUTS.find((x) => x.keyword.en === "Liftoff")!.t).toBeGreaterThan(HOLD_DOWN);
    expect(MAX_Q_T).toBeLessThan(SEPARATION_T);
  });

  it("fires each call once as the clock passes it, and not for ones jumped over", () => {
    const liftoff = CALLOUTS.find((x) => x.keyword.en === "Liftoff")!;
    expect(calloutsDue(liftoff.t - 0.1, liftoff.t + 0.1)).toEqual([liftoff]);
    expect(calloutsDue(liftoff.t + 0.1, liftoff.t + 0.2)).toEqual([]);
    // A skip from the start to the end must not replay the whole film's chatter.
    expect(calloutsDue(0, FILM_END).length).toBeLessThanOrEqual(1);
  });
});
