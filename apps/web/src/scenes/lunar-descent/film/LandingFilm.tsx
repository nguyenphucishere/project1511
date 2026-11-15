"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { useSceneViewpoints } from "@/game/sceneStore";
import { useSettingsStore } from "@/game/settingsStore";
import { playSfx, speak, startAlarm, startRumble, startScore, stopSpeaking, type Rumble, type Score, type ScoreMood } from "@/game/sfx";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { FilmWorld } from "./FilmWorld";
import { filmClock } from "./clock";
import { BEATS, FILM_SECONDS, PHASES, POLL, SPEAKER, readout, type Beat, type FilmPart } from "./script";

const VIEWPOINTS = [{ id: "film", label: { en: "the film", vi: "bộ phim" }, position: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, yawRange: 0, pitchRange: 0 }];
const TICK_MS = 100;
/** The film channel keeps the crew and Houston in one line-up, one voice after another. */
const CHANNEL = "landing-film";

const moodAt = (part: FilmPart, t: number): ScoreMood => {
  if (part === "approach") return t < 20 ? "awe" : t < 36 ? "ride" : t < 48 ? "dread" : t < 66 ? "ride" : "hush";
  return t < 9 ? "dread" : t < 14 ? "hush" : "awe";
};

/** How hard the engine roars, 0..1. */
const rumbleAt = (part: FilmPart, t: number) => {
  if (part === "approach") return t < 21 ? 0 : t < 66 ? 0.55 : 0.4;
  return t < 8.8 ? 0.5 : 0;
};

const ft = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * A landing film, watch-only: `approach` (undocking, powered descent, the 1202 alarm, the pitch-over)
 * before the player takes the stick, or `touchdown` (the dust, the contact light, "the Eagle has
 * landed", Mission Control) after a safe landing. It calls `onComplete` when it ends or is skipped.
 */
export function LandingFilm({ part, from = 0, to, onComplete }: { part: FilmPart; from?: number; to?: number; onComplete: () => void }) {
  const t = useT();
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const total = FILM_SECONDS[part];
  const seconds = to ?? total;
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(from);
  const [ended, setEnded] = useState(false);
  const score = useRef<Score | null>(null);
  const rumble = useRef<Rumble | null>(null);
  const alarm = useRef<(() => void) | null>(null);
  const fired = useRef(new Set<number>());
  const mood = useRef("");
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const finished = useRef(false);

  useSceneViewpoints(VIEWPOINTS, "film");

  const began = useRef(false);
  const begin = useCallback(() => {
    if (began.current) return;
    began.current = true;
    score.current = startScore(moodAt(part, from));
    rumble.current = startRumble();
    setStartAt(performance.now());
  }, [part, from]);

  useEffect(
    () => () => {
      score.current?.stop();
      rumble.current?.stop();
      alarm.current?.();
      stopSpeaking(undefined, CHANNEL);
    },
    [],
  );

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setEnded(true);
    rumble.current?.setLevel(0);
    alarm.current?.();
    alarm.current = null;
    onComplete();
  }, [onComplete]);

  // The panel clock, the voices, the music and the sound effects, all off the same film clock the 3D view reads.
  useEffect(() => {
    if (startAt === null) return;
    const id = window.setInterval(() => {
      const f = filmClock.t;
      setNow(f);
      rumble.current?.setLevel(rumbleAt(part, f));
      const m = moodAt(part, f);
      if (m !== mood.current) {
        mood.current = m;
        score.current?.setMood(m);
      }
      BEATS[part].forEach((b: Beat, i) => {
        if (b.at < from) return;
        if (f >= b.at && f < b.at + 2.5 && !fired.current.has(i)) {
          fired.current.add(i);
          speak(b.line[localeRef.current], localeRef.current, { channel: CHANNEL, queue: true, panic: b.panic });
        }
      });
      if (part === "approach") {
        if (f >= 36.5 && f < 47 && !alarm.current) alarm.current = startAlarm();
        if ((f >= 47 || f < 36.5) && alarm.current) {
          alarm.current();
          alarm.current = null;
        }
        if (f >= 20.2 && from < 20 && !fired.current.has(-1)) {
          fired.current.add(-1);
          playSfx("ignition", 0.8);
        }
      } else {
        if (f >= 6.2 && !fired.current.has(-2)) {
          fired.current.add(-2);
          playSfx("contact");
        }
        if (f >= 6.6 && !fired.current.has(-3)) {
          fired.current.add(-3);
          playSfx("touchdown", 0.8);
        }
        if (f >= 27 && !fired.current.has(-4)) {
          fired.current.add(-4);
          playSfx("success");
        }
      }
      if (f >= seconds - 0.05) finish();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [startAt, part, from, seconds, finish]);

  const skip = () => finish();

  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    // Dev-only: window.__landing.seek(t) jumps the film to t seconds.
    (window as unknown as { __landing?: unknown }).__landing = { seek: (film: number) => setStartAt(performance.now() - (film - from) * 1000) };
  }

  const phase = PHASES[part].find((c) => now >= c.from && now < c.to);
  const beat = [...BEATS[part]].reverse().find((b) => now >= b.at && now < b.at + (b.line.en.length / 11 + 1.2));
  const started = startAt !== null;
  const reading = part === "approach" && now >= 20 ? readout(now) : null;
  const alarmOn = part === "approach" && now >= 36.5 && now < 47;
  const poll = part === "approach" ? now >= 40 && now < 48 : now >= 26 && now < 38;
  // Fade out at the very end so the hand-over is not a cut.
  const fadeOut = now > seconds - 1.2;

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-black" data-landing-film={part}>
      <WorldCanvas label={part === "approach" ? "The lunar module Eagle descending to the Moon" : "The lunar module Eagle on the surface of the Moon"}>
        <FilmWorld part={part} from={from} to={to} startAt={startAt} onReady={begin} />
      </WorldCanvas>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[8vh] bg-black" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[8vh] bg-black" />
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-20 bg-black transition-opacity duration-[1400ms]", started && !fadeOut ? "opacity-0" : "opacity-100")} />

      {/* The instruments: altitude, speed and fuel through the descent. */}
      {reading && (
        <div className="pointer-events-none absolute left-4 top-[calc(8vh+0.75rem)] z-10 font-mono text-white/90 sm:left-10">
          <div className="text-[10px] uppercase tracking-[0.2em] text-space-cyan sm:text-xs">{part === "approach" ? "LM · P63" : ""}</div>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm sm:text-lg">
            <dt className="text-white/55">ALT</dt>
            <dd className="text-right tabular-nums">{ft(reading.altFt)} ft</dd>
            <dt className="text-white/55">VEL</dt>
            <dd className="text-right tabular-nums">{ft(reading.speed)} ft/s</dd>
            <dt className="text-white/55">FUEL</dt>
            <dd className={cn("text-right tabular-nums", reading.fuel < 35 && "text-amber-300")}>{Math.round(reading.fuel)} %</dd>
          </dl>
        </div>
      )}

      {/* The computer's keyboard: the program alarm. */}
      {part === "approach" && now >= 36 && now < 48 && (
        <div className="pointer-events-none absolute right-4 top-[calc(8vh+0.75rem)] z-10 w-56 rounded-md border-2 border-[#3b4150] bg-[#101318] p-3 font-mono sm:right-10 sm:w-64">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <span className={cn("rounded px-2 py-1 text-center", alarmOn ? "animate-pulse bg-amber-400 text-black" : "bg-[#1b1f27] text-white/40")}>PROG</span>
            <span className="rounded bg-[#1b1f27] px-2 py-1 text-center text-white/40">COMP ACTY</span>
          </div>
          <div className="mt-2 rounded bg-black px-2 py-2 text-center text-3xl tracking-[0.3em] text-[#6bff8e] sm:text-4xl">{alarmOn ? "1202" : "63"}</div>
          <div className="mt-1 text-center text-[10px] uppercase tracking-[0.2em] text-white/45">{alarmOn ? "EXEC OVERFLOW" : "DESCENT"}</div>
        </div>
      )}

      {/* Mission Control: the flight controllers answer, one lamp each. */}
      {poll && (
        <div className="pointer-events-none absolute bottom-[calc(8vh+1rem)] left-4 z-10 w-60 rounded-md border border-white/20 bg-black/75 p-3 font-mono sm:left-10 sm:w-72">
          <div className="text-[10px] uppercase tracking-[0.25em] text-space-cyan">{part === "approach" ? "Mission Control" : "Houston"}</div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {POLL.map((p, i) => {
              const lit = part === "approach" ? p.id === "guido" || now > 44.5 + i * 0.25 : now > 27 + i * 0.5;
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", lit ? "bg-[#4dff88] shadow-[0_0_8px_#4dff88]" : "bg-white/15")} />
                  <span className={lit ? "text-white" : "text-white/40"}>{localize(p.label)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 text-center text-sm font-bold tracking-[0.3em] text-[#4dff88]">{part === "approach" ? (now > 44.5 ? "GO" : "…") : now > 31 ? "GO" : "…"}</div>
        </div>
      )}

      {/* Captions: who is speaking and what they say; the title of the stretch below. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(8vh+1rem)] z-10 flex flex-col items-center gap-2 px-6 text-center">
        {beat && (
          <div key={beat.at} className="max-w-2xl [animation:fade-in_300ms_ease-out]">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/65">{localize(SPEAKER[beat.who])}</p>
            <p className="text-lg font-semibold text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.9)] sm:text-2xl">“{localize(beat.line)}”</p>
          </div>
        )}
        {phase && (
          <p key={phase.from} className="[animation:fade-in_900ms_ease-out] text-xs uppercase tracking-[0.25em] text-white/75 sm:text-sm">
            {localize(phase.text)}
          </p>
        )}
      </div>

      {started && !ended && (
        <div className="absolute bottom-[calc(8vh+0.75rem)] right-4 z-20 sm:right-10">
          <Button variant="secondary" size="sm" onClick={skip}>
            {t.missionControl.skipCinematic}
          </Button>
        </div>
      )}
    </section>
  );
}
