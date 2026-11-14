"use client";

import { Hotspot } from "@/components/viewport/Hotspot";
import { useSceneStore } from "@/game/sceneStore";
import { ROCKET_PARTS, type PartId } from "@/mocks/rocket-parts";
import type { CraneEvent } from "./crane";
import { CarriedLoad, CraneController, OverheadCrane, PlacementGuide, SeatPulse, type CraneRigState } from "./CraneRig";
import { StaticBatch } from "@/components/viewport/StaticBatch";
import { FuelBay, PlayerWatch } from "./Bay";
import { Defects } from "./Defects";
import { FlangeBolts, HeldWrench, ToolBench } from "./Handwork";
import type { ToolId } from "./content";
import type { FaultId } from "./faults";
import { Dust, Hall, LightShafts, VABHeritageMurals } from "./Hall";
import { BAY_VIEWPOINT, CRANE_LIFTS, LIFTS, VIEWPOINT_BY_LEVEL, markerFor } from "./layout";
import type { EngineId } from "./loadout";
import type { StationId } from "./checks";
import {
  CryoSupplyTanks,
  FloorEngineer,
  FloorInspector,
  IndustrialForklift,
  Level2Technician,
  Level3Technician,
  Props,
} from "./Living";
import { HallSoundscape } from "./Soundscape";
import { PartModel } from "./RocketModel";
import { Stations } from "./Stations";
import { LaunchMount, LiftPanel, Tower } from "./Structures";
import { FloorWelder, Loudspeakers, Walker } from "./Workers";
import type { LevelId } from "@/mocks/rocket-parts";

export type Phase = "crane" | "tour" | "scan" | "tighten" | "checklist" | "loadout";

export interface WorkshopWorldProps {
  /** Id of the current viewpoint: a gantry level, or one of the crane views. */
  level: string;
  phase: Phase;
  inspected: ReadonlySet<PartId>;
  activeId: PartId | null;
  onInspect: (id: PartId) => void;
  onLift: (to: LevelId | "bay") => void;
  engine: EngineId;
  crane: { rig: CraneRigState; seated: number; carrying: number | null; onEvent: (e: CraneEvent, lift: number) => void };
  scan: { on: boolean; found: ReadonlySet<FaultId>; revealAll: boolean; onFound: (id: FaultId) => void };
  stations: { done: readonly StationId[]; busy: StationId | null; hose: boolean; onPress: (id: StationId) => void };
  handwork: {
    tool: ToolId | null;
    wrongTool: { id: ToolId; n: number } | null;
    boltsDone: readonly number[];
    onPickTool: (id: ToolId) => void;
    onBolt: (i: number) => void;
    onEnterBay: () => void;
  };
}

const PART_LIFT = new Map<PartId, number>(CRANE_LIFTS.flatMap((l) => l.parts.map((p): [PartId, number] => [p, l.index])));

/**
 * Scene 2 geometry: the assembly hall with the Moon rocket on its mount, the gantry crane that
 * stacks it, the hidden faults, the checklist consoles, and a hall full of people at work.
 */
export function WorkshopWorld({ level, phase, inspected, activeId, onInspect, onLift, engine, crane, scan, stations, handwork }: WorkshopWorldProps) {
  const highlightedId = useSceneStore((s) => s.highlightedId);
  const touring = phase === "tour";
  const stacking = phase === "crane";

  return (
    <>
      <fogExp2 attach="fog" args={["#8398b0", 0.0072]} />
      <hemisphereLight args={["#d8e6ff", "#6a5d4e", 1.35]} />
      {/* Key light from the skylight side: soft shadows across the whole hall */}
      <directionalLight
        position={[-16, 40, 20]}
        color="#fff4e0"
        intensity={3.1}
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-near={5}
        shadow-camera-far={110}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={34}
        shadow-camera-bottom={-12}
      />
      {/* Every light is paid for on every lit pixel, so the hall keeps few: sun, cool fill, sky. */}
      <directionalLight position={[16, 26, -12]} color="#cfe6ff" intensity={1.1} />
      <directionalLight position={[10, 34, 14]} color="#fff1d6" intensity={0.8} />

      <StaticBatch>
        <Hall />
      </StaticBatch>
      <VABHeritageMurals />
      <LightShafts />
      <Dust />
      <Loudspeakers />

      <OverheadCrane rig={crane.rig} carrying={crane.carrying} />
      <CraneController rig={crane.rig} onEvent={crane.onEvent} />
      <SeatPulse rig={crane.rig} />
      {crane.carrying !== null && <PlacementGuide rig={crane.rig} lift={CRANE_LIFTS[crane.carrying]} />}

      <StaticBatch>
        <LaunchMount />
        <Tower level="level2" />
        <Tower level="level3" />
        <Props />
      </StaticBatch>
      <IndustrialForklift />
      <StaticBatch>
        <CryoSupplyTanks />
      </StaticBatch>

      <FloorEngineer />
      <FloorInspector />
      <Level2Technician />
      <Level3Technician />
      <FloorWelder />
      <Walker path={[[13.4, 12], [13.4, 1]]} carrying="crate" speed={0.8} />
      <Walker path={[[-9.5, 3.5], [-9.5, -8]]} carrying="tablet" vest="#2563eb" speed={0.7} phase={0.3} />
      <Walker path={[[3, -9.5], [11, -9.5]]} carrying="tablet" vest="#16a34a" suit="#1f2937" speed={0.65} phase={0.6} />

      {ROCKET_PARTS.map((part) => {
        const liftIndex = PART_LIFT.get(part.id);
        const seatedNow = liftIndex === undefined || liftIndex < crane.seated;
        const carried = liftIndex !== undefined && liftIndex === crane.carrying;
        if (!seatedNow && !carried) return null; // still waiting on the floor, not in the hall yet
        const hot = highlightedId === part.id || activeId === part.id;
        const model = <PartModel id={part.id} hot={hot} engine={engine} />;
        if (carried && liftIndex !== undefined) {
          return (
            <CarriedLoad key={part.id} rig={crane.rig} lift={CRANE_LIFTS[liftIndex]}>
              {model}
            </CarriedLoad>
          );
        }
        return touring && part.level === level ? (
          <Hotspot
            key={part.id}
            id={part.id}
            label={part.name}
            position={[0, 0, 0]}
            markerOffset={markerFor(part.id)}
            done={inspected.has(part.id)}
            onActivate={() => onInspect(part.id)}
          >
            {model}
          </Hotspot>
        ) : (
          <group key={part.id}>{model}</group>
        );
      })}

      {phase === "scan" || scan.revealAll ? (
        <Defects scanning={scan.on} found={scan.found} revealAll={scan.revealAll} onFound={scan.onFound} />
      ) : null}

      <Stations interactive={phase === "checklist"} done={stations.done} busy={stations.busy} hose={stations.hose} onPress={stations.onPress} />

      <FuelBay active={stations.hose} />
      {phase === "checklist" && level === "floor" && (
        <Hotspot id="go-bay" kind="move" label={BAY_VIEWPOINT.label} position={[9.6, 0, -9.6]} markerHeight={1.2} onActivate={() => onLift("bay")} />
      )}
      {phase === "checklist" && level === "bay" && (
        <Hotspot id="go-floor" kind="move" label={VIEWPOINT_BY_LEVEL.floor.label} position={[10.6, 0, -10.4]} markerHeight={1.2} onActivate={() => onLift("floor")} />
      )}
      <PlayerWatch onEnterBay={handwork.onEnterBay} />
      <HallSoundscape rig={crane.rig} />
      <ToolBench interactive={phase === "tighten" && handwork.tool === null} held={handwork.tool} wrong={handwork.wrongTool} onPick={handwork.onPickTool} />
      {handwork.tool === "torque" && <HeldWrench />}
      {phase !== "crane" && (
        <FlangeBolts
          interactive={phase === "tighten" && handwork.tool === "torque" && level === "level2"}
          done={handwork.boltsDone}
          showLabels={phase === "tighten" && handwork.tool === "torque" && level === "level2"}
          onPress={handwork.onBolt}
        />
      )}

      {LIFTS.map((lift) =>
        !stacking && lift.from === level ? (
          <Hotspot
            key={lift.id}
            id={lift.id}
            kind="move"
            label={VIEWPOINT_BY_LEVEL[lift.to].label}
            position={lift.position}
            markerHeight={1.6}
            onActivate={() => onLift(lift.to)}
          >
            <LiftPanel lift={lift} />
          </Hotspot>
        ) : (
          <group key={lift.id} position={lift.position}>
            <LiftPanel lift={lift} />
          </group>
        ),
      )}
    </>
  );
}
