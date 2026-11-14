"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { addTrauma } from "@/game/shake";
import { playSfx, prefetchVoiceLines, speak, startBreathing, startHeartbeat, startSuspense, stopVoiceLine, type Pulse, type Suspense } from "@/game/sfx";
import { startCauseBed, type CauseBed } from "@/game/causeAudio";
import { useSettingsStore } from "@/game/settingsStore";
import { useLocalized } from "@/i18n/useT";
import type { AscentFailure } from "@/game/ascentFlight";
import type { AscentFlight } from "./AscentWorld";
import { CREW_NAME, FLAVOR, SCRIPT, type Cue } from "./failureScript";
import { GaugeShot } from "./GaugeShot";
import { HelmetShot } from "./HelmetShot";
import { CauseFx } from "./CauseFx";

const GLOW_RGB = { red: "255, 45, 30", amber: "255, 165, 45", blue: "120, 175, 255", green: "70, 225, 150", white: "235, 238, 255" } as const;
/** The performed recordings are already fast and high; the player only adds a little shake on top. */
const CREW_RATE = 1;
/** The crew's voices have their own channel: the computer and Houston (the "guide" channel) speak at the same time, not in turn. */
const CREW_CHANNEL = "crew";

/**
 * The cabin cutaways of a doomed flight, laid over the 3D view: cuts to the three helmets, the score
 * of dread, the heartbeat and quick breathing in the ears, the beacon sweeping the cabin, sparks,
 * fire at the window, a storm's strobes or a wind shear's roll, and what the crew say. It watches the
 * flight clock and plays its cues once each.
 */
export function FailureCinema({
  flight,
  failure,
  reduced,
}: {
  flight: MutableRefObject<AscentFlight>;
  failure: AscentFailure;
  reduced: boolean;
}) {
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const flavor = FLAVOR[failure.code];
  const script = SCRIPT[failure.code];
  const [shot, setShot] = useState<{ cue: Cue; n: number } | null>(null);
  const [strobe, setStrobe] = useState(0);
  const [sparks, setSparks] = useState(0);
  const [dark, setDark] = useState(false);
  const [fire, setFire] = useState(false);
  const [fear, setFear] = useState(0);
  const [mode, setMode] = useState<AscentFlight["mode"]>("ride");
  const [alarm, setAlarm] = useState(false);
  const [clock, setClock] = useState(-24);
  const fired = useRef(new Set<number>());
  const groans = useRef(new Set<number>());
  const troubleAt = useRef<number | null>(null);
  const hide = useRef(0);
  const flickerUntil = useRef(0);
  const fireUntil = useRef(0);
  const nextStrobe = useRef(0);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const fearRef = useRef(0);
  const localizeRef = useRef(localize);
  localizeRef.current = localize;

  // The voice starts in the very frame that draws its shot, on its own channel: nothing waits for it and it
  // waits for nothing. (Started from the timer instead, it would run ahead of a slow frame and be heard
  // before the picture it belongs to.)
  useEffect(() => {
    const line = shot?.cue.line;
    if (!line) return;
    const id = window.requestAnimationFrame(() => speak(localizeRef.current(line), localeRef.current, { channel: CREW_CHANNEL, rate: CREW_RATE, panic: 0.15 + fearRef.current * 0.3 }));
    return () => window.cancelAnimationFrame(id);
  }, [shot]);

  useEffect(() => {
    let heart: Pulse | null = null;
    let breath: Pulse | null = null;
    let music: Suspense | null = null;
    let bed: CauseBed | null = null;
    const start = () => {
      if (heart) return;
      heart = startHeartbeat();
      breath = startBreathing();
      music = startSuspense();
      bed = startCauseBed(flavor.bed);
    };
    // Every line of this film is downloaded before it is needed, so a voice starts with its shot and not after.
    prefetchVoiceLines(script.flatMap((c) => (c.line ? [localize(c.line)] : [])), localeRef.current);

    const id = window.setInterval(() => {
      const f = flight.current;
      setMode(f.mode);
      setAlarm(f.alarm && !f.boom);
      const now = performance.now();
      if (f.mode === "trouble" || f.mode === "failing") {
        if (troubleAt.current === null) {
          troubleAt.current = now;
          start();
        }
        const inTrouble = f.mode === "trouble" ? (now - troubleAt.current) / 1000 : 99;
        // Dread builds through the warnings and peaks when the engines quit.
        const k = f.mode === "failing" ? 1 : Math.min(1, inTrouble / 15);
        setFear(k);
        setClock(f.mode === "failing" ? f.failT : Math.min(-0.1, inTrouble - 24));
        heart?.setRate(72 + k * 100);
        heart?.setLevel(f.boom ? 0 : flavor.hush && f.mode === "failing" ? 1 : 0.2 + k * 0.7);
        breath?.setRate(18 + k * 52);
        breath?.setLevel(f.boom ? 0 : 0.35 + k * 0.65);
        music?.setIntensity(f.boom ? 0 : 0.15 + k * 0.85);
        bed?.setLevel(f.boom ? 0 : flavor.hush && f.mode === "failing" ? 0.35 : 0.25 + k * 0.75);

        // The cutaways, each once, on the clock of the phase it belongs to.
        script.forEach((cue, i) => {
          if (fired.current.has(i)) return;
          const t = cue.phase === "trouble" ? inTrouble : f.mode === "failing" ? f.failT : -1;
          if (t < cue.at) return;
          fired.current.add(i);
          if (f.boom) return;
          window.clearTimeout(hide.current);
          setShot({ cue, n: i });
          addTrauma(0.15 + flavor.shake * 0.2);
          fearRef.current = k;
          for (const fx of cue.fx ?? []) {
            if (fx === "stinger") {
              music?.stinger();
              playSfx("bang");
              addTrauma(0.6);
            } else if (fx === "silence") music?.silence(2600);
            else if (fx === "sparks") {
              setSparks((n) => n + 1);
              playSfx("relay", 0.7);
            } else if (fx === "flicker") flickerUntil.current = now + 900;
            else if (fx === "fire") fireUntil.current = now + 2600;
          }
          hide.current = window.setTimeout(() => setShot((s) => (s?.n === i ? null : s)), cue.ms);
        });

        // Metal groans through the structure as it fails.
        if (f.mode === "failing") {
          flavor.groans?.forEach((at, i) => {
            if (f.failT >= at && !groans.current.has(i)) {
              groans.current.add(i);
              playSfx("groan");
              addTrauma(0.35);
            }
          });
        }

        // A storm: lightning through the window, and the lights stutter out as the strike lands.
        if (flavor.storm && !reduced && f.mode === "trouble" && now > nextStrobe.current) {
          nextStrobe.current = now + 700 + Math.random() * 1800;
          setStrobe((n) => n + 1);
          playSfx("bang", 0.6);
          addTrauma(0.3);
        }
        const flicker = now < flickerUntil.current && Math.random() < 0.55;
        const out = Boolean(flavor.storm) && f.mode === "failing" && f.failT < 2.2;
        setDark(!reduced && !f.boom && (flicker || out));
        setFire(!reduced && !f.boom && now < fireUntil.current);
      }
      if (flight.current.boom) {
        heart?.stop();
        breath?.stop();
        music?.stop(0.2);
        bed?.stop(0.3);
        stopVoiceLine(CREW_CHANNEL);
        heart = null;
        breath = null;
        music = null;
        bed = null;
        setShot(null);
      }
    }, 80);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(hide.current);
      heart?.stop();
      breath?.stop();
      music?.stop(0.2);
      bed?.stop(0.2);
      stopVoiceLine(CREW_CHANNEL);
    };
  }, [flight, flavor, script, localize, reduced]);

  const r = GLOW_RGB[flavor.glow];
  const beat = 60 / (72 + fear * 100);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5]"
      style={flavor.sway && !reduced ? { animation: "fc-sway 2.6s ease-in-out infinite" } : undefined}
    >
      {(mode === "trouble" || mode === "failing") && !mode.includes("boom") && <CauseFx code={failure.code} t={clock} trouble={fear} reduced={reduced} />}

      {/* Light of the warning, rolling round the cabin like a beacon. */}
      {alarm && !reduced && (
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{ background: `radial-gradient(ellipse 60% 120% at 0% 50%, rgba(${r}, 0.55), transparent 70%)`, animation: "fc-beacon 1s ease-in-out infinite" }}
        />
      )}

      {/* Heart pounding: the edges close in and let go, once a beat. */}
      {(mode === "trouble" || mode === "failing") && !reduced && (
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.9) 100%)", animation: `fc-beat ${beat}s ease-in-out infinite` }}
        />
      )}

      {/* Fire licking up past the window. */}
      {fire && (
        <div
          className="absolute inset-x-0 bottom-0 h-3/4 mix-blend-screen"
          style={{ background: "linear-gradient(to top, rgba(255,120,30,0.85), rgba(255,70,10,0.35) 45%, transparent)", animation: "fc-fire 0.18s ease-in-out infinite alternate" }}
        />
      )}

      {/* Sparks from the panels. */}
      {sparks > 0 && !reduced && <Sparks key={sparks} />}

      {/* Lightning. */}
      {strobe > 0 && <div key={strobe} className="absolute inset-0 bg-[#cfe3ff]" style={{ animation: "fc-strobe 380ms ease-out forwards" }} />}
      {dark && <div className="absolute inset-0 bg-black/80" />}

      {shot && (
        <div key={shot.n} className="absolute inset-0 animate-in fade-in duration-100">
          {shot.cue.shot === "gauge" ? (
            <GaugeShot kind={flavor.gauge} phase={shot.cue.phase} glow={flavor.glow} ms={shot.cue.ms} fear={fear} reduced={reduced} />
          ) : (
            <HelmetShot who={shot.cue.who} look={shot.cue.look} ms={shot.cue.ms} glow={flavor.glow} lens={flavor.helmet} shake={flavor.shake} fear={fear} reduced={reduced} />
          )}
          {fire && <div className="absolute inset-0 mix-blend-screen" style={{ background: "radial-gradient(ellipse at 50% 110%, rgba(255,110,30,0.7), transparent 60%)" }} />}
          <div className="absolute inset-x-0 bottom-[10dvh] flex flex-col items-center gap-1 px-6 text-center">
            {(shot.cue.shot !== "gauge" || shot.cue.line) && <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">{localize(CREW_NAME[shot.cue.who])}</p>}
            {shot.cue.line && (
              <p className="max-w-2xl text-xl font-semibold text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.9)] sm:text-3xl">“{localize(shot.cue.line)}”</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fc-beacon { 0%, 100% { transform: translateX(-35%); opacity: 0; } 50% { transform: translateX(80%); opacity: 1; } }
        @keyframes fc-beat { 0%, 100% { opacity: 0.25; } 12% { opacity: 0.75; } 28% { opacity: 0.35; } 40% { opacity: 0.6; } }
        @keyframes fc-strobe { 0% { opacity: 0.9; } 15% { opacity: 0.2; } 30% { opacity: 0.7; } 100% { opacity: 0; } }
        @keyframes fc-sway { 0%, 100% { transform: rotate(-3.5deg) scale(1.08); } 50% { transform: rotate(3.5deg) scale(1.08); } }
        @keyframes fc-fire { from { opacity: 0.55; transform: scaleY(0.92); } to { opacity: 1; transform: scaleY(1.05); } }
        @keyframes fc-spark { 0% { opacity: 1; transform: translate(0, 0); } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)); } }
      `}</style>
    </div>
  );
}

/** A shower of sparks from a failing panel: a burst of orange dots thrown out and falling. */
function Sparks() {
  const dots = useRef(
    Array.from({ length: 26 }, (_, i) => ({
      x: 15 + ((i * 37) % 70),
      y: 55 + ((i * 53) % 35),
      dx: ((i * 29) % 160) - 80,
      dy: -(40 + ((i * 41) % 120)),
      d: (i % 7) * 40,
    })),
  ).current;
  return (
    <div className="absolute inset-0">
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-[#ffb347] shadow-[0_0_8px_#ff8a1f]"
          style={{ left: `${d.x}%`, top: `${d.y}%`, ["--dx" as string]: `${d.dx}px`, ["--dy" as string]: `${d.dy}px`, animation: `fc-spark 0.9s ${d.d}ms ease-out forwards`, opacity: 0 }}
        />
      ))}
    </div>
  );
}
