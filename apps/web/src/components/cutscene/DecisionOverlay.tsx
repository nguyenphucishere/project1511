"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { CHARACTERS } from "@/game/characters";
import { DECISIONS, type DecisionId } from "@/game/decisions";
import { ADVICE, getCallbackLines, getConsequence, normalizePoint, type Consequence } from "@/game/consequences";
import { CHAPTERS, chapterNumber, type ChapterId } from "@/game/flow";
import { useGameStore } from "@/game/gameStore";
import { CharacterPortrait } from "./CharacterPortrait";
import { ConsequenceBeat } from "./ConsequenceBeat";
import { ParallaxCanvas } from "./ParallaxCanvas";

export interface DecisionOverlayProps {
  decisionId: DecisionId;
  chapter: ChapterId;
  onDone: () => void;
}

/**
 * Interactive Decision Overlay:
 * Presents historical Apollo 11 decision points with tactical options and keyboard hotkeys (1/2/3, A/B/C).
 * Dispatches choice to gameStore and advances narrative branching.
 */
export function DecisionOverlay({ decisionId, chapter, onDone }: DecisionOverlayProps) {
  const t = useT();
  const localize = useLocalized();
  const makeDecision = useGameStore((s) => s.makeDecision);
  const decision = DECISIONS[decisionId];
  const speaker = CHARACTERS[decision.speaker];
  const chapterInfo = CHAPTERS.find((c) => c.id === chapter);

  const narrative = useGameStore((s) => s.narrative);
  // After the call is committed the consequence beat covers the screen, then onDone runs.
  const [beat, setBeat] = useState<{ consequence: Consequence; title: string } | null>(null);

  const handleSelect = useCallback(
    (optionId: string) => {
      if (beat) return;
      const committed = makeDecision(decision.pointId, optionId);
      if (!committed) return onDone();
      const option = decision.options.find((o) => o.id === optionId);
      setBeat({
        consequence: getConsequence(decision.pointId, optionId, useGameStore.getState().narrative),
        title: option ? localize(option.title) : optionId,
      });
    },
    [beat, decision.options, decision.pointId, localize, makeDecision, onDone],
  );

  const pointKey = normalizePoint(decision.pointId);
  const advice = pointKey ? ADVICE[pointKey] : undefined;
  const adviceSpeaker = advice ? CHARACTERS[advice.speaker] : null;
  const callbacks = getCallbackLines(decision.pointId, narrative);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea")) return;

      const key = e.key.toUpperCase();
      if ((key === "1" || key === "A") && decision.options[0]) {
        e.preventDefault();
        handleSelect(decision.options[0].id);
      } else if ((key === "2" || key === "B") && decision.options[1]) {
        e.preventDefault();
        handleSelect(decision.options[1].id);
      } else if ((key === "3" || key === "C") && decision.options[2]) {
        e.preventDefault();
        handleSelect(decision.options[2].id);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decision.options, handleSelect]);

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="decision-title">
      <ParallaxCanvas
        mode="drift"
        horizon={chapter === "lunar-descent"}
        className="absolute inset-0"
      />

      <header className="absolute left-4 top-12 z-20 flex max-w-[min(38rem,calc(100%-2rem))] flex-col gap-1 sm:left-10 sm:top-16">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-amber-400" />
          <p className="font-mono text-xs tracking-widest text-amber-400">
            {chapterInfo
              ? format(t.play.chapterOf, { n: chapterNumber(chapterInfo.id), total: CHAPTERS.length })
              : "APOLLO 11 MISSION BRANCH"}
            {" // DECISION NODE"}
          </p>
        </div>
        <h1 id="decision-title" className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
          {localize(decision.title)}
        </h1>
        <p className="text-xs text-foreground/75 font-mono sm:text-sm">
          {localize(decision.context)}
        </p>
        {callbacks.map((line, i) => (
          <p key={i} className="font-mono text-xs italic text-amber-300/80 sm:text-sm">
            {localize(line)}
          </p>
        ))}
      </header>

      <div className="absolute inset-x-3 bottom-3 z-30 sm:inset-x-10 sm:bottom-6">
        {/* Speaker Portrait */}
        <div className="pointer-events-none absolute bottom-full right-2 h-[min(26dvh,13rem)] sm:right-8 sm:h-[min(45dvh,24rem)]">
          <CharacterPortrait key={speaker.id} character={speaker.id} className="animate-fade-in" />
        </div>

        {/* Speaker Nameplate */}
        <Nameplate
          name={localize(speaker.name)}
          role={speaker.title ?? localize(speaker.role)}
        />

        {/* Main Decision Bezel */}
        <div className="bezel bezel-gold relative bg-space-deep/95 px-5 pb-5 pt-8 sm:px-8 sm:pb-6 sm:pt-9 shadow-2xl">
          <div className="mb-4">
            <p className="font-mono text-xs text-primary/80 mb-1">TRANSMISSION DIRECTIVE // CALL REQUIRED:</p>
            <p className="text-base sm:text-lg leading-relaxed text-foreground font-medium">
              &ldquo;{localize(decision.prompt)}&rdquo;
            </p>
          </div>

          {advice && adviceSpeaker && (
            <p className="border-l-2 border-primary/50 pl-3 text-xs italic text-foreground/70 sm:text-sm">
              <span className="font-mono not-italic text-primary/80">
                {t.consequence.advisor} — {localize(adviceSpeaker.name)}:
              </span>{" "}
              &ldquo;{localize(advice.text)}&rdquo;
            </p>
          )}

          {/* Decision Choice Cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decision.options.map((opt, idx) => {
              const hotkey = `${opt.keyLabel} / ${idx + 1}`;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className="group relative flex flex-col justify-between text-left p-4 rounded-sm border border-space-blue/80 bg-space-deep/90 hover:border-primary hover:bg-space-blue/30 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-150 cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40 group-hover:bg-primary group-hover:text-space-deep transition-colors">
                        KEY [{hotkey}]
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                      {localize(opt.title)}
                    </h2>
                    <p className="mt-1.5 text-xs text-foreground/75 leading-normal">
                      {localize(opt.description)}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-space-blue/50 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-amber-300/90 font-medium">
                      {localize(opt.tacticalBadge)}
                    </span>
                    <span className="text-xs text-primary group-hover:translate-x-1 transition-transform">
                      &rarr;
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-foreground/50">
            <span>PRESS 1/2/3 OR A/B/C TO CONFIRM SELECTION</span>
            <span>APOLLO GUIDANCE TELEMETRY LINKED</span>
          </div>
        </div>
      </div>

      {beat && (
        <ConsequenceBeat
          consequence={beat.consequence}
          choiceTitle={beat.title}
          horizon={chapter === "lunar-descent"}
          onDone={onDone}
        />
      )}
    </section>
  );
}

function Nameplate({ name, role }: { name: string; role: string }) {
  const shape = "[clip-path:polygon(14px_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,14px_100%,0_50%)]";
  return (
    <div className={`absolute -top-6 left-5 z-10 bg-primary p-[1.5px] sm:left-8 ${shape}`}>
      <div className={`bg-space-deep px-6 py-1 text-sm font-semibold text-foreground flex items-center gap-2 ${shape}`}>
        <span>{name}</span>
        <span className="text-xs font-mono text-primary font-normal hidden sm:inline">({role})</span>
      </div>
    </div>
  );
}
