"use client";

import { DoubleSide } from "three";
import { Hotspot } from "@/components/viewport/Hotspot";
import { LightingRig } from "@/components/viewport/LightingRig";
import { useSceneStore } from "@/game/sceneStore";
import { PALETTE } from "@/lib/palette";
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
 * Scene 2 geometry: the assembly hall, the Moon rocket on its mount, and two gantry towers.
 * Only the parts of the level the player stands on are interactive; the rest of the stack is
 * scenery until they take the lift, which keeps each stop to a small, readable set of choices.
 */
export function WorkshopWorld({ level, inspected, activeId, onInspect, onLift }: WorkshopWorldProps) {
  const highlightedId = useSceneStore((s) => s.highlightedId);

  return (
    <>
      <LightingRig />
      {/* Neutral fill from the level-2 side: the rig's key comes from +X, which left the hull
          facing that balcony lit by the hemisphere only, and blue quantised down to deep. */}
      <directionalLight position={[-6, 8, 5]} color={PALETTE.mist} intensity={1.4} />
      <Hall />
      <LaunchMount />
      <Tower level="level2" />
      <Tower level="level3" />
      <Props />

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
  // Highlighting repaints the part's main surfaces gold: one palette colour, no extra light.
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
  const bell = hot ? PALETTE.gold : PALETTE.deep;
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
        <cylinderGeometry args={[STACK.stage1.r, r, 0.6, 20]} />
        <meshStandardMaterial color={hot ? PALETTE.gold : PALETTE.deep} />
      </mesh>
      <mesh position={[0, y1 - 0.65, 0]}>
        <cylinderGeometry args={[r, r, 0.1, 20]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      {spots.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, bellY, z]}>
          <mesh>
            <cylinderGeometry args={[0.22, 0.55, bellH, 12, 1, true]} />
            <meshStandardMaterial color={bell} side={DoubleSide} />
          </mesh>
          <mesh position={[0, bellH / 2 + 0.12, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.24, 8]} />
            <meshStandardMaterial color={PALETTE.mist} />
          </mesh>
        </group>
      ))}
      {/* Four fins at 45°, the classic silhouette cue for "first stage". */}
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 1.95, y1 - 0.2, Math.cos(a) * 1.95]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.12, 1.7, 0.9]} />
            <meshStandardMaterial color={PALETTE.blue} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A quarter (or other arc) of a cylinder wall, slightly proud of the hull: roll-pattern paint. */
function Band({ r, y0, y1, color, theta = 0, arc = Math.PI * 2 }: { r: number; y0: number; y1: number; color: string; theta?: number; arc?: number }) {
  return (
    <mesh position={[0, (y0 + y1) / 2, 0]}>
      <cylinderGeometry args={[r + 0.015, r + 0.015, y1 - y0, 24, 1, arc < Math.PI * 2, theta, arc]} />
      <meshStandardMaterial color={color} side={arc < Math.PI * 2 ? DoubleSide : undefined} />
    </mesh>
  );
}

function Stage1Tanks({ main }: { main: string }) {
  const { y0, y1, r } = STACK.stage1;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 24]} />
        <meshStandardMaterial color={main} />
      </mesh>
      <Band r={r} y0={y0} y1={y0 + 0.7} color={PALETTE.deep} />
      {/* Roll pattern: alternating quarters so the rocket's spin reads on camera. */}
      {[0, Math.PI].map((t) => (
        <Band key={t} r={r} y0={y0 + 0.7} y1={y0 + 2.4} color={PALETTE.deep} theta={t} arc={Math.PI / 2} />
      ))}
      <Band r={r} y0={7.5} y1={7.8} color={PALETTE.deep} />
      <Band r={r} y0={y1 - 0.5} y1={y1} color={PALETTE.deep} />
    </group>
  );
}

function Interstage({ hot }: { hot: boolean }) {
  const { y0, y1, r0, r1 } = STACK.interstage;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0, 24]} />
        {/* Blue, not deep: from level 2 the interstage is seen against the dark hall wall. */}
        <meshStandardMaterial color={hot ? PALETTE.gold : PALETTE.blue} />
      </mesh>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[(r0 + r1) / 2 + 0.02, (r0 + r1) / 2 + 0.06, 0.18, 24]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
    </group>
  );
}

function Stage2({ main }: { main: string }) {
  const { y0, y1, r } = STACK.stage2;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 24]} />
        <meshStandardMaterial color={main} />
      </mesh>
      <Band r={r} y0={y0} y1={y0 + 0.5} color={PALETTE.deep} />
      {[Math.PI / 2, (3 * Math.PI) / 2].map((t) => (
        <Band key={t} r={r} y0={y0 + 0.5} y1={y0 + 1.7} color={PALETTE.deep} theta={t} arc={Math.PI / 2} />
      ))}
      <Band r={r} y0={y1 - 0.45} y1={y1} color={PALETTE.deep} />
    </group>
  );
}

function LanderInAdapter({ hot }: { hot: boolean }) {
  const { y0, y1, r0, r1 } = STACK.adapter;
  // A window is cut in the adapter on the side facing gantry level 3, so the lander shows.
  const windowArc = 1.5;
  const start = facingTheta("level3") + windowArc / 2;
  const body = hot ? PALETTE.gold : PALETTE.orange;
  const legs: [number, number][] = [
    [0.62, 0.62],
    [-0.62, 0.62],
    [0.62, -0.62],
    [-0.62, -0.62],
  ];
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0, 24, 1, true, start, Math.PI * 2 - windowArc]} />
        <meshStandardMaterial color={hot ? PALETTE.gold : PALETTE.mist} side={DoubleSide} />
      </mesh>
      {/* Lander: foil-wrapped descent stage, crew cabin on top, splayed legs. */}
      <group position={[0, y0 + 0.2, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.6, 8]} />
          <meshStandardMaterial color={body} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[0.7, 0.6, 0.6]} />
          <meshStandardMaterial color={PALETTE.mist} />
        </mesh>
        <mesh position={[0, 1.3, 0.31]}>
          <planeGeometry args={[0.24, 0.18]} />
          <meshBasicMaterial color={PALETTE.deep} />
        </mesh>
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x * 0.85, 0.25, z * 0.85]} rotation={[z * 0.5, 0, -x * 0.5]}>
            <cylinderGeometry args={[0.035, 0.035, 0.75, 5]} />
            <meshStandardMaterial color={PALETTE.gold} />
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
        <cylinderGeometry args={[r, r, y1 - y0, 24]} />
        <meshStandardMaterial color={main} />
      </mesh>
      {/* Radiator panels and four thruster quads. */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Band key={i} r={r} y0={y0 + 0.2} y1={y1 - 0.5} color={PALETTE.blue} theta={(i * Math.PI) / 3} arc={0.35} />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const a = t + Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * (r + 0.08), y1 - 0.3, Math.cos(a) * (r + 0.08)]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.22, 0.22, 0.12]} />
            <meshStandardMaterial color={PALETTE.deep} />
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
        <cylinderGeometry args={[r0 + 0.02, r0 + 0.02, 0.08, 24]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, (y0 + y1) / 2 + 0.04, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0 - 0.08, 24]} />
        <meshStandardMaterial color={main} />
      </mesh>
      {/* One hatch window, off-centre; the marker sits on the other side (see layout MARKER_AT). */}
      {[0.4].map((d) => (
        <mesh
          key={d}
          position={[Math.sin(t + d) * 0.66, y0 + 0.75, Math.cos(t + d) * 0.66]}
          rotation={[-0.45, t + d, 0, "YXZ"]}
        >
          <planeGeometry args={[0.16, 0.16]} />
          <meshBasicMaterial color={PALETTE.deep} />
        </mesh>
      ))}
    </group>
  );
}

function EscapeTower({ hot }: { hot: boolean }) {
  const { y0, y1 } = STACK.tower;
  const trussTop = y0 + 1.4;
  const struts = hot ? PALETTE.gold : PALETTE.orange;
  return (
    <group>
      {[
        [0.22, 0.22],
        [-0.22, 0.22],
        [0.22, -0.22],
        [-0.22, -0.22],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (y0 + trussTop) / 2, z]}>
          <cylinderGeometry args={[0.035, 0.035, trussTop - y0, 4]} />
          <meshStandardMaterial color={struts} />
        </mesh>
      ))}
      <mesh position={[0, y0 + 0.7, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshStandardMaterial color={struts} />
      </mesh>
      <mesh position={[0, (trussTop + y1 - 0.6) / 2, 0]}>
        <cylinderGeometry args={[0.22, 0.24, y1 - 0.6 - trussTop, 12]} />
        <meshStandardMaterial color={hot ? PALETTE.gold : PALETTE.mist} />
      </mesh>
      <mesh position={[0, y1 - 0.3, 0]}>
        <coneGeometry args={[0.22, 0.6, 12]} />
        <meshStandardMaterial color={struts} />
      </mesh>
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      {/* Back wall with the rollout door: the way the rocket leaves, so it gets the hazard band. */}
      <mesh position={[0, h / 2, HALL.minZ]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, door.height / 2, HALL.minZ + 0.02]}>
        <planeGeometry args={[door.width, door.height]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, door.height / 2, HALL.minZ + 0.04]}>
          <planeGeometry args={[0.12, door.height]} />
          <meshBasicMaterial color={PALETTE.deep} />
        </mesh>
      ))}
      <mesh position={[0, 0.6, HALL.minZ + 0.05]}>
        <planeGeometry args={[door.width, 1.2]} />
        <meshBasicMaterial color={PALETTE.gold} />
      </mesh>
      {/* Side and front walls, with structural ribs every 6 m. */}
      {[HALL.minX, HALL.maxX].map((x) => (
        <group key={x}>
          <mesh position={[x, h / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[d, h]} />
            <meshStandardMaterial color={PALETTE.deep} />
          </mesh>
          {[-12, -6, 0, 6, 12].map((z) => (
            <mesh key={z} position={[x + (x < 0 ? 0.3 : -0.3), h / 2, z]}>
              <boxGeometry args={[0.6, h, 0.6]} />
              <meshStandardMaterial color={PALETTE.blue} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, h / 2, HALL.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      {/* Ceiling light rows and the overhead crane girder. */}
      {[-10, 0, 10].flatMap((x) =>
        [-10, 0, 10].map((z) => (
          <mesh key={`${x}${z}`} rotation={[Math.PI / 2, 0, 0]} position={[x, h - 0.02, z]}>
            <planeGeometry args={[4, 1]} />
            <meshBasicMaterial color={PALETTE.mist} />
          </mesh>
        )),
      )}
      <mesh position={[0, h - 3, -2]}>
        <boxGeometry args={[w, 1.2, 1]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      {/* Walkway line from the player toward the rocket: the hall's leading line. */}
      {[5, 7, 9, 11].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[0.25, 1.1]} />
          <meshBasicMaterial color={PALETTE.mist} />
        </mesh>
      ))}
    </group>
  );
}

function LaunchMount() {
  const s = 3.3;
  return (
    <group>
      <mesh position={[0, STACK.mount.y1 - 0.15, 0]}>
        <boxGeometry args={[6, 0.3, 6]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      {[-2.5, 2.5].flatMap((x) =>
        [-2.5, 2.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (STACK.mount.y1 - 0.3) / 2, z]}>
            <boxGeometry args={[0.6, STACK.mount.y1 - 0.3, 0.6]} />
            <meshStandardMaterial color={PALETTE.blue} />
          </mesh>
        )),
      )}
      {/* Gold keep-out square on the floor around the mount. */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, a]} position={[Math.sin(a) * s, 0.012, Math.cos(a) * s]}>
            <planeGeometry args={[s * 2 + 0.3, 0.3]} />
            <meshBasicMaterial color={PALETTE.gold} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A lattice service tower with a balcony at its gantry level, aligned to that level's view. */
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
              <meshStandardMaterial color={PALETTE.blue} />
            </mesh>
          )),
        )}
        {braces.flatMap((y) =>
          [0, 1, 2, 3].map((side) => {
            const a = (side * Math.PI) / 2;
            return (
              <mesh key={`${y}-${side}`} position={[Math.sin(a) * half, y, Math.cos(a) * half]} rotation={[0, a, 0]}>
                <boxGeometry args={[half * 2, 0.1, 0.1]} />
                <meshStandardMaterial color={PALETTE.deep} />
              </mesh>
            );
          }),
        )}
        <mesh position={[0, height + 0.1, 0]}>
          <boxGeometry args={[half * 2 + 0.3, 0.2, half * 2 + 0.3]} />
          <meshStandardMaterial color={PALETTE.deep} />
        </mesh>
      </group>

      {/* Balcony, in the viewpoint's own frame: local -Z faces the rocket. */}
      <group position={[v.position[0], deckY, v.position[2]]} rotation={[0, v.yaw, 0]}>
        <mesh position={[0, -0.08, -0.4]}>
          <boxGeometry args={[3.2, 0.16, 3.2]} />
          <meshStandardMaterial color={PALETTE.deep} />
        </mesh>
        {/* Safety railing: gold, so the edge reads even after the pixel pass. */}
        {/* The front has no top rail: at eye level minus 0.6 m it would cut across the rocket. */}
        <mesh position={[0, 0.5, -2]}>
          <boxGeometry args={[3.2, 0.05, 0.05]} />
          <meshStandardMaterial color={PALETTE.gold} />
        </mesh>
        <mesh position={[0, 0.08, -2]}>
          <boxGeometry args={[3.2, 0.16, 0.04]} />
          <meshStandardMaterial color={PALETTE.gold} />
        </mesh>
        {[1.05, 0.5].map((y) => (
          <group key={y}>
            {[-1.6, 1.6].map((x) => (
              <mesh key={x} position={[x, y, -0.4]}>
                <boxGeometry args={[0.05, 0.05, 3.2]} />
                <meshStandardMaterial color={PALETTE.gold} />
              </mesh>
            ))}
          </group>
        ))}
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} position={[x, 0.53, -2]}>
            <boxGeometry args={[0.05, 1.06, 0.05]} />
            <meshStandardMaterial color={PALETTE.gold} />
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
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.46, 0.42, 0.12]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, 1.2, 0.065]}>
        <planeGeometry args={[0.34, 0.3]} />
        <meshBasicMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, 1.2, 0.07]} rotation={[0, 0, (lift.direction * Math.PI) / 2]}>
        <circleGeometry args={[0.1, 3]} />
        <meshBasicMaterial color={PALETTE.gold} />
      </mesh>
    </group>
  );
}

/** Set dressing on the hall floor: a spare engine on a cart, crates, a workbench. */
function Props() {
  return (
    <group>
      <group position={[8.5, 0, 7]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[2, 0.3, 1.4]} />
          <meshStandardMaterial color={PALETTE.blue} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <cylinderGeometry args={[0.22, 0.55, 1.4, 12, 1, true]} />
          <meshStandardMaterial color={PALETTE.deep} side={DoubleSide} />
        </mesh>
      </group>
      {[
        [-13, -9, 1.6, PALETTE.blue],
        [-11.4, -9.6, 1.2, PALETTE.orange],
        [14, 9, 1.4, PALETTE.blue],
        [12.6, 10.4, 1, PALETTE.blue],
      ].map(([x, z, size, color]) => (
        <mesh key={`${x}${z}`} position={[x as number, (size as number) / 2, z as number]}>
          <boxGeometry args={[size as number, size as number, size as number]} />
          <meshStandardMaterial color={color as string} />
        </mesh>
      ))}
      <group position={[-3.4, 0, 9.6]} rotation={[0, 0.35, 0]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[1.8, 0.08, 0.8]} />
          <meshStandardMaterial color={PALETTE.mist} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} position={[x, 0.45, 0]}>
            <boxGeometry args={[0.08, 0.9, 0.7]} />
            <meshStandardMaterial color={PALETTE.deep} />
          </mesh>
        ))}
        <mesh position={[0.3, 1.04, 0]}>
          <boxGeometry args={[0.5, 0.2, 0.3]} />
          <meshStandardMaterial color={PALETTE.orange} />
        </mesh>
      </group>
    </group>
  );
}
