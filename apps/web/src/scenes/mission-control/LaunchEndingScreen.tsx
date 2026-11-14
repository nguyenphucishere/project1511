"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocalized, useT } from "@/i18n/useT";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import { startScore } from "@/game/sfx";
import { cn } from "@/lib/utils";
import type { LaunchEnding } from "./launchEndings";

/** Time each story line stays before the next appears: long enough to be heard, never hurried. */
const lineMs = (text: string) => Math.max(4200, text.length * 70);

/**
 * The end of a launch that went wrong (or cost too much): black, a sad pad of strings, Flight's
 * last call over the radio, then the story a line at a time. The buttons arrive once it has been told.
 */
export function LaunchEndingScreen({
  ending,
  trace,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  traceLabel,
}: {
  ending: LaunchEnding;
  /** The engine's failure trace, shown small at the bottom as the flight data. */
  trace?: { key: string; time: string; text: string }[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  traceLabel: string;
}) {
  const localize = useLocalized();
  const skip = useT().missionControl.skipCinematic;
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  // 0 = Flight's call, 1..n = the story lines, n + 1 = told.
  const [stage, setStage] = useState(0);
  const total = ending.lines.length;

  // The room goes dark, a sad chord holds.
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), 60);
    const score = startScore("hush");
    return () => {
      window.clearTimeout(id);
      score.stop();
    };
  }, []);

  const call = localize(ending.call);
  const current = stage >= 1 && stage <= total ? localize(ending.lines[stage - 1]!) : null;

  // Flight's call first, then each line is read as it comes up.
  useVoiceLine(stage === 0 ? call : null, { delayMs: reduced ? 0 : 1500 });
  useVoiceLine(current, { queue: true });

  useEffect(() => {
    if (stage > total) return;
    const text = stage === 0 ? call : localize(ending.lines[stage - 1]!);
    const wait = (stage === 0 ? 1500 : 0) + (reduced ? 1200 : lineMs(text));
    const id = window.setTimeout(() => setStage((s) => s + 1), wait);
    return () => window.clearTimeout(id);
  }, [stage, total, call, ending, localize, reduced]);

  const told = stage > total;
  const accent = ending.tone === "loss" ? "#ff6b5e" : "#ffc247";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={localize(ending.title)}
      style={{ backgroundColor: "#000" }}
      className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 px-6 text-center transition-opacity duration-[2500ms]", visible ? "opacity-100" : "opacity-0")}
    >
      <header className="flex flex-col items-center gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-foreground/60">{localize(ending.tagline)}</p>
        <h1 className="text-4xl font-bold tracking-wide drop-shadow-[0_0_30px_currentColor] sm:text-6xl" style={{ color: accent }}>{localize(ending.title)}</h1>
      </header>

      <div className="flex min-h-[11rem] w-full max-w-2xl flex-col items-center gap-3 text-lg leading-relaxed text-foreground/90 sm:text-2xl">
        {stage === 0 && <p className="font-mono text-base italic text-primary/90 sm:text-lg">“{call}”</p>}
        {ending.lines.map((line, i) =>
          stage > i && stage <= total + 1 ? (
            <p key={i} className={cn("animate-fade-in", i === stage - 1 || told ? "opacity-100" : "opacity-50")}>
              {localize(line)}
            </p>
          ) : null,
        )}
      </div>

      {told && (
        <div className="flex animate-fade-in flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={onPrimary}>
              {primaryLabel}
            </Button>
            {secondaryLabel && onSecondary && (
              <Button size="lg" variant="secondary" onClick={onSecondary}>
                {secondaryLabel}
              </Button>
            )}
          </div>
          {trace && trace.length > 0 && (
            <details className="max-w-xl text-left text-xs text-foreground/60">
              <summary className="cursor-pointer text-center font-mono uppercase tracking-widest">{traceLabel}</summary>
              <ol className="mt-2 flex flex-col gap-1">
                {trace.map((s) => (
                  <li key={s.key} className="grid grid-cols-[4.5rem_1fr] gap-x-3">
                    <span className="font-mono">{s.time}</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}

      {!told && (
        <button type="button" onClick={() => setStage(total + 1)} className="absolute bottom-6 right-6 font-mono text-xs uppercase tracking-widest text-foreground/50 hover:text-foreground">
          {skip}
        </button>
      )}
    </div>
  );
}
