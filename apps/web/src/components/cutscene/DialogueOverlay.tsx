"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useTypewriter } from "@/hooks/useTypewriter";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { CHARACTERS } from "@/game/characters";
import { BRIEFINGS, type BriefingId } from "@/game/script";
import { CHAPTERS, chapterNumber, type ChapterId } from "@/game/flow";
import { CharacterPortrait } from "./CharacterPortrait";
import { ParallaxCanvas } from "./ParallaxCanvas";

export interface DialogueOverlayProps {
  briefing: BriefingId;
  chapter: ChapterId | "epilogue";
  onDone: () => void;
}

/**
 * Pre-scene briefing: tells the player whose eyes they are about to see through and what to do.
 * Input: click the box, Enter/Space/→ to continue (first press completes the line), ← to go back.
 */
export function DialogueOverlay({ briefing, chapter, onDone }: DialogueOverlayProps) {
  const t = useT();
  const localize = useLocalized();
  const reduced = useReducedMotion();
  const data = BRIEFINGS[briefing];
  const [index, setIndex] = useState(0);
  const line = data.lines[index];
  const speaker = CHARACTERS[line.speaker];
  const pov = CHARACTERS[data.pov];
  const isLast = index === data.lines.length - 1;
  const text = localize(line.text);
  const { shown, hidden, done, complete } = useTypewriter(text, { instant: reduced });
  const primaryRef = useRef<HTMLButtonElement>(null);

  const chapterInfo = chapter === "epilogue" ? null : CHAPTERS.find((c) => c.id === chapter);

  const advance = useCallback(() => {
    if (!done) return complete();
    if (!isLast) return setIndex((i) => i + 1);
    onDone();
  }, [done, complete, isLast, onDone]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const onControl = target?.closest("button, a, input, select, textarea, [role='dialog']");
      if ((e.key === "Enter" || e.key === " ") && !onControl) {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowRight" && !target?.closest("input, [role='group']")) {
        advance();
      } else if (e.key === "ArrowLeft" && !target?.closest("input, [role='group']")) {
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back]);

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="briefing-title">
      <ParallaxCanvas mode="drift" horizon={chapter === "lunar-descent" || chapter === "epilogue"} className="absolute inset-0" />

      <header className="absolute left-4 top-16 flex max-w-[min(32rem,calc(100%-2rem))] flex-col gap-1 sm:left-10 sm:top-20">
        <p className="text-sm text-foreground/75">
          {chapterInfo
            ? format(t.play.chapterOf, { n: chapterNumber(chapterInfo.id), total: CHAPTERS.length })
            : t.play.epilogue}
        </p>
        <h1 id="briefing-title" className="text-3xl font-semibold sm:text-4xl">
          {chapterInfo ? localize(chapterInfo.title) : t.play.epilogue}
        </h1>
        <p className="text-base text-primary">
          {format(t.play.youAre, { name: localize(pov.name), role: localize(pov.role).toLowerCase() })}
        </p>
      </header>

      <div className="absolute inset-x-3 bottom-3 sm:inset-x-10 sm:bottom-8">
        {/* Portrait stands on the box's top edge at the right, like the reference art, and moves with the box height. */}
        <div className="pointer-events-none absolute bottom-full right-2 h-[min(28dvh,14rem)] sm:right-8 sm:h-[min(50dvh,28rem)]">
          <CharacterPortrait key={speaker.id} character={speaker.id} className="animate-fade-in" />
        </div>
        <Nameplate name={localize(speaker.name)} />
        <div
          className="bezel bezel-gold relative bg-space-deep/95 px-5 pb-4 pt-7 sm:px-8 sm:pb-6 sm:pt-8"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button")) advance();
          }}
        >
          <p className="max-w-[62ch] cursor-pointer text-lg leading-relaxed sm:text-xl" aria-hidden>
            <span>{shown}</span>
            <span className="invisible">{hidden}</span>
          </p>
          <p className="sr-only" aria-live="polite">
            {localize(speaker.name)}: {text}
          </p>

          {isLast && done && data.objectives.length > 0 && (
            <div className="mt-5 animate-fade-in">
              <h2 className="text-sm font-medium text-foreground/75">{t.play.tasks}</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {data.objectives.map((o) => (
                  <li key={o.en} className="flex items-center gap-3 text-base">
                    <span aria-hidden className="h-3 w-3 shrink-0 shadow-[inset_0_0_0_1.5px_rgb(var(--primary))]" />
                    {localize(o)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto font-mono text-xs text-foreground/60" aria-hidden>
              {index + 1} / {data.lines.length}
            </span>
            {done && !isLast && (
              <span aria-hidden className="mr-1 h-0 w-0 animate-pulse border-x-[7px] border-t-[9px] border-x-transparent border-t-primary" />
            )}
            <Button variant="ghost" size="icon" onClick={back} disabled={index === 0} aria-label={t.play.previousLine}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            {!isLast && (
              <Button variant="ghost" onClick={onDone}>
                {t.play.skipBriefing}
              </Button>
            )}
            <Button ref={primaryRef} onClick={advance}>
              {isLast && done ? (chapter === "epilogue" ? t.play.finish : t.play.begin) : t.play.continueLine}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Speaker name tag with pointed ends, overlapping the top edge of the box. */
function Nameplate({ name }: { name: string }) {
  const shape = "[clip-path:polygon(14px_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,14px_100%,0_50%)]";
  return (
    <div className={`absolute -top-5 left-5 z-10 bg-primary p-[1.5px] sm:left-8 ${shape}`}>
      <div className={`bg-space-deep px-7 py-1.5 text-lg font-semibold text-foreground ${shape}`}>{name}</div>
    </div>
  );
}
