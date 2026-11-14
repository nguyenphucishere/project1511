"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SignOffDialog } from "@/components/hud/SignOffDialog";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { useSceneViewpoints } from "@/game/sceneStore";
import { startCauseBed, type CauseBed } from "@/game/causeAudio";
import { playSfx, startRumble, startScore, type Rumble, type Score } from "@/game/sfx";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { filmClock } from "./clock";
import { ATMOSPHERE, ENTRY_BLACKOUT, FILM_END, MAIN_DELAY, frameAt, homePosition, plasma, viewKind, cutDip, OUTBOUND_END, RETURN_LOG, SIGNAL_LOST, T, TEI_LOS, atmosphereLayer, entryState, formatMet, skyAir, missionElapsed, thrust } from "./flight";
import { CUES, HOUSTON, PHASES, RADIO_WHO, radioLineAt, READING, captionAt, moodAt } from "./story";
import { TranslunarWorld } from "./TranslunarWorld";

/** The camera is a scripted rig; the store just needs a viewpoint to exist. */
const VIEWPOINTS = [
  { id: "film", label: { en: "the film", vi: "bộ phim" }, position: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, yawRange: 0, pitchRange: 0 },
];

const PANEL_TICK_MS = 100;

type Part = "outbound" | "return";

function Readout({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-white/55">{label}</div>
      <div className={cn("text-sm tabular-nums sm:text-base", hot ? "text-amber-300" : "text-white")}>{value}</div>
    </div>
  );
}

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
  // Beds that belong to the entry: the dead radio of the blackout, and the wind once the air is thick.
  const staticBed = useRef<CauseBed | null>(null);
  const windBed = useRef<CauseBed | null>(null);
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
      staticBed.current?.stop(0.3);
      windBed.current?.stop(0.3);
    },
    [],
  );

  // Panel clock, sound cues and the end of the film. The 3D view runs off the same film clock.
  useEffect(() => {
    if (startAt === null) return;
    const id = window.setInterval(() => {
      const f = filmClock.t;
      setNow(f);
      // The roar is the engine at the burn and the air itself in the entry: it follows the fire.
      rumble.current?.setLevel(Math.max(thrust(f) * 0.8, f >= T.REENTRY && f < T.CHUTES ? plasma(f) * 0.9 : 0));
      const dead = f >= ENTRY_BLACKOUT[0] && f < ENTRY_BLACKOUT[1];
      if (dead && !staticBed.current) staticBed.current = startCauseBed("static");
      if (!dead && staticBed.current) {
        staticBed.current.stop(1.2);
        staticBed.current = null;
      }
      staticBed.current?.setLevel(0.35);
      const windy = f >= T.REENTRY && f < T.CHUTES + MAIN_DELAY + 10 && entryState(f).altKm < 14;
      if (windy && !windBed.current) windBed.current = startCauseBed("wind");
      if (!windy && windBed.current) {
        windBed.current.stop(2.5);
        windBed.current = null;
      }
      windBed.current?.setLevel(Math.min(0.45, (14 - entryState(f).altKm) / 14));
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
    (window as unknown as { __tl?: unknown }).__tl = { seek, t: () => filmClock.t, frame: (t: number) => frameAt(t), home: (t: number) => homePosition(t) };
  }

  const phase = captionAt(PHASES, now);
  const reading = captionAt(READING, now);
  // The narrator reads each stretch's title and the cabin reading as they appear, one after the other.
  useVoiceLine(phase ? localize(phase.text) : null, { queue: true });
  useVoiceLine(reading ? localize(reading.text) : null, { queue: true });
  // The air-to-ground traffic of the entry and recovery: on a channel of its own, heard with the narrator.
  const radioLine = part === "return" ? radioLineAt(now) : undefined;
  useVoiceLine(radioLine ? localize(radioLine.text) : null, { queue: true, radio: true, channel: "radio" });
  // No radio: behind the Moon on the way out and again for the burn that sends the ship home, and in the
  // plasma of the entry. Each says why in its own words.
  const farSide = part === "outbound" ? now >= SIGNAL_LOST[0] && now < SIGNAL_LOST[1] : now >= TEI_LOS[0] && now < TEI_LOS[1];
  const plasmaBlackout = part === "return" && now >= ENTRY_BLACKOUT[0] && now < ENTRY_BLACKOUT[1];
  const lost = farSide || plasmaBlackout;
  // After the burn the only signal loss left is the plasma one, so the fade-out keeps its own words.
  const inEntry = part === "return" && now >= T.REENTRY;
  const skipping = part === "return" && now >= T.TEI_END + 1 && now < T.TEI_END + 9;
  const entry = part === "return" && now >= T.REENTRY ? entryState(now) : null;
  const passed = part === "return" ? RETURN_LOG.filter((e) => now >= e.t).slice(-3) : [];
  const started = startAt !== null;

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-black">
      <WorldCanvas label={part === "outbound" ? s.sceneLabel : s.returnSceneLabel}>
        <TranslunarWorld startAt={startAt} from={from} to={to} onReady={begin} />
      </WorldCanvas>

      {/* Inside the capsule in the entry the fire is light at the window: orange, brightest to one side, and flickering */}
      {part === "return" && viewKind(now) === "cabin" && now >= T.REENTRY && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[8]"
          style={{
            opacity: Math.min(1, plasma(now) * 1.3) * (0.78 + 0.22 * Math.sin(now * 41) * Math.sin(now * 13 + 1)),
            background: "radial-gradient(ellipse 70% 60% at 72% 42%, rgba(255,170,80,0.85), rgba(255,110,40,0.4) 45%, rgba(120,40,10,0.35) 80%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* The radio: Houston's countdown through the blackout, and each line of the real air-to-ground traffic */}
      {part === "return" && ((now >= ENTRY_BLACKOUT[0] && now < ENTRY_BLACKOUT[1]) || radioLine) && (() => {
        const dead = now >= ENTRY_BLACKOUT[0] && now < ENTRY_BLACKOUT[1];
        const left = Math.max(0, missionElapsed(ENTRY_BLACKOUT[1]) - missionElapsed(now));
        const mm = String(Math.floor(left / 60)).padStart(2, "0");
        const ss = String(Math.floor(left % 60)).padStart(2, "0");
        return (
          <div aria-live="polite" className="pointer-events-none absolute bottom-[calc(8vh+4.2rem)] right-4 z-10 w-[min(18rem,calc(100%-2rem))] border border-white/25 bg-black/65 p-2.5 font-mono text-[11px] text-white/85 backdrop-blur-sm sm:right-10">
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em]">
              <span className="text-space-cyan">{localize(HOUSTON.title)}</span>
              <span className={dead ? "animate-pulse text-red-400" : "text-emerald-300"}>{localize(dead ? HOUSTON.noSignal : HOUSTON.signal)}</span>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-sm", dead ? "bg-white/15" : "bg-emerald-300/70")} style={dead ? undefined : { opacity: 0.4 + 0.6 * Math.abs(Math.sin(now * 3 + i)) }} />
              ))}
            </div>
            {dead && <div className="mt-2 text-white">{localize(HOUSTON.waiting)} {mm}:{ss}</div>}
            {radioLine && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/55">{localize(RADIO_WHO[radioLine.who])}</div>
                <div className="text-white">{localize(radioLine.text)}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* The cuts of the flight home dip through black instead of jumping */}
      {part === "return" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[9] bg-black transition-opacity duration-100 ease-linear" style={{ opacity: cutDip(now) }} />
      )}

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
        <div className="animate-pulse font-mono text-sm font-semibold uppercase tracking-[0.25em] text-red-400 sm:text-base">{inEntry ? s.blackout : s.signalLost}</div>
        <div className="mt-1 text-xs text-white/70">{inEntry ? s.blackoutSub : part === "return" ? s.teiSub : s.signalLostSub}</div>
      </div>

      {/* The air thickens as the capsule falls: a blue glow along the bottom edge, and the layers it passes through */}
      {entry && now < T.CHUTES + MAIN_DELAY && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[5]"
            style={{
              height: "55%",
              opacity: skyAir(entry.altKm),
              background: "linear-gradient(to top, rgba(120,180,255,0.75), rgba(60,120,230,0.35) 35%, transparent)",
            }}
          />
          <div aria-hidden className="pointer-events-none absolute right-4 top-[calc(8vh+5rem)] z-10 font-mono text-[10px] text-white/80 sm:right-10">
            <div className="mb-1 uppercase tracking-[0.2em] text-space-cyan">{s.layerTitle}</div>
            <div className="relative flex h-40 gap-2">
              <div className="flex w-2 flex-col overflow-hidden rounded border border-white/30">
                {ATMOSPHERE.map((l) => (
                  <div key={l.id} className="flex-1 border-b border-white/20 last:border-b-0" style={{ background: `rgba(120,180,255,${0.1 + 0.2 * (ATMOSPHERE.length - 1 - ATMOSPHERE.indexOf(l)) })` }} />
                ))}
              </div>
              <div className="flex flex-col">
                {ATMOSPHERE.map((l) => (
                  <div key={l.id} className={cn("flex flex-1 items-center", atmosphereLayer(entry.altKm) === l.id ? "text-white" : "text-white/45")}>
                    {s.layer[l.id]} <span className="ml-1 text-white/40">{l.toKm >= 100 ? "100+" : l.toKm} km</span>
                  </div>
                ))}
              </div>
              <span
                className="absolute -left-1 h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_#fb923c]"
                style={{ top: `calc(${(() => { const i = ATMOSPHERE.findIndex((l) => entry.altKm >= l.fromKm); const l = ATMOSPHERE[i < 0 ? ATMOSPHERE.length - 1 : i]; return ((i < 0 ? ATMOSPHERE.length - 1 : i) + (l.toKm - Math.min(l.toKm, entry.altKm)) / (l.toKm - l.fromKm)) * 25; })()}% - 4px)` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Two and a half days pass between the end of the burn and the air */}
      {skipping && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[40%] z-10 text-center font-mono text-sm uppercase tracking-[0.3em] text-white/80 sm:text-lg">{s.daysLater}</div>
      )}

      {/* The way home, with the real Apollo 11 numbers: the entry readout and the log of what has happened */}
      {part === "return" && (
        <div className="pointer-events-none absolute bottom-[calc(8vh+4.5rem)] left-4 z-10 w-[min(21rem,calc(100%-2rem))] font-mono text-xs text-white/85 sm:left-10">
          {entry && (
            <div className="mb-2 grid grid-cols-3 gap-2 border border-white/20 bg-black/55 px-3 py-2 backdrop-blur-sm" aria-hidden>
              <Readout label={s.entryAlt} value={`${entry.altKm >= 10 ? Math.round(entry.altKm) : entry.altKm.toFixed(1)} km`} />
              <Readout label={s.entrySpeed} value={`${entry.speedKms.toFixed(2)} km/s`} />
              <Readout label={s.entryLoad} value={`${entry.g.toFixed(1)} g`} hot={entry.g > 5} />
            </div>
          )}
          {passed.length > 0 && (
            <div className="border-l-2 border-space-cyan/70 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-[0.2em] text-space-cyan">{s.logTitle}</div>
              <ul className="mt-1 space-y-0.5">
                {passed.map((e, i) => (
                  <li key={e.id} className={i === passed.length - 1 ? "text-white" : "text-white/55"}>
                    <span className="mr-2 text-white/60">{e.approx ? "≈" : ""}{e.get}</span>
                    {s.log[e.id]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
