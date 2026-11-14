"use client";

import type { CrewId, Flavor, HelmetStyle } from "./failureScript";

const ACCENT: Record<CrewId, string> = { armstrong: "#4f8cff", aldrin: "#ff9a2e", collins: "#3ddc97" };
const NAME: Record<CrewId, string> = { armstrong: "ARMSTRONG", aldrin: "ALDRIN", collins: "COLLINS" };
const GLOW: Record<Flavor["glow"], [number, number, number]> = { red: [255, 45, 30], amber: [255, 165, 45], blue: [120, 175, 255], green: [70, 225, 150], white: [235, 238, 255] };

/**
 * A close-up of one astronaut through his helmet: the visor catches the alarm light as it sweeps
 * round the cabin, his breath fogs the glass, and the helmet turns toward the man beside him.
 * Drawn in SVG so it can be shaken, pushed in on and lit without any image files. The glass behaves
 * differently in each failure (`lens`): it cracks, stays calm and fogs, tilts, rolls with the wind, or
 * flashes with the lightning.
 */
export function HelmetShot({
  who,
  look,
  ms,
  glow,
  lens = "cracked",
  shake,
  fear,
  reduced,
}: {
  who: CrewId;
  look: "front" | "left" | "right";
  ms: number;
  glow: Flavor["glow"];
  /** How the glass and the view behave in this failure. */
  lens?: HelmetStyle;
  /** 0 to 1: how hard the cabin is shaking. */
  shake: number;
  /** 0 to 1: how afraid he is: wide eyes, fast breath. */
  fear: number;
  reduced: boolean;
}) {
  const [r, g, b] = GLOW[glow];
  const rgb = `${r}, ${g}, ${b}`;
  const turn = look === "left" ? -1 : look === "right" ? 1 : 0;
  const accent = ACCENT[who];
  // Wider eyes and faster breath as the danger grows.
  const eyeH = 13 + fear * 12;
  const calm = lens === "calm";
  const fogSec = calm ? 4.2 : 3.2 - fear * 2.1;
  const amp = reduced || calm ? 0 : shake * (3 + fear * 7);
  // The way the whole picture moves is part of what each failure feels like.
  const motion = reduced
    ? undefined
    : {
        cracked: `hs-push ${Math.max(1.8, ms / 1000 + 0.6)}s ease-out forwards, hs-shake 0.09s linear infinite`,
        calm: `hs-push ${Math.max(3, ms / 1000 + 1.6)}s ease-out forwards, hs-drift 5s ease-in-out infinite alternate`,
        tilt: `hs-push ${Math.max(1.8, ms / 1000 + 0.6)}s ease-out forwards, hs-shake 0.12s linear infinite, hs-tilt ${Math.max(1.8, ms / 1000)}s ease-in forwards`,
        roll: `hs-roll 1.15s ease-in-out infinite, hs-shake 0.08s linear infinite`,
        flash: `hs-push ${Math.max(1.8, ms / 1000 + 0.6)}s ease-out forwards, hs-shake 0.1s linear infinite`,
      }[lens];

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 42%, rgba(${rgb}, ${lens === "flash" ? 0.12 : calm ? 0.2 : 0.28}), #05070c ${lens === "flash" ? 55 : 70}%)` }}>
      <svg
        viewBox="0 0 800 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={{
          animation: motion,
          ["--amp" as string]: `${amp}px`,
        }}
        aria-hidden
      >
        <defs>
          <radialGradient id={`shell-${who}`} cx="38%" cy="30%" r="80%">
            <stop offset="0" stopColor="#f4f6fa" />
            <stop offset="0.55" stopColor="#c9ced8" />
            <stop offset="1" stopColor="#6f7683" />
          </radialGradient>
          <linearGradient id={`visor-${who}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#3a2e10" />
            <stop offset="0.5" stopColor="#15110a" />
            <stop offset="1" stopColor="#0a0906" />
          </linearGradient>
          <radialGradient id={`fog-${who}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`sweep-${who}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={`rgb(${rgb})`} stopOpacity="0" />
            <stop offset="0.5" stopColor={`rgb(${rgb})`} stopOpacity="0.85" />
            <stop offset="1" stopColor={`rgb(${rgb})`} stopOpacity="0" />
          </linearGradient>
          <clipPath id={`visorClip-${who}`}>
            <ellipse cx="400" cy="392" rx="208" ry="172" />
          </clipPath>
        </defs>

        {/* Shoulders and the neck ring, with his name patch on the chest. */}
        <path d="M60 800 C80 640 210 600 400 610 C590 600 720 640 740 800 Z" fill="#aeb4c0" />
        <path d="M60 800 C80 660 210 625 400 632 C590 625 720 660 740 800 Z" fill="#d8dce4" />
        <ellipse cx="400" cy="640" rx="168" ry="34" fill={accent} opacity="0.95" />
        <ellipse cx="400" cy="632" rx="160" ry="26" fill="#1a1f2a" />
        <rect x="262" y="716" width="276" height="46" rx="6" fill="#0f1420" stroke={accent} strokeWidth="3" />
        <text x="400" y="749" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="28" letterSpacing="6" fill="#f3f5fa">
          {NAME[who]}
        </text>
        <circle cx="300" cy="650" r="14" fill="#2a303c" />
        <circle cx="500" cy="650" r="14" fill="#2a303c" />

        {/* The helmet turns a little toward whoever he looks at. */}
        <g style={{ transform: `translateX(${turn * 34}px) rotate(${turn * 3.5}deg)`, transformOrigin: "400px 600px", transition: reduced ? undefined : "transform 650ms cubic-bezier(.3,.8,.3,1)" }}>
          <ellipse cx="400" cy="400" rx="262" ry="248" fill={`url(#shell-${who})`} />
          <ellipse cx="400" cy="392" rx="226" ry="190" fill="#222833" />
          <ellipse cx="400" cy="392" rx="208" ry="172" fill={`url(#visor-${who})`} />

          {/* Behind the glass: his eyes, brows drawn together. */}
          <g clipPath={`url(#visorClip-${who})`}>
            <g style={{ transform: `translateX(${turn * 30}px)`, transition: reduced ? undefined : "transform 650ms cubic-bezier(.3,.8,.3,1)" }}>
              <path d="M300 372 L372 358" stroke="#05070a" strokeWidth="12" strokeLinecap="round" />
              <path d="M500 372 L428 358" stroke="#05070a" strokeWidth="12" strokeLinecap="round" />
              <ellipse cx="338" cy="394" rx="26" ry={eyeH} fill="#e9e2d2" opacity="0.62" />
              <ellipse cx="462" cy="394" rx="26" ry={eyeH} fill="#e9e2d2" opacity="0.62" />
              <circle cx={338 + turn * 10} cy="394" r="9" fill="#06080c" />
              <circle cx={462 + turn * 10} cy="394" r="9" fill="#06080c" />
            </g>
            {/* The alarm light crossing the visor. */}
            <rect x="-260" y="200" width="240" height="400" fill={`url(#sweep-${who})`} style={{ animation: reduced ? undefined : "hs-sweep 1.2s linear infinite" }} opacity={reduced ? 0.25 : 1} />
            {/* Breath on the glass. */}
            <ellipse cx="400" cy="470" rx="150" ry="70" fill={`url(#fog-${who})`} style={{ animation: reduced ? undefined : `hs-fog ${fogSec}s ease-in-out infinite` }} opacity="0.3" />
          </g>

          {/* Highlights on the glass. */}
          <path d="M236 330 C262 262 330 226 410 222" stroke="#fff" strokeOpacity="0.55" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M252 360 C262 336 276 318 296 304" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" fill="none" />
          <ellipse cx="400" cy="392" rx="208" ry="172" fill="none" stroke="#9aa1ae" strokeWidth="6" />
          {lens === "cracked" && <VisorCracks fear={fear} />}
        </g>
      </svg>

      {/* Lightning on the glass: white flashes at uneven moments. */}
      {lens === "flash" && !reduced && <div className="absolute inset-0" style={{ background: "#dbe8ff", animation: `hs-flash ${1.7 + (ms % 900) / 1000}s steps(1) infinite` }} />}
      {/* A cold frost creeping in from the edges of the glass in the quiet. */}
      {calm && <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(150,255,210,0.13) 78%)" }} />}

      <style>{`
        @keyframes hs-push { from { transform: scale(1); } to { transform: scale(1.13); } }
        @keyframes hs-shake {
          0% { translate: 0 0; } 20% { translate: var(--amp) calc(var(--amp) * -0.6); }
          40% { translate: calc(var(--amp) * -0.8) var(--amp); } 60% { translate: calc(var(--amp) * 0.5) calc(var(--amp) * 0.8); }
          80% { translate: calc(var(--amp) * -0.6) calc(var(--amp) * -0.7); } 100% { translate: 0 0; }
        }
        @keyframes hs-sweep { from { transform: translateX(0); } to { transform: translateX(1100px); } }
        @keyframes hs-fog { 0%, 100% { opacity: 0.08; } 45% { opacity: 0.85; } }
        @keyframes hs-drift { from { translate: -6px 3px; } to { translate: 6px -3px; } }
        @keyframes hs-tilt { from { rotate: 0deg; } to { rotate: 9deg; } }
        @keyframes hs-roll { 0%, 100% { rotate: -13deg; scale: 1.02; } 50% { rotate: 13deg; scale: 1.1; } }
        @keyframes hs-flash { 0%, 100% { opacity: 0; } 2% { opacity: 0.85; } 5% { opacity: 0.1; } 7% { opacity: 0.55; } 12% { opacity: 0; } 58% { opacity: 0; } 59% { opacity: 0.7; } 63% { opacity: 0; } }
      `}</style>
    </div>
  );
}

/** Cracks that run across the visor, more of them (and longer) as his fear grows. */
function VisorCracks({ fear }: { fear: number }) {
  const cracks = [
    "M400 392 L360 340 L372 300 L330 262",
    "M400 392 L452 346 L440 304 L488 270",
    "M400 392 L338 410 L300 392 L262 418",
    "M400 392 L470 420 L512 404 L548 430",
    "M400 392 L392 450 L420 488 L408 528",
    "M372 300 L398 276 L396 238",
    "M452 346 L500 352 L520 330",
  ];
  const shown = Math.min(cracks.length, 3 + Math.round(fear * 4));
  return (
    <g fill="none" stroke="#f1f5ff" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
      {cracks.slice(0, shown).map((d, i) => (
        <path key={i} d={d} strokeWidth={i < 3 ? 3.2 : 2} />
      ))}
    </g>
  );
}
