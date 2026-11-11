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
  const [count, setCount] = useState(instant ? chars.length : 0);

  useEffect(() => {
    if (instant) {
      setCount(chars.length);
      return;
    }
    setCount(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const n = Math.min(chars.length, Math.floor(((now - start) / 1000) * charsPerSecond));
      setCount((prev) => (prev >= chars.length ? prev : n));
      if (n < chars.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [chars, charsPerSecond, instant]);

  const done = count >= chars.length;
  const complete = useCallback(() => setCount(chars.length), [chars.length]);

  return {
    shown: chars.slice(0, count).join(""),
    hidden: chars.slice(count).join(""),
    done,
    complete,
  };
}
