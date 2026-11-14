"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalized, useT } from "@/i18n/useT";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CHARACTERS } from "@/game/characters";
import type { Consequence } from "@/game/consequences";
import { cn } from "@/lib/utils";
import { ParallaxCanvas } from "./ParallaxCanvas";
import { useVoiceLine } from "@/hooks/useVoiceLine";

export interface ConsequenceBeatProps {
  consequence: Consequence;
  /** Title of the option the player picked, echoed back before the aftermath. */
  choiceTitle: string;
  horizon?: boolean;
  onDone: () => void;
}

const TONE: Record<Consequence["tone"], { text: string; border: string }> = {
  calm: { text: "text-emerald-300", border: "border-emerald-600/70" },
  tense: { text: "text-amber-300", border: "border-amber-500/70" },
  critical: { text: "text-red-300", border: "border-red-500/70" },
};

/**
 * The beat between a decision and the next scene: letterboxed, shows the aftermath in the
 * world (radio and cabin lines) and never names the ending. Enter / click / Space advances.
 */
export function ConsequenceBeat({ consequence, choiceTitle, horizon, onDone }: ConsequenceBeatProps) {
  const t = useT();
  const localize = useLocalized();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const finished = useRef(false);
  const line = consequence.lines[index];
  const isLast = index === consequence.lines.length - 1;
  const text = localize(line.text);
  useVoiceLine(text);
  const { shown, hidden, done, complete } = useTypewriter(text, { instant: reduced });
  const tone = TONE[consequence.tone];
  const speaker = line.speaker ? CHARACTERS[line.speaker] : null;

  const advance = useCallback(() => {
    if (!done) return complete();
    if (!isLast) return setIndex((i) => i + 1);
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [done, complete, isLast, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  return (
    <section
      className="absolute inset-0 z-50 cursor-pointer overflow-hidden bg-space-deep"
      aria-label={t.consequence.yourCall}
      data-consequence-tone={consequence.tone}
      onClick={advance}
    >
      <ParallaxCanvas mode="drift" horizon={horizon} className="absolute inset-0 opacity-60" />

      {/* Letterbox bars slide in to mark the beat. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[12dvh] bg-black animate-fade-in" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[12dvh] bg-black animate-fade-in" />

      <div className="absolute inset-x-4 top-[14dvh] mx-auto max-w-2xl sm:inset-x-10">
        <p className={cn("font-mono text-xs tracking-widest", tone.text)}>
          {t.consequence.yourCall.toUpperCase()}
          {consequence.met && ` // ${consequence.met}`}
        </p>
        <p className="mt-1 text-sm text-foreground/80">{choiceTitle}</p>
      </div>

      <div className="absolute inset-x-4 bottom-[16dvh] mx-auto max-w-2xl sm:inset-x-10">
        <div className={cn("bezel bg-space-deep/95 border-l-2 px-5 py-4 sm:px-7", tone.border)}>
          {speaker && (
            <p className="mb-1 font-mono text-xs text-primary">
              {localize(speaker.name)} <span className="text-foreground/50">({localize(speaker.role)})</span>
            </p>
          )}
          <p className={cn("text-lg leading-relaxed sm:text-xl", !speaker && "italic text-foreground/85")} aria-hidden>
            <span>{shown}</span>
            <span className="invisible">{hidden}</span>
          </p>
          <p className="sr-only" aria-live="polite">
            {speaker ? `${localize(speaker.name)}: ` : ""}
            {text}
          </p>
          <p className="mt-3 text-right font-mono text-[11px] text-foreground/50">
            {done && isLast ? t.consequence.continue : t.consequence.hint}
          </p>
        </div>
      </div>
    </section>
  );
}
