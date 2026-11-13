"use client";

import { useEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useLocalized } from "@/i18n/useT";
import { playSfx } from "@/game/sfx";
import { cn } from "@/lib/utils";
import { UI } from "./content";
import { bolts } from "./Handwork";
import {
  BOLT_COUNT,
  BOLT_LABEL,
  COUPLING,
  FUEL_LINES,
  STAR_ORDER,
  TORQUE,
  createCoupling,
  createWrench,
  currentLine,
  lockCoupling,
  stepCoupling,
  stepWrench,
  type FuelLine,
} from "./handworkRules";

const panel = "bezel pointer-events-auto bg-space-deep/95 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]";

/** Space (held or tapped) as a boolean ref, plus Escape. Both panels use it. */
function useSpaceKey(onDown: () => void, onUp: () => void, onEscape: () => void) {
  const refs = useRef({ onDown, onUp, onEscape });
  refs.current = { onDown, onUp, onEscape };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) refs.current.onDown();
      } else if (e.code === "Escape") refs.current.onEscape();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") refs.current.onUp();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
}

/* ---------------------------------------------------------------- fuel bay */

type FuelPhase = "connect" | "fill" | "done";

/**
 * Fuel bay minigame: seat the oxidizer coupling and then the fuel coupling by stopping a sweeping
 * marker inside the green zone, then watch the propellant transfer.
 */
export function FuelGame({
  onHit,
  onMiss,
  onFill,
  onDone,
  onCancel,
}: {
  onHit: (line: FuelLine) => void;
  onMiss: () => void;
  onFill: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const localize = useLocalized();
  const state = useRef(createCoupling());
  const [view, setView] = useState({ pos: state.current.pos, locked: 0, slips: 0, flash: "" as "" | "hit" | "miss" });
  const [phase, setPhase] = useState<FuelPhase>("connect");
  const [fill, setFill] = useState(0);
  const phaseRef = useRef<FuelPhase>("connect");
  const fillRef = useRef(0);
  const flash = useRef<{ kind: "hit" | "miss"; until: number } | null>(null);
  const cb = useRef({ onHit, onMiss, onFill, onDone });
  cb.current = { onHit, onMiss, onFill, onDone };

  const connect = () => {
    if (phaseRef.current !== "connect") return;
    const line = currentLine(state.current);
    const result = lockCoupling(state.current);
    if (result === "hit" && line) {
      playSfx("unlatch");
      flash.current = { kind: "hit", until: performance.now() + 350 };
      cb.current.onHit(line);
      if (currentLine(state.current) === null) {
        phaseRef.current = "fill";
        setPhase("fill");
        cb.current.onFill();
      }
    } else if (result === "miss") {
      playSfx("noGo");
      flash.current = { kind: "miss", until: performance.now() + 350 };
      cb.current.onMiss();
    }
  };
  useSpaceKey(connect, () => {}, onCancel);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (phaseRef.current === "connect") {
        stepCoupling(state.current, dt);
      } else if (phaseRef.current === "fill") {
        fillRef.current = Math.min(1, fillRef.current + dt / COUPLING.fillSeconds);
        setFill(fillRef.current);
        if (fillRef.current >= 1) {
          phaseRef.current = "done";
          setPhase("done");
          playSfx("success");
          window.setTimeout(() => cb.current.onDone(), 900);
        }
      }
      const f = flash.current && flash.current.until > now ? flash.current.kind : "";
      setView({ pos: state.current.pos, locked: state.current.locked.length, slips: state.current.slips, flash: f });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const line = FUEL_LINES[view.locked];
  const zoneLeft = (0.5 - COUPLING.zone) * 100;
  const zoneWidth = COUPLING.zone * 2 * 100;

  return (
    <section className={cn(panel, "bezel-gold w-full max-w-sm space-y-3")} aria-label={localize(UI.fuelGame.title)}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{localize(UI.fuelGame.title)}</h2>
        <span className="font-mono text-xs text-foreground/65">{format(localize(UI.fuelGame.slips), { n: view.slips })}</span>
      </header>

      <ol className="space-y-1 text-xs">
        {FUEL_LINES.map((id, i) => (
          <li key={id} className="flex items-center justify-between gap-3">
            <span className={cn(i < view.locked ? "text-foreground" : "text-foreground/70")}>{localize(UI.fuelGame.line[id])}</span>
            <span className={cn("font-mono", i < view.locked ? "text-emerald-300" : "text-foreground/40")}>
              {i < view.locked ? localize(UI.fuelGame.linked) : "—"}
            </span>
          </li>
        ))}
      </ol>

      {phase === "connect" ? (
        <>
          <div
            className={cn(
              "relative h-9 overflow-hidden rounded border bg-black/40 transition-colors",
              view.flash === "miss" ? "border-red-400" : view.flash === "hit" ? "border-emerald-400" : "border-foreground/25",
            )}
            role="img"
            aria-label={line ? localize(UI.fuelGame.line[line]) : ""}
          >
            <div className="absolute inset-y-0" style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%`, background: "rgba(16,185,129,0.45)" }} />
            <div className="absolute inset-y-0 w-1 -translate-x-1/2 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" style={{ left: `${view.pos * 100}%` }} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-foreground/70">{localize(UI.fuelGame.hint)}</p>
            <Button size="sm" onClick={connect}>
              {localize(UI.fuelGame.connect)}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span>{localize(UI.fuelGame.filling)}</span>
            <span className="font-mono">{format(localize(UI.fuelGame.flow), { value: Math.round(fill * 100) })}</span>
          </div>
          <div className="h-3 overflow-hidden rounded bg-black/40">
            <div className="h-full bg-gradient-to-r from-sky-400 to-cyan-200" style={{ width: `${fill * 100}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- torque wrench */

/**
 * Torque one bolt: hold Space (or the button) to turn. Torque rises faster as the bolt seats; the
 * wrench clicks at the set value and the player must let go before the thread strips.
 */
export function TorqueGame({
  index,
  onTight,
  onStripped,
  onCancel,
}: {
  index: number;
  onTight: () => void;
  onStripped: () => void;
  onCancel: () => void;
}) {
  const localize = useLocalized();
  const wrench = useRef(createWrench());
  const holding = useRef(false);
  const [view, setView] = useState({ torque: 0, clicked: false, result: "idle" as "idle" | "tight" | "stripped" });
  const cb = useRef({ onTight, onStripped });
  cb.current = { onTight, onStripped };
  const clickedPlayed = useRef(false);

  useEffect(() => {
    bolts.active = index;
    bolts.torque = 0;
    return () => {
      bolts.active = -1;
      bolts.turning = false;
    };
  }, [index]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let finished = false;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const w = wrench.current;
      const before = w.torque;
      stepWrench(w, holding.current, dt);
      bolts.turning = holding.current && w.result === "idle";
      bolts.torque = w.torque;
      // The bolt visibly turns as the player turns: more per second as the thread bites.
      if (holding.current && w.result === "idle") bolts.angle[index] += (w.torque - before + dt * 0.5) * 9;
      if (w.clicked && !clickedPlayed.current) {
        clickedPlayed.current = true;
        playSfx("tick");
        playSfx("switch");
      }
      setView({ torque: w.torque, clicked: w.clicked, result: w.result });
      if (!finished && w.result !== "idle") {
        finished = true;
        if (w.result === "tight") {
          bolts.seat[index] = 1;
          playSfx("success");
          window.setTimeout(() => cb.current.onTight(), 450);
        } else {
          bolts.stripped[index] = 1.4;
          playSfx("noGo");
          window.setTimeout(() => cb.current.onStripped(), 700);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [index]);

  useSpaceKey(
    () => (holding.current = true),
    () => (holding.current = false),
    onCancel,
  );

  const pct = (v: number) => `${Math.min(100, v * 100)}%`;
  const bar =
    view.result === "stripped" ? "bg-red-500" : view.clicked ? "bg-emerald-400" : "bg-sky-400";

  return (
    <section className={cn(panel, "bezel-gold w-full max-w-sm space-y-3")} aria-label={format(localize(UI.tighten.bolt), { label: BOLT_LABEL[index] })}>
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="size-4" aria-hidden />
          {format(localize(UI.tighten.bolt), { label: BOLT_LABEL[index] })}
        </h2>
        <span className="font-mono text-xs text-foreground/65">
          {view.result === "tight" ? localize(UI.tighten.done) : view.result === "stripped" ? localize(UI.tighten.strip) : `${Math.round(view.torque * 100)}%`}
        </span>
      </header>

      <div>
        <div className="mb-1 flex justify-between text-[11px] text-foreground/60">
          <span>{localize(UI.tighten.torque)}</span>
          <span>
            {localize(UI.tighten.click)} {Math.round(TORQUE.click * 100)}% → {localize(UI.tighten.strip)} {Math.round(TORQUE.strip * 100)}%
          </span>
        </div>
        <div className="relative h-4 overflow-hidden rounded bg-black/40">
          <div className="absolute inset-y-0" style={{ left: pct(TORQUE.click), width: pct(TORQUE.strip - TORQUE.click), background: "rgba(16,185,129,0.4)" }} />
          <div className={cn("h-full transition-[width] duration-75", bar)} style={{ width: pct(view.torque) }} />
          <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: pct(TORQUE.click) }} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/70">{localize(UI.tighten.holdKeys)}</p>
        <Button
          size="sm"
          onPointerDown={() => (holding.current = true)}
          onPointerUp={() => (holding.current = false)}
          onPointerLeave={() => (holding.current = false)}
          onPointerCancel={() => (holding.current = false)}
        >
          {localize(UI.tighten.hold)}
        </Button>
      </div>
    </section>
  );
}

/** Where the tightening task stands: tool in hand, which level, which bolt is next. */
export function TightenStatus({ held, onLevel2, done, mistakes }: { held: boolean; onLevel2: boolean; done: readonly number[]; mistakes: number }) {
  const localize = useLocalized();
  const next = STAR_ORDER[done.length];
  return (
    <section className={cn(panel, "w-full max-w-xs space-y-2")} aria-label={localize(UI.tighten.title)}>
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wrench className="size-4" aria-hidden />
          {localize(UI.tighten.title)}
        </h2>
        <span className="font-mono text-xs text-foreground/65">
          {done.length}/{BOLT_COUNT}
        </span>
      </header>
      <ol className="flex gap-1.5" aria-label={STAR_ORDER.map((i) => BOLT_LABEL[i]).join(", ")}>
        {STAR_ORDER.map((i, step) => (
          <li
            key={i}
            className={cn(
              "grid size-7 place-items-center rounded-full border text-xs font-bold",
              step < done.length ? "border-emerald-400" : step === done.length && held ? "border-amber-300" : "border-foreground/25 text-foreground/55",
            )}
            style={
              step < done.length
                ? { background: "rgba(16,185,129,0.4)" }
                : step === done.length && held
                  ? { background: "rgba(251,191,36,0.25)" }
                  : undefined
            }
          >
            {BOLT_LABEL[i]}
          </li>
        ))}
      </ol>
      <p className="text-xs text-foreground/80">
        {!held
          ? localize(UI.tighten.needTool)
          : !onLevel2
            ? localize(UI.tighten.needLevel)
            : next !== undefined
              ? format(localize(UI.tighten.next), { label: BOLT_LABEL[next] })
              : ""}
      </p>
      {mistakes > 0 && <p className="font-mono text-[11px] text-foreground/55">{format(localize(UI.done.bolts), {})}: {mistakes}</p>}
    </section>
  );
}
