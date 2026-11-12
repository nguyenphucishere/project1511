"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { BRIEFINGS } from "@/game/script";
import { useGameStore } from "@/game/gameStore";
import { useSceneStore } from "@/game/sceneStore";
import { addTrauma } from "@/game/shake";
import { launchSimulator } from "@/lib/simulation/launch.adapter";
import { TRACE_TEXT } from "@/lib/simulation/launch.mock";
import type { LaunchConfig, LaunchResult } from "@/lib/simulation/launch.types";
import { ConfigPanel } from "./ConfigPanel";
import { ControlRoomWorld } from "./ControlRoomWorld";
import { CountdownPanel, FlightPanel, PollPanel } from "./LaunchPanels";
import { formatMissionTime } from "./flight";
import { VIEWPOINTS } from "./layout";

type Phase = "config" | "poll" | "countdown" | "flight" | "anomaly" | "orbit";

/**
 * First attempt as the player finds it: the heavy rocket, the right payload, but 90 % fuel and
 * the windy first window. The poll teaches the weather rule; the flight teaches the fuel one.
 */
const INITIAL_CONFIG: LaunchConfig = { vehicle: "saros", payload: "standard", fuelPct: 90, orbitKm: 185, window: "w1" };

/**
 * Scene 3 — mission control (flight director POV).
 * Loop: configure → GO/NO-GO poll → countdown → liftoff and flight playback → on failure the
 * ANOMALY report and back to configure; on success orbit, then the launch video.
 */
export function MissionControlScene({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const m = t.missionControl;
  const localize = useLocalized();
  const setViewpoints = useSceneStore((s) => s.setViewpoints);
  const resetScene = useSceneStore((s) => s.reset);
  const recordLaunch = useGameStore((s) => s.recordLaunch);

  const [config, setConfig] = useState<LaunchConfig>(INITIAL_CONFIG);
  const [phase, setPhase] = useState<Phase>("config");
  const [attempt, setAttempt] = useState(1);
  const [ignitionAt, setIgnitionAt] = useState<number | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [alarm, setAlarm] = useState(0);
  // Sticky: once a configuration has gone to countdown, that objective stays ticked after a failure.
  const [configured, setConfigured] = useState(false);
  const pending = useRef<Promise<LaunchResult> | null>(null);
  const consoleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setViewpoints(VIEWPOINTS, "console");
    return resetScene;
  }, [setViewpoints, resetScene]);

  // The console scrolls on small screens; each phase starts at its top.
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: 0 });
  }, [phase]);

  const assessment = useMemo(() => launchSimulator.assess(config), [config]);

  const startCountdown = useCallback(() => {
    // Ask the simulator during the countdown, so the result is ready at T-0.
    pending.current = launchSimulator.simulate(config);
    setConfigured(true);
    setPhase("countdown");
  }, [config]);

  const ignite = useCallback(async () => {
    const r = await pending.current;
    if (!r) return;
    setResult(r);
    setIgnitionAt(performance.now());
    addTrauma(0.45);
    setPhase("flight");
  }, []);

  const endFlight = useCallback(() => {
    if (!result) return;
    recordLaunch(config, result.isSuccess);
    if (result.isSuccess) {
      setPhase("orbit");
    } else {
      addTrauma(0.35);
      setAlarm((a) => a + 1);
      setPhase("anomaly");
    }
  }, [config, result, recordLaunch]);

  const adjust = useCallback(() => {
    setIgnitionAt(null); // the replacement vehicle is back on the pad
    setResult(null);
    setAttempt((a) => a + 1);
    setPhase("config");
  }, []);

  const briefing = BRIEFINGS["mission-control"];
  const titles: Record<Phase, string> = {
    config: m.configTitle,
    poll: m.pollTitle,
    countdown: m.countdownTitle,
    flight: m.flightTitle,
    anomaly: m.flightTitle,
    orbit: m.flightTitle,
  };
  const overweight = result?.failureTrace.some((s) => s.code === "slow-climb") ?? false;

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={m.sceneLabel}>
      <WorldCanvas label={m.sceneLabel}>
        <ControlRoomWorld ignitionAt={ignitionAt} />
      </WorldCanvas>

      {alarm > 0 && (
        <div key={alarm} aria-hidden className="pointer-events-none absolute inset-0 animate-alarm-flash bg-warning/35" />
      )}

      <div className="pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20">
        <ObjectivePanel
          className="pointer-events-auto"
          items={[
            { id: "configure", label: localize(briefing.objectives[0]), done: configured },
            { id: "launch", label: localize(briefing.objectives[1]), done: phase === "orbit" },
          ]}
        />
      </div>

      <aside
        ref={consoleRef}
        aria-label={m.consoleLabel}
        className="bezel absolute inset-x-3 bottom-3 max-h-[56dvh] overflow-y-auto bg-space-deep/95 p-4 sm:inset-x-auto sm:bottom-6 sm:right-8 sm:top-20 sm:max-h-none sm:w-[27rem] sm:p-5"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{titles[phase]}</h2>
          <span className="font-mono text-xs text-foreground/70">{format(m.attempt, { n: attempt })}</span>
        </header>

        {phase === "config" && (
          <ConfigPanel config={config} onChange={setConfig} assessment={assessment} onProceed={() => setPhase("poll")} />
        )}
        {phase === "poll" && (
          <PollPanel assessment={assessment} onLaunch={startCountdown} onBack={() => setPhase("config")} />
        )}
        {phase === "countdown" && <CountdownPanel onIgnition={ignite} onHold={() => setPhase("poll")} />}
        {(phase === "flight" || phase === "anomaly" || phase === "orbit") && result && ignitionAt !== null && (
          <FlightPanel config={config} result={result} ignitionAt={ignitionAt} onEnd={endFlight} />
        )}
      </aside>

      <Dialog open={phase === "anomaly"} onOpenChange={() => {}}>
        <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <StatusBadge status="fault" className="mb-2 w-fit">
              {m.anomalyTitle}
            </StatusBadge>
            <DialogTitle className="text-2xl">{m.anomalyTitle}</DialogTitle>
            <DialogDescription>{m.anomalyBody}</DialogDescription>
          </DialogHeader>
          <section aria-labelledby="trace-title" className="bg-space-blue/35 px-4 py-3">
            <h3 id="trace-title" className="mb-2 text-sm font-medium">
              {m.traceTitle}
            </h3>
            <ol className="flex flex-col gap-2 text-sm">
              {result?.failureTrace.map((s) => (
                <li key={`${s.code}-${s.timestampSec}`} className="grid grid-cols-[4.5rem_1fr] gap-x-3">
                  <span className="font-mono text-xs leading-5">{formatMissionTime(s.timestampSec)}</span>
                  <span>
                    <span className="font-medium">
                      {localize(TRACE_TEXT[s.code].subsystem)}: {localize(TRACE_TEXT[s.code].anomaly)}
                    </span>
                    <span className="block text-foreground/75">{localize(TRACE_TEXT[s.code].consequence)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <div>
            <h3 className="text-sm font-medium">{m.whatToChange}</h3>
            <p className="mt-1 text-sm text-foreground/85">{overweight ? m.adviceOverweight : m.adviceFuel}</p>
            <p className="mt-2 text-xs text-foreground/65">{m.replacement}</p>
          </div>
          <StatusBadge status="demo" className="w-fit">
            {t.common.demoData}
          </StatusBadge>
          <DialogFooter>
            <Button size="lg" onClick={adjust}>
              {m.adjust}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phase === "orbit"} onOpenChange={() => {}}>
        <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mb-2 flex items-end gap-4">
              <div className="h-20 w-16 shrink-0">
                <CharacterPortrait character="flight-director" />
              </div>
              <StatusBadge status="go" className="mb-1">
                {m.go}
              </StatusBadge>
            </div>
            <DialogTitle className="text-2xl">{m.orbitTitle}</DialogTitle>
            <DialogDescription>{format(m.orbitBody, { km: config.orbitKm })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="lg" onClick={onComplete}>
              {m.continue}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
