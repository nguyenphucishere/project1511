"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/game/gameStore";
import { ENDINGS_CATALOG, getEnding, type EndingDefinition } from "@/game/endings";
import { DECISIONS, type DecisionId } from "@/game/decisions";
import { useLocalized } from "@/i18n/useT";

export default function DebriefPage() {
  const localize = useLocalized();
  const endingIdFromStore = useGameStore((s) => s.endingId);
  const narrativeEndingFromStore = useGameStore((s) => s.narrative.ending);
  const currentEndingId = endingIdFromStore ?? narrativeEndingFromStore ?? "ending-1";
  const narrative = useGameStore((s) => s.narrative);
  const [selectedEndingId, setSelectedEndingId] = useState<string>(currentEndingId);

  const ending: EndingDefinition = getEnding(selectedEndingId) ?? ENDINGS_CATALOG["ending-1"];

  const endingKeys = ["ending-1", "ending-2", "ending-3", "ending-4", "ending-5"] as const;

  const decisionPoints: { id: DecisionId; label: string; pointKey: string }[] = [
    { id: "workshop-decision", label: "1. Workshop LOX Inspection Rigor", pointKey: "inspection" },
    { id: "weather-decision", label: "2. Launch Window & Weather Call", pointKey: "weather" },
    { id: "trajectory-decision", label: "3. Translunar Trajectory Profile", pointKey: "trajectory" },
    { id: "agc-alarm-decision", label: "4. AGC 1201/1202 Program Alarm Call", pointKey: "agc_alarm" },
    { id: "landing-decision", label: "5. P66 Final Approach & Touchdown Call", pointKey: "landing_approach" },
  ];

  return (
    <main className="min-h-screen bg-space-deep text-foreground px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Navigation & Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-space-blue pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                APOLLO 11 MISSION ARCHIVE // POST-FLIGHT EVALUATION
              </p>
            </div>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
              Mission Debrief & Technical Telemetry
            </h1>
            <p className="text-sm text-foreground/75 font-mono mt-1">
              Authoritative Reference: NASA SP-238 (Apollo 11 Mission Report) & SP-4029
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/">&larr; Return to Title</Link>
            </Button>
          </div>
        </header>

        {/* Ending Selector Tabs */}
        <section aria-labelledby="endings-tabs" className="space-y-3">
          <h2 id="endings-tabs" className="text-xs font-mono uppercase tracking-wider text-primary">
            Select Mission Outcome Scenario:
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {endingKeys.map((key) => {
              const def = ENDINGS_CATALOG[key];
              const isSelected = selectedEndingId === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedEndingId(key)}
                  className={`p-2.5 text-left rounded border font-mono text-xs transition-all ${
                    isSelected
                      ? "border-primary bg-primary/20 text-foreground font-semibold shadow-md"
                      : "border-space-blue/60 bg-space-deep/80 text-foreground/70 hover:border-space-blue hover:text-foreground"
                  }`}
                >
                  <div className="text-[10px] uppercase text-primary/80">Scenario {key.replace("ending-", "")}</div>
                  <div className="truncate mt-0.5">{localize(def.badgeText)}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Main Debrief Dossier */}
        <article className="bezel bezel-gold bg-space-deep/95 p-6 sm:p-8 space-y-6">
          {/* Badge & Title */}
          <div className="border-b border-space-blue/60 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded border border-primary/40 bg-primary/20 text-primary">
                {localize(ending.badgeText)} &bull; OUTCOME SCORE: {ending.score}/100
              </span>
              <span className="font-mono text-xs text-foreground/60">
                STATUS: {ending.status.toUpperCase()}
              </span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-foreground">
              {localize(ending.title)}
            </h2>
            <p className="text-sm font-medium text-primary mt-1">
              {localize(ending.subtitle)}
            </p>
          </div>

          {/* Historical Transmission Box */}
          <div className="bg-space-blue/20 border-l-4 border-primary p-4 rounded-r">
            <p className="font-mono text-xs text-primary mb-1">AIR-TO-GROUND VOICE TRANSCRIPT:</p>
            <blockquote className="italic text-base sm:text-lg text-foreground font-serif">
              &ldquo;{ending.quote}&rdquo;
            </blockquote>
            <p className="text-right font-mono text-xs text-foreground/70 mt-2">
              — {ending.quoteAttribution}
            </p>
          </div>

          {/* Debrief Report Text */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-primary">
              Mission Flight Controller Analysis:
            </h3>
            {ending.debriefReport.map((paragraph, idx) => (
              <p key={idx} className="text-sm leading-relaxed text-foreground/90">
                {localize(paragraph)}
              </p>
            ))}
          </div>

          {/* William Safire Contingency Address */}
          {ending.contingencySpeechText && (
            <div className="border border-red-900/60 bg-red-950/20 p-5 rounded space-y-2">
              <p className="font-mono text-xs font-bold text-red-400">
                WHITE HOUSE MEMORANDUM // PRESIDENTIAL CONTINGENCY ARCHIVE (JULY 18, 1969)
              </p>
              <p className="text-xs font-mono text-foreground/60">
                Author: William Safire &bull; Intended for: President Richard M. Nixon
              </p>
              <blockquote className="mt-2 text-xs sm:text-sm italic text-foreground/90 leading-relaxed border-l-2 border-red-500 pl-3">
                &ldquo;{localize(ending.contingencySpeechText)}&rdquo;
              </blockquote>
            </div>
          )}

          {/* Telemetry Snapshot Grid */}
          <div className="space-y-3 pt-2 border-t border-space-blue/60">
            <h3 className="text-xs font-mono uppercase tracking-wider text-primary">
              Descent / Touchdown Engineering Telemetry:
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">TIME / GET</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.getTouchdown}</div>
              </div>
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">COORDINATES</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.coordinates ?? "N/A"}</div>
              </div>
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">TERMINAL Vz</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.terminalVzMs.toFixed(2)} m/s</div>
              </div>
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">SURFACE TILT</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.surfaceTiltDeg.toFixed(1)}&deg;</div>
              </div>
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">FUEL REMAINING</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.fuelRemainingPct.toFixed(1)}%</div>
              </div>
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">HOVER MARGIN</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.fuelHoverMarginSeconds.toFixed(1)}s</div>
              </div>
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">LUNAR SAMPLES</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.lunarSamplesKg} kg</div>
              </div>
              <div className="bg-space-blue/30 p-3 rounded">
                <div className="text-foreground/60 text-[10px]">EASEP DEPLOYED</div>
                <div className="font-bold text-foreground mt-1">{ending.telemetry.scienceDeployed ? "YES (PSEP + LRRR)" : "NO"}</div>
              </div>
            </div>
          </div>
        </article>

        {/* Decision Branching Log for Current Run */}
        <section aria-labelledby="current-run-decisions" className="bezel bg-space-deep/90 p-6 space-y-4">
          <h2 id="current-run-decisions" className="text-sm font-mono uppercase tracking-wider text-primary">
            Active Run Decision Audit:
          </h2>
          <div className="space-y-2">
            {decisionPoints.map((dp) => {
              const choiceId = narrative.decisions[dp.pointKey] ?? (dp.pointKey === "agc_alarm" ? narrative.decisions.agcAlarm : dp.pointKey === "landing_approach" ? narrative.decisions.landing : null);
              const decDef = DECISIONS[dp.id];
              const optDef = decDef.options.find((o) => o.id === choiceId);
              return (
                <div
                  key={dp.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded bg-space-blue/20 border border-space-blue/50 text-xs font-mono"
                >
                  <span className="text-foreground/80 font-sans">{dp.label}:</span>
                  <span className="flex items-center gap-2">
                    <span className={choiceId ? "font-bold text-primary" : "text-foreground/40"}>
                      {optDef ? localize(optDef.title) : "Not recorded in this run"}
                    </span>
                    {optDef?.historical && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-800">
                        HISTORIC
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
