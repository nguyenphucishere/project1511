import { describe, expect, it } from "vitest";
import { GENESIS_AUDIO_S, OUTBOUND_FILM_END, READING_FILM, T, elapsedTo, filmTimeAt, readingAudioTime, readingFilmTime } from "./flight";
import { PHASES, READING, READING_AUDIO } from "./story";

describe("the Genesis reading", () => {
  it("is the full broadcast (the opening and Genesis 1:1-10), in order, inside the cabin stretch", () => {
    expect(READING).toHaveLength(READING_AUDIO.length);
    expect(READING.some((c) => c.text.en.startsWith("In the beginning God created the heaven and the earth"))).toBe(true);
    // Every caption lies within the recording, in order.
    for (const c of READING_AUDIO) {
      expect(c.from).toBeGreaterThanOrEqual(0);
      expect(c.to).toBeLessThanOrEqual(GENESIS_AUDIO_S + 0.01);
      expect(c.to).toBeGreaterThan(c.from);
    }
    expect(READING[READING.length - 1]!.text.en).toMatch(/God saw that it was good\.$/);
    for (let i = 0; i < READING.length; i++) {
      const c = READING[i]!;
      expect(c.from).toBeGreaterThanOrEqual(READING_FILM[0]);
      expect(c.to).toBeLessThanOrEqual(Math.min(READING_FILM[1], OUTBOUND_FILM_END) + 0.01);
      if (i > 0) expect(c.from).toBeGreaterThanOrEqual(READING[i - 1]!.to);
    }
  });

  it("never says Christmas, in the captions or the titles", () => {
    for (const c of [...READING, ...PHASES]) {
      expect(c.text.en.toLowerCase()).not.toContain("christmas");
      expect(c.text.vi.toLowerCase()).not.toContain("giáng sinh");
    }
  });

  it("leaves a pause after the last verse before the film ends", () => {
    expect(OUTBOUND_FILM_END - READING_FILM[1]).toBeGreaterThanOrEqual(2);
  });

  it("the film clock runs slow through the reading so the recording is heard whole", () => {
    expect(elapsedTo(0, READING_FILM[1]) - elapsedTo(0, READING_FILM[0])).toBeCloseTo(GENESIS_AUDIO_S, 3);
    // Outside the reading the clock is untouched (the separation and transposition keep their timing).
    expect(filmTimeAt(0, T.SEP)).toBeCloseTo(T.SEP, 6);
    expect(filmTimeAt(0, T.FLIP_B_END)).toBeCloseTo(T.FLIP_B_END, 6);
    expect(filmTimeAt(T.OUTBOUND_END, 10)).toBeCloseTo(T.OUTBOUND_END + 10, 6);
    for (const f of [5, 60, 118.6, 125, 139.4, 140]) expect(filmTimeAt(0, elapsedTo(0, f))).toBeCloseTo(f, 6);
    expect(readingAudioTime(readingFilmTime(42))).toBeCloseTo(42, 6);
  });

  it("keeps the phase titles", () => {
    expect(PHASES.length).toBeGreaterThan(0);
  });
});
