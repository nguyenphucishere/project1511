import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ENDINGS_CATALOG } from "@/game/endings";
import { EndingDiagnostics, EndingScene } from "./EndingScene";

const render = (C: (p: { ending: (typeof ENDINGS_CATALOG)[string] }) => React.ReactElement | null, id: string) =>
  renderToStaticMarkup(createElement(C, { ending: ENDINGS_CATALOG[id] }));

describe("EndingScene", () => {
  for (const id of ["ending-1", "ending-2", "ending-3", "ending-4", "ending-5"]) {
    it(`renders a dedicated scene for ${id}`, () => {
      const html = render(EndingScene, id);
      expect(html).toContain(`data-ending-scene="${id}"`);
      expect(html).toContain("<svg");
    });
  }

  it("shows diagnostics only for non-nominal endings", () => {
    expect(render(EndingDiagnostics, "ending-1")).toBe("");
    for (const id of ["ending-2", "ending-3", "ending-4", "ending-5"]) {
      expect(render(EndingDiagnostics, id)).toContain(`data-ending-diagnostics="${id}"`);
    }
  });
});
