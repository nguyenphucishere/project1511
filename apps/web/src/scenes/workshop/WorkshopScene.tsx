"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { HotspotList } from "@/components/hud/HotspotList";
import { ObjectivePanel } from "@/components/hud/ObjectivePanel";
import { SignOffDialog, SignOffDetails } from "@/components/hud/SignOffDialog";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";
import { CHARACTERS } from "@/game/characters";
import { isTypingTarget } from "@/game/input";
import { playSfx, speak, stopSpeaking } from "@/game/sfx";
import { BRIEFINGS } from "@/game/script";
import { useGameStore } from "@/game/gameStore";
import { useSceneStore, useSceneViewpoints } from "@/game/sceneStore";
import { addTrauma } from "@/game/shake";
import { useSettingsStore } from "@/game/settingsStore";
import { ROCKET_PARTS, TOTAL_MASS_T, type LevelId, type PartId } from "@/mocks/rocket-parts";
import { checkStation, type StationId } from "./checks";
import { PA_LINES, SAY, UI, type Line } from "./content";
import type { CraneEvent } from "./crane";
import { advanceCrane, createRig, startLift } from "./CraneRig";
import { FAULTS, SCAN_SECONDS, type FaultId } from "./faults";
import { ALL_VIEWPOINTS, CRANE_LIFTS, VIEWPOINTS } from "./layout";
import { DEFAULT_LOADOUT, assessLoadout, type Loadout } from "./loadout";
import { PartPanel } from "./PartPanel";
import { Callout, ChecklistPanel, CraneHud, LoadoutPanel, PaStrip, PressureGame, ScanHud, ScanOverlay } from "./WorkshopHud";
import { WorkshopWorld, type Phase } from "./WorkshopWorld";
import { pa } from "./Workers";
import type { LocalizedText } from "@/i18n";

const LEVEL_COUNT = VIEWPOINTS.length;

/**
 * Scene 2 — assembly hall (launch engineer POV).
 * Beats: stack the rocket with the gantry crane → walk the hall and inspect every part (with the
 * scanner's inside view) → hunt four hidden faults against the clock → run the pre-flight
 * checklist in order → choose engines and tanks → Chief Bao signs off and the build carries on
 * to the launch console.
 */
export function WorkshopScene({ onComplete }: { onComplete: () => void }) {
  const t = useT();
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const goTo = useSceneStore((s) => s.goTo);
  const recenter = useSceneStore((s) => s.recenter);
  /** Back to the hall floor, facing the rocket. */
  const toFloor = useCallback(() => {
    goTo("floor");
    recenter();
  }, [goTo, recenter]);
  const recordParts = useGameStore((s) => s.recordParts);
  const recordLoadout = useGameStore((s) => s.recordLoadout);
  const viewpoint = useSceneStore((s) => s.viewpointId) ?? "crane1";
  const level = viewpoint as LevelId;

  const [phase, setPhase] = useState<Phase>("crane");
  const [rig] = useState(createRig);
  const [seated, setSeated] = useState(0);
  const [carrying, setCarrying] = useState<number | null>(null);

  const [inspected, setInspected] = useState<Set<PartId>>(new Set());
  const [visited, setVisited] = useState<Set<LevelId>>(new Set(["floor"]));
  const [active, setActive] = useState<PartId | null>(null);
  const [quiz, setQuiz] = useState<Map<PartId, boolean>>(new Map());

  const [scanOn, setScanOn] = useState(false);
  const [found, setFound] = useState<Set<FaultId>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(SCAN_SECONDS);
  const [revealAll, setRevealAll] = useState(false);

  const [done, setDone] = useState<StationId[]>([]);
  const [busy, setBusy] = useState<StationId | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [pressureOpen, setPressureOpen] = useState(false);

  const [loadout, setLoadout] = useState<Loadout>(DEFAULT_LOADOUT);
  const [signedOff, setSignedOff] = useState(false);

  const [line, setLine] = useState<Line | null>(null);
  const [paLine, setPaLine] = useState<LocalizedText | null>(null);

  useSceneViewpoints(ALL_VIEWPOINTS, "crane1");

  /* ------------------------------------------------------------ timers and speech */

  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const list = timers.current;
    return () => {
      for (const id of list) window.clearTimeout(id);
      stopSpeaking();
      pa.active = false;
    };
  }, []);

  const lineTimer = useRef<number | undefined>(undefined);
  const speaking = useRef(false);
  const say = useCallback(
    (l: Line, opts: { voice?: boolean; ms?: number } = {}) => {
      setLine(l);
      window.clearTimeout(lineTimer.current);
      const text = l.text[locale];
      if (opts.voice !== false) {
        playSfx("chime");
        speak(text, locale);
      }
      speaking.current = true;
      lineTimer.current = window.setTimeout(() => {
        setLine(null);
        speaking.current = false;
      }, opts.ms ?? Math.max(5200, text.length * 62));
    },
    [locale],
  );
  useEffect(() => () => window.clearTimeout(lineTimer.current), []);

  // Loudspeaker: an announcement every half minute or so. It speaks only if nobody else is.
  useEffect(() => {
    let id: number;
    let n = 0;
    const next = () => {
      id = window.setTimeout(() => {
        const text = PA_LINES[n++ % PA_LINES.length];
        setPaLine(text);
        pa.active = true;
        playSfx("chime");
        if (!speaking.current) speak(text[locale], locale);
        window.setTimeout(() => {
          setPaLine(null);
          pa.active = false;
        }, 7000);
        next();
      }, 26000 + Math.random() * 14000);
    };
    id = window.setTimeout(next, 18000);
    return () => window.clearTimeout(id);
  }, [locale]);

  /* ------------------------------------------------------------ phase 1: crane */

  const beginLift = useCallback(
    (index: number) => {
      startLift(rig, index);
      setCarrying(index);
      goTo(CRANE_LIFTS[index].view);
    },
    [rig, goTo],
  );

  useEffect(() => {
    later(() => {
      beginLift(0);
      say(SAY.craneIntro);
      later(() => say(SAY.craneTip, { voice: false, ms: 6500 }), 9500);
    }, 900);
  }, [later, beginLift, say]);

  const onCraneEvent = useCallback(
    (ev: CraneEvent, lift: number) => {
      if (ev === "blocked") {
        playSfx("caution");
        say(SAY.blocked, { ms: 4200 });
      } else if (ev === "hard-landing") {
        addTrauma(0.55);
        playSfx("bang");
        say(SAY.hardLanding, { ms: 4600 });
      } else if (ev === "seated") {
        addTrauma(0.45);
        playSfx("bang");
        later(() => playSfx("unlatch"), 280);
        setSeated(lift + 1);
        setCarrying(null);
        say(SAY.seated[lift]);
        if (lift < CRANE_LIFTS.length - 1) {
          later(() => beginLift(lift + 1), 3600);
        } else {
          later(() => {
            setPhase("tour");
            toFloor();
            say(SAY.tourIntro);
          }, 4400);
        }
      }
    },
    [say, later, beginLift, toFloor],
  );

  /* ------------------------------------------------------------ phase 2: inspection */

  const inspect = useCallback((id: PartId) => {
    setActive(id);
    setInspected((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const ride = useCallback(
    (to: LevelId) => {
      setActive(null);
      playSfx("lift");
      setVisited((prev) => (prev.has(to) ? prev : new Set(prev).add(to)));
      goTo(to);
    },
    [goTo],
  );

  const closePanel = useCallback(() => setActive(null), []);
  const onQuiz = useCallback((id: PartId, correct: boolean) => {
    setQuiz((prev) => (prev.has(id) ? prev : new Map(prev).set(id, correct)));
  }, []);

  const toursDone = phase === "tour" && active === null && inspected.size === ROCKET_PARTS.length;
  useEffect(() => {
    if (!toursDone) return;
    later(() => {
      setPhase("scan");
      toFloor();
      setSecondsLeft(SCAN_SECONDS);
      say(SAY.scanIntro);
      later(() => say(SAY.scanFirstTip, { voice: false, ms: 6000 }), 12000);
    }, 900);
  }, [toursDone, later, toFloor, say]);

  /* ------------------------------------------------------------ phase 3: fault hunt */

  const toggleScan = useCallback(() => {
    setScanOn((on) => {
      playSfx(on ? "switch" : "scan");
      return !on;
    });
  }, []);

  useEffect(() => {
    if (phase !== "scan") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyQ" && !e.repeat && !isTypingTarget(e.target) && !e.ctrlKey && !e.metaKey) toggleScan();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, toggleScan]);

  const startChecklist = useCallback(() => {
    setScanOn(false);
    setRevealAll(false);
    setPhase("checklist");
    toFloor();
    say(SAY.checklistIntro);
  }, [toFloor, say]);

  const huntOver = phase === "scan" && (revealAll || found.size === FAULTS.length);
  useEffect(() => {
    if (phase !== "scan" || revealAll || found.size === FAULTS.length) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        window.clearInterval(id);
        setRevealAll(true);
        setScanOn(true);
        playSfx("noGo");
        say(SAY.scanTimeUp);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, revealAll, found.size, say]);

  useEffect(() => {
    if (!huntOver) return;
    const timeout = revealAll ? 7500 : 5200;
    if (!revealAll) later(() => say(SAY.scanAllFound), 2200);
    later(startChecklist, timeout);
  }, [huntOver, revealAll, later, say, startChecklist]);

  const onFault = useCallback(
    (id: FaultId) => {
      setFound((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      const fault = FAULTS.find((f) => f.id === id);
      if (!fault) return;
      playSfx("success");
      addTrauma(0.15);
      say(
        {
          who: "workshop-chief",
          text: {
            en: `${fault.name.en}. ${fault.explain.en}`,
            vi: `${fault.name.vi}. ${fault.explain.vi}`,
          },
        },
        { ms: 9000 },
      );
    },
    [say],
  );

  /* ------------------------------------------------------------ phase 4: checklist */

  const finishStation = useCallback(
    (id: StationId) => {
      setBusy(null);
      setPressureOpen(false);
      setDone((prev) => {
        const next = prev.includes(id) ? prev : [...prev, id];
        if (next.length === 3) {
          later(() => {
            say(SAY.checklistDone);
            later(() => {
              setPhase("loadout");
              toFloor();
              say(SAY.loadoutIntro);
            }, 4800);
          }, 2600);
        }
        return next;
      });
      say(SAY.stationDone[id], { ms: 4200 });
    },
    [say, later, toFloor],
  );

  const pressStation = useCallback(
    (id: StationId) => {
      if (busy || pressureOpen || done.includes(id)) return;
      const result = checkStation(done, id);
      if (!result.ok) {
        setMistakes((m) => m + 1);
        playSfx("noGo");
        addTrauma(0.2);
        say(SAY.wrongOrder(result.expected), { ms: 7000 });
        return;
      }
      if (id === "pressure") {
        playSfx("switch");
        setPressureOpen(true);
        return;
      }
      setBusy(id);
      playSfx(id === "fuel" ? "lift" : "switch");
      later(() => finishStation(id), id === "fuel" ? 1700 : 1400);
    },
    [busy, pressureOpen, done, say, later, finishStation],
  );

  /* ------------------------------------------------------------ phase 5: loadout */

  const confirmLoadout = useCallback(() => {
    if (!assessLoadout(loadout).ok) {
      playSfx("noGo");
      say(SAY.loadoutLocked, { ms: 4000 });
      return;
    }
    recordLoadout(loadout);
    recordParts(inspected.size);
    playSfx("success");
    setSignedOff(true);
  }, [loadout, say, recordLoadout, recordParts, inspected.size]);

  /* ------------------------------------------------------------ dev hook */

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __ws?: unknown };
    w.__ws = {
      rig,
      jump: (p: Phase) => {
        setSeated(3);
        setCarrying(null);
        rig.active = false;
        setPhase(p);
        toFloor();
        if (p === "scan") setSecondsLeft(SCAN_SECONDS);
      },
      /** Runs the crane physics without waiting for animation frames (the hidden preview pane throttles them). */
      drive: (input: { moveX: number; moveZ: number; hoist: number }, seconds: number) => {
        for (let i = 0; i < seconds * 60; i++) advanceCrane(rig, input, 1 / 60, onCraneEvent);
      },
      goto: (id: string) => goTo(id),
      seatAll: () => {
        setSeated(3);
        setCarrying(null);
        rig.active = false;
      },
      state: () => ({ phase, seated, found: [...found], done, secondsLeft }),
    };
    return () => {
      delete w.__ws;
    };
  });

  /* ------------------------------------------------------------ view */

  const part = ROCKET_PARTS.find((p) => p.id === active) ?? null;
  const next = ROCKET_PARTS.find((p) => p.level === level && p.id !== active && !inspected.has(p.id)) ?? null;
  const chiefName = localize(CHARACTERS["workshop-chief"].name);
  const briefing = BRIEFINGS.workshop;
  const number = new Intl.NumberFormat(locale);
  const stats = assessLoadout(loadout);
  const quizRight = [...quiz.values()].filter(Boolean).length;
  const stackingNow = phase === "crane";
  const objective = (i: number) => localize(briefing.objectives[i]);
  const afterScan = phase === "checklist" || phase === "loadout";
  const afterChecklist = phase === "loadout";

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-label={t.workshop.sceneLabel}>
      <WorldCanvas label={t.workshop.sceneLabel}>
        <WorkshopWorld
          level={level}
          phase={phase}
          inspected={inspected}
          activeId={active}
          onInspect={inspect}
          onLift={ride}
          engine={loadout.engine}
          crane={{ rig, seated, carrying, onEvent: onCraneEvent }}
          scan={{ on: scanOn, found, revealAll, onFound: onFault }}
          stations={{ done, busy, onPress: pressStation }}
        />
      </WorldCanvas>

      <ScanOverlay on={phase === "scan" && scanOn} />
      <Callout line={line} />
      <PaStrip text={paLine} />

      <div className="pointer-events-none absolute left-3 top-16 sm:left-8 sm:top-20">
        <ObjectivePanel
          className="pointer-events-auto"
          compact
          items={[
            { id: "crane", label: objective(0), done: seated === CRANE_LIFTS.length, progress: `${seated}/${CRANE_LIFTS.length}` },
            { id: "levels", label: objective(1), done: visited.size === LEVEL_COUNT, progress: `${visited.size}/${LEVEL_COUNT}` },
            { id: "parts", label: objective(2), done: inspected.size === ROCKET_PARTS.length, progress: `${inspected.size}/${ROCKET_PARTS.length}` },
            { id: "faults", label: objective(3), done: afterScan || found.size === FAULTS.length, progress: `${found.size}/${FAULTS.length}` },
            { id: "checklist", label: objective(4), done: afterChecklist, progress: `${done.length}/3` },
            { id: "loadout", label: objective(5), done: signedOff },
          ]}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col items-start gap-3 sm:inset-x-8 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between">
        <div className={cn("pointer-events-auto w-full max-w-xs flex-col gap-2", (phase === "tour" && part) || stackingNow || phase === "loadout" ? "hidden" : "flex")}>
          <HotspotList />
          <p className="hidden text-xs text-foreground/70 sm:block">{t.hud.lookHint}</p>
        </div>

        {stackingNow && carrying !== null && <CraneHud rig={rig} lift={carrying} />}

        {phase === "tour" && part && (
          <PartPanel
            key={part.id}
            part={part}
            next={next}
            onNext={() => next && inspect(next.id)}
            onClose={closePanel}
            onQuiz={(c) => onQuiz(part.id, c)}
          />
        )}

        {phase === "scan" && <ScanHud on={scanOn} onToggle={toggleScan} found={found} secondsLeft={secondsLeft} revealAll={revealAll} />}

        {phase === "checklist" && !pressureOpen && <ChecklistPanel done={done} mistakes={mistakes} />}
        {phase === "checklist" && pressureOpen && (
          <PressureGame onDone={() => finishStation("pressure")} onCancel={() => setPressureOpen(false)} />
        )}

        {phase === "loadout" && !signedOff && (
          <div className="ml-auto">
            <LoadoutPanel value={loadout} onChange={setLoadout} onConfirm={confirmLoadout} />
          </div>
        )}
      </div>

      <SignOffDialog
        open={signedOff}
        character="workshop-chief"
        badge={t.workshop.readyBadge}
        title={localize(UI.done.title)}
        description={format(localize(UI.done.body), { name: chiefName })}
        continueLabel={t.workshop.continue}
        onContinue={onComplete}
        demo
      >
        <SignOffDetails className="max-h-[40dvh] gap-y-1 overflow-y-auto">
          {[
            [UI.done.build, `${localize(stats.engine.name)} + ${localize(stats.tank.name)}`],
            [UI.done.faults, `${found.size}/${FAULTS.length}`],
            [UI.done.quiz, `${quizRight}/${ROCKET_PARTS.length}`],
            [UI.done.rough, String(rig.bumps)],
            [UI.done.order, String(mistakes)],
          ].map(([label, value]) => (
            <div key={localize(label as LocalizedText)} className="contents">
              <dt className="text-foreground/80">{localize(label as LocalizedText)}</dt>
              <dd className="text-right font-mono">{value as string}</dd>
            </div>
          ))}
          <div className="col-span-2 mt-1 flex justify-between gap-6 border-t border-foreground/20 pt-1.5 font-semibold">
            <dt>{t.workshop.total}</dt>
            <dd className="font-mono">{format(t.workshop.massValue, { value: number.format(Math.round(stats.liftoffMassT)) })}</dd>
          </div>
          <div className="col-span-2 text-[11px] text-foreground/55">
            {format(t.workshop.massValue, { value: number.format(TOTAL_MASS_T) })} · {localize({ en: "tour reference stack", vi: "bộ khối lượng tham chiếu khi tham quan" })}
          </div>
        </SignOffDetails>
      </SignOffDialog>
    </section>
  );
}
