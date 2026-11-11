"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Hotspot } from "@/components/viewport/Hotspot";
import { LightingRig } from "@/components/viewport/LightingRig";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PALETTE } from "@/lib/palette";
import { VITAL_STATIONS, type StationId } from "@/mocks/vitals";
import type { LocalizedText } from "@/i18n";
import { BACK_Z, CORRIDOR_LENGTH, DOOR, DOOR_PANEL, ROOM, STATIONS } from "./layout";

interface MedicalWorldProps {
  doorOpen: boolean;
  checked: ReadonlySet<StationId>;
  onOpenDoor: () => void;
  onInspect: (id: StationId) => void;
}

const DOOR_LABEL: LocalizedText = { en: "Door control: OPEN", vi: "Bảng điều khiển cửa: MỞ" };

/** Scene 1 geometry: a short corridor, the sliding door, and the medical bay with three stations. */
export function MedicalWorld({ doorOpen, checked, onOpenDoor, onInspect }: MedicalWorldProps) {
  const name = (id: StationId) => VITAL_STATIONS.find((s) => s.id === id)!.name;

  return (
    <>
      <LightingRig />
      <Corridor />
      <FrontWall />
      <SlidingDoor open={doorOpen} />
      {!doorOpen && (
        <Hotspot id="door" label={DOOR_LABEL} position={DOOR_PANEL} markerHeight={0.45} onActivate={onOpenDoor}>
          <mesh>
            <boxGeometry args={[0.32, 0.42, 0.08]} />
            <meshStandardMaterial color={PALETTE.deep} />
          </mesh>
          <mesh position={[0, 0.02, 0.045]}>
            <planeGeometry args={[0.22, 0.22]} />
            <meshBasicMaterial color={PALETTE.gold} />
          </mesh>
        </Hotspot>
      )}

      <Room />
      <ExamBed />
      <Cabinet />

      {(
        [
          ["heart", <HeartMonitor key="h" rotationY={STATIONS.heart.rotationY} />],
          ["pressure", <PressureStation key="p" rotationY={STATIONS.pressure.rotationY} />],
          ["vision", <VisionChart key="v" />],
        ] as const
      ).map(([id, model]) =>
        // Stations only become interactive once the door is open: the first beat teaches one thing.
        doorOpen ? (
          <Hotspot
            key={id}
            id={id}
            label={name(id)}
            position={STATIONS[id].position}
            markerHeight={STATIONS[id].marker}
            done={checked.has(id)}
            onActivate={() => onInspect(id)}
          >
            {model}
          </Hotspot>
        ) : (
          <group key={id} position={STATIONS[id].position}>
            {model}
          </group>
        ),
      )}
    </>
  );
}

function Corridor() {
  const len = CORRIDOR_LENGTH;
  const z = ROOM.frontZ + len / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z]}>
        <planeGeometry args={[3, len]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.6, z]}>
        <planeGeometry args={[3, len]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 1.3, z]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[len, 2.6]} />
          <meshStandardMaterial color={PALETTE.mist} />
        </mesh>
      ))}
      {/* Ceiling strip light leading the eye to the door. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.59, z]}>
        <planeGeometry args={[0.3, len - 0.4]} />
        <meshBasicMaterial color={PALETTE.mist} />
      </mesh>
    </group>
  );
}

/** Front wall of the bay with a door-sized hole, built from three boxes. */
function FrontWall() {
  const side = (ROOM.width - DOOR.width) / 2;
  const z = ROOM.frontZ;
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DOOR.width / 2 + side / 2), ROOM.height / 2, z]}>
          <boxGeometry args={[side, ROOM.height, 0.15]} />
          <meshStandardMaterial color={PALETTE.mist} />
        </mesh>
      ))}
      <mesh position={[0, DOOR.height + (ROOM.height - DOOR.height) / 2, z]}>
        <boxGeometry args={[DOOR.width, ROOM.height - DOOR.height, 0.15]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
      {/* Gold frame around the opening. */}
      <mesh position={[0, DOOR.height + 0.04, z + 0.08]}>
        <boxGeometry args={[DOOR.width + 0.16, 0.08, 0.02]} />
        <meshBasicMaterial color={PALETTE.gold} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DOOR.width / 2 + 0.04), DOOR.height / 2, z + 0.08]}>
          <boxGeometry args={[0.08, DOOR.height, 0.02]} />
          <meshBasicMaterial color={PALETTE.gold} />
        </mesh>
      ))}
    </group>
  );
}

function SlidingDoor({ open }: { open: boolean }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const amount = useRef(0);
  const reduced = useReducedMotion();
  const half = DOOR.width / 2;

  useFrame((_, dt) => {
    const goal = open ? 1 : 0;
    amount.current = reduced ? goal : amount.current + (goal - amount.current) * (1 - Math.exp(-5 * Math.min(dt, 0.1)));
    const shift = amount.current * (half + 0.02);
    if (left.current) left.current.position.x = -half / 2 - shift;
    if (right.current) right.current.position.x = half / 2 + shift;
  });

  return (
    <group position={[0, DOOR.height / 2, ROOM.frontZ]}>
      {[left, right].map((ref, i) => (
        <group key={i} ref={ref} position={[(i === 0 ? -1 : 1) * (half / 2), 0, 0]}>
          <mesh>
            <boxGeometry args={[half, DOOR.height, 0.06]} />
            <meshStandardMaterial color={PALETTE.blue} />
          </mesh>
          {/* Hazard band at hand height; a pair of windows here read as a face. */}
          <mesh position={[0, -0.05, 0.035]}>
            <planeGeometry args={[half, 0.16]} />
            <meshBasicMaterial color={PALETTE.gold} />
          </mesh>
          <mesh position={[(i === 0 ? 1 : -1) * (half / 2 - 0.03), 0, 0.035]}>
            <planeGeometry args={[0.04, DOOR.height]} />
            <meshBasicMaterial color={PALETTE.deep} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Room() {
  const cz = ROOM.frontZ - ROOM.depth / 2;
  const hw = ROOM.width / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, cz]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, ROOM.height / 2, BACK_Z]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
      {[-hw, hw].map((x) => (
        <mesh key={x} position={[x, ROOM.height / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[ROOM.depth, ROOM.height]} />
          <meshStandardMaterial color={PALETTE.mist} />
        </mesh>
      ))}
      {/* Wainscot band so walls and floor read apart after quantisation. */}
      {[-hw + 0.01, hw - 0.01].map((x) => (
        <mesh key={x} position={[x, 0.45, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[ROOM.depth, 0.9]} />
          <meshStandardMaterial color={PALETTE.blue} />
        </mesh>
      ))}
      {/* Ceiling light panels. */}
      {[-1.4, 1.4].flatMap((x) =>
        [0.2, -2.6].map((z) => (
          <mesh key={`${x}${z}`} rotation={[Math.PI / 2, 0, 0]} position={[x, ROOM.height - 0.01, z]}>
            <planeGeometry args={[1.1, 0.6]} />
            <meshBasicMaterial color={PALETTE.mist} />
          </mesh>
        )),
      )}
    </group>
  );
}

function ExamBed() {
  return (
    <group position={[-1.9, 0, BACK_Z + 1.3]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.9, 0.5, 0.75]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <boxGeometry args={[1.85, 0.14, 0.72]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
      <mesh position={[0.7, 0.78, 0]}>
        <boxGeometry args={[0.35, 0.1, 0.55]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
    </group>
  );
}

function Cabinet() {
  return (
    <group position={[2.6, 0, BACK_Z + 0.4]}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1, 2, 0.6]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, 1.55, 0.31]}>
        <planeGeometry args={[0.18, 0.18]} />
        <meshBasicMaterial color={PALETTE.orange} />
      </mesh>
    </group>
  );
}

function HeartMonitor({ rotationY }: { rotationY: number }) {
  // ECG trace made of short segments, drawn on the screen.
  const trace: [number, number, number][] = [
    [-0.3, 0, 0.18],
    [-0.13, 0.08, 0.06],
    [-0.08, -0.06, 0.08],
    [-0.02, 0.14, 0.12],
    [0.05, -0.04, 0.1],
    [0.2, 0, 0.22],
  ];
  return (
    <group rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.6, 0.12, 0.6]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.3, 8]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
      <mesh position={[0, 1.45, 0.05]}>
        <boxGeometry args={[0.8, 0.55, 0.12]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, 1.45, 0.115]}>
        <planeGeometry args={[0.7, 0.45]} />
        <meshBasicMaterial color={PALETTE.deep} />
      </mesh>
      {trace.map(([x, y, w], i) => (
        <mesh key={i} position={[x, 1.45 + y, 0.12]} rotation={[0, 0, i % 2 ? 0.9 : -0.9]}>
          <planeGeometry args={[w, 0.025]} />
          <meshBasicMaterial color={PALETTE.gold} />
        </mesh>
      ))}
    </group>
  );
}

function PressureStation({ rotationY }: { rotationY: number }) {
  return (
    <group rotation={[0, rotationY, 0]}>
      {/* Chair. */}
      <mesh position={[0, 0.45, 0.5]}>
        <boxGeometry args={[0.55, 0.1, 0.55]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, 0.85, 0.75]}>
        <boxGeometry args={[0.55, 0.7, 0.08]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, 0.22, 0.5]}>
        <boxGeometry args={[0.08, 0.45, 0.08]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      {/* Side table with the cuff unit. */}
      <mesh position={[0, 0.75, -0.2]}>
        <boxGeometry args={[0.7, 0.06, 0.5]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
      <mesh position={[0, 0.37, -0.2]}>
        <boxGeometry args={[0.08, 0.74, 0.08]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, 0.92, -0.25]}>
        <boxGeometry args={[0.36, 0.28, 0.22]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh position={[0, 0.95, -0.135]}>
        <planeGeometry args={[0.24, 0.12]} />
        <meshBasicMaterial color={PALETTE.gold} />
      </mesh>
      {/* Cuff, an orange band resting on the table. */}
      <mesh position={[0.22, 0.81, -0.05]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.07, 0.035, 6, 12]} />
        <meshStandardMaterial color={PALETTE.orange} />
      </mesh>
    </group>
  );
}

/** Eye chart: rows of shrinking bars, plus a floor line marking where to stand. */
function VisionChart() {
  const rows = [0.5, 0.4, 0.32, 0.25, 0.19, 0.14];
  return (
    <group>
      <mesh position={[0, 1.6, 0.02]}>
        <planeGeometry args={[0.9, 1.5]} />
        <meshBasicMaterial color={PALETTE.mist} />
      </mesh>
      <mesh position={[0, 1.6, 0.01]}>
        <planeGeometry args={[1, 1.6]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      {rows.map((w, i) => (
        <mesh key={i} position={[0, 2.18 - i * 0.2, 0.03]}>
          <planeGeometry args={[w, 0.09 - i * 0.008]} />
          <meshBasicMaterial color={PALETTE.deep} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 3]}>
        <planeGeometry args={[0.8, 0.08]} />
        <meshBasicMaterial color={PALETTE.gold} />
      </mesh>
    </group>
  );
}
