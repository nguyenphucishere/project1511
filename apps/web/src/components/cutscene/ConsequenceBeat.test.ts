import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getConsequence } from "@/game/consequences";
import { ConsequenceBeat } from "./ConsequenceBeat";

// The canvas needs a browser (and the classic JSX runtime in this test config); not under test here.
vi.mock("./ParallaxCanvas", () => ({ ParallaxCanvas: () => null }));

describe("ConsequenceBeat", () => {
  it("renders the call echo, mission clock and tone without naming an ending", () => {
    const consequence = getConsequence("weather", "severe_wind", { decisions: { weather: "severe_wind" } });
    const html = renderToStaticMarkup(
      createElement(ConsequenceBeat, { consequence, choiceTitle: "Option C: Force Launch", onDone: () => {} }),
    );
    expect(html).toContain('data-consequence-tone="critical"');
    expect(html).toContain("Option C: Force Launch");
    expect(html).toContain("T+00:01:23");
    expect(html).not.toMatch(/ending/i);
  });
});
