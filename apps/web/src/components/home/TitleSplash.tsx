"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocaleToggle } from "@/components/hud/LocaleToggle";
import { SoundToggle } from "@/components/hud/SoundToggle";
import { playSfx } from "@/game/sfx";
import { format } from "@/i18n";
import { subscribePreload, warmProgress } from "@/scenes/preload";
import { useLocalized, useT } from "@/i18n/useT";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hasContinuableProgress, useGameStore } from "@/game/gameStore";
import { CHAPTERS, getStep, type ChapterId } from "@/game/flow";
import { CHARACTERS } from "@/game/characters";
import { cn } from "@/lib/utils";

/** The art is one 1672 x 941 frame; every layer shares it, so they stack exactly. */
const FRAME_W = 1672;
const FRAME_H = 941;
const BASE = "/assets/title";

interface Layer {
  id: string;
  /** Image path(s), back to front. Images that always move together share one layer (one compositor layer, not two). */
  src: string | string[];
  /** How far the layer slides (px at 1672 wide) as the pointer moves: far layers little, near layers a lot. */
  depth: number;
  /** How much the layer swells and settles while "breathing" (fraction of its size), and its phase in the cycle. */
  breath: number;
  phase: number;
  /** The point the layer swells from: the ground and the astronaut breathe up from their feet. */
  origin: string;
  /** Scale it starts from (the galaxy is oversized so it can drift without showing edges). */
  base?: number;
  cover?: boolean;
}

/** Back to front. The galaxy replaces the flat sky; the astronaut and his shadow always travel together. */
const WORLD: Layer[] = [
  { id: "galaxy", src: "/assets/env/nebula-bg.webp", depth: 4, breath: 0.014, phase: 0, origin: "50% 45%", base: 1.22, cover: true },
  { id: "distant_mountain", src: `${BASE}/distant_mountain.webp`, depth: 14, breath: 0.006, phase: 1.1, origin: "72% 90%" },
  { id: "ground_and_left_rocks", src: `${BASE}/ground_and_left_rocks.webp`, depth: 26, breath: 0.008, phase: 2.2, origin: "50% 100%" },
  { id: "foreground_rocks", src: `${BASE}/foreground_rocks.webp`, depth: 46, breath: 0.012, phase: 3.3, origin: "50% 100%" },
  { id: "astronaut", src: [`${BASE}/astronaut_shadow.webp`, `${BASE}/astronaut.webp`], depth: 26, breath: 0.014, phase: 4.4, origin: "30% 100%" },
];
const TITLE_SRC = `${BASE}/title.webp`;
const IMAGE_COUNT = WORLD.reduce((n, l) => n + (Array.isArray(l.src) ? l.src.length : 1), 0) + 1;

/** Where the buttons start, as fractions of the frame (just under the title). */
const MENU = { x: 0.5, y: 0.445, w: 0.26 };

/** Breathing period in ms: slow enough to feel like air, not a pulse. */
const BREATH_MS = 2700;

/** A deterministic scatter of stars for the galaxy (seeded, so server and client agree). */
function makeStars(count: number) {
  let seed = 90210;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({ x: rnd() * FRAME_W, y: rnd() * FRAME_H * 0.78, r: 0.9 + rnd() * 1.9 }));
}

const STAR_GROUPS = [
  { delay: 0, dur: 3.2 },
  { delay: 1.1, dur: 4.4 },
  { delay: 2.3, dur: 5.6 },
];

/**
 * The stars: seventy-two of them drawn as three SVG sheets, and only the three sheets twinkle (one
 * opacity fade each, run by the compositor). Seventy separate animated dots cost far more.
 */
const StarField = memo(function StarField() {
  const stars = useMemo(() => makeStars(72), []);
  return (
    <div aria-hidden className="absolute inset-0">
      {STAR_GROUPS.map((g, gi) => (
        <svg key={gi} viewBox={`0 0 ${FRAME_W} ${FRAME_H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full motion-safe:animate-twinkle" style={{ animationDelay: `${g.delay}s`, animationDuration: `${g.dur}s` }}>
          {stars
            .filter((_, i) => i % 3 === gi)
            .map((st, i) => (
              <g key={i}>
                <circle cx={st.x} cy={st.y} r={st.r * 3.2} fill="rgb(150 190 255)" opacity="0.18" />
                <circle cx={st.x} cy={st.y} r={st.r} fill="#fff" />
              </g>
            ))}
        </svg>
      ))}
    </div>
  );
});

/** The loading bar is its own component, so each preload tick re-renders only this and not the whole screen. */
const LoadingBar = memo(function LoadingBar() {
  const t = useT();
  const progress = useSyncExternalStore(subscribePreload, warmProgress, () => 0);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-[min(22rem,80vw)] text-center" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-black/40" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full bg-yellow-300 transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 font-mono text-xs tracking-widest text-white/80">
        {progress >= 100 ? t.sceneLoading.ready.toUpperCase() : `${t.sceneLoading.stageAssets.toUpperCase()} ${progress}%`}
      </p>
    </div>
  );
});

/**
 * The first screen of the game and its menu: a Moon canyon under a galaxy, in layered parallax that
 * follows the pointer and breathes. Continue, New game and the chapter list live right here.
 */
export function TitleSplash() {
  const reduced = useReducedMotion();
  const t = useT();
  const localize = useLocalized();
  const router = useRouter();
  const { stepId, hydrated, newGame, jumpToChapter } = useGameStore();

  const stage = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [chapters, setChapters] = useState(false);
  const ready = loaded >= IMAGE_COUNT;
  const done = useRef(false);
  const width = useRef(FRAME_W);
  // Set when the screen turns out to run slowly on this machine: the extras (stars, breathing) switch off.
  const [lite, setLite] = useState(false);
  const liteRef = useRef(false);
  const paused = useRef(false);

  const canContinue = hydrated && hasContinuableProgress(stepId);
  const resumeStep = stepId ? getStep(stepId) : undefined;
  const resumeChapter = resumeStep && resumeStep.kind !== "end" ? CHAPTERS.find((c) => c.id === resumeStep.chapter) : undefined;

  /** Fades the screen out, then goes to the game. */
  const enter = useCallback(
    (before?: () => void) => {
      if (done.current) return;
      done.current = true;
      before?.();
      playSfx("click");
      setLeaving(true);
      window.setTimeout(() => router.push("/play"), reduced ? 0 : 650);
    },
    [router, reduced],
  );
  const start = useCallback(() => enter(newGame), [enter, newGame]);
  const resume = useCallback(() => enter(), [enter]);
  const jump = useCallback((chapter: ChapterId) => enter(() => jumpToChapter(chapter)), [enter, jumpToChapter]);

  useEffect(() => {
    router.prefetch("/play");
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && chapters) {
        setChapters(false);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && !chapters && !(e.target as HTMLElement | null)?.closest("button, summary, a")) {
        e.preventDefault();
        if (canContinue) resume();
        else if (hydrated) start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapters, canContinue, hydrated, resume, start]);

  paused.current = chapters || leaving;

  // Watch the frame rate for a moment once the screen is up. On a slow machine, drop the extras for good.
  useEffect(() => {
    if (!ready || reduced) return;
    let raf = 0;
    let last = 0;
    let n = 0;
    let sum = 0;
    const from = performance.now() + 1600; // after the fade-in
    const sample = (now: number) => {
      if (now >= from) {
        if (last) {
          sum += now - last;
          n++;
        }
        last = now;
        if (n >= 60) {
          if (sum / n > 26) {
            liteRef.current = true;
            setLite(true);
          }
          return;
        }
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [ready, reduced]);

  // Never hold the screen back for a slow image.
  useEffect(() => {
    const id = window.setTimeout(() => setLoaded(IMAGE_COUNT), 3000);
    return () => window.clearTimeout(id);
  }, []);

  // Motion: the layers ease toward the pointer (a slow drift keeps touch screens alive) and each one
  // swells and settles on its own phase, so near and far layers breathe against each other.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    const el0 = stage.current;
    const ro = el0 ? new ResizeObserver(() => (width.current = el0.clientWidth)) : null;
    if (el0) {
      width.current = el0.clientWidth;
      ro?.observe(el0);
    }
    const tick = (now: number) => {
      const el = stage.current;
      // While a panel covers the screen (or the screen is fading out) nothing underneath needs to move.
      if (el && !paused.current) {
        const scale = width.current / FRAME_W;
        x += (target.current.x + Math.sin(now / 3200) * 0.18 - x) * 0.065;
        y += (target.current.y + Math.cos(now / 4100) * 0.1 - y) * 0.065;
        WORLD.forEach((l, i) => {
          const node = layers.current[i];
          if (!node) return;
          const s = (l.base ?? 1) * (liteRef.current ? 1 : 1 + l.breath * Math.sin((now / BREATH_MS) * Math.PI * 2 * 0.5 + l.phase));
          node.style.transform = `translate3d(${-x * l.depth * scale}px, ${-y * l.depth * scale * 0.55}px, 0) scale(${s})`;
        });
        if (titleRef.current) {
          const s = liteRef.current ? 1 : 1 + 0.008 * Math.sin(now / BREATH_MS + 0.5);
          titleRef.current.style.transform = `translate3d(${-x * 8 * scale}px, ${-y * 5 * scale}px, 0) scale(${s})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [reduced]);

  const onPointerMove = (e: React.PointerEvent) => {
    target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.current.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  const img = (src: string, cover = false) => (
    // eslint-disable-next-line @next/next/no-img-element -- fixed art, already sized and compressed
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={() => setLoaded((n) => n + 1)}
      className={cn("pointer-events-none absolute inset-0 h-full w-full select-none", cover && "object-cover")}
    />
  );

  const primary =
    "w-full bg-primary px-[2cqw] py-[1.1cqw] font-mono text-[max(0.75rem,1.35cqw)] font-bold uppercase tracking-[0.3em] text-primary-foreground shadow-[0_0_2.4cqw_rgb(var(--primary)/0.35)] transition-[transform,box-shadow] hover:scale-[1.03] hover:shadow-[0_0_3.4cqw_rgb(var(--primary)/0.55)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/80 disabled:opacity-60";
  const secondary =
    "flex-1 border border-primary/60 bg-space-deep/70 px-[1cqw] py-[0.8cqw] font-mono text-[max(0.65rem,1.05cqw)] uppercase tracking-[0.2em] text-foreground backdrop-blur-sm transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/80";

  return (
    <main className={cn("fixed inset-0 z-50 overflow-hidden bg-[#070d18] transition-opacity duration-[650ms]", leaving ? "opacity-0" : "opacity-100")} onPointerMove={onPointerMove} onPointerLeave={() => (target.current = { x: 0, y: 0 })}>
      {/* The world: a 16:9 frame that covers the screen, so it may crop but never shows an edge. */}
      <div
        ref={stage}
        className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
        style={{ width: `max(100vw, calc(100dvh * ${FRAME_W / FRAME_H}))`, aspectRatio: `${FRAME_W} / ${FRAME_H}` }}
        role="img"
        aria-label="Beyond the Earth: an astronaut on the Moon looks toward a mountain canyon under a galaxy"
      >
        <div className="absolute inset-0" style={{ transform: "scale(1.07)", transformOrigin: "50% 72%" }}>
          {WORLD.map((l, i) => (
            <div
              key={l.id}
              ref={(n) => {
                layers.current[i] = n;
              }}
              className="absolute inset-0 will-change-transform"
              style={{ transformOrigin: l.origin }}
            >
              {(Array.isArray(l.src) ? l.src : [l.src]).map((src) => (
                <div key={src} className="absolute inset-0">
                  {img(src, l.cover)}
                </div>
              ))}
              {l.id === "galaxy" && !lite && <StarField />}
            </div>
          ))}
        </div>
      </div>

      {/* The title and the menu sit in a frame that is always fully visible (fit, not cover), so nothing is cropped. */}
      <div
        className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
        style={{ width: `min(100vw, calc(100dvh * ${FRAME_W / FRAME_H}))`, aspectRatio: `${FRAME_W} / ${FRAME_H}`, containerType: "inline-size" }}
      >
        <div ref={titleRef} className="absolute inset-0 will-change-transform">
          {img(TITLE_SRC)}
        </div>

        <div className="absolute flex -translate-x-1/2 flex-col items-stretch gap-[0.9cqw]" style={{ left: `${MENU.x * 100}%`, top: `${MENU.y * 100}%`, width: `${MENU.w * 100}%` }}>
          {canContinue ? (
            <>
              <button type="button" onClick={resume} className={cn(primary, !lite && "motion-safe:animate-pulse")}>
                {t.home.continue}
              </button>
              {resumeChapter && (
                <p className="text-center font-mono text-[max(0.6rem,0.95cqw)] tracking-wider text-white/75">
                  {format(t.home.resumeAt, { chapter: localize(resumeChapter.title) })}
                </p>
              )}
              <div className="flex gap-[0.9cqw]">
                <button type="button" onClick={start} className={secondary}>
                  {t.home.newGame}
                </button>
                <button type="button" onClick={() => setChapters(true)} className={secondary}>
                  {t.home.chaptersShort}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={start} disabled={!hydrated} className={cn(primary, !lite && "motion-safe:animate-pulse")}>
                {t.home.pressStart}
              </button>
              <button type="button" onClick={() => setChapters(true)} className={secondary}>
                {t.home.chaptersShort}
              </button>
            </>
          )}
          {/* Phones only (touch + small screen, either orientation): a heads-up, never a block. */}
          <p className="hidden text-center text-[0.7rem] leading-snug text-white/70 [@media(pointer:coarse)_and_(max-height:500px)]:block [@media(pointer:coarse)_and_(max-width:640px)]:block">{t.home.desktopNotice}</p>
        </div>
      </div>

      {/* Everything the game needs loads in the background while the player reads the title. */}
      <LoadingBar />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <StatusBadge status="demo" className="bg-space-deep">
          {t.common.demoData}
        </StatusBadge>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <LocaleToggle className="bg-space-deep" />
        </div>
      </header>

      {chapters && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4" onClick={() => setChapters(false)}>
          <section role="dialog" aria-modal="true" aria-label={t.home.chapterSelect} className="bezel relative max-h-full w-full max-w-xl overflow-y-auto border border-primary/40 bg-space-deep/95 p-6 shadow-[0_0_40px_rgba(11,61,145,0.45)]" onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label={t.common.close} onClick={() => setChapters(false)} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]">
              <X className="h-4 w-4" aria-hidden />
            </button>
            <h2 className="text-lg font-semibold">{t.home.chapterSelect}</h2>
            <p className="mt-1 text-xs text-foreground/65">{t.home.chapterSelectHint}</p>
            <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <Button variant="secondary" size="sm" className="h-auto w-full flex-col items-start gap-0 py-2 text-left" onClick={() => jump(c.id)} disabled={!hydrated}>
                    <span>
                      {i + 1}. {localize(c.title)}
                    </span>
                    <span className="text-xs font-normal text-foreground/65">{localize(CHARACTERS[c.pov].role)}</span>
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </main>
  );
}
