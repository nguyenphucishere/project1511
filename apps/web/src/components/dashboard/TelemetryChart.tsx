"use client";

import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { PALETTE } from "@/lib/palette";

export interface TelemetryChartProps {
  /** Chart title; a single series needs no legend, the title names it. */
  title: string;
  /** x values (seconds) and y values, same length. Grows as the descent plays. */
  xs: number[];
  ys: number[];
  /** Fixed scales so the line grows into a stable frame instead of rescaling every frame. */
  xMax: number;
  yMin: number;
  yMax: number;
  formatValue: (v: number) => string;
  /** Shorter y-axis tick labels; defaults to formatValue. */
  formatTick?: (v: number) => string;
  formatX: (x: number) => string;
  /** Optional dashed reference line (e.g. a limit), drawn in ink, not series colour. */
  reference?: { value: number; label: string };
  height?: number;
}

const INK = "rgba(208, 224, 213, 0.75)"; // mist, secondary text
const GRID = "rgba(208, 224, 213, 0.12)";
const FONT = "11px ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * One telemetry trace on a fixed frame (uPlot). Altitude and vertical speed get a chart each:
 * two measures of different scale never share a y-axis. Hover snaps a crosshair to the nearest
 * sample and the header shows that value; otherwise the header shows the latest one.
 */
export function TelemetryChart({
  title,
  xs,
  ys,
  xMax,
  yMin,
  yMax,
  formatValue,
  formatTick,
  formatX,
  reference,
  height = 96,
}: TelemetryChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // uPlot hooks are created once; read the latest props through refs.
  const refRef = useRef(reference);
  refRef.current = reference;
  const fmtRef = useRef(formatValue);
  fmtRef.current = formatTick ?? formatValue;
  const fmtXRef = useRef(formatX);
  fmtXRef.current = formatX;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const opts: uPlot.Options = {
      width: Math.max(160, el.clientWidth),
      height,
      legend: { show: false },
      padding: [8, 8, 0, 0],
      scales: { x: { time: false, range: [0, xMax] }, y: { range: [yMin, yMax] } },
      axes: [
        {
          stroke: INK,
          font: FONT,
          size: 28,
          grid: { show: false },
          ticks: { stroke: GRID, size: 4 },
          values: (_u, splits) => splits.map((s) => fmtXRef.current(s)),
          space: 70,
        },
        {
          stroke: INK,
          font: FONT,
          size: 56,
          grid: { stroke: GRID, width: 1 },
          ticks: { show: false },
          values: (_u, splits) => splits.map((s) => fmtRef.current(s)),
          space: 28,
        },
      ],
      series: [
        {},
        {
          stroke: PALETTE.gold,
          width: 2,
          points: { show: false },
        },
      ],
      cursor: {
        y: false,
        drag: { x: false, y: false },
        points: { size: 8, fill: PALETTE.gold, stroke: PALETTE.deep, width: 2 },
      },
      hooks: {
        setCursor: [(u) => setHoverIdx(u.cursor.idx ?? null)],
        draw: [
          (u) => {
            const r = refRef.current;
            if (!r) return;
            const ctx = u.ctx;
            const y = u.valToPos(r.value, "y", true);
            ctx.save();
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(u.bbox.left, y);
            ctx.lineTo(u.bbox.left + u.bbox.width, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = INK;
            ctx.font = FONT.replace("11px", `${Math.round(11 * devicePixelRatio)}px`);
            ctx.textAlign = "right";
            ctx.fillText(r.label, u.bbox.left + u.bbox.width - 4, y - 4 * devicePixelRatio);
            ctx.restore();
          },
        ],
      },
    };
    const u = new uPlot(opts, [[], []], el);
    plot.current = u;
    const ro = new ResizeObserver(() => u.setSize({ width: Math.max(160, el.clientWidth), height }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      u.destroy();
      plot.current = null;
    };
    // The frame (scales, size) is fixed for the chart's life; data flows in below.
  }, [height, xMax, yMin, yMax]);

  useEffect(() => {
    // Rescale too: the fixed ranges come back unchanged, and the first frame needs them set.
    plot.current?.setData([xs, ys]);
  }, [xs, ys]);

  const idx = hoverIdx !== null && hoverIdx < xs.length ? hoverIdx : xs.length - 1;
  const value = idx >= 0 ? ys[idx] : undefined;

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-foreground/75">{title}</span>
        <span className="font-mono text-sm tabular-nums">
          {value !== undefined ? formatValue(value) : "—"}
          {hoverIdx !== null && idx >= 0 && <span className="ml-2 text-xs text-foreground/65">{formatX(xs[idx])}</span>}
        </span>
      </figcaption>
      <div ref={host} aria-hidden className="telemetry-chart w-full" style={{ height }} />
    </figure>
  );
}
