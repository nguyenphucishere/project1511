"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { CHAPTERS, chapterNumber, type SceneId } from "@/game/flow";
import { CHARACTERS } from "@/game/characters";
import { BRIEFINGS } from "@/game/script";
import { ParallaxCanvas } from "./ParallaxCanvas";

/** Stands in for a 3D scene until its phase is built, so the full flow can be walked today. */
export function ScenePlaceholder({ scene, onComplete }: { scene: SceneId; onComplete: () => void }) {
  const t = useT();
  const localize = useLocalized();
  const chapter = CHAPTERS.find((c) => c.id === scene)!;
  const pov = CHARACTERS[chapter.pov];

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="scene-title">
      <ParallaxCanvas mode="still" horizon={scene === "lunar-descent"} className="absolute inset-0 opacity-60" />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="bezel flex w-full max-w-lg flex-col gap-4 bg-space-deep/90 p-6 sm:p-8">
          <p className="text-sm text-foreground/75">
            {format(t.play.chapterOf, { n: chapterNumber(scene), total: CHAPTERS.length })}
          </p>
          <h1 id="scene-title" className="text-3xl font-semibold">
            {localize(chapter.title)}
          </h1>
          <p className="text-primary">
            {format(t.play.youAre, { name: localize(pov.name), role: localize(pov.role).toLowerCase() })}
          </p>
          <ul className="flex flex-col gap-1.5">
            {BRIEFINGS[scene].objectives.map((o) => (
              <li key={o.en} className="flex items-center gap-3">
                <span aria-hidden className="h-3 w-3 shrink-0 shadow-[inset_0_0_0_1.5px_rgb(var(--primary))]" />
                {localize(o)}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-2 border-t border-border/20 pt-4">
            <StatusBadge status="pending" className="w-fit">
              {t.scenePlaceholder.title}
            </StatusBadge>
            <p className="text-sm text-foreground/75">{t.scenePlaceholder.body}</p>
          </div>
          <Button size="lg" onClick={onComplete} className="self-start">
            {t.scenePlaceholder.complete}
          </Button>
        </div>
      </div>
    </section>
  );
}
