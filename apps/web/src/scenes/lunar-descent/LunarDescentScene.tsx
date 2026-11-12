"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { SignOffDialog, SignOffDetails } from "@/components/hud/SignOffDialog";
import { useLocalized, useT } from "@/i18n/useT";
import { BRIEFINGS } from "@/game/script";
import { useGameStore } from "@/game/gameStore";
import { useSceneViewpoints } from "@/game/sceneStore";
import { addTrauma } from "@/game/shake";
import { DESCENT_STEPS, TOUCHDOWN } from "@/mocks/descent";
import { DescentPanel, formatVs } from "./DescentPanel";
import { LunarWorld } from "./LunarWorld";
import { VIEWPOINTS, missionTimeNow, type DescentClock } from "./layout";

type Phase = "hold" | "playing" | "landed";

/** Feedback per control, scaled to how big the moment is: ignition kicks, small thrusters nudge. */
const PRESS_TRAUMA = [0.4, 0.15, 0.12, 0] as const;
const TOUCHDOWN_TRAUMA = 0.55;
/** Beat between touchdown and the dialog, so the dust and the thump land first. */
const DIALOG_DELAY_MS = 1600;
/** DOM readouts and charts refresh at this rate; the 3D view runs every frame. */
const PANEL_TICK_MS = 80;

/**
 * Scene 4 — lunar descent (astronaut POV).
 * A guided sequence: four switches in a fixed order, each starting one scripted segment of the
 * descent (powered descent → pitch-over → landing site → engine stop). Between segments the
 * lander holds for the player's call. Touchdown → flag video.
 */
export function LunarDescentScene({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const d = t.lunarDescent;
  const localize = useLocalized();
  const recordLanding = useGameStore((s) => s.recordLanding);

  const [clock, setClock] = useState<DescentClock>({ stepsDone: 0, segmentStart: null });
  const [phase, setPhase] = useState<Phase>("hold");
  const [missionT, setMissionT] = useState(0);
  const [touchdownAt, setTouchdownAt] = useState<number | null>(null);
  const [dialog, setDialog] = useState(false);
  const timers = useRef<number[]>([]);

  useSceneViewpoints(VIEWPOINTS, "window");

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // Panel clock: ticks while a segment plays, then settles on the exact hold point.
  useEffect(() => {
    if (phase !== "playing") {
      setMissionT(missionTimeNow(clock));
      return;
    }
    const id = window.setInterval(() => setMissionT(missionTimeNow(clock)), PANEL_TICK_MS);
    return () => window.clearInterval(id);
  }, [clock, phase]);

  const armed = phase === "hold" && clock.stepsDone < DESCENT_STEPS.length ? clock.stepsDone : null;

  const press = useCallback(
    (index: number) => {
      if (armed !== index) return;
      const start = performance.now();
      addTrauma(PRESS_TRAUMA[index]);
      setClock({ stepsDone: index + 1, segmentStart: start });
      setPhase("playing");
      const last = index === DESCENT_STEPS.length - 1;
      timers.current.push(
        window.setTimeout(() => {
          if (!last) {
            setPhase("hold");
            return;
          }
          addTrauma(TOUCHDOWN_TRAUMA);
          setTouchdownAt(performance.now());
          setPhase("landed");
          recordLanding({ touchdownMs: Math.abs(TOUCHDOWN.vsMs), fuelLeftPct: TOUCHDOWN.fuelPct });
          timers.current.push(window.setTimeout(() => setDialog(true), DIALOG_DELAY_MS));
        }, DESCENT_STEPS[index].playSec * 1000),
      );
    },
    [armed, recordLanding],
  );

  const briefing = BRIEFINGS["lunar-descent"];
  const contactLight = armed === DESCENT_STEPS.length - 1;

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={d.sceneLabel}>
      <WorldCanvas label={d.sceneLabel}>
        <LunarWorld clock={clock} armed={armed} onPress={press} contactLight={contactLight} touchdownAt={touchdownAt} />
      </WorldCanvas>

      <div className="pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20">
        <ObjectivePanel
          className="pointer-events-auto"
          items={[
            {
              id: "checklist",
              label: localize(briefing.objectives[0]),
              done: phase === "landed",
              progress: `${clock.stepsDone}/${DESCENT_STEPS.length}`,
            },
          ]}
        />
      </div>

      <aside
        aria-label={d.panelLabel}
        className="bezel absolute inset-x-3 bottom-3 max-h-[56dvh] overflow-y-auto bg-space-deep/95 p-4 sm:inset-x-auto sm:bottom-6 sm:right-8 sm:top-20 sm:max-h-none sm:w-[25rem] sm:p-5"
      >
        <h2 className="mb-4 text-lg font-semibold">{d.panelLabel}</h2>
        <DescentPanel
          t={missionT}
          stepsDone={clock.stepsDone}
          armed={armed}
          landed={phase === "landed"}
          contactLight={contactLight}
          onPress={press}
        />
      </aside>

      <SignOffDialog
        open={dialog}
        character="astronaut"
        badge={d.soft}
        title={d.touchdownTitle}
        description={d.touchdownBody}
        continueLabel={d.continue}
        onContinue={onComplete}
        demo
      >
        <SignOffDetails>
          <dt className="text-foreground/80">{d.touchdownSpeed}</dt>
          <dd className="text-right font-mono">{formatVs(Math.abs(TOUCHDOWN.vsMs))}</dd>
          <dt className="text-foreground/80">{d.fuelLeft}</dt>
          <dd className="text-right font-mono">{TOUCHDOWN.fuelPct}%</dd>
        </SignOffDetails>
      </SignOffDialog>
    </section>
  );
}
