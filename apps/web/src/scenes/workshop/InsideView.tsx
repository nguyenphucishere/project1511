"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLocalized } from "@/i18n/useT";
import { playSfx } from "@/game/sfx";
import type { PartId } from "@/mocks/rocket-parts";
import { UI } from "./content";
import { KNOWLEDGE, type Cutaway } from "./knowledge";

const INK = "#5ee7ff";
const FAINT = "rgba(94,231,255,0.28)";
const WARM = "#ffc72c";

/** Where the three numbered callouts sit on each drawing (x, y in a 240 x 250 box). */
const ANCHORS: Record<Cutaway, [number, number][]> = {
  engine: [[120, 40], [120, 112], [120, 205]],
  tank: [[120, 52], [120, 124], [120, 196]],
  ring: [[120, 62], [120, 125], [120, 188]],
  stage: [[120, 44], [120, 128], [120, 218]],
  module: [[120, 60], [120, 118], [120, 208]],
  capsule: [[120, 56], [120, 122], [120, 210]],
  tower: [[120, 54], [120, 128], [120, 200]],
};

/** Blueprint-style cutaway of a part with three numbered callouts, plus the quick-check question. */
export function InsideView({ part, onAnswer }: { part: PartId; onAnswer: (correct: boolean) => void }) {
  const localize = useLocalized();
  const k = KNOWLEDGE[part];
  const [picked, setPicked] = useState<number | null>(null);

  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const right = i === k.quiz.answer;
    playSfx(right ? "success" : "noGo");
    onAnswer(right);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3">
        <svg viewBox="0 0 240 250" role="img" aria-label={localize(UI.inside.title)} className="w-full border border-primary/40 bg-[#07203a]">
          <defs>
            <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" stroke={FAINT} strokeWidth="0.4" />
            </pattern>
            <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={INK} stopOpacity="0" />
              <stop offset="1" stopColor={INK} stopOpacity="0.35" />
            </linearGradient>
          </defs>
          <rect width="240" height="250" fill="url(#grid)" />
          <Drawing kind={k.cutaway} />
          {ANCHORS[k.cutaway].map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x + 62} y2={y - 6} stroke={WARM} strokeWidth="0.8" />
              <circle cx={x} cy={y} r="3" fill={WARM} />
              <circle cx={x + 66} cy={y - 7} r="8.5" fill="#07203a" stroke={WARM} strokeWidth="1" />
              <text x={x + 66} y={y - 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill={WARM}>
                {i + 1}
              </text>
            </g>
          ))}
          <rect x="0" y="-40" width="240" height="40" fill="url(#sweep)">
            <animate attributeName="y" values="-40;250" dur="3.2s" repeatCount="indefinite" />
          </rect>
        </svg>
        <ol className="space-y-2 self-center text-sm">
          {k.parts.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary text-xs font-bold text-primary">{i + 1}</span>
              <span className="text-foreground/90">{localize(p)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t border-foreground/15 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{localize(UI.inside.quiz)}</p>
        <p className="mt-1 text-sm font-medium">{localize(k.quiz.question)}</p>
        <div className="mt-2 grid gap-1.5">
          {k.quiz.options.map((o, i) => {
            const chosen = picked === i;
            const right = i === k.quiz.answer;
            return (
              <button
                key={i}
                type="button"
                disabled={picked !== null}
                onClick={() => answer(i)}
                className={cn(
                  "border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  picked === null && "border-foreground/25 hover:border-primary hover:bg-primary/10",
                  picked !== null && right && "border-emerald-400 bg-emerald-400/15",
                  chosen && !right && "border-red-400 bg-red-400/15",
                  picked !== null && !right && !chosen && "border-foreground/10 opacity-60",
                )}
              >
                {localize(o)}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <p className="mt-2 text-sm text-foreground/85" role="status">
            <strong className={picked === k.quiz.answer ? "text-emerald-300" : "text-red-300"}>
              {localize(picked === k.quiz.answer ? UI.inside.correct : UI.inside.wrong)}
            </strong>{" "}
            {localize(k.quiz.why)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- drawings (240 x 250) */

const line = { stroke: INK, strokeWidth: 1.3, fill: "none" } as const;
const fillSoft = { stroke: INK, strokeWidth: 1.3, fill: "rgba(94,231,255,0.10)" } as const;

function Flow({ d }: { d: string }) {
  return (
    <path d={d} stroke={WARM} strokeWidth="1.6" fill="none" strokeDasharray="4 5" opacity="0.9">
      <animate attributeName="stroke-dashoffset" values="18;0" dur="1s" repeatCount="indefinite" />
    </path>
  );
}

function Drawing({ kind }: { kind: Cutaway }) {
  switch (kind) {
    case "engine":
      return (
        <g>
          <rect x="92" y="22" width="56" height="34" {...fillSoft} />
          <circle cx="120" cy="39" r="9" {...line} />
          <path d="M104 56v20M136 56v20" {...line} />
          <path d="M96 76h48l6 34h-60z" {...fillSoft} />
          <path d="M102 112c-6 30-30 70-52 110h140c-22-40-46-80-52-110z" {...fillSoft} />
          {[-24, -10, 6, 20].map((dx) => (
            <path key={dx} d={`M${120 + dx} 120L${120 + dx * 1.9} 216`} stroke={FAINT} strokeWidth="1" />
          ))}
          <Flow d="M120 56V110" />
          <Flow d="M120 112 C120 150 120 180 120 218" />
        </g>
      );
    case "tank":
      return (
        <g>
          <path d="M70 36c0-14 100-14 100 0v82H70z" {...fillSoft} />
          <path d="M70 118h100v82c0 14-100 14-100 0z" {...fillSoft} />
          <path d="M72 118c20 10 76 10 96 0" {...line} />
          <rect x="74" y="64" width="92" height="54" fill="rgba(255,199,44,0.16)" />
          <rect x="74" y="146" width="92" height="52" fill="rgba(94,231,255,0.2)" />
          <path d="M60 60v150M180 60v150" stroke={FAINT} strokeWidth="1" strokeDasharray="3 3" />
          <Flow d="M120 200V232" />
        </g>
      );
    case "ring":
      return (
        <g>
          <path d="M60 60h120l16 140H44z" {...fillSoft} />
          <path d="M60 60h120M52 120h136M44 200h152" {...line} />
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={52 + i * 19} cy="200" r="3" fill={INK} />
          ))}
          {[78, 120, 162].map((x) => (
            <rect key={x} x={x - 7} y="132" width="14" height="46" {...line} />
          ))}
          <Flow d="M78 132V108M162 132V108" />
        </g>
      );
    case "stage":
      return (
        <g>
          <rect x="70" y="24" width="100" height="168" {...fillSoft} />
          <rect x="82" y="34" width="76" height="20" {...line} />
          <path d="M82 44h76" stroke={WARM} strokeWidth="1.2" />
          <rect x="82" y="64" width="76" height="52" fill="rgba(255,199,44,0.14)" stroke={INK} />
          <rect x="82" y="122" width="76" height="52" fill="rgba(94,231,255,0.2)" stroke={INK} />
          <path d="M96 192l-22 36h92l-22-36z" {...fillSoft} />
          <Flow d="M120 174V196" />
        </g>
      );
    case "module":
      return (
        <g>
          <rect x="88" y="26" width="64" height="62" {...fillSoft} />
          <rect x="100" y="38" width="40" height="28" {...line} />
          <path d="M96 88h48l16 44H80z" {...fillSoft} />
          <rect x="70" y="132" width="100" height="40" {...fillSoft} />
          <path d="M80 172l-24 52M160 172l24 52M120 172v30" {...line} />
          <path d="M44 224h26M170 224h26" {...line} />
          <Flow d="M120 172V210" />
        </g>
      );
    case "capsule":
      return (
        <g>
          <path d="M96 28h48l36 138H60z" {...fillSoft} />
          <circle cx="120" cy="40" r="6" {...line} />
          {[92, 120, 148].map((x) => (
            <rect key={x} x={x - 8} y="118" width="16" height="22" {...line} />
          ))}
          <path d="M60 166c20 14 100 14 120 0l4 16c-24 18-104 18-128 0z" fill="rgba(180,100,40,0.5)" stroke={WARM} strokeWidth="1.3" />
          <path d="M96 28l-12-14h72l-12 14" {...line} />
        </g>
      );
    case "tower":
      return (
        <g>
          <path d="M120 20l14 38v68h-28V58z" {...fillSoft} />
          <path d="M104 126l-18 64M136 126l18 64" {...line} />
          <path d="M86 190h68M96 160h48M92 175h56" {...line} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${108 + i * 8} 100l-3 12l6 0z`} fill={WARM} />
          ))}
          <path d="M80 190h80v26H80z" {...fillSoft} />
        </g>
      );
  }
}
