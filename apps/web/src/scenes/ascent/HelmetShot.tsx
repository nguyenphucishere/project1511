"use client";

import type { CrewId, Flavor } from "./failureScript";

const ACCENT: Record<CrewId, string> = { armstrong: "#4f8cff", aldrin: "#ff9a2e", collins: "#3ddc97" };
const NAME: Record<CrewId, string> = { armstrong: "ARMSTRONG", aldrin: "ALDRIN", collins: "COLLINS" };
const GLOW: Record<Flavor["glow"], [number, number, number]> = { red: [255, 45, 30], amber: [255, 165, 45], blue: [120, 175, 255] };

/**
 * A close-up of one astronaut through his helmet: the visor catches the alarm light as it sweeps
 * round the cabin, his breath fogs the glass, and the helmet turns toward the man beside him.
 * Drawn in SVG so it can be shaken, pushed in on and lit without any image files.
 */
export function HelmetShot({
  who,
  look,
  ms,
  glow,
  shake,
  fear,
  reduced,
}: {
  who: CrewId;
  look: "front" | "left" | "right";
  ms: number;
  glow: Flavor["glow"];
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
  const fogSec = 3.2 - fear * 2.1;
  const amp = reduced ? 0 : shake * (3 + fear * 7);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 42%, rgba(${rgb}, 0.28), #05070c 70%)` }}>
      <svg
        viewBox="0 0 800 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={{
          animation: reduced ? undefined : `hs-push ${Math.max(1.8, ms / 1000 + 0.6)}s ease-out forwards, hs-shake 0.09s linear infinite`,
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
        </g>
      </svg>

      <style>{`
        @keyframes hs-push { from { transform: scale(1); } to { transform: scale(1.13); } }
        @keyframes hs-shake {
          0% { translate: 0 0; } 20% { translate: var(--amp) calc(var(--amp) * -0.6); }
          40% { translate: calc(var(--amp) * -0.8) var(--amp); } 60% { translate: calc(var(--amp) * 0.5) calc(var(--amp) * 0.8); }
          80% { translate: calc(var(--amp) * -0.6) calc(var(--amp) * -0.7); } 100% { translate: 0 0; }
        }
        @keyframes hs-sweep { from { transform: translateX(0); } to { transform: translateX(1100px); } }
        @keyframes hs-fog { 0%, 100% { opacity: 0.08; } 45% { opacity: 0.85; } }
      `}</style>
    </div>
  );
}
