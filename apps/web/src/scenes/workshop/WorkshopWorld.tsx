"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Group, type MeshBasicMaterial, type PointLight } from "three";
import { Hotspot } from "@/components/viewport/Hotspot";
import { LightingRig } from "@/components/viewport/LightingRig";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSceneStore } from "@/game/sceneStore";
import { PALETTE, SCENE_COLORS } from "@/lib/palette";
import { ROCKET_PARTS, type LevelId, type PartId } from "@/mocks/rocket-parts";
import {
  EYE,
  HALL,
  LIFTS,
  STACK,
  VIEWPOINT_BY_LEVEL,
  facingTheta,
  markerFor,
  towerCentre,
  type LiftStop,
} from "./layout";

interface WorkshopWorldProps {
  level: LevelId;
  inspected: ReadonlySet<PartId>;
  activeId: PartId | null;
  onInspect: (id: PartId) => void;
  onLift: (to: LevelId) => void;
}

/**
 * Scene 2 geometry: the massive NASA Vehicle Assembly Building (VAB), the Moon rocket on its mount,
 * animated gantry cranes, heavy support equipment, realistic NASA heritage murals, and lively technicians.
 */
export function WorkshopWorld({ level, inspected, activeId, onInspect, onLift }: WorkshopWorldProps) {
  const highlightedId = useSceneStore((s) => s.highlightedId);

  return (
    <>
      <LightingRig intensity={1.0} />
      {/* High-bay industrial floodlights illuminating the massive rocket stack */}
      <directionalLight position={[-12, 28, 14]} color="#F8FAFC" intensity={1.5} />
      <directionalLight position={[14, 25, -10]} color="#E0F2FE" intensity={1.2} />
      <pointLight position={[0, 18, 5]} color="#FFFBEB" intensity={1.0} distance={25} />

      <Hall />
      <VABHeritageMurals />
      <OverheadCrane />
      <LaunchMount />
      <Tower level="level2" />
      <Tower level="level3" />
      <Props />
      <IndustrialForklift />
      <CryoSupplyTanks />

      {/* Lively VAB engineers and technicians */}
      <FloorEngineer />
      <FloorInspector />
      <Level2Technician />
      <Level3Technician />

      {ROCKET_PARTS.map((part) => {
        const hot = highlightedId === part.id || activeId === part.id;
        const model = <PartModel id={part.id} hot={hot} />;
        return part.level === level ? (
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

      {LIFTS.map((lift) =>
        lift.from === level ? (
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

/* ---------------------------------------------------------------- rocket parts */

function PartModel({ id, hot }: { id: PartId; hot: boolean }) {
  const main = hot ? PALETTE.gold : PALETTE.mist;
  switch (id) {
    case "stage1-engines":
      return <Engines hot={hot} />;
    case "stage1-tanks":
      return <Stage1Tanks main={main} />;
    case "interstage":
      return <Interstage hot={hot} />;
    case "stage2":
      return <Stage2 main={main} />;
    case "lander":
      return <LanderInAdapter hot={hot} />;
    case "service-module":
      return <ServiceModule main={main} />;
    case "crew-capsule":
      return <CrewCapsule main={main} />;
    case "escape-tower":
      return <EscapeTower hot={hot} />;
  }
}

function Engines({ hot }: { hot: boolean }) {
  const { y0, y1, r } = STACK.engines;
  const bell = hot ? PALETTE.gold : SCENE_COLORS.titanium;
  const bellH = 1.4;
  const bellY = y0 + 0.1 + bellH / 2;
  const spots: [number, number][] = [
    [0, 0],
    [0.95, 0],
    [-0.95, 0],
    [0, 0.95],
    [0, -0.95],
  ];
  return (
    <group>
      {/* Thrust structure skirt and heat shield the bells hang from. */}
      <mesh position={[0, y1 - 0.3, 0]}>
        <cylinderGeometry args={[STACK.stage1.r, r, 0.6, 24]} />
        <meshStandardMaterial color={hot ? PALETTE.gold : SCENE_COLORS.steelDark} metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, y1 - 0.65, 0]}>
        <cylinderGeometry args={[r, r, 0.1, 24]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.7} />
      </mesh>
      {spots.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, bellY, z]}>
          {/* Main titanium rocket nozzle with heat-tint bronze throat */}
          <mesh>
            <cylinderGeometry args={[0.22, 0.58, bellH, 20, 1, true]} />
            <meshStandardMaterial color={bell} metalness={0.85} roughness={0.25} side={DoubleSide} />
          </mesh>
          {/* Engine gimbal turbopump manifold */}
          <mesh position={[0, bellH / 2 + 0.12, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.24, 14]} />
            <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.75} roughness={0.3} />
          </mesh>
          {/* Red protective nozzle rim band */}
          <mesh position={[0, -bellH / 2 + 0.05, 0]}>
            <cylinderGeometry args={[0.585, 0.585, 0.08, 20, 1, true]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaRed} side={DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* Four aerodynamic fins at 45° with crisp NASA red tips */}
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <group key={i} position={[Math.sin(a) * 1.95, y1 - 0.2, Math.cos(a) * 1.95]} rotation={[0, a, 0]}>
            <mesh>
              <boxGeometry args={[0.12, 1.7, 0.9]} />
              <meshStandardMaterial color={SCENE_COLORS.spaceWhite} metalness={0.3} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <boxGeometry args={[0.122, 0.4, 0.92]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Band({ r, y0, y1, color, theta = 0, arc = Math.PI * 2 }: { r: number; y0: number; y1: number; color: string; theta?: number; arc?: number }) {
  return (
    <mesh position={[0, (y0 + y1) / 2, 0]}>
      <cylinderGeometry args={[r + 0.015, r + 0.015, y1 - y0, 28, 1, arc < Math.PI * 2, theta, arc]} />
      <meshStandardMaterial color={color} side={arc < Math.PI * 2 ? DoubleSide : undefined} />
    </mesh>
  );
}

function Stage1Tanks({ main }: { main: string }) {
  const { y0, y1, r } = STACK.stage1;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 28]} />
        <meshStandardMaterial color={main} roughness={0.4} />
      </mesh>
      <Band r={r} y0={y0} y1={y0 + 0.7} color={SCENE_COLORS.nasaBlue} />
      {/* Roll pattern: alternating quarters so the rocket's spin reads on tracking cameras */}
      {[0, Math.PI].map((t) => (
        <Band key={t} r={r} y0={y0 + 0.7} y1={y0 + 2.4} color={SCENE_COLORS.steelDark} theta={t} arc={Math.PI / 2} />
      ))}
      {/* NASA Insignia Blue mid-band and Red worm accent */}
      <Band r={r} y0={7.4} y1={7.7} color={SCENE_COLORS.nasaBlue} />
      <Band r={r} y0={7.7} y1={7.85} color={SCENE_COLORS.nasaRed} />
      <Band r={r} y0={y1 - 0.5} y1={y1} color={SCENE_COLORS.steelDark} />

      {/* "USA" Vertical Stencil Decal on Stage 1 facing the floor */}
      <group position={[0, 9.6, r + 0.02]}>
        <mesh position={[0, 0.4, 0]}>
          <planeGeometry args={[0.3, 0.5]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <planeGeometry args={[0.3, 0.5]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
      </group>
    </group>
  );
}

function Interstage({ hot }: { hot: boolean }) {
  const { y0, y1, r0, r1 } = STACK.interstage;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0, 28]} />
        <meshStandardMaterial color={hot ? PALETTE.gold : SCENE_COLORS.nasaBlue} roughness={0.4} />
      </mesh>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[(r0 + r1) / 2 + 0.02, (r0 + r1) / 2 + 0.06, 0.22, 28]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
      {/* Interstage separation retro-rockets */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * (r0 + 0.08), y0 + 0.4, Math.cos(a) * (r0 + 0.08)]} rotation={[0, a, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.4, 8]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

function Stage2({ main }: { main: string }) {
  const { y0, y1, r } = STACK.stage2;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 28]} />
        <meshStandardMaterial color={main} roughness={0.4} />
      </mesh>
      <Band r={r} y0={y0} y1={y0 + 0.5} color={SCENE_COLORS.nasaBlue} />
      {[Math.PI / 2, (3 * Math.PI) / 2].map((t) => (
        <Band key={t} r={r} y0={y0 + 0.5} y1={y0 + 1.7} color={SCENE_COLORS.steelDark} theta={t} arc={Math.PI / 2} />
      ))}
      <Band r={r} y0={y1 - 0.45} y1={y1} color={SCENE_COLORS.nasaBlue} />
      {/* American Flag graphic on Stage 2 */}
      <mesh position={[0, y0 + 3.2, r + 0.02]}>
        <planeGeometry args={[0.7, 0.45]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[-0.18, y0 + 3.32, r + 0.025]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      <mesh position={[0.12, y0 + 3.32, r + 0.025]}>
        <planeGeometry args={[0.35, 0.08]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
    </group>
  );
}

function LanderInAdapter({ hot }: { hot: boolean }) {
  const { y0, y1, r0, r1 } = STACK.adapter;
  const windowArc = 1.5;
  const start = facingTheta("level3") + windowArc / 2;
  const body = hot ? PALETTE.gold : SCENE_COLORS.kaptonGold;
  const legs: [number, number][] = [
    [0.62, 0.62],
    [-0.62, 0.62],
    [0.62, -0.62],
    [-0.62, -0.62],
  ];
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0, 28, 1, true, start, Math.PI * 2 - windowArc]} />
        <meshStandardMaterial color={hot ? PALETTE.gold : SCENE_COLORS.spaceWhite} side={DoubleSide} />
      </mesh>
      {/* Cutaway border highlighted in safety yellow */}
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1 + 0.01, r0 + 0.01, y1 - y0, 28, 1, true, start - 0.05, 0.05]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} side={DoubleSide} />
      </mesh>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1 + 0.01, r0 + 0.01, y1 - y0, 28, 1, true, start + Math.PI * 2 - windowArc, 0.05]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} side={DoubleSide} />
      </mesh>

      {/* Lander: glistening gold Kapton foil descent stage, white crew cabin on top, splayed legs */}
      <group position={[0, y0 + 0.2, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.6, 8]} />
          <meshStandardMaterial color={body} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[0.7, 0.6, 0.6]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.3, 0.31]}>
          <planeGeometry args={[0.24, 0.18]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x * 0.85, 0.25, z * 0.85]} rotation={[z * 0.5, 0, -x * 0.5]}>
            <cylinderGeometry args={[0.035, 0.035, 0.75, 6]} />
            <meshStandardMaterial color={SCENE_COLORS.solarGold} metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ServiceModule({ main }: { main: string }) {
  const { y0, y1, r } = STACK.serviceModule;
  const t = facingTheta("level3");
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 28]} />
        <meshStandardMaterial color={main === PALETTE.mist ? SCENE_COLORS.aluminum : main} metalness={0.55} roughness={0.3} />
      </mesh>
      {/* Radiator panels and four thruster quads */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Band key={i} r={r} y0={y0 + 0.2} y1={y1 - 0.5} color={SCENE_COLORS.nasaBlue} theta={(i * Math.PI) / 3} arc={0.35} />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const a = t + Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * (r + 0.08), y1 - 0.3, Math.cos(a) * (r + 0.08)]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.22, 0.22, 0.12]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

function CrewCapsule({ main }: { main: string }) {
  const { y0, y1, r0, r1 } = STACK.capsule;
  const t = facingTheta("level3");
  return (
    <group>
      <mesh position={[0, y0 + 0.04, 0]}>
        <cylinderGeometry args={[r0 + 0.02, r0 + 0.02, 0.08, 28]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
      </mesh>
      <mesh position={[0, (y0 + y1) / 2 + 0.04, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0 - 0.08, 28]} />
        <meshStandardMaterial color={main} roughness={0.35} />
      </mesh>
      {/* Hatch Window */}
      {[0.4].map((d) => (
        <mesh
          key={d}
          position={[Math.sin(t + d) * 0.66, y0 + 0.75, Math.cos(t + d) * 0.66]}
          rotation={[-0.45, t + d, 0, "YXZ"]}
        >
          <planeGeometry args={[0.18, 0.18]} />
          <meshBasicMaterial color={SCENE_COLORS.screenGlass} />
        </mesh>
      ))}
      {/* Thermal protective ablative shield ring */}
      <mesh position={[0, y0 + 0.01, 0]}>
        <cylinderGeometry args={[r0 + 0.04, r0 + 0.04, 0.04, 28]} />
        <meshStandardMaterial color="#B45309" metalness={0.3} roughness={0.8} />
      </mesh>
    </group>
  );
}

function EscapeTower({ hot }: { hot: boolean }) {
  const { y0, y1 } = STACK.tower;
  const trussTop = y0 + 1.4;
  const struts = hot ? PALETTE.gold : SCENE_COLORS.nasaRed;
  return (
    <group>
      {[
        [0.22, 0.22],
        [-0.22, 0.22],
        [0.22, -0.22],
        [-0.22, -0.22],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (y0 + trussTop) / 2, z]}>
          <cylinderGeometry args={[0.035, 0.035, trussTop - y0, 6]} />
          <meshStandardMaterial color={struts} />
        </mesh>
      ))}
      <mesh position={[0, y0 + 0.7, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshStandardMaterial color={struts} />
      </mesh>
      <mesh position={[0, (trussTop + y1 - 0.6) / 2, 0]}>
        <cylinderGeometry args={[0.22, 0.24, y1 - 0.6 - trussTop, 16]} />
        <meshStandardMaterial color={hot ? PALETTE.gold : SCENE_COLORS.spaceWhite} />
      </mesh>
      <mesh position={[0, y1 - 0.3, 0]}>
        <coneGeometry args={[0.22, 0.6, 16]} />
        <meshStandardMaterial color={struts} />
      </mesh>
      {/* Abort solid rocket motor nozzles */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.24, trussTop + 0.4, Math.cos(a) * 0.24]} rotation={[0.4, a, 0]}>
            <coneGeometry args={[0.08, 0.18, 8]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------------------------------------------------------------- hall and structures */

function Hall() {
  const w = HALL.maxX - HALL.minX;
  const d = HALL.maxZ - HALL.minZ;
  const cz = (HALL.minZ + HALL.maxZ) / 2;
  const h = HALL.height;
  const door = { width: 16, height: 32 };

  return (
    <group>
      {/* Heavy industrial concrete VAB floor with epoxy coating */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.concreteFloor} roughness={0.7} />
      </mesh>
      {/* Ceiling structure */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.85} />
      </mesh>

      {/* Back wall with the massive rollout bay door */}
      <mesh position={[0, h / 2, HALL.minZ]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} roughness={0.7} />
      </mesh>
      <mesh position={[0, door.height / 2, HALL.minZ + 0.02]}>
        <planeGeometry args={[door.width, door.height]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.4} roughness={0.45} />
      </mesh>
      {/* NASA Blue & Red vertical accents on rollout door */}
      <mesh position={[0, door.height * 0.65, HALL.minZ + 0.03]}>
        <planeGeometry args={[door.width, 1.8]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      <mesh position={[0, door.height * 0.65 - 1.1, HALL.minZ + 0.03]}>
        <planeGeometry args={[door.width, 0.4]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, door.height / 2, HALL.minZ + 0.04]}>
          <planeGeometry args={[0.16, door.height]} />
          <meshBasicMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
      ))}
      <mesh position={[0, 0.6, HALL.minZ + 0.05]}>
        <planeGeometry args={[door.width, 1.2]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>

      {/* Side walls with massive structural steel pillars */}
      {[HALL.minX, HALL.maxX].map((x) => (
        <group key={x}>
          <mesh position={[x, h / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[d, h]} />
            <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.65} />
          </mesh>
          {[-12, -6, 0, 6, 12].map((z) => (
            <mesh key={z} position={[x + (x < 0 ? 0.35 : -0.35), h / 2, z]}>
              <boxGeometry args={[0.7, h, 0.7]} />
              <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.5} roughness={0.45} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Front wall */}
      <mesh position={[0, h / 2, HALL.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.65} />
      </mesh>

      {/* Industrial high-bay ceiling lighting grids */}
      {[-12, -4, 4, 12].flatMap((x) =>
        [-10, 0, 10].map((z) => (
          <group key={`${x}${z}`} position={[x, h - 0.05, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.2, 1.2]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
          </group>
        )),
      )}

      {/* Primary safety walkway and crawler tracks on floor */}
      {[3, 5, 7, 9, 11, 13, 15].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, z]}>
          <planeGeometry args={[0.3, 1.2]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
      ))}
      {/* Heavy crawler rails embedded in floor */}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, cz]}>
          <planeGeometry args={[0.2, d]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Giant American Flag & NASA Insignia Murals on the VAB interior walls */
function VABHeritageMurals() {
  return (
    <group>
      {/* Giant 50-Star American Flag on Left Wall */}
      <group position={[HALL.minX + 0.1, 22, -1]} rotation={[0, Math.PI / 2, 0]}>
        {/* White base */}
        <mesh>
          <planeGeometry args={[14, 7.8]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Red stripes (7 red, 6 white) */}
        {[0, 2, 4, 6].map((i) => (
          <mesh key={i} position={[0, 3.3 - i * 1.2, 0.01]}>
            <planeGeometry args={[14, 0.6]} />
            <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
          </mesh>
        ))}
        {/* Blue Union Canton */}
        <mesh position={[-3.6, 1.65, 0.02]}>
          <planeGeometry args={[6.8, 4.5]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
      </group>

      {/* Giant NASA Insignia Mural on Right Wall */}
      <group position={[HALL.maxX - 0.1, 22, -1]} rotation={[0, -Math.PI / 2, 0]}>
        {/* Outer sphere */}
        <mesh>
          <circleGeometry args={[4.2, 36]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
        {/* Orbit track ring */}
        <mesh position={[0, 0, 0.01]} rotation={[0, 0, 0.4]}>
          <ringGeometry args={[3.8, 4.1, 36]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Red vector / chevron */}
        <mesh position={[0.4, 0.2, 0.02]} rotation={[0, 0, -0.6]}>
          <planeGeometry args={[6.4, 0.7]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
      </group>
    </group>
  );
}

/** Animated Heavy-Duty Overhead Crane traversing the high ceiling */
function OverheadCrane() {
  const trolleyRef = useRef<Group>(null);
  const strobeRef = useRef<MeshBasicMaterial>(null);
  const reduced = useReducedMotion();
  const w = HALL.maxX - HALL.minX;
  const h = HALL.height;

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime * 0.12;
    if (trolleyRef.current) {
      trolleyRef.current.position.x = Math.sin(t) * 8.5;
    }
    if (strobeRef.current) {
      const flash = Math.sin(clock.elapsedTime * 8) > 0.3;
      strobeRef.current.color.set(flash ? SCENE_COLORS.solarGold : "#451A03");
    }
  });

  return (
    <group position={[0, h - 3.2, 0]}>
      {/* Dual Yellow Box Girders spanning full hall width */}
      {[-0.9, 0.9].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh>
            <boxGeometry args={[w, 1.4, 0.8]} />
            <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.4} />
          </mesh>
          {/* Black diagonal warning stripes on crane side */}
          {[-12, -6, 0, 6, 12].map((x) => (
            <mesh key={x} position={[x, 0, z > 0 ? 0.41 : -0.41]}>
              <planeGeometry args={[1.2, 1.3]} />
              <meshBasicMaterial color={SCENE_COLORS.steelDark} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Traversing Hoist Trolley */}
      <group ref={trolleyRef} position={[0, 0.4, 0]}>
        <mesh>
          <boxGeometry args={[2.8, 1.0, 2.8]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.5} />
        </mesh>
        {/* Flashing Amber Warning Strobe Beacon */}
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.25, 12]} />
          <meshBasicMaterial ref={strobeRef} color={SCENE_COLORS.solarGold} />
        </mesh>
        {/* Steel Winch Drum */}
        <mesh position={[0, -0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.45, 0.45, 1.6, 16]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.8} />
        </mesh>
        {/* Steel cables hanging down */}
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, -5.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 9.0, 6]} />
            <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.9} />
          </mesh>
        ))}
        {/* 100-Ton Heavy Lifting Crane Hook Block */}
        <group position={[0, -10.2, 0]}>
          <mesh>
            <boxGeometry args={[1.6, 1.2, 0.7]} />
            <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <torusGeometry args={[0.4, 0.12, 10, 20, Math.PI * 1.4]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.8} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function LaunchMount() {
  const s = 3.3;
  return (
    <group>
      <mesh position={[0, STACK.mount.y1 - 0.15, 0]}>
        <boxGeometry args={[6, 0.3, 6]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} />
      </mesh>
      {[-2.5, 2.5].flatMap((x) =>
        [-2.5, 2.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (STACK.mount.y1 - 0.3) / 2, z]}>
            <boxGeometry args={[0.6, STACK.mount.y1 - 0.3, 0.6]} />
            <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.5} />
          </mesh>
        )),
      )}
      {/* Safety yellow keep-out perimeter on floor around the launch mount */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, a]} position={[Math.sin(a) * s, 0.015, Math.cos(a) * s]}>
            <planeGeometry args={[s * 2 + 0.3, 0.32]} />
            <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Lattice service tower with balcony */
function Tower({ level }: { level: "level2" | "level3" }) {
  const v = VIEWPOINT_BY_LEVEL[level];
  const [tx, tz] = towerCentre(level);
  const deckY = v.position[1] - EYE;
  const height = deckY + 3.2;
  const half = 1.2;
  const braces = Array.from({ length: Math.floor(height / 3) }, (_, i) => (i + 1) * 3);

  return (
    <group>
      <group position={[tx, 0, tz]} rotation={[0, v.yaw, 0]}>
        {[-half, half].flatMap((x) =>
          [-half, half].map((z) => (
            <mesh key={`${x}${z}`} position={[x, height / 2, z]}>
              <boxGeometry args={[0.18, height, 0.18]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.45} metalness={0.3} />
            </mesh>
          )),
        )}
        {braces.flatMap((y) =>
          [0, 1, 2, 3].map((side) => {
            const a = (side * Math.PI) / 2;
            return (
              <mesh key={`${y}-${side}`} position={[Math.sin(a) * half, y, Math.cos(a) * half]} rotation={[0, a, 0]}>
                <boxGeometry args={[half * 2, 0.1, 0.1]} />
                <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.4} />
              </mesh>
            );
          }),
        )}
        <mesh position={[0, height + 0.1, 0]}>
          <boxGeometry args={[half * 2 + 0.3, 0.2, half * 2 + 0.3]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
      </group>

      {/* Balcony, in the viewpoint's own frame: local -Z faces the rocket */}
      <group position={[v.position[0], deckY, v.position[2]]} rotation={[0, v.yaw, 0]}>
        <mesh position={[0, -0.08, -0.4]}>
          <boxGeometry args={[3.2, 0.16, 3.2]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} />
        </mesh>
        {/* Safety railing: industrial vibrant yellow */}
        <mesh position={[0, 0.5, -2]}>
          <boxGeometry args={[3.2, 0.05, 0.05]} />
          <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
        <mesh position={[0, 0.08, -2]}>
          <boxGeometry args={[3.2, 0.16, 0.04]} />
          <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
        {[1.05, 0.5].map((y) => (
          <group key={y}>
            {[-1.6, 1.6].map((x) => (
              <mesh key={x} position={[x, y, -0.4]}>
                <boxGeometry args={[0.05, 0.05, 3.2]} />
                <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
              </mesh>
            ))}
          </group>
        ))}
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} position={[x, 0.53, -2]}>
            <boxGeometry args={[0.05, 1.06, 0.05]} />
            <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function LiftPanel({ lift }: { lift: LiftStop }) {
  return (
    <group rotation={[0, lift.rotationY, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.12, 1, 0.12]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.46, 0.42, 0.12]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      <mesh position={[0, 1.2, 0.065]}>
        <planeGeometry args={[0.34, 0.3]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGlass} />
      </mesh>
      <mesh position={[0, 1.2, 0.07]} rotation={[0, 0, (lift.direction * Math.PI) / 2]}>
        <circleGeometry args={[0.1, 3]} />
        <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
      </mesh>
    </group>
  );
}

/** Heavy Industrial Forklift parked on the hall floor */
function IndustrialForklift() {
  return (
    <group position={[-9.5, 0, 7.5]} rotation={[0, 0.6, 0]}>
      {/* Heavy yellow chassis */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.5, 0.7, 2.4]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.4} />
      </mesh>
      {/* Black rear counterweight */}
      <mesh position={[0, 0.65, 1.0]}>
        <boxGeometry args={[1.48, 0.8, 0.6]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} />
      </mesh>
      {/* 4 Solid rubber industrial tires */}
      {[
        [-0.8, 0.35, 0.7],
        [0.8, 0.35, 0.7],
        [-0.8, 0.35, -0.7],
        [0.8, 0.35, -0.7],
      ].map(([x, y, z]) => (
        <mesh key={`${x}${z}`} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
          <meshStandardMaterial color="#111827" roughness={0.8} />
        </mesh>
      ))}
      {/* Overhead Operator Protection Cage */}
      {[-0.65, 0.65].flatMap((x) =>
        [-0.4, 0.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.5, z]}>
            <boxGeometry args={[0.08, 1.2, 0.08]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[1.4, 0.06, 1.0]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      {/* Driver seat and steering wheel */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.5, 0.35, 0.5]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
      {/* Mast & Lifting Forks */}
      <mesh position={[0, 1.4, -1.25]}>
        <boxGeometry args={[0.9, 2.2, 0.12]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
      </mesh>
      {/* 2 Steel Forks extending forward */}
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, 0.08, -1.9]}>
          <boxGeometry args={[0.12, 0.05, 1.2]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Cryogenic Ground Support Equipment: high-pressure helium and nitrogen tanks */
function CryoSupplyTanks() {
  return (
    <group position={[9.0, 0, -4.5]} rotation={[0, -0.4, 0]}>
      {/* Heavy support skid */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.2, 0.2, 1.4]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} />
      </mesh>
      {/* 3 High-pressure cryogenic vessels */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <group key={x} position={[x, 1.1, 0]}>
          <mesh>
            <cylinderGeometry args={[0.26, 0.26, 1.8, 16]} />
            <meshStandardMaterial
              color={i === 1 ? SCENE_COLORS.spaceWhite : SCENE_COLORS.nasaBlue}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.26, 16, 12]} />
            <meshStandardMaterial color={i === 1 ? SCENE_COLORS.spaceWhite : SCENE_COLORS.nasaBlue} />
          </mesh>
          {/* Pressure gauge & brass regulator valve */}
          <mesh position={[0, 1.2, 0.15]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
            <meshStandardMaterial color={SCENE_COLORS.solarGold} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Stainless braided flexible umbilical hose leading toward rocket */}
      <mesh position={[-1.2, 0.15, -0.4]} rotation={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Set dressing on the hall floor: spare engine on cart, tool chests, workbench */
function Props() {
  return (
    <group>
      {/* Spare rocket engine on maintenance stand */}
      <group position={[8.5, 0, 7]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[2.2, 0.3, 1.5]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <cylinderGeometry args={[0.22, 0.58, 1.4, 16, 1, true]} />
          <meshStandardMaterial color={SCENE_COLORS.titanium} metalness={0.8} roughness={0.25} side={DoubleSide} />
        </mesh>
      </group>

      {/* Crates and shipping containers with NASA markings */}
      {[
        [-13, -9, 1.6, SCENE_COLORS.nasaBlue],
        [-11.4, -9.6, 1.2, SCENE_COLORS.nasaRed],
        [14, 9, 1.4, SCENE_COLORS.steelMid],
        [12.6, 10.4, 1, SCENE_COLORS.spaceWhite],
      ].map(([x, z, size, color]) => (
        <group key={`${x}${z}`} position={[x as number, (size as number) / 2, z as number]}>
          <mesh>
            <boxGeometry args={[size as number, size as number, size as number]} />
            <meshStandardMaterial color={color as string} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, (size as number) / 2 + 0.01]}>
            <planeGeometry args={[(size as number) * 0.4, (size as number) * 0.2]} />
            <meshBasicMaterial color={SCENE_COLORS.solarGold} />
          </mesh>
        </group>
      ))}

      {/* Workbench with computer terminal & red tool chest */}
      <group position={[-3.8, 0, 9.6]} rotation={[0, 0.35, 0]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[2.2, 0.08, 0.9]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} />
        </mesh>
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} position={[x, 0.45, 0]}>
            <boxGeometry args={[0.08, 0.9, 0.8]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} />
          </mesh>
        ))}
        {/* Rolling tool chest */}
        <mesh position={[0.4, 1.15, 0]}>
          <boxGeometry args={[0.65, 0.4, 0.35]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.4} />
        </mesh>
        {/* Computer monitor */}
        <mesh position={[-0.4, 1.22, 0]}>
          <boxGeometry args={[0.5, 0.38, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        <mesh position={[-0.4, 1.22, 0.045]}>
          <planeGeometry args={[0.44, 0.32]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- lively personnel */

/** Floor Level: Lead Propulsion Engineer patrolling with tablet */
function FloorEngineer() {
  const root = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime * 0.35;
    const x = Math.sin(t) * 3.5;
    const moving = Math.cos(t);
    if (root.current) {
      root.current.position.set(x, 0, 5.5);
      root.current.rotation.y = moving >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const stride = Math.sin(clock.elapsedTime * 3) * 0.35;
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride;
  });

  return (
    <group ref={root} position={[0, 0, 5.5]}>
      {/* Boots */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]}>
          <boxGeometry args={[0.13, 0.12, 0.26]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      ))}
      {/* Trousers */}
      <group ref={leftLeg} position={[-0.1, 0.48, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.72, 0.18]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.1, 0.48, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.72, 0.18]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>
      {/* High-visibility orange safety vest over white shirt */}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.42, 0.62, 0.26]} />
        <meshStandardMaterial color="#EA580C" roughness={0.5} />
      </mesh>
      {/* Silver reflective vest stripes */}
      <mesh position={[0, 1.15, 0.132]}>
        <planeGeometry args={[0.38, 0.08]} />
        <meshBasicMaterial color="#E0F2FE" />
      </mesh>
      {/* Head with white NASA hardhat */}
      <mesh position={[0, 1.58, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <sphereGeometry args={[0.15, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.64, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Holding Ruggedized Inspection Tablet */}
      <group position={[0, 1.05, 0.28]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.28, 0.38, 0.03]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <planeGeometry args={[0.24, 0.32]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
      </group>
    </group>
  );
}

/** Floor Level: Quality Inspector checking the stage 1 engine bells */
function FloorInspector() {
  const headRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (headRef.current) {
      headRef.current.rotation.x = -0.3 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
    }
  });

  return (
    <group position={[-2.4, 0, 3.2]} rotation={[0, Math.PI / 4, 0]}>
      {/* Trousers & Boots */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.32, 0.75, 0.22]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
      {/* Safety Yellow High-Vis Jacket */}
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.26]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>
      {/* Head with White Hardhat */}
      <group ref={headRef} position={[0, 1.56, 0]}>
        <mesh>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color="#FCD34D" />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.15, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>
      {/* Holding clipboard */}
      <mesh position={[0, 1.05, 0.22]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.2, 0.28, 0.02]} />
        <meshStandardMaterial color="#B45309" />
      </mesh>
    </group>
  );
}

/** Level 2: Technician with animated welding sparks inspecting the interstage */
function Level2Technician() {
  const sparkLight = useRef<PointLight>(null);
  const sparkMesh = useRef<MeshBasicMaterial>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (reduced) return;
    const flicker = Math.random() > 0.4 && Math.sin(clock.elapsedTime * 4) > -0.1;
    if (sparkLight.current) {
      sparkLight.current.intensity = flicker ? 2.5 + Math.random() * 2 : 0;
    }
    if (sparkMesh.current) {
      sparkMesh.current.color.set(flicker ? "#E0F2FE" : "#1E293B");
    }
  });

  return (
    <group position={[-3.8, 12.3, 2.8]} rotation={[0, 0.8, 0]}>
      {/* Technician in work coveralls */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.34, 0.75, 0.22]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.26]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.7} />
      </mesh>
      {/* Dark Welding Helmet with glowing visor */}
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[0.24, 0.26, 0.24]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 1.55, 0.125]}>
        <planeGeometry args={[0.12, 0.08]} />
        <meshBasicMaterial color={SCENE_COLORS.solarGold} />
      </mesh>

      {/* Welding Torch extending toward interstage */}
      <group position={[0.2, 1.05, 0.35]} rotation={[0.2, 0.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.8} />
        </mesh>
        {/* Arc Flash & Sparks */}
        <mesh position={[0, 0.24, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial ref={sparkMesh} color="#E0F2FE" />
        </mesh>
        <pointLight ref={sparkLight} position={[0, 0.25, 0]} color="#38BDF8" intensity={0} distance={4} />
      </group>
    </group>
  );
}

/** Level 3: Cleanroom Technician in white bunny suit inspecting the crew capsule */
function Level3Technician() {
  const root = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (root.current) {
      root.current.position.y = 21.25 + Math.sin(clock.elapsedTime * 1.5) * 0.01;
    }
  });

  return (
    <group ref={root} position={[4.6, 21.25, 3.2]} rotation={[0, -0.9, 0]}>
      {/* Pristine White Cleanroom "Bunny Suit" */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.34, 0.75, 0.22]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.26]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
      </mesh>
      {/* Cleanroom Hood & Goggles */}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.14, 14, 14]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.56, 0.12]}>
        <boxGeometry args={[0.18, 0.06, 0.04]} />
        <meshStandardMaterial color="#0284C7" metalness={0.7} />
      </mesh>
      {/* Blue Nitrile Gloves */}
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, 0.95, 0.15]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#0284C7" />
        </mesh>
      ))}
      {/* Telemetry data pad */}
      <mesh position={[0, 1.05, 0.25]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.22, 0.32, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 1.05, 0.262]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[0.18, 0.26]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGreen} />
      </mesh>
    </group>
  );
}
