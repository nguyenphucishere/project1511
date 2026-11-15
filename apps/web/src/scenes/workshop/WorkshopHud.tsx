"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronsDown, ChevronsUp, Crosshair, Megaphone, Minus, TriangleAlert } from "lucide-react";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useLocalized } from "@/i18n/useT";
import { CHARACTERS } from "@/game/characters";
import { playSfx } from "@/game/sfx";
import { cn } from "@/lib/utils";
import { CHECKLIST_ORDER, PRESSURE, createPressure, inWindow, stepPressure, type PressureState, type StationId } from "./checks";
import { CHECKLIST_TEXT, UI, type Line } from "./content";
import { CRANE, approachSpeed, loadOffset } from "./crane";
import type { CraneRigState } from "./CraneRig";
import { scan } from "./Defects";
import { FAULTS, type FaultId } from "./faults";
import { CRANE_LIFTS } from "./layout";
import { DELTA_V_MIN_KMS, ENGINES, TANKS, TWR_MAX, TWR_MIN, assessLoadout, type Loadout } from "./loadout";

/* ---------------------------------------------------------------- shared */

/** Re-reads a mutable value ~15 times a second. For HUDs fed by per-frame simulations. */
function usePolled<T>(read: () => T, ms = 66): T {
  const [value, setValue] = useState<T>(read);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    const id = window.setInterval(() => setValue(readRef.current()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return value;
}

const panel = "bezel pointer-events-auto bg-space-deep/95 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]";

/* ---------------------------------------------------------------- callout */

/** Speech bubble: Kai, Chief Bao or the loudspeaker, top centre. */
export function Callout({ line }: { line: Line | null }) {
  const localize = useLocalized();
  if (!line) return null;
  const speaker = line.who === "pa" ? null : CHARACTERS[line.who];
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-16 z-20 flex w-[min(92vw,36rem)] -translate-x-1/2 animate-fade-in items-start gap-3 sm:left-[calc(50%+8rem)] sm:top-20 sm:w-[min(62vw,36rem)]"
    >
      <div className="bezel bezel-gold flex w-full items-start gap-3 bg-space-deep/95 p-3 shadow-xl">
        {speaker ? (
          <div className="h-12 w-10 shrink-0">
            <CharacterPortrait character={line.who as Exclude<Line["who"], "pa">} avatar />
          </div>
        ) : (
          <Megaphone className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {speaker ? localize(speaker.name) : localize(UI.paLabel)}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-foreground/95">{localize(line.text)}</p>
        </div>
      </div>
    </div>
  );
}

/** Loudspeaker announcement, a thin strip so it never hides the story lines. */
export function PaStrip({ text }: { text: import("@/i18n").LocalizedText | null }) {
  const localize = useLocalized();
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[3.6rem] z-10 flex justify-center px-3 sm:top-[3.9rem]">
      <p className="flex animate-fade-in items-center gap-2 border border-primary/40 bg-space-deep/85 px-3 py-1 text-xs text-foreground/90">
        <Megaphone className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="font-semibold text-primary">{localize(UI.paLabel)}:</span> {localize(text)}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- crane */

const RADAR = 120;

export function CraneHud({ rig, lift }: { rig: CraneRigState; lift: number }) {
  const localize = useLocalized();
  const snap = usePolled(() => {
    const s = rig.state;
    const spec = CRANE_LIFTS[lift];
    return {
      x: s.x + s.sx,
      z: s.z + s.sz,
      off: loadOffset(s),
      speed: approachSpeed(s),
      height: Math.max(0, s.y - spec.seatY),
      blocked: rig.blocked,
      bumps: rig.bumps,
    };
  });
  const aligned = snap.off <= CRANE.tolerance;
  // Radar scale is stretched near the centre so the last few centimetres are readable.
  const scale = (v: number) => Math.sign(v) * Math.min(1, Math.sqrt(Math.abs(v) / 8)) * (RADAR / 2 - 8);
  const dot = { x: RADAR / 2 + scale(snap.x), y: RADAR / 2 + scale(snap.z) };
  const ringR = Math.sqrt(CRANE.tolerance / 8) * (RADAR / 2 - 8);
  const tooFast = snap.speed > CRANE.softLanding;

  const hold = (patch: Partial<typeof rig.input>) => () => {
    Object.assign(rig.input, patch);
  };
  const release = () => {
    rig.input.moveX = 0;
    rig.input.moveZ = 0;
    rig.input.hoist = 0;
  };
  const padBtn = (label: string, icon: React.ReactNode, patch: Partial<typeof rig.input>) => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={hold(patch)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      className="flex h-9 w-9 touch-none items-center justify-center border border-foreground/25 bg-space-blue/50 text-foreground hover:border-primary active:bg-primary/30"
    >
      {icon}
    </button>
  );

  return (
    <section aria-label={localize(UI.crane.lift)} className={cn(panel, "w-full max-w-[25rem] space-y-3")}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{localize(UI.crane.sections[lift])}</h2>
        <span className="font-mono text-xs text-primary">{format(localize(UI.crane.lift), { n: lift + 1, total: CRANE_LIFTS.length })}</span>
      </header>

      <div className="flex gap-4">
        <svg width={RADAR} height={RADAR} viewBox={`0 0 ${RADAR} ${RADAR}`} role="img" aria-label={localize(UI.crane.alignment)} className="shrink-0 border border-primary/40 bg-[#07203a]">
          <circle cx={RADAR / 2} cy={RADAR / 2} r={RADAR / 2 - 8} fill="none" stroke="rgba(94,231,255,0.25)" />
          <circle cx={RADAR / 2} cy={RADAR / 2} r={(RADAR / 2 - 8) / 2} fill="none" stroke="rgba(94,231,255,0.15)" />
          <path d={`M${RADAR / 2} 4V${RADAR - 4}M4 ${RADAR / 2}H${RADAR - 4}`} stroke="rgba(94,231,255,0.25)" />
          <circle cx={RADAR / 2} cy={RADAR / 2} r={ringR} fill="none" stroke={aligned ? "#34d399" : "#fbbf24"} strokeWidth="1.6" />
          <line x1={RADAR / 2} y1={RADAR / 2} x2={dot.x} y2={dot.y} stroke={aligned ? "#34d399" : "#f87171"} strokeWidth="1" opacity="0.7" />
          <circle cx={dot.x} cy={dot.y} r="5" fill={aligned ? "#34d399" : "#f87171"} />
        </svg>
        <dl className="min-w-0 flex-1 space-y-2.5 text-xs">
          <div>
            <dt className="text-foreground/65">{localize(UI.crane.alignment)}</dt>
            <dd className={cn("font-mono text-sm", aligned ? "text-emerald-300" : "text-amber-300")}>
              {aligned ? localize(UI.crane.aligned) : format(localize(UI.crane.off), { cm: Math.round(snap.off * 100) })}
            </dd>
          </div>
          <div>
            <dt className="text-foreground/65">{localize(UI.crane.speed)}</dt>
            <dd>
              <div className="relative mt-1 h-2 bg-foreground/15" aria-hidden>
                <div className="absolute inset-y-0 left-0 bg-emerald-400/50" style={{ width: `${(CRANE.softLanding / CRANE.lowerMax) * 100}%` }} />
                <div className={cn("absolute inset-y-0 left-0 w-1", tooFast ? "bg-red-400" : "bg-primary")} style={{ left: `${Math.min(100, (snap.speed / CRANE.lowerMax) * 100)}%` }} />
              </div>
              <span className={cn("font-mono", tooFast && "text-red-300")}>{snap.speed.toFixed(1)} m/s</span>
            </dd>
          </div>
          <div>
            <dt className="text-foreground/65">{localize(UI.crane.clearance)}</dt>
            <dd className="font-mono text-sm">{snap.height.toFixed(1)} m</dd>
          </div>
        </dl>
      </div>

      {snap.blocked && (
        <p className="flex items-center gap-1.5 border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-xs text-amber-200" role="alert">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {localize({ en: "Held above the stack: line it up", vi: "Đang bị giữ phía trên: hãy căn thẳng trục" })}
        </p>
      )}

      <div className="flex items-end justify-between gap-3">
        <div className="grid grid-cols-3 gap-1">
          <span />
          {padBtn("W", <ArrowUp className="h-4 w-4" />, { moveZ: -1 })}
          <span />
          {padBtn("A", <ArrowLeft className="h-4 w-4" />, { moveX: -1 })}
          {padBtn("S", <ArrowDown className="h-4 w-4" />, { moveZ: 1 })}
          {padBtn("D", <ArrowRight className="h-4 w-4" />, { moveX: 1 })}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onPointerDown={hold({ hoist: -1 })}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
            className="flex h-9 touch-none items-center justify-center gap-1.5 border border-primary/60 bg-primary/15 px-3 text-sm font-medium hover:bg-primary/30"
          >
            <ChevronsDown className="h-4 w-4" aria-hidden /> {localize(UI.crane.lower)}
          </button>
          <button
            type="button"
            onPointerDown={hold({ hoist: 1 })}
            onPointerUp={release}
            onPointerLeave={release}
            onPointerCancel={release}
            className="flex h-9 touch-none items-center justify-center gap-1.5 border border-foreground/25 bg-space-blue/50 px-3 text-sm hover:border-primary"
          >
            <ChevronsUp className="h-4 w-4" aria-hidden /> {localize(UI.crane.raise)}
          </button>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-foreground/60">{localize(UI.crane.controls)}</p>
      <p className="font-mono text-[11px] text-foreground/60">{format(localize(UI.crane.bumps), { n: snap.bumps })}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- scanner */

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

export function ScanOverlay({ on }: { on: boolean }) {
  const snap = usePolled(() => scan.signal, 50);
  if (!on) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at center, rgba(6,182,212,0) 38%, rgba(6,182,212,0.2) 78%, rgba(3,52,90,0.55) 100%)" }}
      />
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0 1px, transparent 1px 3px)" }}
      />
      {/* Reticle: tightens and warms up with the signal */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="rounded-full border-2 transition-[width,height,border-color] duration-100"
          style={{
            width: `${150 - snap * 80}px`,
            height: `${150 - snap * 80}px`,
            borderColor: `rgba(${94 + snap * 160}, ${231 - snap * 40}, ${255 - snap * 210}, ${0.55 + snap * 0.4})`,
          }}
        />
        <Crosshair className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-cyan-200/80" strokeWidth={1.2} />
      </div>
      {[["left-4 top-4", "border-l-2 border-t-2"], ["right-4 top-4", "border-r-2 border-t-2"], ["left-4 bottom-4", "border-b-2 border-l-2"], ["right-4 bottom-4", "border-b-2 border-r-2"]].map(([pos, b]) => (
        <span key={pos} className={cn("absolute h-8 w-8 border-cyan-200/70", pos, b)} />
      ))}
    </div>
  );
}

interface ScanHudProps {
  on: boolean;
  onToggle: () => void;
  found: ReadonlySet<FaultId>;
  secondsLeft: number;
  revealAll: boolean;
}

export function ScanHud({ on, onToggle, found, secondsLeft, revealAll }: ScanHudProps) {
  const localize = useLocalized();
  const signal = usePolled(() => scan.signal, 60);
  const low = secondsLeft <= 20;
  return (
    <section aria-label={localize(UI.scan.toggle)} className={cn(panel, "w-full max-w-sm space-y-3")}>
      <div className="flex items-center justify-between gap-3">
        <Button onClick={onToggle} variant={on ? "primary" : "secondary"} aria-pressed={on} disabled={revealAll}>
          <Crosshair className="mr-1.5 h-4 w-4" aria-hidden /> {localize(on ? UI.scan.on : UI.scan.off)}
        </Button>
        <div className={cn("text-right font-mono", low && "text-red-300")} aria-label={localize(UI.scan.time)}>
          <div className="text-xl leading-none">{mmss(secondsLeft)}</div>
          <div className="text-[10px] uppercase text-foreground/60">{localize(UI.scan.time)}</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-foreground/70">
          <span>{localize(UI.scan.signal)}</span>
          <span className="font-mono">{on ? `${Math.round(signal * 100)}%` : "—"}</span>
        </div>
        <div className="mt-1 h-2 bg-foreground/15" aria-hidden>
          <div className="h-full bg-gradient-to-r from-cyan-400 to-amber-300 transition-[width] duration-75" style={{ width: `${on ? Math.max(3, signal * 100) : 0}%` }} />
        </div>
      </div>

      <p className="text-xs text-foreground/70">{localize(UI.scan.hint)}</p>

      <div>
        <p className="mb-1 font-mono text-xs text-primary">{format(localize(UI.scan.found), { n: found.size, total: FAULTS.length })}</p>
        <ul className="space-y-1 text-xs">
          {FAULTS.map((f) => {
            const got = found.has(f.id);
            const showName = got || revealAll;
            return (
              <li key={f.id} className={cn("flex items-center gap-2", got ? "text-emerald-300" : revealAll ? "text-amber-300" : "text-foreground/45")}>
                {got ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
                {showName ? localize(f.name) : "???"}
                {revealAll && !got && <span className="ml-auto uppercase text-[10px]">{localize(UI.scan.missed)}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- checklist */

export function ChecklistPanel({ done, mistakes }: { done: readonly StationId[]; mistakes: number }) {
  const localize = useLocalized();
  return (
    <section aria-label={localize(UI.station.checklist)} className={cn(panel, "w-full max-w-sm space-y-2")}>
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{localize(UI.station.checklist)}</h2>
        <span className={cn("font-mono text-xs", mistakes ? "text-amber-300" : "text-foreground/60")}>
          {format(localize(UI.station.mistakes), { n: mistakes })}
        </span>
      </header>
      <ol className="space-y-2">
        {CHECKLIST_ORDER.map((id, i) => {
          const ok = done.includes(id);
          const next = done.length === i;
          return (
            <li key={id} className={cn("flex gap-3 border-l-2 px-3 py-1.5", ok ? "border-emerald-400 bg-emerald-400/10" : next ? "border-primary bg-primary/10" : "border-foreground/15 opacity-70")}>
              <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold", ok ? "border-emerald-400 text-emerald-300" : "border-foreground/40")}>
                {ok ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0 text-sm">
                <span className="font-semibold">{localize(CHECKLIST_TEXT[id].step)}</span>
                <span className="block text-xs text-foreground/75">{localize(CHECKLIST_TEXT[id].detail)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Hold-to-pump gauge: bring the needle into the green window and keep it there. */
export function PressureGame({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const localize = useLocalized();
  const state = useRef<PressureState>(createPressure());
  const pumping = useRef(false);
  const [view, setView] = useState({ bar: state.current.bar, stable: 0, done: false });
  const finished = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      stepPressure(state.current, pumping.current, dt);
      setView({ bar: state.current.bar, stable: state.current.stable, done: state.current.done });
      if (state.current.done && !finished.current) {
        finished.current = true;
        playSfx("success");
        window.setTimeout(onDone, 700);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        pumping.current = true;
      } else if (e.code === "Escape") onCancel();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") pumping.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onDone, onCancel]);

  // Gauge: 0..4.5 bar over a 240 degree sweep.
  const angle = (bar: number) => -120 + (bar / PRESSURE.ceiling) * 240;
  const pt = (bar: number, r: number) => {
    const a = ((angle(bar) - 90) * Math.PI) / 180;
    return [80 + Math.cos(a) * r, 80 + Math.sin(a) * r] as const;
  };
  const arc = (b0: number, b1: number, r: number) => {
    const [x0, y0] = pt(b0, r);
    const [x1, y1] = pt(b1, r);
    return `M${x0} ${y0}A${r} ${r} 0 ${angle(b1) - angle(b0) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const [nx, ny] = pt(view.bar, 54);
  const good = inWindow(view.bar);

  return (
    <section className={cn(panel, "bezel-gold w-full max-w-sm space-y-3")} aria-label={localize(UI.station.pump)}>
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{localize({ en: "Pressure manifold", vi: "Cụm áp suất" })}</h2>
        <span className="font-mono text-xs text-foreground/65">
          {format(localize(UI.station.window), { min: PRESSURE.min, max: PRESSURE.max })}
        </span>
      </header>
      <svg viewBox="0 0 160 120" className="mx-auto w-56" role="img" aria-label={format(localize(UI.station.bar), { value: view.bar.toFixed(2) })}>
        <circle cx="80" cy="80" r="70" fill="#07203a" stroke="rgba(94,231,255,0.4)" />
        <path d={arc(0.2, PRESSURE.ceiling, 60)} stroke="rgba(255,255,255,0.18)" strokeWidth="8" fill="none" />
        <path d={arc(PRESSURE.min, PRESSURE.max, 60)} stroke="#34d399" strokeWidth="8" fill="none" />
        <path d={arc(PRESSURE.max + 0.4, PRESSURE.ceiling, 60)} stroke="#f87171" strokeWidth="8" fill="none" opacity="0.7" />
        {[0, 1, 2, 3, 4].map((b) => {
          const [x0, y0] = pt(b, 66);
          const [x1, y1] = pt(b, 72);
          const [tx, ty] = pt(b, 50);
          return (
            <g key={b}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(255,255,255,0.5)" />
              <text x={tx} y={ty + 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.7)">{b}</text>
            </g>
          );
        })}
        <line x1="80" y1="80" x2={nx} y2={ny} stroke={good ? "#34d399" : "#ffc72c"} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="80" cy="80" r="5" fill="#e5e7eb" />
        <text x="80" y="108" textAnchor="middle" fontSize="12" fontWeight="700" fill={good ? "#6ee7b7" : "#fde68a"} fontFamily="monospace">
          {format(localize(UI.station.bar), { value: view.bar.toFixed(2) })}
        </text>
      </svg>
      <div className="h-2 bg-foreground/15" aria-hidden>
        <div className="h-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${Math.min(100, (view.stable / PRESSURE.hold) * 100)}%` }} />
      </div>
      <button
        type="button"
        onPointerDown={() => (pumping.current = true)}
        onPointerUp={() => (pumping.current = false)}
        onPointerLeave={() => (pumping.current = false)}
        onPointerCancel={() => (pumping.current = false)}
        className="w-full touch-none border border-primary/70 bg-primary/15 py-3 text-sm font-semibold hover:bg-primary/30 active:bg-primary/40"
      >
        {localize(UI.station.pump)}
      </button>
      <p className="text-xs text-foreground/65">{localize(UI.station.pumpKeys)}</p>
    </section>
  );
}

/* ---------------------------------------------------------------- loadout */

interface LoadoutPanelProps {
  value: Loadout;
  onChange: (l: Loadout) => void;
  onConfirm: () => void;
}

function Meter({ label, shown, ok, min, max, lo, hi, note }: { label: string; shown: string; ok: boolean; min: number; max: number; lo?: number; hi?: number; note?: string }) {
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-foreground/70">{label}</span>
        <span className={cn("font-mono text-sm", ok ? "text-emerald-300" : "text-red-300")}>{shown}</span>
      </div>
      <div className="relative mt-1 h-2 bg-foreground/15" aria-hidden>
        {lo !== undefined && <div className="absolute inset-y-0 bg-emerald-400/30" style={{ left: pos(lo), right: hi !== undefined ? `calc(100% - ${pos(hi)})` : 0 }} />}
        <div className={cn("absolute inset-y-0 left-0 w-1.5 transition-[left] duration-300", ok ? "bg-emerald-300" : "bg-red-400")} style={{ left: pos(Number.parseFloat(shown)) }} />
      </div>
      {note && <p className="mt-0.5 text-[11px] text-red-300">{note}</p>}
    </div>
  );
}

export function LoadoutPanel({ value, onChange, onConfirm }: LoadoutPanelProps) {
  const localize = useLocalized();
  const stats = assessLoadout(value);
  const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const choice = (selected: boolean) =>
    cn(
      "w-full border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      selected ? "border-primary bg-primary/15" : "border-foreground/20 hover:border-foreground/50",
    );
  return (
    <section aria-label={localize(UI.loadout.title)} className={cn(panel, "bezel-gold max-h-[80dvh] w-full max-w-lg space-y-3 overflow-y-auto")}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{localize(UI.loadout.title)}</h2>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">{localize(UI.loadout.engines)}</legend>
          {ENGINES.map((e) => (
            <button key={e.id} type="button" aria-pressed={value.engine === e.id} className={choice(value.engine === e.id)} onClick={() => { playSfx("click"); onChange({ ...value, engine: e.id }); }}>
              <span className="block font-medium">{localize(e.name)} <span className="font-mono text-xs text-foreground/60">×{e.count}</span></span>
              <span className="block text-xs text-foreground/70">{localize(e.note)}</span>
            </button>
          ))}
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">{localize(UI.loadout.tanks)}</legend>
          {TANKS.map((tk) => (
            <button key={tk.id} type="button" aria-pressed={value.tank === tk.id} className={choice(value.tank === tk.id)} onClick={() => { playSfx("click"); onChange({ ...value, tank: tk.id }); }}>
              <span className="block font-medium">{localize(tk.name)} <span className="font-mono text-xs text-foreground/60">{format(localize(UI.loadout.tonnes), { value: nf.format(tk.propellantT) })}</span></span>
              <span className="block text-xs text-foreground/70">{localize(tk.note)}</span>
            </button>
          ))}
        </fieldset>
      </div>

      <div className="space-y-2.5 border-t border-foreground/15 pt-3">
        <Meter
          label={localize(UI.loadout.twr)}
          shown={stats.twr.toFixed(2)}
          ok={!stats.twrTooLow && !stats.twrTooHigh}
          min={0.5}
          max={3.5}
          lo={TWR_MIN}
          hi={TWR_MAX}
          note={stats.twrTooLow ? localize(UI.loadout.twrLow) : stats.twrTooHigh ? localize(UI.loadout.twrHigh) : undefined}
        />
        <Meter
          label={localize(UI.loadout.dv)}
          shown={stats.deltaVKms.toFixed(2)}
          ok={!stats.deltaVLow}
          min={2.5}
          max={6}
          lo={DELTA_V_MIN_KMS}
          note={stats.deltaVLow ? localize(UI.loadout.dvLow) : undefined}
        />
        <dl className="grid grid-cols-2 gap-px bg-space-blue/60 text-xs">
          {[
            [UI.loadout.thrust, format(localize(UI.loadout.mn), { value: nf.format(stats.thrustMN) })],
            [UI.loadout.mass, format(localize(UI.loadout.tonnes), { value: nf.format(Math.round(stats.liftoffMassT)) })],
            [UI.loadout.vehicle, stats.engine.vehicle === "kestrel" ? "Kestrel M" : stats.engine.vehicle === "saros" ? "Saros H" : "Orison SH"],
            [UI.loadout.fuel, `${stats.tank.fuelPct}%`],
          ].map(([label, v]) => (
            <div key={String(v) + localize(label as never)} className="bg-space-deep/80 px-3 py-1.5">
              <dt className="text-foreground/60">{localize(label as never)}</dt>
              <dd className="font-mono text-sm">{v as string}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-foreground/55">{localize(UI.loadout.rulesNote)}</p>
      </div>

      <Button className="w-full" disabled={!stats.ok} onClick={onConfirm}>
        {localize(stats.ok ? UI.loadout.confirm : UI.loadout.blocked)}
      </Button>
    </section>
  );
}
