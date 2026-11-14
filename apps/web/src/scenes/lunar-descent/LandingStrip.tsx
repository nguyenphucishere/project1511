"use client";

import {
  BOULDER_HALF_WIDTH,
  CRATER_EDGE_X,
  PRECISION_M,
  SITES,
  STRIP_HALF_WIDTH,
  type SiteId,
} from "./flight";

const W = 300;
const H = 78;
const PAD = 14;
const GROUND_Y = 52;
const LANDER_Y = 20;

const SITE_COLOR: Record<SiteId, string> = {
  A: "text-space-cyan",
  B: "text-nasa-red",
  C: "text-space-gold",
};

const clampX = (x: number) => Math.max(-STRIP_HALF_WIDTH, Math.min(STRIP_HALF_WIDTH, x));
const sx = (x: number) => PAD + ((clampX(x) + STRIP_HALF_WIDTH) / (2 * STRIP_HALF_WIDTH)) * (W - 2 * PAD);
const TICKS = [-30, -20, -10, 0, 10, 20, 30];

export interface LandingStripProps {
  /** Lander position, m, 0 = the boulder field. */
  xM: number;
  /** Sideways speed, m/s. */
  hsMs: number;
  /** Where the lander would touch down if nothing changes, m. */
  predictedX: number;
  siteId: SiteId | null;
  label: string;
  youLabel: string;
}

/**
 * Side-on map of the landing line, 64 m wide: hazards, the three sites, the lander with its
 * sideways velocity, and a cross where it will touch down if the pilot changes nothing.
 */
export function LandingStrip({ xM, hsMs, predictedX, siteId, label, youLabel }: LandingStripProps) {
  const lx = sx(xM);
  const px = sx(predictedX);
  const arrow = Math.max(-34, Math.min(34, hsMs * 14));
  const chosen = SITES.find((s) => s.id === siteId);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block w-full" shapeRendering="geometricPrecision">
      <title>{label}</title>
      <rect x={0} y={0} width={W} height={H} className="fill-space-deep/60" />

      {/* Hazards. */}
      <rect x={sx(-STRIP_HALF_WIDTH)} y={GROUND_Y} width={sx(CRATER_EDGE_X) - sx(-STRIP_HALF_WIDTH)} height={H - GROUND_Y} className="fill-nasa-red/25" />
      <rect x={sx(-BOULDER_HALF_WIDTH)} y={GROUND_Y - 4} width={sx(BOULDER_HALF_WIDTH) - sx(-BOULDER_HALF_WIDTH)} height={H - GROUND_Y + 4} className="fill-nasa-red/35" />
      {[-3, -1.2, 0.8, 2.6, 3.8].map((bx, i) => (
        <circle key={bx} cx={sx(bx)} cy={GROUND_Y - 1 - (i % 2) * 2} r={2.2} className="fill-nasa-red/80" />
      ))}

      {/* Ground and a scale every 10 m. */}
      <line x1={PAD} x2={W - PAD} y1={GROUND_Y} y2={GROUND_Y} className="stroke-foreground/50" strokeWidth={1} />
      {TICKS.map((t) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={GROUND_Y} y2={GROUND_Y + 3} className="stroke-foreground/40" strokeWidth={1} />
          <text x={sx(t)} y={H - 3} textAnchor="middle" className="fill-foreground/45 font-mono" fontSize={7}>
            {t}
          </text>
        </g>
      ))}

      {/* Sites; the chosen one carries a 3 m precision band. */}
      {chosen && (
        <rect
          x={sx(chosen.x - PRECISION_M)}
          y={GROUND_Y - 3}
          width={sx(chosen.x + PRECISION_M) - sx(chosen.x - PRECISION_M)}
          height={6}
          className="fill-space-gold/45"
        />
      )}
      {SITES.map((s) => (
        <g key={s.id} className={SITE_COLOR[s.id]}>
          <line x1={sx(s.x)} x2={sx(s.x)} y1={GROUND_Y - 9} y2={GROUND_Y} stroke="currentColor" strokeWidth={1.2} />
          <circle
            cx={sx(s.x)}
            cy={GROUND_Y - 12}
            r={s.id === siteId ? 6.5 : 5}
            className={s.id === siteId ? "fill-space-deep" : "fill-space-deep/80"}
            stroke="currentColor"
            strokeWidth={s.id === siteId ? 2 : 1}
          />
          <text x={sx(s.x)} y={GROUND_Y - 9.4} textAnchor="middle" fontSize={8} fontWeight={700} fill="currentColor">
            {s.id}
          </text>
        </g>
      ))}

      {/* Predicted touchdown. */}
      <line x1={lx} x2={px} y1={LANDER_Y + 7} y2={GROUND_Y - 2} className="stroke-foreground/35" strokeWidth={1} strokeDasharray="2 3" />
      <g className="stroke-space-gold" strokeWidth={1.6} strokeLinecap="round">
        <line x1={px - 3} x2={px + 3} y1={GROUND_Y - 5} y2={GROUND_Y + 1} />
        <line x1={px + 3} x2={px - 3} y1={GROUND_Y - 5} y2={GROUND_Y + 1} />
      </g>

      {/* Lander and its sideways velocity. */}
      {Math.abs(arrow) > 1.5 && (
        <g className="stroke-space-gold fill-space-gold" strokeWidth={1.6}>
          <line x1={lx} x2={lx + arrow} y1={LANDER_Y} y2={LANDER_Y} />
          <polygon points={`${lx + arrow},${LANDER_Y} ${lx + arrow - Math.sign(arrow) * 4},${LANDER_Y - 3} ${lx + arrow - Math.sign(arrow) * 4},${LANDER_Y + 3}`} stroke="none" />
        </g>
      )}
      <polygon points={`${lx},${LANDER_Y + 8} ${lx - 6},${LANDER_Y - 4} ${lx + 6},${LANDER_Y - 4}`} className="fill-foreground stroke-space-deep" strokeWidth={1} />
      <text x={lx} y={LANDER_Y - 8} textAnchor="middle" fontSize={7.5} className="fill-foreground/80 font-mono">
        {youLabel}
      </text>
    </svg>
  );
}
