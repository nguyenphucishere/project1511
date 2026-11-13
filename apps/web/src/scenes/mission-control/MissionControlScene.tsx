"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { SignOffDialog } from "@/components/hud/SignOffDialog";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { BRIEFINGS } from "@/game/script";
import { useGameStore } from "@/game/gameStore";
import { useSceneViewpoints } from "@/game/sceneStore";
import { addTrauma } from "@/game/shake";
import { playSfx, startLoop } from "@/game/sfx";
import { launchSimulator } from "@/lib/simulation/launch.adapter";
import { TRACE_TEXT } from "@/lib/simulation/launch.mock";
import type { LaunchConfig, LaunchResult } from "@/lib/simulation/launch.types";
import { ConfigPanel } from "./ConfigPanel";
import { ControlRoomWorld } from "./ControlRoomWorld";
import { CountdownPanel, FlightPanel, PollPanel } from "./LaunchPanels";
import { formatMissionTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VIEWPOINTS } from "./layout";
import { realSecondsAt } from "./flight";

/** How long the liftoff roar lasts, in real time (the climb out of sight). */
const ROAR_MS = 8000;

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
  const recordLaunch = useGameStore((s) => s.recordLaunch);

  const [config, setConfig] = useState<LaunchConfig>(INITIAL_CONFIG);
  const [phase, setPhase] = useState<Phase>("config");
  const [attempt, setAttempt] = useState(1);
  // Sticky: once a configuration has gone to countdown, that objective stays ticked after a hold or a failure.
  const [configured, setConfigured] = useState(false);
  const [ignitionAt, setIgnitionAt] = useState<number | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [alarm, setAlarm] = useState(0);
  const pending = useRef<Promise<LaunchResult> | null>(null);
  // The liftoff roar is heard while the rocket is low; stopped early on adjust or leaving.
  const roar = useRef<() => void>(() => {});
  useEffect(() => () => roar.current(), []);
  const consoleRef = useRef<HTMLElement>(null);
  // The planning console can fold down to its title bar, to look at the pad and the room.
  const [collapsed, setCollapsed] = useState(false);

  useSceneViewpoints(VIEWPOINTS, "console");

  // The console scrolls on small screens; each phase starts at its top.
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: 0 });
    setCollapsed(false);
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
    playSfx("ignition");
    const stop = startLoop("engine", { gain: 0.3 });
    roar.current = stop;
    window.setTimeout(stop, ROAR_MS);
    setPhase("flight");
  }, []);

  const endFlight = useCallback(() => {
    if (!result) return;
    recordLaunch(config, result.isSuccess);
    if (result.isSuccess) {
      setPhase("orbit");
    } else {
      addTrauma(0.35);
      playSfx("alarm");
      setAlarm((a) => a + 1);
      setPhase("anomaly");
    }
  }, [config, result, recordLaunch]);

  const adjust = useCallback(() => {
    roar.current();
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
  // From the launch command on, the camera is outside and the console shrinks to a corner HUD.
  const launching = phase !== "config" && phase !== "poll";
  // When the last engine stops in the 3D view: orbit insertion, or stage 2 running dry.
  const burnEndT = result ? realSecondsAt(result.endSec) : Infinity;
  const overweight = result?.failureTrace.some((s) => s.code === "slow-climb") ?? false;

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={m.sceneLabel}>
      <WorldCanvas label={m.sceneLabel}>
        <ControlRoomWorld ignitionAt={ignitionAt} launchView={launching} burnEndT={burnEndT} />
      </WorldCanvas>

      {alarm > 0 && (
        <div key={alarm} aria-hidden className="pointer-events-none absolute inset-0 animate-alarm-flash bg-warning/35" />
      )}

      {/* On phones the corner flight HUD needs this space during the launch. */}
      <div className={cn("pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20", launching && "hidden sm:block")}>
        <ObjectivePanel
          className="pointer-events-auto"
          items={[
            { id: "configure", label: localize(briefing.objectives[0]), done: configured },
            { id: "launch", label: localize(briefing.objectives[1]), done: phase === "orbit" },
          ]}
        />
      </div>

      {launching ? (
        // Launch: only a small clock and the stage list in the top-right corner, so the
        // rocket (seen from outside) owns the screen.
        <aside
          aria-label={m.consoleLabel}
          className="absolute right-3 top-16 flex w-[15.5rem] flex-col gap-2 sm:right-8 sm:top-20"
        >
          {phase === "countdown" && <CountdownPanel onIgnition={ignite} onHold={() => setPhase("poll")} />}
          {phase !== "countdown" && result && ignitionAt !== null && (
            <FlightPanel config={config} result={result} ignitionAt={ignitionAt} onEnd={endFlight} />
          )}
        </aside>
      ) : (
        <aside
          ref={consoleRef}
          aria-label={m.consoleLabel}
          className={cn(
            "bezel absolute inset-x-3 bottom-3 overflow-y-auto bg-space-deep/95 p-3.5",
            "sm:inset-x-auto sm:bottom-auto sm:right-8 sm:top-20 sm:w-[21rem] sm:max-h-[calc(100dvh-6.5rem)]",
            collapsed ? "max-h-none" : "max-h-[50dvh]",
          )}
        >
          <header className={cn("flex items-center justify-between gap-2", !collapsed && "mb-3")}>
            <h2 className="text-base font-semibold">{titles[phase]}</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-foreground/70">{format(m.attempt, { n: attempt })}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 px-0"
                onClick={() => setCollapsed((c) => !c)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? m.expand : m.collapse}
                title={collapsed ? m.expand : m.collapse}
              >
                {collapsed ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronUp className="h-4 w-4" aria-hidden />}
              </Button>
            </div>
          </header>

          {!collapsed && phase === "config" && (
            <ConfigPanel config={config} onChange={setConfig} assessment={assessment} onProceed={() => setPhase("poll")} />
          )}
          {!collapsed && phase === "poll" && (
            <PollPanel assessment={assessment} onLaunch={startCountdown} onBack={() => setPhase("config")} />
          )}
        </aside>
      )}

      <Dialog open={phase === "anomaly"}>
        <DialogContent locked>
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

      <SignOffDialog
        open={phase === "orbit"}
        character="flight-director"
        badge={m.go}
        title={m.orbitTitle}
        description={format(m.orbitBody, { km: config.orbitKm })}
        continueLabel={m.continue}
        onContinue={onComplete}
      />
    </section>
  );
}
