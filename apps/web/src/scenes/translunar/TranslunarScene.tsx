"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SignOffDialog } from "@/components/hud/SignOffDialog";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { useSceneViewpoints } from "@/game/sceneStore";
import { playSfx, startRumble, startScore, type Rumble, type Score } from "@/game/sfx";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { filmClock } from "./clock";
import { FILM_END, OUTBOUND_END, SIGNAL_LOST, formatMet, missionElapsed, thrust } from "./flight";
import { CUES, PHASES, READING, captionAt, moodAt } from "./story";
import { TranslunarWorld } from "./TranslunarWorld";

/** The camera is a scripted rig; the store just needs a viewpoint to exist. */
const VIEWPOINTS = [
  { id: "film", label: { en: "the film", vi: "bộ phim" }, position: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, yawRange: 0, pitchRange: 0 },
];

const PANEL_TICK_MS = 100;

type Part = "outbound" | "return";

/**
 * The flight to the Moon (outbound) or the flight home (return): a watch-only film that cuts
 * between a spacecraft in space and the crew cabin. A Skip button jumps to the end card.
 */
function FlightFilm({ part, onComplete }: { part: Part; onComplete: () => void }) {
  const t = useT();
  const s = t.translunar;
  const localize = useLocalized();
  const from = part === "outbound" ? 0 : OUTBOUND_END;
  const to = part === "outbound" ? OUTBOUND_END : FILM_END;

  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(from);
  const [done, setDone] = useState(false);
  const score = useRef<Score | null>(null);
  const rumble = useRef<Rumble | null>(null);
  const fired = useRef(new Set<number>());
  const mood = useRef<string>("");

  useSceneViewpoints(VIEWPOINTS, "film");

  // The film starts when the world reports it is loaded and compiled; the music and engine start with it.
  const began = useRef(false);
  const begin = useCallback(() => {
    if (began.current) return;
    began.current = true;
    score.current = startScore(moodAt(from));
    rumble.current = startRumble();
    setStartAt(performance.now());
  }, [from]);
  useEffect(
    () => () => {
      score.current?.stop();
      rumble.current?.stop();
    },
    [],
  );

  // Panel clock, sound cues and the end of the film. The 3D view runs off the same film clock.
  useEffect(() => {
    if (startAt === null) return;
    const id = window.setInterval(() => {
      const f = filmClock.t;
      setNow(f);
      rumble.current?.setLevel(thrust(f) * 0.8);
      const m = moodAt(f);
      if (m !== mood.current) {
        mood.current = m;
        score.current?.setMood(m);
      }
      CUES.forEach((cue, i) => {
        if (f >= cue.t && f < cue.t + 3 && !fired.current.has(i) && cue.t >= from) {
          fired.current.add(i);
          playSfx(cue.id, cue.gain ?? 1);
        }
      });
      if (f >= to - 0.05) {
        setDone(true);
        rumble.current?.setLevel(0);
      }
    }, PANEL_TICK_MS);
    return () => window.clearInterval(id);
  }, [startAt, from, to]);

  const seek = useCallback(
    (film: number) => setStartAt(performance.now() - (film - from) * 1000),
    [from],
  );

  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    // Dev-only: window.__tl.seek(t) jumps the film (use with a frozen performance.now).
    (window as unknown as { __tl?: unknown }).__tl = { seek, t: () => filmClock.t };
  }

  const phase = captionAt(PHASES, now);
  const reading = captionAt(READING, now);
  // The narrator reads each stretch's title and the cabin reading as they appear, one after the other.
  useVoiceLine(phase ? localize(phase.text) : null, { queue: true });
  useVoiceLine(reading ? localize(reading.text) : null, { queue: true });
  const lost = now >= SIGNAL_LOST[0] && now < SIGNAL_LOST[1];
  const started = startAt !== null;

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-black">
      <WorldCanvas label={part === "outbound" ? s.sceneLabel : s.returnSceneLabel}>
        <TranslunarWorld startAt={startAt} from={from} to={to} onReady={begin} />
      </WorldCanvas>

      {/* Letterbox bars */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[8vh] bg-black" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[8vh] bg-black" />

      {/* Fade in from black */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-[1400ms]", started ? "opacity-0" : "opacity-100")}
      />

      {/* Mission clock */}
      <div className="pointer-events-none absolute left-4 top-[calc(8vh+0.75rem)] z-10 font-mono text-xs leading-tight text-white/85 sm:left-10 sm:text-sm">
        <div className="text-[10px] uppercase tracking-[0.2em] text-space-cyan sm:text-xs">{s.met}</div>
        <div className="text-base sm:text-xl">{formatMet(missionElapsed(now))}</div>
      </div>

      {/* Loss of signal behind the Moon */}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute right-4 top-[calc(8vh+0.75rem)] z-10 max-w-[18rem] text-right transition-opacity duration-700 sm:right-10",
          lost ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="animate-pulse font-mono text-sm font-semibold uppercase tracking-[0.25em] text-red-400 sm:text-base">{s.signalLost}</div>
        <div className="mt-1 text-xs text-white/70">{s.signalLostSub}</div>
      </div>

      {/* Phase title and, in the cabin, the reading */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(8vh+1rem)] z-10 flex flex-col items-center gap-2 px-6 text-center">
        {reading && (
          <p key={reading.from} className="max-w-2xl [animation:fade-in_900ms_ease-out] text-lg font-medium italic text-amber-100 drop-shadow sm:text-2xl">
            {localize(reading.text)}
          </p>
        )}
        {phase && (
          <p key={phase.from} className="[animation:fade-in_900ms_ease-out] text-xs uppercase tracking-[0.25em] text-white/75 sm:text-sm">
            {localize(phase.text)}
          </p>
        )}
      </div>

      {started && !done && (
        <div className="absolute bottom-[calc(8vh+0.75rem)] right-4 z-20 sm:right-10">
          <Button variant="secondary" size="sm" onClick={() => seek(to - 0.2)}>
            {t.missionControl.skipCinematic}
          </Button>
        </div>
      )}

      <SignOffDialog
        open={done}
        character="astronaut"
        badge={part === "outbound" ? s.doneTitle : s.returnDoneTitle}
        title={part === "outbound" ? s.doneTitle : s.returnDoneTitle}
        description={part === "outbound" ? s.doneBody : s.returnDoneBody}
        continueLabel={part === "outbound" ? s.continue : s.returnContinue}
        onContinue={onComplete}
      />
    </section>
  );
}

export function TranslunarScene({ onComplete }: { onComplete: () => void }) {
  return <FlightFilm part="outbound" onComplete={onComplete} />;
}

export function ReturnScene({ onComplete }: { onComplete: () => void }) {
  return <FlightFilm part="return" onComplete={onComplete} />;
}
