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
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { CHARACTERS } from "@/game/characters";
import { BRIEFINGS } from "@/game/script";
import { useSceneStore } from "@/game/sceneStore";
import { VITAL_STATIONS, type StationId } from "@/mocks/vitals";
import { MedicalWorld } from "./MedicalWorld";
import { StationPanel } from "./StationPanel";
import { VIEWPOINTS } from "./layout";

/** Delay between the door starting to slide and the camera walking through it. */
const WALK_IN_MS = 700;

/**
 * Scene 1 — medical bay (astronaut POV).
 * Beats: open the door (teaches clicking) → walk in → three stations in any order →
 * flight surgeon clears the astronaut → next chapter.
 */
export function MedicalScene({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const localize = useLocalized();
  const reduced = useReducedMotion();
  const setViewpoints = useSceneStore((s) => s.setViewpoints);
  const goTo = useSceneStore((s) => s.goTo);
  const resetScene = useSceneStore((s) => s.reset);

  const [doorOpen, setDoorOpen] = useState(false);
  const [checked, setChecked] = useState<Set<StationId>>(new Set());
  const [active, setActive] = useState<StationId | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setViewpoints(VIEWPOINTS, "corridor");
    return resetScene;
  }, [setViewpoints, resetScene]);

  const openDoor = useCallback(() => {
    setDoorOpen(true);
    window.setTimeout(() => goTo("inside"), reduced ? 0 : WALK_IN_MS);
  }, [goTo, reduced]);

  const markMeasured = useCallback((id: StationId) => {
    setChecked((prev) => new Set(prev).add(id));
  }, []);

  const closePanel = useCallback(() => {
    setActive(null);
    // The surgeon signs off once the last panel is closed, not mid-reading.
    if (checked.size === VITAL_STATIONS.length) setCleared(true);
  }, [checked]);

  const briefing = BRIEFINGS.medical;
  const station = VITAL_STATIONS.find((s) => s.id === active);
  const doctorName = localize(CHARACTERS.doctor.name);

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={t.medical.sceneLabel}>
      <WorldCanvas label={t.medical.sceneLabel}>
        <MedicalWorld doorOpen={doorOpen} checked={checked} onOpenDoor={openDoor} onInspect={setActive} />
      </WorldCanvas>

      <div className="pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20">
        <ObjectivePanel
          className="pointer-events-auto"
          items={[
            { id: "door", label: localize(briefing.objectives[0]), done: doorOpen },
            {
              id: "checks",
              label: localize(briefing.objectives[1]),
              done: checked.size === VITAL_STATIONS.length,
              progress: `${checked.size}/${VITAL_STATIONS.length}`,
            },
          ]}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-start gap-3 sm:inset-x-8 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between">
        {/* On phones the open station panel needs the space; the list returns when it closes. */}
        <div className={cn("pointer-events-auto w-full max-w-xs flex-col gap-2", station ? "hidden sm:flex" : "flex")}>
          <HotspotList />
          <p className="hidden text-xs text-foreground/70 sm:block">{t.hud.lookHint}</p>
        </div>
        {station && (
          <StationPanel
            key={station.id}
            station={station}
            alreadyChecked={checked.has(station.id)}
            onMeasured={() => markMeasured(station.id)}
            onClose={closePanel}
          />
        )}
      </div>

      <Dialog open={cleared} onOpenChange={() => {}}>
        <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mb-2 flex items-end gap-4">
              <div className="h-20 w-16 shrink-0">
                <CharacterPortrait character="doctor" />
              </div>
              <StatusBadge status="go" className="mb-1">
                {t.medical.withinRange}
              </StatusBadge>
            </div>
            <DialogTitle className="text-2xl">{t.medical.clearedTitle}</DialogTitle>
            <DialogDescription>{format(t.medical.clearedBody, { name: doctorName })}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 bg-space-blue/35 px-4 py-3 text-sm">
            {VITAL_STATIONS.map((s) => (
              <div key={s.id} className="contents">
                <dt className="text-foreground/80">{localize(s.name)}</dt>
                <dd className="text-right font-mono">
                  {s.value} {s.unit}
                </dd>
              </div>
            ))}
          </dl>
          <StatusBadge status="demo" className="w-fit">
            {t.common.demoData}
          </StatusBadge>
          <DialogFooter>
            <Button size="lg" onClick={onComplete}>
              {t.medical.continue}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
