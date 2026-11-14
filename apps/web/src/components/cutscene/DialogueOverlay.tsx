"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  const current = chapterInfo ? chapterNumber(chapterInfo.id) : CHAPTERS.length;

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-space-deep" aria-labelledby="briefing-title">
      <ParallaxCanvas mode="drift" horizon={chapter === "lunar-descent" || chapter === "epilogue"} className="absolute inset-0" />

      {/* Atmosphere: a blue nebula behind the speaker, a warm glow from below, and a vignette to frame the scene. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[5%] h-[80vh] w-[70vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--nasa-blue)/0.45),transparent)] blur-2xl" />
        <div className="absolute -left-[15%] -top-[20%] h-[60vh] w-[55vw] rounded-full bg-[radial-gradient(closest-side,rgb(var(--space-cyan)/0.10),transparent)] blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-space-deep via-space-deep/70 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55))]" />
      </div>

      <header
        key={`header-${briefing}`}
        className="absolute left-4 top-16 flex max-w-[min(36rem,calc(100%-2rem))] animate-rise-in flex-col gap-3 border-l-2 border-primary/80 pl-4 sm:left-10 sm:top-20 sm:max-w-[min(36rem,calc(50%-8rem))] sm:pl-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary/90">
            {chapterInfo
              ? format(t.play.chapterOf, { n: current, total: CHAPTERS.length })
              : t.play.epilogue}
          </p>
          {/* Mission progress: one segment per chapter. */}
          <ol className="flex gap-1" aria-hidden>
            {CHAPTERS.map((c, i) => (
              <li
                key={c.id}
                className={
                  i + 1 < current
                    ? "h-1 w-5 bg-primary/70"
                    : i + 1 === current
                      ? "h-1 w-8 bg-primary shadow-[0_0_8px_rgb(var(--primary)/0.8)]"
                      : "h-1 w-5 bg-foreground/20"
                }
              />
            ))}
          </ol>
        </div>
        <h1
          id="briefing-title"
          className="text-2xl font-bold tracking-tight drop-shadow-[0_4px_24px_rgb(var(--nasa-blue)/0.6)] sm:text-3xl"
        >
          {chapterInfo ? localize(chapterInfo.title) : t.play.epilogue}
        </h1>
        <p className="inline-flex w-fit items-center gap-2.5 border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary backdrop-blur-sm sm:text-base">
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping bg-primary/70" />
            <span className="relative h-2 w-2 bg-primary" />
          </span>
          {format(t.play.youAre, { name: localize(pov.name), role: localize(pov.role).toLowerCase() })}
        </p>
      </header>

      <div className="absolute inset-x-3 bottom-3 animate-rise-in sm:inset-x-10 sm:bottom-8">
        {/* Portrait stands centre-stage, large, its feet tucked behind the dialogue box, in front of a soft halo. */}
        <div className="pointer-events-none absolute bottom-[calc(100%-2.5rem)] left-1/2 h-[min(40dvh,18rem)] -translate-x-1/2 sm:h-[min(52dvh,36rem)]">
          <div
            aria-hidden
            className="absolute left-1/2 top-[42%] aspect-square h-[95%] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="h-full w-full animate-halo rounded-full bg-[radial-gradient(closest-side,rgb(var(--nasa-blue-light)/0.55),rgb(var(--nasa-blue)/0.25)_60%,transparent)]" />
            <div className="absolute inset-[8%] rounded-full border border-primary/25" />
            <div className="absolute inset-[18%] rounded-full border border-dashed border-foreground/10" />
          </div>
          <div className="relative h-full animate-float">
            <CharacterPortrait
              key={speaker.id}
              character={speaker.id}
              className="animate-fade-in drop-shadow-[0_10px_30px_rgb(0_0_0/0.55)]"
            />
          </div>
        </div>
        <Nameplate name={localize(speaker.name)} role={localize(speaker.role)} />
        <div
          className="bezel relative bg-gradient-to-br from-space-deep/95 via-space-deep/90 to-nasa-blue/40 px-5 pb-4 pt-9 shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.45)] backdrop-blur-md sm:px-10 sm:pb-6 sm:pt-11"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button")) advance();
          }}
        >
          {/* Glowing top edge and corner ticks. */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgb(var(--primary)/0.9)]" />
          <span aria-hidden className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r-2 border-t-2 border-primary/60" />
          <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 border-primary/60" />

          <p className="min-h-[3.5em] max-w-[62ch] cursor-pointer text-lg leading-relaxed text-foreground sm:text-2xl sm:leading-relaxed" aria-hidden>
            <span>{shown}</span>
            {!done && <span className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] animate-caret bg-primary" />}
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

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-foreground/10 pt-4">
            <div className="mr-auto flex items-center gap-3" aria-hidden>
              <div className="flex gap-1.5">
                {data.lines.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === index
                        ? "h-1.5 w-6 bg-primary transition-all duration-300"
                        : i < index
                          ? "h-1.5 w-1.5 bg-primary/60 transition-all duration-300"
                          : "h-1.5 w-1.5 bg-foreground/25 transition-all duration-300"
                    }
                  />
                ))}
              </div>
              <span className="font-mono text-xs text-foreground/50">
                {String(index + 1).padStart(2, "0")} / {String(data.lines.length).padStart(2, "0")}
              </span>
              <span className="hidden font-mono text-xs text-foreground/35 md:inline">ENTER ↵</span>
            </div>
            {done && !isLast && (
              <span aria-hidden className="mr-1 h-0 w-0 animate-bounce border-x-[7px] border-t-[9px] border-x-transparent border-t-primary" />
            )}
            <Button variant="ghost" size="icon" onClick={back} disabled={index === 0} aria-label={t.play.previousLine}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            {!isLast && (
              <Button variant="ghost" onClick={onDone}>
                {t.play.skipBriefing}
              </Button>
            )}
            <Button
              ref={primaryRef}
              onClick={advance}
              className="min-w-[9rem] shadow-[0_0_24px_rgb(var(--primary)/0.35)] hover:shadow-[0_0_32px_rgb(var(--primary)/0.55)]"
            >
              {isLast && done ? (chapter === "epilogue" ? t.play.finish : t.play.begin) : t.play.continueLine}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Speaker name tag with pointed ends, overlapping the top edge of the box. */
function Nameplate({ name, role }: { name: string; role: string }) {
  const shape = "[clip-path:polygon(14px_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,14px_100%,0_50%)]";
  return (
    <div className="absolute -top-6 left-5 z-10 flex items-center gap-3 sm:left-10">
      <div className={`bg-primary p-[1.5px] drop-shadow-[0_0_10px_rgb(var(--primary)/0.5)] ${shape}`}>
        <div className={`bg-primary px-7 py-1.5 text-lg font-bold text-primary-foreground ${shape}`}>{name}</div>
      </div>
      <span className="bg-space-deep/80 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.2em] text-foreground/70 backdrop-blur-sm">
        {role}
      </span>
    </div>
  );
}
