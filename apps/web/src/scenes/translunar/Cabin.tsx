"use client";

import { forwardRef } from "react";
import { Color, DoubleSide, type Group } from "three";

const WALL = { color: "#2a2c32", roughness: 0.85, metalness: 0.15 } as const;
const SUIT = { color: "#b9b6af", roughness: 0.8, metalness: 0.02 } as const;
const GLOW_GREEN = new Color(0.4, 3, 1);
const GLOW_AMBER = new Color(3, 1.6, 0.3);
const GLOW_RED = new Color(3, 0.35, 0.25);

/** Window aperture, in the cabin's local metres: the camera sits at the origin, looking down -Z. */
export const WINDOW_Z = -0.4;
const AP_W = 0.36;
const AP_H = 0.24;

function Panel({ x, rows }: { x: number; rows: number }) {
  const glow = [GLOW_GREEN, GLOW_AMBER, GLOW_RED, GLOW_GREEN];
  return (
    <group position={[x, -0.05, 0.55]} rotation={[0, x > 0 ? -0.3 : 0.3, 0]}>
      <mesh>
        <boxGeometry args={[0.04, 0.5, 0.9]} />
        <meshStandardMaterial color="#1d1f24" roughness={0.6} metalness={0.4} />
      </mesh>
      {Array.from({ length: rows * 8 }, (_, i) => (
        <mesh key={i} position={[x > 0 ? -0.03 : 0.03, -0.2 + (i % rows) * 0.07, -0.38 + Math.floor(i / rows) * 0.1]}>
          <boxGeometry args={[0.012, 0.03, 0.05]} />
          <meshBasicMaterial color={glow[(i * 7) % glow.length]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Astronaut({ x, z, turn = 0 }: { x: number; z: number; turn?: number }) {
  return (
    <group position={[x, -0.2, z]} rotation={[0, turn, 0]}>
      {/* Shoulders and torso, a helmet, and the couch behind */}
      <mesh position={[0, -0.02, 0.0]}>
        <boxGeometry args={[0.22, 0.2, 0.16]} />
        <meshStandardMaterial {...SUIT} />
      </mesh>
      <mesh position={[0, 0.15, -0.02]}>
        <sphereGeometry args={[0.078, 20, 16]} />
        <meshStandardMaterial color="#a9a8a3" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.15, -0.068]}>
        <sphereGeometry args={[0.06, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#17181c" roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh position={[0, -0.12, 0.1]}>
        <boxGeometry args={[0.28, 0.4, 0.05]} />
        <meshStandardMaterial {...WALL} />
      </mesh>
    </group>
  );
}

/**
 * The inside of the crew cabin, seen from the middle seat: a small window in a dark wall, side
 * panels with lit switches, and three suited crew in their couches. Lit by a warm lamp (kept in
 * the world, so this group can be hidden without changing the light count).
 */
export const Cabin = forwardRef<Group>(function Cabin(_, ref) {
  const w = AP_W / 2;
  const h = AP_H / 2;
  return (
    <group ref={ref}>
      {/* Room shell: floor, ceiling, side walls and the back, but no front (that is the window wall) */}
      <mesh position={[0, -0.5, 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.7]} />
        <meshStandardMaterial {...WALL} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.5, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.7]} />
        <meshStandardMaterial {...WALL} side={DoubleSide} />
      </mesh>
      <mesh position={[0.75, 0, 0.45]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.7, 1]} />
        <meshStandardMaterial {...WALL} side={DoubleSide} />
      </mesh>
      <mesh position={[-0.75, 0, 0.45]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.7, 1]} />
        <meshStandardMaterial {...WALL} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 1.3]}>
        <planeGeometry args={[1.5, 1]} />
        <meshStandardMaterial {...WALL} side={DoubleSide} />
      </mesh>
      {/* The wall around the window: four slabs leaving a hole */}
      <group position={[0, 0, WINDOW_Z]}>
        <mesh position={[0, h + 0.4, 0]}>
          <boxGeometry args={[1.5, 0.8, 0.06]} />
          <meshStandardMaterial {...WALL} />
        </mesh>
        <mesh position={[0, -h - 0.4, 0]}>
          <boxGeometry args={[1.5, 0.8, 0.06]} />
          <meshStandardMaterial {...WALL} />
        </mesh>
        <mesh position={[w + 0.57, 0, 0]}>
          <boxGeometry args={[1.14, AP_H + 0.02, 0.06]} />
          <meshStandardMaterial {...WALL} />
        </mesh>
        <mesh position={[-w - 0.57, 0, 0]}>
          <boxGeometry args={[1.14, AP_H + 0.02, 0.06]} />
          <meshStandardMaterial {...WALL} />
        </mesh>
        {/* A lighter gasket just inside the opening, top and bottom */}
        <mesh position={[0, h, 0.035]}>
          <boxGeometry args={[AP_W + 0.04, 0.02, 0.01]} />
          <meshStandardMaterial color="#8d9097" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[0, -h, 0.035]}>
          <boxGeometry args={[AP_W + 0.04, 0.02, 0.01]} />
          <meshStandardMaterial color="#8d9097" metalness={0.8} roughness={0.4} />
        </mesh>
      </group>
      <Panel x={0.72} rows={5} />
      <Panel x={-0.72} rows={5} />
      <Astronaut x={-0.3} z={0.42} turn={0.6} />
      <Astronaut x={0} z={0.5} />
      <Astronaut x={0.3} z={0.42} turn={-0.6} />
    </group>
  );
});
