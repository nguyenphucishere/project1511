"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useGameStore } from "@/game/gameStore";
import { ROCKET_PARTS } from "@/mocks/rocket-parts";
import { PAYLOADS, VEHICLES } from "@/mocks/launch-options";
import { ParallaxCanvas } from "./ParallaxCanvas";

/** Final screen after the epilogue: the mission summary from the run's log, and Play again. */
export function EndScreen() {
  const t = useT();
  const e = t.end;
  const localize = useLocalized();
  const newGame = useGameStore((s) => s.newGame);
  const log = useGameStore((s) => s.log);

  const cfg = log.launchConfig;
  const vehicle = cfg && VEHICLES.find((v) => v.id === cfg.vehicle);
  const payload = cfg && PAYLOADS.find((p) => p.id === cfg.payload);

  // Chapters can be jumped to from the dev menu, so any row may be missing from this run.
  const rows: [string, string | null][] = [
    [e.launches, log.launchAttempts > 0 ? String(log.launchAttempts) : null],
    [
      e.partsInspected,
      log.partsInspected > 0 ? format(e.partsValue, { n: log.partsInspected, total: ROCKET_PARTS.length }) : null,
    ],
    [
      e.launchConfig,
      cfg && vehicle && payload
        ? format(e.configValue, { vehicle: vehicle.name, payload: localize(payload.name), fuel: cfg.fuelPct, orbit: cfg.orbitKm })
        : null,
    ],
    [
      e.touchdown,
      log.landing
        ? format(e.touchdownValue, { speed: log.landing.touchdownMs.toFixed(1), fuel: log.landing.fuelLeftPct })
        : null,
    ],
  ];

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="end-title">
      <ParallaxCanvas mode="drift" horizon className="absolute inset-0" />
      <div className="absolute inset-0 overflow-y-auto px-4 py-[12dvh]">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h1 id="end-title" className="text-4xl font-semibold sm:text-5xl">
            {e.title}
          </h1>
          <p className="max-w-[44ch] text-lg text-foreground/85">{e.body}</p>

          <section aria-labelledby="summary-title" className="bezel mt-2 w-full bg-space-deep/90 p-4 text-left sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="summary-title" className="text-lg font-semibold">
                {e.summaryTitle}
              </h2>
              <StatusBadge status="demo">{t.common.demoData}</StatusBadge>
            </div>
            <dl className="flex flex-col gap-px bg-space-blue/60">
              {rows.map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 bg-space-deep px-3 py-2">
                  <dt className="text-sm text-foreground/80">{label}</dt>
                  <dd className={value ? "font-mono text-sm" : "text-sm text-foreground/55"}>{value ?? e.notPlayed}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="text-sm text-foreground/75">{e.homeHint}</p>
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
