"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { addTrauma } from "@/game/shake";
import { playSfx, type SfxId } from "@/game/sfx";
import { SCENE_COLORS } from "@/lib/palette";
import { CSM_SEP_T, DOCK_T, FLIP_FROM, FLIP_TO, TOW_T } from "./ascent";
import { CSM_Y, csmPose, towOffset } from "./docking";

/**
 * After the third stage shuts down the command and service modules separate, turn the whole ship
 * round (with a roll, for the camera) and come back nose first to dock with the lander, which they
 * then tow out of the spent stage. These are the capsule, the lander and the cloud sleeve at max-Q.
 */

const since = (ignitionAt: number | null) => (ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (k: number) => k * k * (3 - 2 * k);

const STEEL = { color: "#9aa5b1", metalness: 0.85, roughness: 0.3 } as const;
const BRASS = { color: "#b0823f", metalness: 0.9, roughness: 0.28 } as const;

type Cue = [at: number, id: SfxId, trauma?: number];
const CUES: Cue[] = [
  [CSM_SEP_T - 0.15, "pyro", 0.4],
  [CSM_SEP_T, "gas"],
  [FLIP_FROM, "hydraulic"],
  [FLIP_FROM + 0.9, "ratchet"],
  [FLIP_FROM + 1.8, "ratchet"],
  [FLIP_FROM + 2.7, "ratchet"],
  [FLIP_TO - 0.2, "hydraulic"],
  [DOCK_T - 1.2, "hydraulic"],
  [DOCK_T - 0.05, "clank", 0.35],
  [DOCK_T + 0.2, "gas"],
  [DOCK_T + 0.4, "clank", 0.1],
  [DOCK_T + 0.7, "ratchet"],
  [DOCK_T + 0.95, "ratchet"],
  [TOW_T, "hydraulic"],
  [TOW_T + 0.2, "gas"],
];

function useCues(cues: Cue[]) {
  const prev = useRef(-1);
  return (t: number) => {
    for (const [at, id, trauma] of cues) {
      if (prev.current < at && t >= at && t < at + 1) {
        playSfx(id);
        if (trauma) addTrauma(trauma);
      }
    }
    prev.current = t;
  };
}

/** The service and command modules, pivoting about their own middle. */
export function Capsule({ ignitionAt }: { ignitionAt: number | null }) {
  const root = useRef<Group>(null);
  const puffs = useRef<Group>(null);
  const probe = useRef<Mesh>(null);
  const latches = useRef<(Group | null)[]>([]);
  const cues = useCues(CUES);

  useFrame(() => {
    const t = since(ignitionAt);
    const p = csmPose(t);
    if (root.current) {
      root.current.position.set(p.dx, CSM_Y + p.dy, 0);
      root.current.rotation.set(p.pitch, p.roll, 0, "XYZ");
    }
    if (puffs.current) {
      puffs.current.visible = p.thrust > 0;
      if (p.thrust > 0) puffs.current.scale.setScalar(0.7 + Math.abs(Math.sin(t * 70)) * 0.5);
    }
    // The probe reaches out as the ship comes back, and pulls the lander in once it has caught.
    const out = ease(clamp01((t - (FLIP_TO - 0.3)) / 1.0));
    const pull = ease(clamp01((t - DOCK_T) / 0.7));
    const len = 0.35 + 0.65 * out - 0.55 * pull;
    if (probe.current) {
      probe.current.scale.y = len;
      probe.current.position.y = 31.2 + len * 0.45;
    }
    const clamp = ease(clamp01((t - DOCK_T - 0.2) / 0.8));
    latches.current.forEach((l) => {
      if (l) l.rotation.z = 0.9 - clamp * 0.9;
    });
    cues(t);
  });

  return (
    <group ref={root} position={[0, CSM_Y, 0]}>
      <group position={[0, -CSM_Y, 0]}>
        {/* Service module with its gold band and engine bell */}
        <mesh position={[0, 28.6, 0]}>
          <cylinderGeometry args={[0.96, 0.96, 2, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 28.35, 0]}>
          <cylinderGeometry args={[0.98, 0.98, 0.3, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.kaptonGold} metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 27.5, 0]}>
          <cylinderGeometry args={[0.25, 0.5, 0.6, 10, 1, true]} />
          <meshStandardMaterial {...STEEL} side={DoubleSide} />
        </mesh>
        {/* Command module */}
        <mesh position={[0, 30.4, 0]}>
          <cylinderGeometry args={[0.3, 0.96, 1.6, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} />
        </mesh>
        {/* Reaction control quads on the service module */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 1.0, 28.9, Math.cos(a) * 1.0]}>
              <boxGeometry args={[0.16, 0.3, 0.16]} />
              <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.5} />
            </mesh>
          );
        })}
        {/* Docking probe and its three capture latches */}
        <mesh ref={probe} position={[0, 31.65, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.9, 8]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh position={[0, 31.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.05, 6, 16]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i * Math.PI * 2) / 3;
          return (
            <group key={i} position={[Math.sin(a) * 0.3, 31.2, Math.cos(a) * 0.3]} rotation={[0, a, 0]}>
              <group ref={(el) => (latches.current[i] = el)}>
                <mesh position={[0.12, 0.08, 0]}>
                  <boxGeometry args={[0.28, 0.05, 0.08]} />
                  <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
                </mesh>
              </group>
            </group>
          );
        })}
        {/* Thruster puffs round the service module */}
        <group ref={puffs} visible={false}>
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 1.35, 28.9, Math.cos(a) * 1.35]} rotation={[Math.cos(a) * 1.5708, 0, -Math.sin(a) * 1.5708]}>
                <coneGeometry args={[0.16, 0.7, 8, 1, true]} />
                <meshBasicMaterial color="#cfe6ff" toneMapped={false} blending={AdditiveBlending} transparent opacity={0.85} depthWrite={false} side={DoubleSide} />
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
}

/** The lunar module: folded legs, gold foil and a docking ring on top, towed out after docking. */
export function LunarModule({ ignitionAt }: { ignitionAt: number | null }) {
  const root = useRef<Group>(null);
  useFrame(() => {
    const t = since(ignitionAt);
    if (root.current) root.current.position.y = 24.4 + towOffset(t);
  });
  return (
    <group ref={root} position={[0, 24.4, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 1.4, 8]} />
        <meshStandardMaterial color={SCENE_COLORS.kaptonGold} metalness={0.85} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <cylinderGeometry args={[0.6, 0.7, 0.9, 8]} />
        <meshStandardMaterial color="#cfd3d8" metalness={0.6} roughness={0.35} flatShading />
      </mesh>
      <mesh position={[0, 2.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.06, 6, 16]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.95, 0.9, Math.cos(a) * 0.95]} rotation={[Math.cos(a) * -0.25, 0, Math.sin(a) * 0.25]}>
            <boxGeometry args={[0.07, 1.8, 0.07]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A sleeve of cloud that forms round the stack at max-Q and slides down it. */
export function VaporCone({ ignitionAt, from, to, y }: { ignitionAt: number | null; from: number; to: number; y: number }) {
  const cone = useRef<Mesh>(null);
  useFrame(() => {
    const t = since(ignitionAt);
    const k = clamp01((t - from) / (to - from));
    if (!cone.current) return;
    cone.current.visible = k > 0 && k < 1;
    if (k > 0 && k < 1) {
      cone.current.position.y = y - k * 6;
      cone.current.scale.set(1 + k * 0.5, 1, 1 + k * 0.5);
      (cone.current.material as MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
    }
  });
  return (
    <mesh ref={cone} position={[0, y, 0]} visible={false}>
      <cylinderGeometry args={[1.75, 2.9, 3.6, 24, 1, true]} />
      <meshBasicMaterial color="#f4f8ff" transparent opacity={0} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}
