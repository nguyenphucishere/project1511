"use client";

import type { Flavor, GaugeKind } from "./failureScript";

const GLOW: Record<Flavor["glow"], string> = {
  red: "255, 45, 30",
  amber: "255, 165, 45",
  blue: "120, 175, 255",
  green: "70, 225, 150",
  white: "235, 238, 255",
};

const LABEL: Record<GaugeKind, string> = {
  strain: "AIRFRAME LOAD",
  fuel: "PROPELLANT",
  altitude: "ALTITUDE / CLIMB RATE",
  horizon: "ATTITUDE",
  power: "POWER BUS",
};

/**
 * A close-up of the one instrument that tells this failure's story, in the same cabin as the helmet
 * shots: the airframe load needle leaving its scale, the tanks draining, the altimeter and the
 * vertical-speed tape running backwards, the horizon rolling, the power bus going out lamp by lamp.
 * All motion is CSS, started when the shot cuts in and sized to how long it stays (`ms`).
 */
export function GaugeShot({
  kind,
  phase,
  glow,
  ms,
  fear,
  reduced,
}: {
  kind: GaugeKind;
  /** Before the engines fail the readings are bad; after, they are gone or reversed. */
  phase: "trouble" | "failing";
  glow: Flavor["glow"];
  ms: number;
  /** 0 to 1: how far the failure has gone. */
  fear: number;
  reduced: boolean;
}) {
  const rgb = GLOW[glow];
  const dur = Math.max(0.8, ms / 1000);
  const failing = phase === "failing";
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(${rgb}, 0.2), #04060a 72%)` }}>
      <svg viewBox="0 0 800 800" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-hidden style={{ animation: reduced ? undefined : `gs-push ${dur + 0.5}s ease-out forwards` }}>
        {/* The panel: a dark bezel with screws, and the instrument's name. */}
        <rect x="70" y="110" width="660" height="580" rx="26" fill="#0b0f16" stroke="#2a3140" strokeWidth="10" />
        <rect x="90" y="130" width="620" height="540" rx="16" fill="#06090e" stroke={`rgb(${rgb})`} strokeOpacity="0.35" strokeWidth="3" />
        {[[100, 140], [700, 140], [100, 660], [700, 660]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#3a4152" />
        ))}
        <text x="400" y="176" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="26" letterSpacing="8" fill={`rgb(${rgb})`} opacity="0.9">
          {LABEL[kind]}
        </text>
        {kind === "strain" && <Strain rgb={rgb} dur={dur} fear={fear} reduced={reduced} failing={failing} />}
        {kind === "fuel" && <Fuel rgb={rgb} dur={dur} reduced={reduced} failing={failing} />}
        {kind === "altitude" && <Altitude dur={dur} reduced={reduced} failing={failing} />}
        {kind === "horizon" && <Horizon rgb={rgb} reduced={reduced} failing={failing} />}
        {kind === "power" && <Power rgb={rgb} dur={dur} reduced={reduced} failing={failing} />}
      </svg>
      <style>{`
        @keyframes gs-push { from { transform: scale(1); } to { transform: scale(1.1); } }
        @keyframes gs-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.1; } }
        @keyframes gs-jitter { 0%, 100% { translate: 0 0; } 25% { translate: 5px -3px; } 50% { translate: -4px 4px; } 75% { translate: 3px 2px; } }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- strain */

/** A half-circle load gauge: the needle runs past the red band and shivers there; six strain bars rise into the red. */
function Strain({ rgb, dur, fear, reduced, failing }: { rgb: string; dur: number; fear: number; reduced: boolean; failing: boolean }) {
  const arc = (from: number, to: number, r: number) => {
    const p = (a: number) => [400 + r * Math.cos(Math.PI - (a * Math.PI) / 180), 470 - r * Math.sin(Math.PI - (a * Math.PI) / 180)];
    const [x1, y1] = p(from);
    const [x2, y2] = p(to);
    return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  return (
    <g>
      <path d={arc(0, 110, 210)} fill="none" stroke="#2d3646" strokeWidth="26" />
      <path d={arc(110, 150, 210)} fill="none" stroke="#c9a227" strokeWidth="26" />
      <path d={arc(150, 180, 210)} fill="none" stroke="#e23b2e" strokeWidth="26" />
      <g style={{ transformOrigin: "400px 470px", transform: `rotate(${failing ? 168 : 40 + fear * 120}deg)`, animation: reduced ? undefined : `gs-needle ${dur}s ease-out forwards, gs-jitter 0.07s linear infinite` }}>
        <path d="M400 470 L206 470" stroke="#f4f6fa" strokeWidth="9" strokeLinecap="round" />
      </g>
      <circle cx="400" cy="470" r="20" fill="#e8ebf2" />
      <text x="400" y="560" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="40" fill="#e23b2e" style={{ animation: reduced ? undefined : "gs-blink 0.4s steps(1) infinite" }}>
        STRUCT LIMIT
      </text>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} style={{ transformOrigin: `${150 + i * 100}px 640px`, animation: reduced ? undefined : `gs-bar ${0.5 + i * 0.07}s ease-in-out ${i * 0.05}s infinite alternate` }}>
          <rect x={125 + i * 100} y="595" width="50" height="45" fill={failing || i > 2 ? "#e23b2e" : `rgb(${rgb})`} opacity="0.9" />
        </g>
      ))}
      <style>{`
        @keyframes gs-needle { from { transform: rotate(35deg); } to { transform: rotate(${failing ? 168 : 150}deg); } }
        @keyframes gs-bar { from { transform: scaleY(0.2); } to { transform: scaleY(1.7); } }
      `}</style>
    </g>
  );
}

/* ---------------------------------------------------------------- fuel */

/** Two tank columns draining to nothing under a LOW lamp; the readout counts down. */
function Fuel({ rgb, dur, reduced, failing }: { rgb: string; dur: number; reduced: boolean; failing: boolean }) {
  const start = failing ? 0.07 : 0.34;
  return (
    <g>
      {[0, 1].map((i) => {
        const x = 220 + i * 250;
        return (
          <g key={i}>
            <rect x={x} y="230" width="110" height="340" rx="8" fill="#0d1520" stroke="#3a4a5e" strokeWidth="6" />
            <g style={{ transformOrigin: `${x}px 570px`, animation: reduced || failing ? undefined : `gs-drain ${dur + 0.4}s ease-in forwards` }}>
              <rect x={x + 6} y={564 - 328 * start} width="98" height={328 * start} fill={`rgb(${rgb})`} opacity="0.55" />
            </g>
            <text x={x + 55} y="610" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="26" fill="#9db4c9">
              {i === 0 ? "LOX" : "RP-1"}
            </text>
          </g>
        );
      })}
      <circle cx="400" cy="640" r="14" fill={failing ? "#e23b2e" : `rgb(${rgb})`} style={{ animation: reduced ? undefined : `gs-blink ${failing ? 1.4 : 0.5}s steps(1) infinite` }} />
      <text x="400" y="222" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="34" fill={`rgb(${rgb})`}>
        {failing ? "0.0 %" : "LOW LEVEL"}
      </text>
      <style>{`@keyframes gs-drain { from { transform: scaleY(1); } to { transform: scaleY(0.12); } }`}</style>
    </g>
  );
}

/* ---------------------------------------------------------------- altitude */

/** An altitude tape and a climb-rate tape: still at zero in the warnings, running backwards once she falls. */
function Altitude({ dur, reduced, failing }: { dur: number; reduced: boolean; failing: boolean }) {
  const marks = Array.from({ length: 12 }, (_, i) => i);
  return (
    <g>
      <clipPath id="gs-tape">
        <rect x="150" y="220" width="200" height="380" />
      </clipPath>
      <rect x="150" y="220" width="200" height="380" fill="#0d1520" stroke="#3a4a5e" strokeWidth="6" />
      <g clipPath="url(#gs-tape)">
        <g style={{ animation: reduced ? undefined : failing ? `gs-fall ${dur}s linear infinite` : "gs-creep 3s ease-in-out infinite alternate" }}>
          {marks.map((i) => (
            <g key={i}>
              <line x1="150" y1={220 + i * 60} x2="350" y2={220 + i * 60} stroke="#9db4c9" strokeWidth="3" />
              <text x="180" y={254 + i * 60} fontFamily="monospace" fontSize="26" fill="#cfe0ef">
                {String(Math.max(0, 7 - i)).padStart(1, "0")}.{(i * 3) % 10}
              </text>
            </g>
          ))}
        </g>
      </g>
      <path d="M345 410 L380 395 L380 425 Z" fill="#ffd166" />
      <rect x="450" y="220" width="200" height="380" fill="#0d1520" stroke="#3a4a5e" strokeWidth="6" />
      <line x1="450" y1="410" x2="650" y2="410" stroke="#9db4c9" strokeWidth="3" />
      <g style={{ transformOrigin: "550px 410px", transform: `scaleY(${failing ? 1 : 0.02})`, animation: reduced ? undefined : failing ? `gs-sink ${dur}s ease-in forwards` : undefined }}>
        <rect x="500" y="410" width="100" height="170" fill="#e23b2e" opacity="0.85" />
      </g>
      <text x="550" y="660" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="38" fill={failing ? "#ff5a4a" : "#ffd166"} style={{ animation: reduced ? undefined : "gs-blink 0.5s steps(1) infinite" }}>
        {failing ? "SINK RATE" : "0.0 m/s"}
      </text>
      <text x="250" y="660" textAnchor="middle" fontFamily="monospace" fontSize="30" fill="#9db4c9">
        km
      </text>
      <style>{`
        @keyframes gs-fall { from { transform: translateY(-120px); } to { transform: translateY(0px); } }
        @keyframes gs-creep { from { transform: translateY(-6px); } to { transform: translateY(6px); } }
        @keyframes gs-sink { from { transform: scaleY(0.05); } to { transform: scaleY(1); } }
      `}</style>
    </g>
  );
}

/* ---------------------------------------------------------------- horizon */

/** An artificial horizon that rolls hard in the warnings and spins end over end once the vehicle tumbles. */
function Horizon({ rgb, reduced, failing }: { rgb: string; reduced: boolean; failing: boolean }) {
  return (
    <g>
      <clipPath id="gs-ball">
        <circle cx="400" cy="420" r="210" />
      </clipPath>
      <g clipPath="url(#gs-ball)">
        <g style={{ transformOrigin: "400px 420px", animation: reduced ? undefined : failing ? "gs-spin 1.6s linear infinite" : "gs-bank 1.3s ease-in-out infinite alternate" }}>
          <rect x="150" y="140" width="500" height="280" fill="#2d6db3" />
          <rect x="150" y="420" width="500" height="280" fill="#6a4a2a" />
          <line x1="150" y1="420" x2="650" y2="420" stroke="#fff" strokeWidth="5" />
          {[-60, -30, 30, 60].map((d) => (
            <line key={d} x1="360" y1={420 + d * 2.4} x2="440" y2={420 + d * 2.4} stroke="#fff" strokeWidth="3" />
          ))}
        </g>
      </g>
      <circle cx="400" cy="420" r="210" fill="none" stroke="#3a4152" strokeWidth="14" />
      <path d="M300 420 L370 420 L400 450 L430 420 L500 420" fill="none" stroke="#ffd166" strokeWidth="9" strokeLinejoin="round" />
      <text x="400" y="680" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="36" fill={failing ? "#ff5a4a" : `rgb(${rgb})`} style={{ animation: reduced ? undefined : "gs-blink 0.45s steps(1) infinite" }}>
        {failing ? "TUMBLING" : "BANK ANGLE"}
      </text>
      <style>{`
        @keyframes gs-bank { from { transform: rotate(-34deg) translateY(-26px); } to { transform: rotate(38deg) translateY(30px); } }
        @keyframes gs-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </g>
  );
}

/* ---------------------------------------------------------------- power */

/** A bank of bus lamps going out one by one under a wash of static; after the strike only the red ones are left. */
function Power({ rgb, dur, reduced, failing }: { rgb: string; dur: number; reduced: boolean; failing: boolean }) {
  const lamps = Array.from({ length: 12 }, (_, i) => i);
  return (
    <g>
      {lamps.map((i) => {
        const x = 175 + (i % 4) * 150;
        const y = 250 + Math.floor(i / 4) * 130;
        const dead = failing || i % 3 === 0;
        return (
          <g key={i}>
            <rect x={x} y={y} width="110" height="70" rx="8" fill="#0d1520" stroke="#2a3140" strokeWidth="4" />
            <circle
              cx={x + 55}
              cy={y + 35}
              r="20"
              fill={failing ? "#5a0f0a" : `rgb(${rgb})`}
              opacity={dead ? 0.15 : 0.95}
              style={{ animation: reduced || failing ? undefined : `gs-out ${dur}s steps(1) ${(i * dur) / 14}s forwards` }}
            />
          </g>
        );
      })}
      <text x="400" y="660" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="36" fill={failing ? "#ff5a4a" : `rgb(${rgb})`}>
        {failing ? "BUS A B C: DEAD" : "BUS FAULT"}
      </text>
      {/* Static: bars of noise crawling down the panel. */}
      {!reduced &&
        [0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x="95" y={200 + i * 90} width="610" height="5" fill="#cfe3ff" opacity="0.25" style={{ animation: `gs-static ${0.25 + i * 0.11}s steps(2) infinite` }} />
        ))}
      <style>{`
        @keyframes gs-out { 0% { opacity: 0.95; } 100% { opacity: 0.1; } }
        @keyframes gs-static { 0% { translate: 0 0; opacity: 0.35; } 50% { translate: 0 70px; opacity: 0.05; } 100% { translate: 0 -40px; opacity: 0.3; } }
      `}</style>
    </g>
  );
}
