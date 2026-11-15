"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LAUNCH_ENDINGS, type LaunchEndingId } from "@/scenes/mission-control/launchEndings";
import { LaunchEndingScreen } from "@/scenes/mission-control/LaunchEndingScreen";
import { useLocalized } from "@/i18n/useT";
import { AscentScene } from "@/scenes/ascent/AscentScene";
import type { AscentFailure, FailureCode } from "@/game/ascentFlight";

/** Mission time (s) at which each kind of failure hits, roughly where the engine puts it. */
const FLIGHTS: [FailureCode, number][] = [
  ["structural", 83],
  ["fuel-depleted", 520],
  ["slow-climb", 60],
  ["wind-shear", 90],
  ["lightning", 70],
];

/** Developer page: play each launch ending on its own, without flying the mission. Not part of the game flow. */
export default function EndingsPreview() {
  const localize = useLocalized();
  const [id, setId] = useState<LaunchEndingId | null>(null);
  const [flight, setFlight] = useState<AscentFailure | null>(null);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8">
      <h1 className="text-xl font-semibold">Launch endings</h1>
      {Object.values(LAUNCH_ENDINGS).map((e) => (
        <Button key={e.id} variant="secondary" onClick={() => setId(e.id)}>
          {localize(e.title)}
        </Button>
      ))}
      <h2 className="mt-4 text-lg font-semibold">Doomed flights (cabin cutaways)</h2>
      {FLIGHTS.map(([code, met]) => (
        <Button key={code} variant="secondary" onClick={() => setFlight({ code, met })}>
          {code}
        </Button>
      ))}
      {flight && (
        <div className="fixed inset-0 z-40 bg-black">
          <AscentScene key={flight.code} failure={flight} orbitKm={185} onComplete={() => setFlight(null)} />
        </div>
      )}
      {id && (
        <LaunchEndingScreen
          key={id}
          ending={LAUNCH_ENDINGS[id]}
          traceLabel="Failure trace"
          trace={[{ key: "a", time: "T+02:41", text: "Structure: max-Q breakup" }]}
          primaryLabel="Close"
          onPrimary={() => setId(null)}
        />
      )}
    </main>
  );
}
