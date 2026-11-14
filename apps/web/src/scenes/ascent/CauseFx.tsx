"use client";

import { useMemo } from "react";
import type { FailureCode } from "@/game/ascentFlight";

/**
 * What each kind of failure looks like from inside the cabin, over the 3D view: so that a structural
 * break, a dry tank, a vehicle too heavy to climb, a wind shear and a lightning strike are five
 * different films and not one film with different lines. `t` is seconds since the engines failed
 * (negative while the warnings are still coming), `trouble` how far into the warnings (0 to 1).
 */
export function CauseFx({ code, t, trouble, reduced }: { code: FailureCode; t: number; trouble: number; reduced: boolean }) {
  switch (code) {
    case "structural":
      return <Cracks t={t} trouble={trouble} reduced={reduced} />;
    case "fuel-depleted":
      return <Weightless t={t} reduced={reduced} />;
    case "slow-climb":
      return <SinkRate t={t} trouble={trouble} reduced={reduced} />;
    case "wind-shear":
      return <WindStreaks t={t} trouble={trouble} reduced={reduced} />;
    case "lightning":
      return <PowerLoss t={t} trouble={trouble} reduced={reduced} />;
  }
}

/** Seconds of the failing phase at which the film ends in the blast (see FAIL_BOOM_AT). */
const END = 16;

/* ------------------------------------------------------------ structural */

/** The window glass cracks and the cracks spread; panels and pieces of the skin streak past outside. */
function Cracks({ t, trouble, reduced }: { t: number; trouble: number; reduced: boolean }) {
  const lines = useMemo(() => {
    let s = 7;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    // Cracks start from a few points around the window and run in jagged lines.
    return Array.from({ length: 9 }, (_, i) => {
      let x = 25 + rnd() * 50;
      let y = 18 + rnd() * 40;
      const pts = [[x, y]];
      const a = rnd() * Math.PI * 2;
      for (let k = 0; k < 7; k++) {
        const ang = a + (rnd() - 0.5) * 1.3;
        x += Math.cos(ang) * (4 + rnd() * 7);
        y += Math.sin(ang) * (4 + rnd() * 7);
        pts.push([x, y]);
      }
      return { pts: pts.map((p) => p.join(",")).join(" "), at: -2 + i * 1.8 };
    });
  }, []);
  const pieces = Math.max(0, Math.floor((t + 0.5) / 1.1));
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {lines.map((l, i) => {
          const k = Math.min(1, Math.max(0, (t - l.at + 2 * trouble) / 2));
          return k > 0 ? <polyline key={i} points={l.pts} fill="none" stroke="rgba(235,240,255,0.8)" strokeWidth={0.28} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k} /> : null;
        })}
      </svg>
      {!reduced &&
        Array.from({ length: Math.min(pieces, 14) }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-[2px] bg-[#c7ccd6]"
            style={{
              top: `${10 + ((i * 37) % 55)}%`,
              left: "-6%",
              width: `${14 + ((i * 13) % 26)}px`,
              height: `${6 + ((i * 7) % 12)}px`,
              animation: `cf-piece ${0.9 + (i % 4) * 0.25}s linear forwards`,
              animationDelay: "0s",
              ["--dy" as string]: `${((i * 53) % 90) - 30}px`,
              ["--w" as string]: `${i % 2 ? 1 : -1}`,
              transform: "rotate(var(--rot, 0deg))",
            }}
          />
        ))}
      <style>{`@keyframes cf-piece { from { transform: translate(0,0) rotate(0deg); opacity: 1; } to { transform: translate(130vw, var(--dy)) rotate(540deg); opacity: 0.9; } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------ fuel-depleted */

/** The engines are out: the shaking stops and everything not tied down starts to float. */
function Weightless({ t, reduced }: { t: number; reduced: boolean }) {
  const dust = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({ x: (i * 47) % 100, y: (i * 29) % 100, s: 2 + (i % 4), d: 5 + (i % 5) * 1.6 })),
    [],
  );
  const calm = Math.min(1, Math.max(0, t / 1.5));
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: calm }}>
      <div className="absolute inset-0 bg-[#02060f]/35" />
      {!reduced &&
        dust.map((d, i) => (
          <span key={i} className="absolute rounded-full bg-white/70" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, animation: `cf-float ${d.d}s ease-in-out infinite alternate` }} />
        ))}
      {/* A pencil lifts off the console and drifts. */}
      {!reduced && <span className="absolute h-1.5 w-16 rounded bg-[#f2c94c]" style={{ left: "30%", top: "72%", animation: "cf-pencil 7s ease-in-out infinite alternate" }} />}
      <style>{`
        @keyframes cf-float { from { transform: translate(0, 0); } to { transform: translate(14px, -26px); } }
        @keyframes cf-pencil { from { transform: translate(0, 0) rotate(-8deg); } to { transform: translate(60px, -180px) rotate(40deg); } }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------ slow-climb */

/** Too heavy to climb: the ground and the sea fill the bottom of the window and the warning shouts the height. */
function SinkRate({ t, trouble, reduced }: { t: number; trouble: number; reduced: boolean }) {
  const k = Math.min(1, Math.max(0, (t + 4) / (END + 4)));
  const warn = trouble > 0.45 || t >= 0;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: `${10 + k * 62}%`, background: "linear-gradient(to top, rgba(40,62,48,0.95), rgba(52,92,120,0.55) 55%, transparent)", transition: "height 0.4s linear" }}
      />
      {warn && (
        <p className="absolute inset-x-0 top-[28%] text-center font-mono text-3xl font-bold uppercase tracking-[0.4em] text-[#ff4a3a] drop-shadow-[0_0_14px_rgb(255_60_40/0.9)] sm:text-5xl" style={{ animation: reduced ? undefined : "cf-blink 0.5s steps(2) infinite" }}>
          {t >= 3 ? "PULL UP" : "SINK RATE"}
        </p>
      )}
      <style>{`@keyframes cf-blink { 0% { opacity: 1; } 100% { opacity: 0.15; } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------ wind-shear */

/** The wind hits from the side: streaks of cloud and rain race across the window and the cabin leans on them. */
function WindStreaks({ t, trouble, reduced }: { t: number; trouble: number; reduced: boolean }) {
  const power = t >= 0 ? 1 : Math.min(1, trouble * 1.3);
  const streaks = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ y: (i * 37) % 100, w: 120 + ((i * 41) % 260), d: 0.35 + (i % 5) * 0.12, delay: (i % 9) * 0.07 })), []);
  if (reduced) return <div className="absolute inset-0 bg-white/10" style={{ opacity: power }} />;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.25 + 0.75 * power }}>
      {streaks.map((s, i) => (
        <span key={i} className="absolute h-px bg-white/70" style={{ top: `${s.y}%`, left: "100%", width: s.w, animation: `cf-streak ${s.d}s ${s.delay}s linear infinite` }} />
      ))}
      <style>{`@keyframes cf-streak { from { transform: translateX(0); } to { transform: translateX(-140vw); } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------ lightning */

/** St. Elmo's fire crawls over the glass, then the power goes and only red emergency lights are left. */
function PowerLoss({ t, trouble, reduced }: { t: number; trouble: number; reduced: boolean }) {
  const struck = t >= 0;
  return (
    <div className="absolute inset-0 overflow-hidden">
      {!struck && trouble > 0.2 && (
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 90px rgba(130,185,255,0.55), inset 0 0 220px rgba(90,150,255,0.35)", animation: reduced ? undefined : "cf-elmo 0.35s ease-in-out infinite alternate" }} />
      )}
      {struck && (
        <>
          <div className="absolute inset-0 bg-black/60" />
          {/* Emergency lighting: dull red strips, flickering. */}
          <div className="absolute inset-x-0 top-0 h-3 bg-[#7a0d08]" style={{ animation: reduced ? undefined : "cf-emerg 1.4s steps(3) infinite" }} />
          <div className="absolute inset-x-0 bottom-0 h-3 bg-[#7a0d08]" style={{ animation: reduced ? undefined : "cf-emerg 1.4s steps(3) infinite reverse" }} />
        </>
      )}
      <style>{`
        @keyframes cf-elmo { from { opacity: 0.45; } to { opacity: 1; } }
        @keyframes cf-emerg { 0% { opacity: 1; } 50% { opacity: 0.25; } 100% { opacity: 0.85; } }
      `}</style>
    </div>
  );
}
