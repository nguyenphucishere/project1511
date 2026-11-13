"use client";

import { useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Color, MathUtils, Quaternion, Vector3, type Group, type MeshStandardMaterial } from "three";
import { Hotspot } from "@/components/viewport/Hotspot";
import { SCENE_COLORS } from "@/lib/palette";
import { TOOL_NAME, type ToolId } from "./content";
import { BOLT_COUNT, BOLT_LABEL } from "./handworkRules";
import { BENCH, FLANGE, facingTheta } from "./layout";

/**
 * Shared, mutable state of the flange bolts. The torque HUD writes it while the player turns the
 * wrench; the 3D bolts and the wrench in hand read it every frame.
 */
export const bolts = {
  /** Bolt currently under the wrench, or -1. */
  active: -1,
  /** True while the player is holding the turn key. */
  turning: false,
  /** Torque 0..1 of the bolt under the wrench. */
  torque: 0,
  angle: Array.from({ length: BOLT_COUNT }, () => 0),
  /** How far each bolt is seated, 0 (proud) to 1 (flush at torque). */
  seat: Array.from({ length: BOLT_COUNT }, () => 0),
  /** Seconds left of the red "stripped" flash per bolt. */
  stripped: Array.from({ length: BOLT_COUNT }, () => 0),
};

export function resetBolts() {
  bolts.active = -1;
  bolts.turning = false;
  bolts.torque = 0;
  bolts.angle.fill(0);
  bolts.seat.fill(0);
  bolts.stripped.fill(0);
}

export function boltPosition(i: number): [number, number, number] {
  const theta = boltTheta(i);
  return [Math.sin(theta) * FLANGE.r, FLANGE.y, Math.cos(theta) * FLANGE.r];
}

function boltTheta(i: number) {
  return facingTheta("level2") + (i - (BOLT_COUNT - 1) / 2) * FLANGE.spread;
}

/* ---------------------------------------------------------------- tool models */

const CHROME = { color: "#d3d9e0", metalness: 0.95, roughness: 0.22 } as const;

/** Click-type torque wrench, lying along local +x. About 0.7 m long. */
export function TorqueWrench() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.017, 0.017, 0.5, 14]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      {/* Black knurled grip and the yellow setting collar */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.42, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.24, 16]} />
        <meshStandardMaterial color="#14181d" roughness={0.85} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.28, 0, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.05, 16]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
      </mesh>
      {/* Ratchet head and square drive */}
      <mesh position={[-0.1, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.05, 20]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      <mesh position={[-0.1, 0, 0.034]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.03, 8]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Hammer() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.16, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.016, 0.42, 10]} />
        <meshStandardMaterial color="#9a6a3a" roughness={0.8} />
      </mesh>
      <mesh position={[-0.05, 0, 0]}>
        <boxGeometry args={[0.07, 0.05, 0.1]} />
        <meshStandardMaterial color="#6b7480" metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[-0.05, 0.05, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.025, 0.07, 0.03]} />
        <meshStandardMaterial color="#6b7480" metalness={0.9} roughness={0.35} />
      </mesh>
    </group>
  );
}

function PipeWrench() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.14, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.02, 0.5, 10]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[-0.12, 0.02, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.035]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[-0.15, 0.065, 0]}>
        <boxGeometry args={[0.05, 0.035, 0.03]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Screwdriver() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.026, 0.14, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.55} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.06, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.2, 8]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  );
}

const TOOL_MODEL: Record<ToolId, () => ReactNode> = {
  torque: () => <TorqueWrench />,
  hammer: () => <Hammer />,
  pipe: () => <PipeWrench />,
  driver: () => <Screwdriver />,
};

/* ---------------------------------------------------------------- bench */

const TOOL_SLOTS: { id: ToolId; x: number; yaw: number }[] = [
  { id: "hammer", x: -0.85, yaw: 0.25 },
  { id: "torque", x: -0.3, yaw: -0.1 },
  { id: "pipe", x: 0.3, yaw: 0.18 },
  { id: "driver", x: 0.78, yaw: -0.3 },
];

/**
 * The tool bench: pegboard, shelf and four tools on the top. While `interactive`, each tool is
 * clickable; the chosen one leaves the bench (the caller tracks which is in hand).
 */
export function ToolBench({
  interactive,
  held,
  onPick,
  wrong,
}: {
  interactive: boolean;
  held: ToolId | null;
  onPick: (id: ToolId) => void;
  /** The last wrong pick: that tool hops back onto the bench. `n` changes on every pick. */
  wrong: { id: ToolId; n: number } | null;
}) {
  return (
    <>
    <group position={[BENCH.x, 0, BENCH.z]}>
      {/* Bench top, legs, lower shelf */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.07, 0.85]} />
        <meshStandardMaterial color="#8a6a45" roughness={0.7} />
      </mesh>
      {[-1.1, 1.1].flatMap((x) => [-0.35, 0.35].map((z) => ({ x, z }))).map(({ x, z }) => (
        <mesh key={`${x}${z}`} position={[x, 0.45, z]}>
          <boxGeometry args={[0.07, 0.9, 0.07]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[2.2, 0.05, 0.75]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0.5, 0.45, 0.1]}>
        <boxGeometry args={[0.7, 0.3, 0.45]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.45} metalness={0.3} />
      </mesh>
      {/* Pegboard with hooks and tool outlines */}
      <mesh position={[0, 1.6, -0.42]}>
        <boxGeometry args={[2.3, 1.1, 0.04]} />
        <meshStandardMaterial color="#2a3340" roughness={0.8} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-0.95 + i * 0.38, 1.7 - (i % 2) * 0.28, -0.38]}>
          <boxGeometry args={[0.04, 0.2, 0.03]} />
          <meshStandardMaterial color={i % 2 ? "#c9d1d9" : SCENE_COLORS.safetyYellow} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
    </group>

    {TOOL_SLOTS.map((slot) => {
      if (held === slot.id) return null;
      const model = (
        <Hop nonce={wrong?.id === slot.id ? wrong.n : 0}>
          <group rotation={[0, slot.yaw, 0]}>{TOOL_MODEL[slot.id]()}</group>
        </Hop>
      );
      const at: [number, number, number] = [BENCH.x + slot.x, 0.98, BENCH.z + 0.08];
      return interactive ? (
        <Hotspot
          key={slot.id}
          id={`tool-${slot.id}`}
          label={TOOL_NAME[slot.id]}
          position={at}
          markerHeight={0.34}
          markerScale={0.8}
          onActivate={() => onPick(slot.id)}
        >
          {model}
        </Hotspot>
      ) : (
        <group key={slot.id} position={at}>
          {model}
        </group>
      );
    })}
    </>
  );
}

/** Hops once whenever `nonce` changes: a tool dropped back on the bench after a wrong pick. */
function Hop({ nonce, children }: { nonce: number; children: ReactNode }) {
  const root = useRef<Group>(null);
  const seen = useRef(nonce);
  const t = useRef(1);
  useFrame((_, dt) => {
    if (seen.current !== nonce) {
      seen.current = nonce;
      t.current = 0;
    }
    const g = root.current;
    if (!g) return;
    t.current = Math.min(1, t.current + dt / 0.55);
    const k = t.current;
    g.position.y = k < 1 ? Math.sin(k * Math.PI) * 0.2 : 0;
    g.rotation.y = k < 1 ? Math.sin(k * Math.PI) * 0.9 : 0;
  });
  return <group ref={root}>{children}</group>;
}

/* ---------------------------------------------------------------- in hand */

const HAND_REST = new Vector3(0.36, -0.32, -0.62);
const HAND_WORK = new Vector3(0.12, -0.2, -0.78);
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();

/** The torque wrench held at the lower right of the view; it leans into the work when turning. */
export function HeldWrench() {
  const camera = useThree((s) => s.camera);
  const root = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const offset = useRef(HAND_REST.clone());

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const working = bolts.active >= 0;
    offset.current.lerp(working ? HAND_WORK : HAND_REST, 1 - Math.exp(-dt * 8));
    tmpPos.copy(offset.current).applyQuaternion(camera.quaternion).add(camera.position);
    g.position.copy(tmpPos);
    tmpQuat.copy(camera.quaternion);
    g.quaternion.copy(tmpQuat);
    if (inner.current) {
      // Resting: angled up like a tool carried at the hip; working: pitched toward the bolt, rocking as it ratchets.
      const rock = bolts.turning ? Math.sin(performance.now() * 0.03) * 0.04 * (0.4 + bolts.torque) : 0;
      inner.current.rotation.set(0.35, working ? -0.35 : -0.9, working ? 0.1 + rock : 0.25);
    }
  });

  return (
    <group ref={root}>
      <group ref={inner} scale={0.95}>
        <TorqueWrench />
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- flange bolts */

const LIME = new Color(0.6, 2.2, 0.35);

/**
 * The five interstage flange bolts. They start proud and unmarked; torquing seats them flush and
 * paints a lime inspection stripe across the head. Hotspots exist only while `interactive`.
 */
export function FlangeBolts({
  interactive,
  done,
  showLabels,
  onPress,
}: {
  interactive: boolean;
  done: readonly number[];
  showLabels: boolean;
  onPress: (i: number) => void;
}) {
  return (
    <group>
      {Array.from({ length: BOLT_COUNT }, (_, i) => {
        const pos = boltPosition(i);
        const body = <Bolt index={i} tight={done.includes(i)} />;
        return interactive ? (
          <Hotspot
            key={i}
            id={`bolt-${i}`}
            label={{ en: `Bolt ${BOLT_LABEL[i]}`, vi: `Bu-lông ${BOLT_LABEL[i]}` }}
            position={pos}
            markerOffset={[Math.sin(boltTheta(i)) * 0.35, 0.3, Math.cos(boltTheta(i)) * 0.35]}
            markerScale={0.8}
            done={done.includes(i)}
            onActivate={() => onPress(i)}
          >
            <group rotation={[0, boltTheta(i), 0]}>{body}</group>
          </Hotspot>
        ) : (
          <group key={i} position={pos} rotation={[0, boltTheta(i), 0]}>
            {body}
          </group>
        );
      })}
      {showLabels &&
        Array.from({ length: BOLT_COUNT }, (_, i) => {
          const [x, y, z] = boltPosition(i);
          const t = boltTheta(i);
          return (
            <Html key={i} position={[x + Math.sin(t) * 0.45, y - 0.32, z + Math.cos(t) * 0.45]} center zIndexRange={[15, 5]} style={{ pointerEvents: "none" }}>
              <span className="grid h-6 w-6 place-items-center rounded-full border border-white/60 bg-space-deep/90 text-xs font-bold text-foreground">
                {BOLT_LABEL[i]}
              </span>
            </Html>
          );
        })}
    </group>
  );
}

/** One bolt, local +z pointing out of the hull. Rotates, sinks and flashes with `bolts`. */
function Bolt({ index, tight }: { index: number; tight: boolean }) {
  const head = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const stripe = useRef<MeshStandardMaterial>(null);
  const shown = useRef(0);

  useFrame((_, dt) => {
    const seatTarget = tight ? 1 : bolts.active === index ? bolts.torque : 0;
    shown.current = MathUtils.damp(shown.current, seatTarget, 14, dt);
    bolts.stripped[index] = Math.max(0, bolts.stripped[index] - dt);
    if (head.current) {
      head.current.position.z = 0.02 + (1 - shown.current) * 0.1;
      head.current.rotation.z = bolts.angle[index];
    }
    if (mat.current) {
      const hot = bolts.stripped[index] > 0;
      mat.current.emissive.set(hot ? "#ff2a1a" : "#000000");
      mat.current.emissiveIntensity = hot ? 1.6 : 0;
    }
    if (stripe.current) stripe.current.emissiveIntensity = tight ? 0.9 : 0;
  });

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]}>
        <cylinderGeometry args={[0.15, 0.15, 0.025, 24]} />
        <meshStandardMaterial color="#8d97a3" metalness={0.9} roughness={0.35} />
      </mesh>
      <group ref={head}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.08, 6]} />
          <meshStandardMaterial ref={mat} color="#c9d0d8" metalness={0.95} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0, 0.042]} rotation={[0, 0, 0.6]}>
          <boxGeometry args={[0.2, 0.026, 0.006]} />
          <meshStandardMaterial
            ref={stripe}
            color={tight ? "#9ad94a" : "#c9d0d8"}
            emissive={LIME}
            emissiveIntensity={0}
            metalness={tight ? 0.2 : 0.95}
            roughness={tight ? 0.6 : 0.22}
          />
        </mesh>
      </group>
    </group>
  );
}
