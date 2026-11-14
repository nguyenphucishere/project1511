"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LocaleToggle } from "@/components/hud/LocaleToggle";
import { SoundToggle } from "@/components/hud/SoundToggle";
import { playSfx } from "@/game/sfx";
import { overallProgress, subscribePreload } from "@/scenes/preload";
import { useT } from "@/i18n/useT";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/** The art is one 1672 x 941 frame; every layer shares it, so they stack exactly. */
const FRAME_W = 1672;
const FRAME_H = 941;
const BASE = "/assets/title";

/** Back to front. `depth` is how far a layer slides (px at 1672 wide) as the pointer moves. */
const WORLD = [
  { id: "sky", depth: 2 },
  { id: "distant_mountain", depth: 6 },
  { id: "ground_and_left_rocks", depth: 10 },
  { id: "foreground_rocks", depth: 18 },
  // The astronaut and the shadow always travel together.
  { id: "astronaut_shadow", depth: 10 },
  { id: "astronaut", depth: 10 },
] as const;
const FIXED = ["title"] as const;
const IMAGE_COUNT = WORLD.length + FIXED.length + 1;

/** "Press to start" in the frame, as fractions of it. */
const BUTTON = { x: 632 / FRAME_W, y: 430 / FRAME_H, w: 408 / FRAME_W, h: 70 / FRAME_H };

/** True once the player has pressed start in this page session, so coming back to the menu skips it. */
let seen = false;
export const titleSplashSeen = () => seen;

/**
 * The first screen of the game: a Moon canyon in layered parallax with the title and a
 * "Press to start" button. Enter, Space or a click on the button dismisses it; the menu is
 * already underneath.
 */
export function TitleSplash({ onStart }: { onStart: () => void }) {
  const reduced = useReducedMotion();
  const t = useT();
  const progress = useSyncExternalStore(subscribePreload, overallProgress, () => 0);
  const stage = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const target = useRef({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const ready = loaded >= IMAGE_COUNT;
  const done = useRef(false);

  const start = useCallback(() => {
    if (done.current) return;
    done.current = true;
    seen = true;
    playSfx("click");
    setLeaving(true);
    window.setTimeout(onStart, reduced ? 0 : 650);
  }, [onStart, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start]);

  // Never hold the screen back for a slow image.
  useEffect(() => {
    const id = window.setTimeout(() => setLoaded(IMAGE_COUNT), 3000);
    return () => window.clearTimeout(id);
  }, []);

  // Parallax: the layers ease toward the pointer; a slow drift keeps it alive on touch screens.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const tick = (now: number) => {
      const el = stage.current;
      if (el) {
        const idle = Math.sin(now / 3200) * 0.18;
        const scale = el.clientWidth / FRAME_W;
        x += (target.current.x + idle - x) * 0.065;
        y += (target.current.y + Math.cos(now / 4100) * 0.1 - y) * 0.065;
        WORLD.forEach((l, i) => {
          const node = layers.current[i];
          if (node) node.style.transform = `translate3d(${-x * l.depth * scale}px, ${-y * l.depth * scale * 0.55}px, 0)`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const onPointerMove = (e: React.PointerEvent) => {
    target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  const img = (id: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- fixed art, already sized and compressed
    <img
      src={`${BASE}/${id}.webp`}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={() => setLoaded((n) => n + 1)}
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
    />
  );

  return (
    <div
      className={cn("fixed inset-0 z-50 overflow-hidden bg-[#111b27] transition-opacity duration-[650ms]", leaving ? "opacity-0" : "opacity-100")}
      onPointerMove={onPointerMove}
      onPointerLeave={() => (target.current = { x: 0, y: 0 })}
    >
      {/* A 16:9 frame that covers the screen; the scene group is nudged 3.5% larger so edges never show. */}
      <div
        ref={stage}
        className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
        style={{ width: `max(100vw, calc(100dvh * ${FRAME_W / FRAME_H}))`, aspectRatio: `${FRAME_W} / ${FRAME_H}` }}
        role="img"
        aria-label="Beyond the Earth: an astronaut on the Moon looks toward a mountain canyon"
      >
        <div className="absolute inset-0" style={{ transform: "scale(1.035)", transformOrigin: "50% 72%" }}>
          {WORLD.map((l, i) => (
            <div
              key={l.id}
              ref={(n) => {
                layers.current[i] = n;
              }}
              className="absolute inset-0 will-change-transform"
            >
              {img(l.id)}
            </div>
          ))}
        </div>
        {FIXED.map((id) => (
          <div key={id} className="absolute inset-0">
            {img(id)}
          </div>
        ))}

        <button
          type="button"
          onClick={start}
          aria-label="Press to start"
          className="absolute cursor-pointer outline-none transition-transform hover:scale-[1.04] focus-visible:ring-4 focus-visible:ring-yellow-300/80 motion-safe:animate-pulse"
          style={{ left: `${BUTTON.x * 100}%`, top: `${BUTTON.y * 100}%`, width: `${BUTTON.w * 100}%`, height: `${BUTTON.h * 100}%` }}
        >
          <span className="pointer-events-none absolute" style={{ left: `${-BUTTON.x * 100 / BUTTON.w}%`, top: `${-BUTTON.y * 100 / BUTTON.h}%`, width: `${100 / BUTTON.w}%`, height: `${100 / BUTTON.h}%` }}>
            {img("start_button")}
          </span>
        </button>
      </div>

      {/* Everything the game needs loads in the background while the player reads the title. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-[min(22rem,80vw)] text-center" aria-live="polite">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-yellow-300 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 font-mono text-xs tracking-widest text-white/80">
          {progress >= 100 ? t.sceneLoading.ready.toUpperCase() : `${t.sceneLoading.stageAssets.toUpperCase()} ${progress}%`}
        </p>
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-8">
        <SoundToggle />
        <LocaleToggle className="bg-space-deep" />
      </div>
    </div>
  );
}
