import { describe, expect, it } from "vitest";
import { DECISIONS } from "./decisions";
import {
  causeChain,
  getCallbackLines,
  getConsequence,
  hoverMarginSeconds,
  resolveLanding,
  type NarrativeLike,
} from "./consequences";

const n = (decisions: Record<string, string>): NarrativeLike => ({ decisions });

describe("consequence beats", () => {
  it("every decision option has a bilingual, non-empty beat", () => {
    for (const d of Object.values(DECISIONS)) {
      for (const o of d.options) {
        const c = getConsequence(d.pointId, o.id, n({ [d.pointId]: o.id }));
        expect(c.met, `${d.pointId}:${o.id}`).not.toBe("");
        expect(c.lines.length).toBeGreaterThan(0);
        for (const l of c.lines) {
          expect(l.text.en.length).toBeGreaterThan(5);
          expect(l.text.vi.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it("never names an ending or spoils outcomes on decision cards", () => {
    for (const d of Object.values(DECISIONS)) {
      for (const o of d.options) {
        for (const text of [o.title, o.hint]) {
          expect(text.en).not.toMatch(/ending[- ]?\d|Triggers|Historical|Safire/i);
          expect(text.vi).not.toMatch(/KẾT THÚC \d|Kích hoạt|Lịch sử/);
        }
      }
    }
  });
});

describe("hover margin and landing resolution", () => {
  it("starts at 25 s and loses 8 s per earlier shortcut", () => {
    expect(hoverMarginSeconds(n({}))).toBe(25);
    expect(hoverMarginSeconds(n({ inspection: "rushed" }))).toBe(17);
    expect(hoverMarginSeconds(n({ trajectory: "direct" }))).toBe(17);
    expect(hoverMarginSeconds(n({ inspection: "rushed", trajectory: "direct" }))).toBe(9);
  });

  it("P66 lands historically unless both shortcuts were taken", () => {
    expect(resolveLanding(n({}), "p66_redesignation")).toBe("ending-1");
    expect(resolveLanding(n({ inspection: "rushed" }), "p66_redesignation")).toBe("ending-1");
    expect(resolveLanding(n({ inspection: "rushed", trajectory: "direct" }), "p66_redesignation")).toBe("ending-4");
  });

  it("other final calls are unaffected by margin, and aliases are understood", () => {
    const worst = n({ inspection: "rushed", trajectory: "direct" });
    expect(resolveLanding(worst, "boulder_field")).toBe("ending-3");
    expect(resolveLanding(worst, "bingo_abort")).toBe("ending-4");
    expect(resolveLanding(n({}), "p66-redesignate")).toBe("ending-1");
    expect(resolveLanding(n({}), "nonsense")).toBeNull();
  });

  it("uses the margin-exhausted beat for a low-margin P66 call", () => {
    const worst = n({ inspection: "rushed", trajectory: "direct" });
    const beat = getConsequence("landing_approach", "p66_redesignation", worst);
    expect(beat.tone).toBe("critical");
    expect(beat.lines.some((l) => /Bingo/.test(l.text.en))).toBe(true);
    expect(getConsequence("landing_approach", "p66_redesignation", n({})).tone).toBe("tense");
  });
});

describe("callbacks and cause chain", () => {
  it("adds subtle callbacks only to later decisions and only for shortcuts taken", () => {
    expect(getCallbackLines("landing_approach", n({}))).toHaveLength(0);
    expect(getCallbackLines("landing_approach", n({ inspection: "rushed" }))).toHaveLength(1);
    expect(getCallbackLines("agc_alarm", n({ inspection: "rushed", trajectory: "direct" }))).toHaveLength(2);
    expect(getCallbackLines("weather", n({ inspection: "rushed" }))).toHaveLength(0);
  });

  it("explains a forced wave-off by naming both shortcuts and the margin", () => {
    const chain = causeChain(
      n({ inspection: "rushed", weather: "go", trajectory: "direct", agc_alarm: "go", landing_approach: "p66_redesignation" }),
    );
    const ids = chain.map((c) => c.id);
    expect(ids).toContain("inspection:rushed");
    expect(ids).toContain("trajectory:direct");
    expect(ids[ids.length - 1]).toBe("landing_approach:margin");
    expect(chain[chain.length - 1].effect.en).toContain("9 s");
  });

  it("has no margin entry for the clean historic run", () => {
    const chain = causeChain(
      n({ inspection: "thorough", weather: "go", trajectory: "free_return", agc_alarm: "go", landing_approach: "p66_redesignation" }),
    );
    expect(chain).toHaveLength(5);
    expect(chain.every((c) => c.impact !== "negative")).toBe(true);
  });
});
