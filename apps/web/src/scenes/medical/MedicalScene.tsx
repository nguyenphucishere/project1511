"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { HotspotList } from "@/components/hud/HotspotList";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { SignOffDialog, SignOffDetails } from "@/components/hud/SignOffDialog";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { CHARACTERS } from "@/game/characters";
import { BRIEFINGS } from "@/game/script";
import { useSceneStore, useSceneViewpoints } from "@/game/sceneStore";
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
  const goTo = useSceneStore((s) => s.goTo);

  const [doorOpen, setDoorOpen] = useState(false);
  const [checked, setChecked] = useState<Set<StationId>>(new Set());
  const [active, setActive] = useState<StationId | null>(null);

  useSceneViewpoints(VIEWPOINTS, "corridor");

  const walkIn = useRef(0);
  useEffect(() => () => window.clearTimeout(walkIn.current), []);

  const openDoor = useCallback(() => {
    setDoorOpen(true);
    walkIn.current = window.setTimeout(() => goTo("inside"), reduced ? 0 : WALK_IN_MS);
  }, [goTo, reduced]);

  const markMeasured = useCallback((id: StationId) => {
    setChecked((prev) => new Set(prev).add(id));
  }, []);

  const closePanel = useCallback(() => setActive(null), []);
  // The surgeon signs off once every station is measured and no panel is open (not mid-reading).
  const cleared = active === null && checked.size === VITAL_STATIONS.length;

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

      <SignOffDialog
        open={cleared}
        character="doctor"
        badge={t.medical.withinRange}
        title={t.medical.clearedTitle}
        description={format(t.medical.clearedBody, { name: doctorName })}
        continueLabel={t.medical.continue}
        onContinue={onComplete}
        demo
      >
        <SignOffDetails>
          {VITAL_STATIONS.map((s) => (
            <div key={s.id} className="contents">
              <dt className="text-foreground/80">{localize(s.name)}</dt>
              <dd className="text-right font-mono">
                {s.value} {s.unit}
              </dd>
            </div>
          ))}
        </SignOffDetails>
      </SignOffDialog>
    </section>
  );
}
