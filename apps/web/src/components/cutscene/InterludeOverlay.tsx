"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalized, useT } from "@/i18n/useT";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CHARACTERS } from "@/game/characters";
import type { Interlude } from "@/game/interludes";
import { CharacterPortrait } from "./CharacterPortrait";
import { ParallaxCanvas } from "./ParallaxCanvas";

/**
 * A transition screen: one speaker, large, and what they say one line at a time over a quiet
 * starfield. Click, Enter, Space or the arrow advances (the first press finishes the line).
 */
export function InterludeOverlay({ interlude, onDone }: { interlude: Interlude; onDone: () => void }) {
  const t = useT();
  const localize = useLocalized();
  const reduced = useReducedMotion();
  const speaker = CHARACTERS[interlude.speaker];
  const [index, setIndex] = useState(0);
  const isLast = index === interlude.lines.length - 1;
  const text = localize(interlude.lines[index]!);
  const { shown, hidden, done, complete } = useTypewriter(text, { instant: reduced, charsPerSecond: 38 });
  const primary = useRef<HTMLButtonElement>(null);

  const advance = useCallback(() => {
    if (!done) return complete();
    if (!isLast) return setIndex((i) => i + 1);
    onDone();
  }, [done, complete, isLast, onDone]);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const onControl = (e.target as HTMLElement | null)?.closest("button, a, input, select, textarea");
      if (((e.key === "Enter" || e.key === " ") && !onControl) || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  return (
    <section
      className="relative flex h-dvh w-full cursor-pointer items-center justify-center overflow-hidden bg-space-deep"
      aria-label={localize(speaker.name)}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button")) advance();
      }}
    >
      <ParallaxCanvas mode="drift" className="absolute inset-0 opacity-70" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(0_0_0/0.75))]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 sm:flex-row sm:gap-12 sm:px-12">
        {/* The speaker: a real photograph in a thin frame when there is one, otherwise the illustrated portrait. */}
        <div className="relative h-[34dvh] shrink-0 animate-fade-in sm:h-[62dvh]">
          {interlude.photo ? (
            <figure className="relative h-full">
              <div aria-hidden className="absolute -inset-6 rounded-full bg-[radial-gradient(closest-side,rgb(var(--nasa-blue-light)/0.4),transparent)] blur-xl" />
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed, pre-sized photograph */}
              <img
                src={interlude.photo.src}
                alt={localize(speaker.name)}
                draggable={false}
                className="relative h-full w-auto select-none border border-primary/50 object-cover shadow-[0_12px_40px_rgb(0_0_0/0.6)]"
              />
              <figcaption className="absolute bottom-1 right-2 font-mono text-[10px] uppercase tracking-widest text-white/70 drop-shadow">
                {interlude.photo.credit}
              </figcaption>
            </figure>
          ) : (
            <>
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 aspect-square h-full -translate-x-1/2 -translate-y-1/2 animate-halo rounded-full bg-[radial-gradient(closest-side,rgb(var(--nasa-blue-light)/0.5),rgb(var(--nasa-blue)/0.2)_60%,transparent)]"
              />
              <CharacterPortrait character={speaker.id} className="relative h-full drop-shadow-[0_10px_30px_rgb(0_0_0/0.6)]" />
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 text-center sm:text-left">
          {interlude.stat && (
            <div className="flex items-baseline justify-center gap-3 sm:justify-start">
              <span className="font-mono text-6xl font-bold leading-none text-primary drop-shadow-[0_0_24px_rgb(var(--primary)/0.5)] sm:text-8xl">
                {interlude.stat.value}
              </span>
              <span className="max-w-[16ch] font-mono text-xs uppercase leading-snug tracking-[0.18em] text-foreground/70 sm:text-sm">
                {localize(interlude.stat.label)}
              </span>
            </div>
          )}

          <p className="min-h-[7.5em] text-xl leading-relaxed text-foreground sm:text-3xl sm:leading-relaxed" aria-hidden>
            <span>“{shown}</span>
            {!done && <span className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] animate-caret bg-primary" />}
            <span className="invisible">{hidden}</span>
            <span className={done ? "" : "invisible"}>”</span>
          </p>
          <p className="sr-only" aria-live="polite">
            {localize(speaker.name)}: {text}
          </p>

          <div className="flex items-center justify-center gap-4 sm:justify-between">
            <div className="text-left">
              <p className="text-lg font-bold text-primary">{localize(speaker.name)}</p>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-foreground/65">{localize(speaker.role)}</p>
            </div>
            <Button ref={primary} onClick={advance} className="min-w-[9rem] shadow-[0_0_24px_rgb(var(--primary)/0.35)]">
              {isLast && done ? t.play.begin : t.play.continueLine}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
