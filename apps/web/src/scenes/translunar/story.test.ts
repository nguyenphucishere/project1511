import { describe, expect, it } from "vitest";
import { OUTBOUND_FILM_END } from "./flight";
import { READING } from "./story";


describe("the Genesis reading", () => {
  it("plays inside the outbound film", () => {
    expect(READING.length).toBeGreaterThan(0);
    for (const line of READING) expect(line.to).toBeLessThanOrEqual(OUTBOUND_FILM_END);
  });
});
