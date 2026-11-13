"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, MathUtils, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";
import { BAY } from "./layout";
import { makeLettering } from "./textures";

/** Where the player stands, refreshed every frame, for rules that depend on distance. */
export const player = { x: 0, z: 13, inBay: false };

export function inBayZone(x: number, z: number): boolean {
  const { minX, maxX, minZ, maxZ } = BAY.zone;
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

/** Tracks the player's floor position and fires once each time they walk into the fuel bay. */
export function PlayerWatch({ onEnterBay }: { onEnterBay: () => void }) {
  const camera = useThree((s) => s.camera);
  const callback = useRef(onEnterBay);
  callback.current = onEnterBay;
  useFrame(() => {
    player.x = camera.position.x;
    player.z = camera.position.z;
    const inside = inBayZone(player.x, player.z);
    if (inside && !player.inBay) callback.current();
    player.inBay = inside;
  });
  return null;
}

const [CX, CZ] = BAY.centre;

/**
 * The fuel bay: a fenced bay against the east wall with two cryogenic tanks, a manifold of
 * lagged pipework, venting vapour, a hazard-marked floor, an overhead sign and a warning beacon.
 */
export function FuelBay({ active }: { active: boolean }) {
  const floorSign = useMemo(
    () => makeLettering("FUEL BAY", { color: "#f5c518", font: "800 120px Arial, sans-serif", w: 768, h: 192 }),
    [],
  );
  const overheadSign = useMemo(
    () => makeLettering("FUEL BAY  ·  CRYOGENIC", { color: "#ffffff", font: "800 64px Arial, sans-serif", w: 1024, h: 128 }),
    [],
  );
  const { minX, maxX, minZ, maxZ } = BAY.zone;
  const w = maxX - minX;
  const d = maxZ - minZ;

  return (
    <group>
      {/* Epoxy-coated pad with a hazard border */}
      <mesh position={[CX + 0.1, 0.012, CZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w - 0.2, d - 0.2]} />
        <meshStandardMaterial color="#1c2530" roughness={0.45} metalness={0.2} />
      </mesh>
      {[
        [minX + 0.1, CZ, 0.16, d],
        [(minX + maxX) / 2, minZ + 0.1, w, 0.16],
        [(minX + maxX) / 2, maxZ - 0.1, w, 0.16],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sx, sz]} />
          <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[CX - 0.3, 0.025, CZ + 2.3]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <planeGeometry args={[4.6, 1.15]} />
        <meshBasicMaterial map={floorSign} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>

      {/* Barrier posts with a red-and-white rail, leaving a gap in front of the panel */}
      {[-12.4, -10.9, -9.4, -5.8, -4.3, -2.8].map((z) => (
        <group key={z} position={[minX + 0.1, 0, z]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 1, 10]} />
            <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {[
        [-12.4, -9.4],
        [-5.8, -2.8],
      ].map(([a, b]) => (
        <mesh key={a} position={[minX + 0.1, 0.8, (a + b) / 2]}>
          <boxGeometry args={[0.04, 0.09, Math.abs(b - a)]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.5} />
        </mesh>
      ))}

      <CryoTank position={[18, 0, -10]} label="LOX" band={SCENE_COLORS.nasaBlue} />
      <CryoTank position={[18, 0, -5.2]} label="RP-1" band={SCENE_COLORS.nasaRed} />

      {/* Lagged manifold running along the east wall to the panel */}
      {[0.7, 1.25].map((y, i) => (
        <group key={y}>
          <mesh position={[18.7 - i * 0.35, y, -7.6]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 6.2, 14]} />
            <meshStandardMaterial color={i ? "#c9d1d9" : "#e8edf2"} metalness={0.7} roughness={0.35} />
          </mesh>
          {[-10, -5.2].map((z) => (
            <mesh key={z} position={[18.7 - i * 0.35, y, z + (z < -8 ? 0.7 : -0.7)]}>
              <sphereGeometry args={[0.12, 12, 10]} />
              <meshStandardMaterial color="#9aa5b1" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[18.7 - i * 0.35, y + 0.22, -7.6]}>
            <torusGeometry args={[0.11, 0.022, 8, 18]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.5} />
          </mesh>
        </group>
      ))}
      <Vent position={[18.6, 4.9, -10]} />
      <Vent position={[18.6, 4.9, -5.2]} />

      {/* Overhead sign on two posts, with a rotating beacon */}
      {[-12.4, -2.8].map((z) => (
        <mesh key={z} position={[minX + 0.1, 1.6, z]}>
          <boxGeometry args={[0.1, 3.2, 0.1]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[minX + 0.1, 3.25, CZ + 0.8]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[9.8, 0.75, 0.08]} />
        <meshStandardMaterial color="#10294a" roughness={0.6} />
      </mesh>
      <mesh position={[minX + 0.04, 3.25, CZ + 0.8]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[8.2, 0.62]} />
        <meshBasicMaterial map={overheadSign} transparent depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <Beacon position={[minX + 0.1, 3.8, CZ + 0.8]} active={active} />

      {/* Cold, slightly blue spill of light over the pad */}
      <pointLight position={[CX + 1.5, 3.4, CZ]} color="#9fd8ff" intensity={14} distance={14} decay={1.7} />
    </group>
  );
}

/** Vertical insulated tank on legs: painted shell, a coloured band, frost and a tag. */
function CryoTank({ position, label, band }: { position: [number, number, number]; label: string; band: string }) {
  const frost = useRef<MeshStandardMaterial>(null);
  const tag = useMemo(
    () => makeLettering(label, { color: "#ffffff", font: "800 70px Arial, sans-serif", w: 256, h: 128 }),
    [label],
  );
  useFrame(({ clock }) => {
    if (frost.current) frost.current.opacity = 0.34 + Math.sin(clock.elapsedTime * 0.8 + position[2]) * 0.05;
  });
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.8, 0.3, Math.cos(a) * 0.8]}>
            <boxGeometry args={[0.12, 0.6, 0.12]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} roughness={0.45} />
          </mesh>
        );
      })}
      <mesh position={[0, 2.7, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 4.2, 40]} />
        <meshPhysicalMaterial color="#e9edf3" metalness={0.35} roughness={0.32} clearcoat={0.6} />
      </mesh>
      <mesh position={[0, 4.8, 0]} scale={[1, 0.45, 1]} castShadow>
        <sphereGeometry args={[1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#e9edf3" metalness={0.35} roughness={0.32} clearcoat={0.6} />
      </mesh>
      <mesh position={[0, 0.6, 0]} scale={[1, -0.35, 1]}>
        <sphereGeometry args={[1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#e9edf3" metalness={0.35} roughness={0.32} />
      </mesh>
      <mesh position={[0, 3.3, 0]}>
        <cylinderGeometry args={[1.012, 1.012, 0.32, 40]} />
        <meshStandardMaterial color={band} roughness={0.5} />
      </mesh>
      {/* Frost creeping up from the cold feed at the bottom */}
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[1.018, 1.018, 1.2, 40, 1, true]} />
        <meshStandardMaterial ref={frost} color="#eaf6ff" transparent opacity={0.34} roughness={1} depthWrite={false} />
      </mesh>
      <mesh position={[-1.012, 2.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshBasicMaterial map={tag} transparent side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[-1.01, 2.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.96, 0.5]} />
        <meshStandardMaterial color="#10294a" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** A stack venting cold vapour: soft puffs rise, swell and fade in a loop. */
function Vent({ position }: { position: [number, number, number] }) {
  const reduced = useReducedMotion();
  const puffs = useRef<(Mesh | null)[]>([]);
  const N = 7;
  useFrame(({ clock }) => {
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const k = reduced ? i / N : (clock.elapsedTime * 0.28 + i / N) % 1;
      m.position.set(Math.sin(i * 2.3) * 0.12 * k, k * 2.3, Math.cos(i * 1.7) * 0.12 * k);
      m.scale.setScalar(0.1 + k * 0.55);
      (m.material as MeshBasicMaterial).opacity = (1 - k) * 0.3 * Math.min(1, k * 6);
    });
  });
  return (
    <group position={position}>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.3, 10]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.7} roughness={0.4} />
      </mesh>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={(el) => (puffs.current[i] = el)}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#f1f8ff" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Amber warning beacon; it spins fast while the bay is in use. */
function Beacon({ position, active }: { position: [number, number, number]; active: boolean }) {
  const lens = useRef<Group>(null);
  const glow = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * (active ? 7 : 2.2);
    if (lens.current) lens.current.rotation.y = t;
    if (glow.current) glow.current.color.setRGB(2.6, 1.5, 0.15).multiplyScalar(MathUtils.clamp(0.5 + Math.sin(t * 2) * 0.5, 0.15, 1));
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.1, 14]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <group ref={lens} position={[0, 0.22, 0]}>
        <mesh>
          <sphereGeometry args={[0.16, 14, 10]} />
          <meshBasicMaterial ref={glow} color="#ffb020" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
