"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { HotspotList } from "@/components/hud/HotspotList";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { CHARACTERS } from "@/game/characters";
import { BRIEFINGS } from "@/game/script";
import { useSceneStore } from "@/game/sceneStore";
import { useSettingsStore } from "@/game/settingsStore";
import { ROCKET_PARTS, TOTAL_MASS_T, type LevelId, type PartId } from "@/mocks/rocket-parts";
import { PartPanel } from "./PartPanel";
import { WorkshopWorld } from "./WorkshopWorld";
import { VIEWPOINTS } from "./layout";

const LEVEL_COUNT = VIEWPOINTS.length;

/**
 * Scene 2 — assembly hall (launch engineer POV).
 * Beats: arrive on the hall floor facing the engines → inspect the parts at each level, riding
 * the gantry lift between them → Chief Bao signs off the stack → mission control.
 * Pacing: the floor teaches the loop with two big parts; level 3 holds four smaller ones.
 */
export function WorkshopScene({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const setViewpoints = useSceneStore((s) => s.setViewpoints);
  const goTo = useSceneStore((s) => s.goTo);
  const resetScene = useSceneStore((s) => s.reset);
  const level = (useSceneStore((s) => s.viewpointId) ?? "floor") as LevelId;

  const [inspected, setInspected] = useState<Set<PartId>>(new Set());
  const [visited, setVisited] = useState<Set<LevelId>>(new Set(["floor"]));
  const [active, setActive] = useState<PartId | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setViewpoints(VIEWPOINTS, "floor");
    return resetScene;
  }, [setViewpoints, resetScene]);

  // Opening a part's panel counts as inspecting it.
  const inspect = useCallback((id: PartId) => {
    setActive(id);
    setInspected((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const ride = useCallback(
    (to: LevelId) => {
      setActive(null);
      setVisited((prev) => (prev.has(to) ? prev : new Set(prev).add(to)));
      goTo(to);
    },
    [goTo],
  );

  const closePanel = useCallback(() => {
    setActive(null);
    // Chief Bao signs off when the last panel closes, not while it is still being read.
    if (inspected.size === ROCKET_PARTS.length) setDone(true);
  }, [inspected]);

  const part = ROCKET_PARTS.find((p) => p.id === active) ?? null;
  const next = ROCKET_PARTS.find((p) => p.level === level && p.id !== active && !inspected.has(p.id)) ?? null;
  const chiefName = localize(CHARACTERS["workshop-chief"].name);
  const briefing = BRIEFINGS.workshop;
  const number = new Intl.NumberFormat(locale);

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={t.workshop.sceneLabel}>
      <WorldCanvas label={t.workshop.sceneLabel}>
        <WorkshopWorld level={level} inspected={inspected} activeId={active} onInspect={inspect} onLift={ride} />
      </WorldCanvas>

      <div className="pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20">
        <ObjectivePanel
          className="pointer-events-auto"
          items={[
            {
              id: "levels",
              label: localize(briefing.objectives[0]),
              done: visited.size === LEVEL_COUNT,
              progress: `${visited.size}/${LEVEL_COUNT}`,
            },
            {
              id: "parts",
              label: localize(briefing.objectives[1]),
              done: inspected.size === ROCKET_PARTS.length,
              progress: `${inspected.size}/${ROCKET_PARTS.length}`,
            },
          ]}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-start gap-3 sm:inset-x-8 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between">
        <div className={cn("pointer-events-auto w-full max-w-xs flex-col gap-2", part ? "hidden sm:flex" : "flex")}>
          <HotspotList />
          <p className="hidden text-xs text-foreground/70 sm:block">{t.hud.lookHint}</p>
        </div>
        {part && (
          <PartPanel
            key={part.id}
            part={part}
            next={next}
            onNext={() => next && inspect(next.id)}
            onClose={closePanel}
          />
        )}
      </div>

      <Dialog open={done} onOpenChange={() => {}}>
        <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mb-2 flex items-end gap-4">
              <div className="h-20 w-16 shrink-0">
                <CharacterPortrait character="workshop-chief" />
              </div>
              <StatusBadge status="go" className="mb-1">
                {t.workshop.readyBadge}
              </StatusBadge>
            </div>
            <DialogTitle className="text-2xl">{t.workshop.doneTitle}</DialogTitle>
            <DialogDescription>{format(t.workshop.doneBody, { name: chiefName })}</DialogDescription>
          </DialogHeader>
          <dl className="grid max-h-[40dvh] grid-cols-[1fr_auto] gap-x-6 gap-y-1 overflow-y-auto bg-space-blue/35 px-4 py-3 text-sm">
            {ROCKET_PARTS.map((p) => (
              <div key={p.id} className="contents">
                <dt className="text-foreground/80">{localize(p.name)}</dt>
                <dd className="text-right font-mono">{format(t.workshop.massValue, { value: number.format(p.massT) })}</dd>
              </div>
            ))}
            <div className="col-span-2 mt-1 flex justify-between gap-6 border-t border-foreground/20 pt-1.5 font-semibold">
              <dt>{t.workshop.total}</dt>
              <dd className="font-mono">{format(t.workshop.massValue, { value: number.format(TOTAL_MASS_T) })}</dd>
            </div>
          </dl>
          <StatusBadge status="demo" className="w-fit">
            {t.common.demoData}
          </StatusBadge>
          <DialogFooter>
            <Button size="lg" onClick={onComplete}>
              {t.workshop.continue}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
