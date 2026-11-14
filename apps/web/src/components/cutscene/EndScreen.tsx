"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLocalized, useT } from "@/i18n/useT";
import { useGameStore } from "@/game/gameStore";
import { ENDINGS, getEnding } from "@/game/endings";
import { DECISIONS, type DecisionId } from "@/game/decisions";
import { causeChain } from "@/game/consequences";
import { EndingScene } from "./EndingScene";
import { ParallaxCanvas } from "./ParallaxCanvas";

const CALLS: { id: DecisionId; pointKey: string }[] = [
  { id: "workshop-decision", pointKey: "inspection" },
  { id: "weather-decision", pointKey: "weather" },
  { id: "trajectory-decision", pointKey: "trajectory" },
  { id: "agc-alarm-decision", pointKey: "agc_alarm" },
  { id: "landing-decision", pointKey: "landing_approach" },
];

/**
 * The ending: which one you earned, one line from history, one short paragraph on what happened
 * and the five calls you made. The long debrief lives on its own page.
 */
export function EndScreen() {
  const t = useT();
  const e = t.end;
  const localize = useLocalized();
  const newGame = useGameStore((s) => s.newGame);
  const narrative = useGameStore((s) => s.narrative);
  const endingId = useGameStore((s) => s.endingId) ?? narrative.ending ?? "ending-1";
  const ending = getEnding(endingId) ?? ENDINGS["ending-1"];

  // What each call cost or bought, plus the forced wave-off when earlier shortcuts ran out the fuel.
  const chain = causeChain(narrative);
  const effectOf = (pointKey: string) => chain.find((c) => c.id.startsWith(`${pointKey}:`) && !c.id.endsWith(":margin"));
  const marginRunOut = chain.find((c) => c.id.endsWith(":margin"));
  const marker = { positive: ["▲", "text-emerald-400"], negative: ["▼", "text-red-400"], neutral: ["■", "text-amber-300"] } as const;

  const badgeColor =
    ending.status === "success"
      ? "border-emerald-600 bg-emerald-950/80 text-emerald-300"
      : ending.status === "partial"
        ? "border-amber-600 bg-amber-950/80 text-amber-300"
        : "border-red-600 bg-red-950/80 text-red-300";

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="end-title">
      <ParallaxCanvas
        mode="drift"
        horizon={ending.normalizedId === "ending-1" || ending.normalizedId === "ending-3"}
        className="absolute inset-0"
      />

      <div className="absolute inset-0 overflow-y-auto px-4 py-[8dvh]">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <div className={`animate-fade-in rounded border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest ${badgeColor}`}>
            {localize(ending.badgeText)} · {ending.score}/100
          </div>

          <div>
            <h1 id="end-title" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {localize(ending.title)}
            </h1>
            <p className="mt-1 text-base font-medium text-primary/90">{localize(ending.subtitle)}</p>
          </div>

          <EndingScene ending={ending} />

          <blockquote className="bezel bezel-gold w-full bg-space-deep/95 p-4 text-left sm:p-5">
            <p className="border-l-2 border-primary pl-3.5 text-base italic text-foreground/95 sm:text-lg">
              &ldquo;{ending.quote}&rdquo;
            </p>
            <footer className="mt-2 text-right text-xs text-foreground/60">{ending.quoteAttribution}</footer>
          </blockquote>

          {ending.debriefReport[0] && (
            <p className="w-full text-left text-sm leading-relaxed text-foreground/85 sm:text-base">
              {localize(ending.debriefReport[0])}
            </p>
          )}

          <ul className="flex w-full flex-wrap justify-center gap-2 text-xs" aria-label={t.consequence.whyTitle}>
            {CALLS.map(({ id, pointKey }) => {
              const choice =
                narrative.decisions[pointKey] ??
                (pointKey === "agc_alarm" ? narrative.decisions.agcAlarm : pointKey === "landing_approach" ? narrative.decisions.landing : undefined);
              const option = DECISIONS[id].options.find((o) => o.id === choice);
              const effect = option ? effectOf(pointKey) : undefined;
              return (
                <li key={id} className="rounded border border-space-blue/60 bg-space-blue/25 px-2.5 py-1 text-left">
                  {effect && (
                    <span aria-hidden className={`mr-1 ${marker[effect.impact][1]}`}>
                      {marker[effect.impact][0]}
                    </span>
                  )}
                  <span className="text-foreground/60">{localize(DECISIONS[id].title)}: </span>
                  <span className={option ? "font-semibold text-foreground" : "text-foreground/45"}>
                    {option ? localize(option.title) : e.notPlayed}
                  </span>
                  {effect && <span className="block text-[11px] text-foreground/60">{localize(effect.effect)}</span>}
                </li>
              );
            })}
            {marginRunOut && (
              <li className="rounded border border-red-700/60 bg-red-950/40 px-2.5 py-1 text-left">
                <span aria-hidden className="mr-1 text-red-400">▼</span>
                <span className="font-semibold text-foreground">{localize(marginRunOut.title)}</span>
                <span className="block text-[11px] text-foreground/60">{localize(marginRunOut.effect)}</span>
              </li>
            )}
          </ul>

          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={newGame}>
              {e.playAgain}
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/">{e.backToTitle}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
