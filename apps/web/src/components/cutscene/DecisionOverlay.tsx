"use client";

import { useCallback, useEffect } from "react";
import { useLocalized } from "@/i18n/useT";
import { CHARACTERS } from "@/game/characters";
import { DECISIONS, type DecisionId } from "@/game/decisions";
import { type ChapterId } from "@/game/flow";
import { useGameStore } from "@/game/gameStore";
import { CharacterPortrait } from "./CharacterPortrait";
import { ParallaxCanvas } from "./ParallaxCanvas";

export interface DecisionOverlayProps {
  decisionId: DecisionId;
  chapter: ChapterId;
  onDone: () => void;
}

/**
 * A decision is a moment, not a reading: who is asking, one short question, and two or three
 * big choices with a single line of consequence each. A/B/C or 1/2/3 pick one.
 */
export function DecisionOverlay({ decisionId, chapter, onDone }: DecisionOverlayProps) {
  const localize = useLocalized();
  const makeDecision = useGameStore((s) => s.makeDecision);
  const decision = DECISIONS[decisionId];
  const speaker = CHARACTERS[decision.speaker];

  const handleSelect = useCallback(
    (optionId: string) => {
      makeDecision(decision.pointId, optionId);
      onDone();
    },
    [decision.pointId, makeDecision, onDone],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea")) return;
      const index = ["1", "2", "3"].indexOf(e.key) >= 0 ? Number(e.key) - 1 : ["A", "B", "C"].indexOf(e.key.toUpperCase());
      const option = decision.options[index];
      if (index >= 0 && option) {
        e.preventDefault();
        handleSelect(option.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decision.options, handleSelect]);

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="decision-title">
      <ParallaxCanvas mode="drift" horizon={chapter === "lunar-descent"} className="absolute inset-0" />

      <header className="absolute left-4 top-16 z-20 max-w-[min(34rem,calc(100%-2rem))] sm:left-10 sm:top-20">
        <h1 id="decision-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {localize(decision.title)}
        </h1>
        <p className="mt-1 text-base text-primary">
          {localize(speaker.name)} · {localize(speaker.role)}
        </p>
      </header>

      <div className="absolute inset-x-3 bottom-3 z-30 sm:inset-x-10 sm:bottom-8">
        <div className="pointer-events-none absolute bottom-full right-2 h-[min(24dvh,12rem)] sm:right-8 sm:h-[min(36dvh,20rem)]">
          <CharacterPortrait key={speaker.id} character={speaker.id} className="animate-fade-in" />
        </div>
        <div className="bezel bezel-gold bg-space-deep/95 px-5 py-4 shadow-2xl sm:px-8 sm:py-5">
          <p className="text-lg font-medium leading-snug text-foreground sm:text-xl">{localize(decision.prompt)}</p>

          <div className={`mt-4 grid grid-cols-1 gap-3 ${decision.options.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {decision.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className="group flex items-center gap-3 rounded-sm border border-space-blue/80 bg-space-deep/90 p-3 text-left transition-colors hover:border-primary hover:bg-space-blue/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary/20 font-mono text-base font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-space-deep">
                  {opt.keyLabel}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-foreground">{localize(opt.title)}</span>
                  <span className="block text-sm text-foreground/70">{localize(opt.hint)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
