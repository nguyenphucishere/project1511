"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useGameStore } from "@/game/gameStore";
import { ENDINGS, getEnding } from "@/game/endings";
import { DECISIONS, type DecisionId } from "@/game/decisions";
import { ROCKET_PARTS } from "@/mocks/rocket-parts";
import { PAYLOADS, VEHICLES } from "@/mocks/launch-options";
import { ParallaxCanvas } from "./ParallaxCanvas";

/**
 * Apollo 11 Multiple Ending Screen:
 * Renders dedicated ending badges, historical transcripts, presidential contingency addresses,
 * full decision audit trail, and mission telemetry.
 */
export function EndScreen() {
  const t = useT();
  const e = t.end;
  const localize = useLocalized();
  const newGame = useGameStore((s) => s.newGame);
  const log = useGameStore((s) => s.log);
  const narrative = useGameStore((s) => s.narrative);
  const endingId = useGameStore((s) => s.endingId) ?? narrative.ending ?? (log.landing ? "ending-1" : "ending-1");

  const ending = getEnding(endingId) ?? ENDINGS["ending-1"];

  const cfg = log.launchConfig;
  const vehicle = cfg && VEHICLES.find((v) => v.id === cfg.vehicle);
  const payload = cfg && PAYLOADS.find((p) => p.id === cfg.payload);

  const statusBadgeColor =
    ending.status === "success"
      ? "bg-emerald-950/80 border-emerald-600 text-emerald-300"
      : ending.status === "partial"
        ? "bg-amber-950/80 border-amber-600 text-amber-300"
        : "bg-red-950/80 border-red-600 text-red-300";

  const decisionPoints: { id: DecisionId; label: string; pointKey: string }[] = [
    { id: "workshop-decision", label: "1. Workshop LOX Inspection", pointKey: "inspection" },
    { id: "weather-decision", label: "2. Launch Window & Weather", pointKey: "weather" },
    { id: "trajectory-decision", label: "3. Translunar Trajectory", pointKey: "trajectory" },
    { id: "agc-alarm-decision", label: "4. AGC 1201/1202 Alarm", pointKey: "agc_alarm" },
    { id: "landing-decision", label: "5. P66 Final Approach", pointKey: "landing_approach" },
  ];

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="end-title">
      <ParallaxCanvas
        mode="drift"
        horizon={ending.normalizedId === "ending-1" || ending.normalizedId === "ending-3"}
        className="absolute inset-0"
      />

      <div className="absolute inset-0 overflow-y-auto px-4 py-[8dvh]">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          {/* Ending Status Badge */}
          <div className={`font-mono text-xs font-semibold tracking-widest px-3 py-1 rounded border uppercase ${statusBadgeColor} animate-fade-in`}>
            {localize(ending.badgeText)} &bull; SCORE: {ending.score}/100
          </div>

          {/* Ending Title and Subtitle */}
          <div>
            <h1 id="end-title" className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
              {localize(ending.title)}
            </h1>
            <p className="mt-1 text-sm sm:text-base text-primary/90 font-medium">
              {localize(ending.subtitle)}
            </p>
          </div>

          {/* Historical Transmission Quote */}
          <div className="bezel bezel-gold w-full bg-space-deep/95 p-4 sm:p-5 text-left">
            <p className="font-mono text-xs text-primary mb-1">HISTORICAL TRANSMISSION ARCHIVE:</p>
            <blockquote className="border-l-2 border-primary pl-3.5 italic text-base sm:text-lg text-foreground/95">
              &ldquo;{ending.quote}&rdquo;
            </blockquote>
            <p className="mt-2 text-right font-mono text-xs text-foreground/60">
              — {ending.quoteAttribution}
            </p>
          </div>

          {/* Mission Debrief Report */}
          <div className="bezel w-full bg-space-deep/90 p-4 sm:p-5 text-left">
            <h2 className="text-sm font-mono uppercase tracking-wider text-primary mb-2 flex items-center justify-between">
              <span>MISSION DEBRIEF REPORT</span>
              <span className="text-[11px] text-foreground/60 font-normal">CLASSIFIED // NASA SP-238</span>
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-foreground/85 leading-relaxed">
              {ending.debriefReport.map((paragraph, idx) => (
                <p key={idx}>{localize(paragraph)}</p>
              ))}
            </div>

            {/* William Safire Contingency Address (if triggered) */}
            {ending.contingencySpeechText && (
              <div className="mt-4 pt-3 border-t border-red-900/60 bg-red-950/20 p-3 rounded">
                <p className="font-mono text-xs text-red-400 font-bold mb-1">
                  PRESIDENTIAL CONTINGENCY ADDRESS // WHITE HOUSE (WILLIAM SAFIRE, JULY 18, 1969):
                </p>
                <p className="text-xs italic text-foreground/85 leading-relaxed">
                  &ldquo;{localize(ending.contingencySpeechText)}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Decision Log Audit Trail */}
          <div className="bezel w-full bg-space-deep/90 p-4 sm:p-5 text-left">
            <h2 className="text-sm font-mono uppercase tracking-wider text-primary mb-3">
              NARRATIVE BRANCH AUDIT TRAIL
            </h2>
            <div className="flex flex-col gap-1.5 font-mono text-xs">
              {decisionPoints.map((dp) => {
                const choiceId = narrative.decisions[dp.pointKey] ?? (dp.pointKey === "agc_alarm" ? narrative.decisions.agcAlarm : dp.pointKey === "landing_approach" ? narrative.decisions.landing : null);
                const decDef = DECISIONS[dp.id];
                const optDef = decDef.options.find((o) => o.id === choiceId);
                const chosenText = optDef ? localize(optDef.title) : e.notPlayed;
                const isHist = optDef?.historical;

                return (
                  <div
                    key={dp.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-space-blue/30 px-3 py-1.5 rounded border border-space-blue/50"
                  >
                    <span className="text-foreground/75 font-sans font-medium">{dp.label}:</span>
                    <span className="flex items-center gap-2">
                      <span className={choiceId ? "text-foreground font-semibold" : "text-foreground/45"}>
                        {chosenText}
                      </span>
                      {isHist && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800">
                          HISTORIC
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mission Telemetry Summary */}
          <div className="bezel w-full bg-space-deep/90 p-4 sm:p-5 text-left">
            <h2 className="text-sm font-mono uppercase tracking-wider text-primary mb-3">
              FLIGHT & TELEMETRY SUMMARY
            </h2>
            <dl className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
              <div className="bg-space-blue/20 p-2 rounded">
                <dt className="text-foreground/60 text-[11px]">LAUNCH ATTEMPTS</dt>
                <dd className="text-sm font-bold text-foreground mt-0.5">{log.launchAttempts || 1}</dd>
              </div>
              <div className="bg-space-blue/20 p-2 rounded">
                <dt className="text-foreground/60 text-[11px]">PARTS INSPECTED</dt>
                <dd className="text-sm font-bold text-foreground mt-0.5">
                  {log.partsInspected > 0 ? `${log.partsInspected}/${ROCKET_PARTS.length}` : "4/4"}
                </dd>
              </div>
              <div className="bg-space-blue/20 p-2 rounded">
                <dt className="text-foreground/60 text-[11px]">TOUCHDOWN SPEED</dt>
                <dd className="text-sm font-bold text-foreground mt-0.5">
                  {ending.telemetry.terminalVxMs ? `${ending.telemetry.terminalVxMs.toFixed(1)} m/s` : "0.5 m/s"}
                </dd>
              </div>
              <div className="bg-space-blue/20 p-2 rounded">
                <dt className="text-foreground/60 text-[11px]">HOVER MARGIN</dt>
                <dd className="text-sm font-bold text-foreground mt-0.5">
                  {ending.telemetry.fuelHoverMarginSeconds ? `${ending.telemetry.fuelHoverMarginSeconds}s` : "25.0s"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Interactive Navigation */}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={newGame}>
              {e.playAgain} (Explore Branch)
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/debrief">Full Mission Debrief</Link>
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
