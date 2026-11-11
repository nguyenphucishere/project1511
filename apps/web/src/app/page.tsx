"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocaleToggle } from "@/components/hud/LocaleToggle";
import { BlastDoor } from "@/components/cutscene/BlastDoor";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { hasContinuableProgress, useGameStore } from "@/game/gameStore";
import { CHAPTERS, getStep, type ChapterId } from "@/game/flow";
import { CHARACTERS } from "@/game/characters";

/** Title screen: the closed hangar door. Starting the mission opens it and rolls the intro. */
export default function StartScreen() {
  const t = useT();
  const localize = useLocalized();
  const router = useRouter();
  const { stepId, hydrated, newGame, jumpToChapter } = useGameStore();
  const [opening, setOpening] = useState(false);

  const canContinue = hydrated && hasContinuableProgress(stepId);
  const resumeStep = stepId ? getStep(stepId) : undefined;
  const resumeChapter =
    resumeStep && resumeStep.kind !== "end" ? CHAPTERS.find((c) => c.id === resumeStep.chapter) : undefined;

  const enterGame = useCallback(() => router.push("/play"), [router]);

  useEffect(() => {
    router.prefetch("/play");
  }, [router]);

  const start = () => {
    newGame();
    setOpening(true);
  };
  const resume = () => setOpening(true);
  const jump = (chapter: ChapterId) => {
    jumpToChapter(chapter);
    enterGame();
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-space-deep">
      <BlastDoor open={opening} onOpened={enterGame} label={t.home.doorLabel}>
        <div className="bezel flex w-full max-w-md flex-col items-center gap-6 bg-space-deep px-6 py-8 text-center sm:px-10 sm:py-10">
          <h1 className="text-4xl font-semibold sm:text-5xl">{t.home.title}</h1>
          <p className="max-w-[34ch] text-base text-foreground/85 sm:text-lg">{t.home.subtitle}</p>

          <div className="flex w-full flex-col gap-3">
            {canContinue ? (
              <>
                <Button size="lg" onClick={resume}>
                  {t.home.continue}
                </Button>
                {resumeChapter && (
                  <p className="-mt-1 text-sm text-foreground/70">
                    {format(t.home.resumeAt, { chapter: localize(resumeChapter.title) })}
                  </p>
                )}
                <Button variant="secondary" onClick={start}>
                  {t.home.newGame}
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={start} disabled={!hydrated}>
                {t.home.start}
              </Button>
            )}
          </div>

          <details className="group w-full text-left">
            <summary className="cursor-pointer list-none text-center text-sm text-foreground/70 underline-offset-4 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
              {t.home.chapterSelect}
            </summary>
            <p className="mt-3 text-center text-xs text-foreground/60">{t.home.chapterSelectHint}</p>
            <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <Button variant="secondary" size="sm" className="h-auto w-full flex-col items-start gap-0 py-2 text-left" onClick={() => jump(c.id)}>
                    <span>
                      {i + 1}. {localize(c.title)}
                    </span>
                    <span className="text-xs font-normal text-foreground/65">{localize(CHARACTERS[c.pov].role)}</span>
                  </Button>
                </li>
              ))}
            </ol>
          </details>
        </div>
      </BlastDoor>

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <StatusBadge status="demo" className="bg-space-deep">
          {t.common.demoData}
        </StatusBadge>
        <LocaleToggle className="bg-space-deep" />
      </header>
    </main>
  );
}
