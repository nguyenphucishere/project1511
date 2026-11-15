"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

export type StarfieldMode = "drift" | "rise" | "still";

export interface ParallaxCanvasProps {
  /** drift: slow sideways float. rise: stars stream down, as if climbing. still: no motion. */
  mode?: StarfieldMode;
  /** Draws a lunar horizon with the Moon photo in the sky. */
  horizon?: boolean;
  className?: string;
}

/** Size of one "pixel" in CSS pixels. The canvas renders at low resolution and is upscaled crisply. */
const PIXEL = 3;

interface Star {
  x: number;
  y: number;
  layer: 0 | 1 | 2;
  phase: number;
}

function token(name: string): string {
  const channels = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return channels ? `rgb(${channels})` : "rgb(0 0 0)";
}

/** Layered pixel starfield in palette colours, with subtle pointer parallax. */
export function ParallaxCanvas({ mode = "drift", horizon = false, className }: ParallaxCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const animate = !reduced && mode !== "still";

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const colors = {
      deep: token("space-deep"),
      blue: token("space-blue"),
      mist: token("space-mist"),
      gold: token("space-gold"),
    };

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let ridge: number[] = [];
    const pointer = { x: 0.5, y: 0.5 };

    const seedStars = () => {
      // The photo already has a dense starfield; the canvas adds only a sparse layer of moving stars.
      const count = Math.round((w * h) / 520);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        layer: (Math.random() < 0.6 ? 0 : Math.random() < 0.7 ? 1 : 2) as Star["layer"],
        phase: Math.random() * Math.PI * 2,
      }));
      // Stepped lunar ridge line, one height per low-res column.
      let y = 0;
      ridge = Array.from({ length: w + 1 }, () => {
        y = Math.max(-4, Math.min(4, y + Math.round(Math.random() * 2 - 1)));
        return y;
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.ceil(rect.width / PIXEL));
      h = Math.max(1, Math.ceil(rect.height / PIXEL));
      canvas.width = w;
      canvas.height = h;
      seedStars();
      draw(0);
    };

    const draw = (time: number) => {
      // Transparent: the nebula photo underneath shows through and the pixel stars twinkle over it.
      ctx.clearRect(0, 0, w, h);

      const px = animate ? (pointer.x - 0.5) * 6 : 0;
      const py = animate ? (pointer.y - 0.5) * 4 : 0;

      for (const s of stars) {
        const depth = s.layer + 1;
        const twinkle = animate ? 0.65 + 0.35 * Math.sin(time / 600 + s.phase) : 1;
        ctx.globalAlpha = (s.layer === 0 ? 0.35 : s.layer === 1 ? 0.6 : 0.95) * twinkle;
        ctx.fillStyle = s.layer === 2 && s.phase < 0.6 ? colors.gold : colors.mist;
        const x = Math.round((s.x + px * depth + w) % w);
        const y = Math.round((s.y + py * depth + h) % h);
        const size = s.layer === 2 ? 2 : 1;
        ctx.fillRect(x, y, size, mode === "rise" && animate ? size + s.layer * 2 : size);
      }
      ctx.globalAlpha = 1;

      if (horizon) {
        // Grey-blue ground with a stepped ridge and a few craters.
        const base = Math.round(h * 0.76);
        ctx.fillStyle = colors.blue;
        for (let x = 0; x < w; x++) ctx.fillRect(x, base + ridge[x], 1, h);
        ctx.fillStyle = colors.mist;
        ctx.globalAlpha = 0.18;
        for (let x = 0; x < w; x++) ctx.fillRect(x, base + ridge[x], 1, 1);
        ctx.fillStyle = colors.deep;
        ctx.globalAlpha = 0.45;
        const craters = [
          [0.18, 0.86, 0.05],
          [0.52, 0.92, 0.07],
          [0.83, 0.84, 0.035],
        ];
        for (const [cx, cy, r] of craters) {
          ctx.beginPath();
          ctx.ellipse(w * cx, h * cy, w * r, w * r * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67;
      last = now;
      for (const s of stars) {
        const speed = 0.04 + s.layer * 0.08;
        if (mode === "drift") s.x = (s.x - speed * dt + w) % w;
        if (mode === "rise") s.y = (s.y + (0.6 + s.layer * 1.4) * dt) % h;
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX / window.innerWidth;
      pointer.y = e.clientY / window.innerHeight;
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (animate && document.visibilityState === "visible") {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (animate) {
      window.addEventListener("pointermove", onPointer);
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, horizon, reduced, animate]);

  return (
    <div aria-hidden className={cn("relative overflow-hidden bg-space-deep", className)}>
      {/* Nebula photo, slightly oversized and slowly panning so the sky feels alive. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized background */}
      <img
        src="/assets/env/nebula-bg.webp"
        alt=""
        draggable={false}
        className={cn(
          "absolute inset-0 h-full w-full select-none object-cover",
          animate && "animate-nebula-pan",
        )}
      />
      {/* Soft darkening so text and the stars on top stay readable. */}
      <div className="absolute inset-0 bg-gradient-to-b from-space-deep/30 via-transparent to-space-deep/50" />
      {horizon && (
        // eslint-disable-next-line @next/next/no-img-element -- static, pre-sized
        <img
          src="/assets/env/moon.jpg"
          alt=""
          draggable={false}
          className="pointer-events-none absolute right-[10%] top-[8%] aspect-square w-[min(26vw,26vh)] select-none rounded-full mix-blend-screen [mask-image:radial-gradient(circle,#000_58%,transparent_72%)]"
        />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full [image-rendering:pixelated]" />
    </div>
  );
}
