"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** Splits into user-perceived characters so Vietnamese diacritics never render half-typed. */
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

interface TypewriterOptions {
  charsPerSecond?: number;
  /** Show the whole line at once (reduced motion). */
  instant?: boolean;
}

/**
 * Reveals a line character by character. Render `shown` visibly and `hidden` with
 * visibility:hidden so the full line is laid out from the start and words never jump.
 */
export function useTypewriter(text: string, { charsPerSecond = 45, instant = false }: TypewriterOptions = {}) {
  const chars = useMemo(() => graphemes(text), [text]);
  const [typed, setTyped] = useState(0);
  // Reset while rendering when the line changes. Resetting in the effect (after paint) would
  // show the new line at the old length for a frame, with `done` briefly true.
  const [lineChars, setLineChars] = useState(chars);
  if (lineChars !== chars) {
    setLineChars(chars);
    setTyped(0);
  }
  const count = instant ? chars.length : typed;

  useEffect(() => {
    if (instant) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(chars.length, Math.floor(((now - start) / 1000) * charsPerSecond));
      setTyped((prev) => (prev >= chars.length ? prev : n));
      if (n < chars.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chars, charsPerSecond, instant]);

  const done = count >= chars.length;
  const complete = useCallback(() => setTyped(chars.length), [chars.length]);

  return {
    shown: chars.slice(0, count).join(""),
    hidden: chars.slice(count).join(""),
    done,
    complete,
  };
}
