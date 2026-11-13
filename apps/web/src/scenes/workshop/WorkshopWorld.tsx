"use client";

import { Hotspot } from "@/components/viewport/Hotspot";
import { useSceneStore } from "@/game/sceneStore";
import { ROCKET_PARTS, type PartId } from "@/mocks/rocket-parts";
import type { CraneEvent } from "./crane";
import { CarriedLoad, CraneController, OverheadCrane, PlacementGuide, SeatPulse, type CraneRigState } from "./CraneRig";
import { Defects } from "./Defects";
import type { FaultId } from "./faults";
import { Dust, Hall, LightShafts, VABHeritageMurals } from "./Hall";
import { CRANE_LIFTS, LIFTS, VIEWPOINT_BY_LEVEL, markerFor } from "./layout";
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
import { PartModel } from "./RocketModel";
import { Stations } from "./Stations";
import { LaunchMount, LiftPanel, Tower } from "./Structures";
import { FloorWelder, Loudspeakers, Walker } from "./Workers";
import type { LevelId } from "@/mocks/rocket-parts";

export type Phase = "crane" | "tour" | "scan" | "checklist" | "loadout";

export interface WorkshopWorldProps {
  /** Id of the current viewpoint: a gantry level, or one of the crane views. */
  level: string;
  phase: Phase;
  inspected: ReadonlySet<PartId>;
  activeId: PartId | null;
  onInspect: (id: PartId) => void;
  onLift: (to: LevelId) => void;
  engine: EngineId;
  crane: { rig: CraneRigState; seated: number; carrying: number | null; onEvent: (e: CraneEvent, lift: number) => void };
  scan: { on: boolean; found: ReadonlySet<FaultId>; revealAll: boolean; onFound: (id: FaultId) => void };
  stations: { done: readonly StationId[]; busy: StationId | null; onPress: (id: StationId) => void };
}

const PART_LIFT = new Map<PartId, number>(CRANE_LIFTS.flatMap((l) => l.parts.map((p): [PartId, number] => [p, l.index])));

/**
 * Scene 2 geometry: the assembly hall with the Moon rocket on its mount, the gantry crane that
 * stacks it, the hidden faults, the checklist consoles, and a hall full of people at work.
 */
export function WorkshopWorld({ level, phase, inspected, activeId, onInspect, onLift, engine, crane, scan, stations }: WorkshopWorldProps) {
  const highlightedId = useSceneStore((s) => s.highlightedId);
  const touring = phase === "tour";
  const stacking = phase === "crane";

  return (
    <>
      <fogExp2 attach="fog" args={["#8398b0", 0.0072]} />
      <hemisphereLight args={["#d8e6ff", "#6a5d4e", 1.05]} />
      {/* Key light from the skylight side: soft shadows across the whole hall */}
      <directionalLight
        position={[-16, 40, 20]}
        color="#fff4e0"
        intensity={3.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-near={5}
        shadow-camera-far={110}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={34}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[16, 26, -12]} color="#cfe6ff" intensity={0.9} />
      <spotLight position={[10, 34, 14]} color="#fff1d6" intensity={380} angle={0.34} penumbra={0.9} distance={60} decay={1.2} />
      <pointLight position={[0, 6, 6]} color="#ffe9c4" intensity={20} distance={22} decay={1.6} />

      <Hall />
      <VABHeritageMurals />
      <LightShafts />
      <Dust />
      <Loudspeakers />

      <OverheadCrane rig={crane.rig} carrying={crane.carrying} />
      <CraneController rig={crane.rig} onEvent={crane.onEvent} />
      <SeatPulse rig={crane.rig} />
      {crane.carrying !== null && <PlacementGuide rig={crane.rig} lift={CRANE_LIFTS[crane.carrying]} />}

      <LaunchMount />
      <Tower level="level2" />
      <Tower level="level3" />
      <Props />
      <IndustrialForklift />
      <CryoSupplyTanks />

      <FloorEngineer />
      <FloorInspector />
      <Level2Technician />
      <Level3Technician />
      <FloorWelder />
      <Walker path={[[13.4, 12], [13.4, -9]]} carrying="crate" speed={0.8} />
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

      <Stations interactive={phase === "checklist"} done={stations.done} busy={stations.busy} onPress={stations.onPress} />

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
