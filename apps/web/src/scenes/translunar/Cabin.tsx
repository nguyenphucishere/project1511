"use client";

import { forwardRef } from "react";
import { useTexture } from "@react-three/drei";
import { Color, DoubleSide, SRGBColorSpace, type Group } from "three";

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

/** The hand-drawn crew, seen from behind (the same art as the viewers on the ending screen). */
export const CREW_ART = ["/assets/characters/viewers/orange.webp", "/assets/characters/viewers/navy.webp", "/assets/characters/viewers/pink.webp"];

/** One of the crew: a flat drawing of a head and shoulders, standing in front of the window. */
function CrewMember({ x, z, art, width = 0.3 }: { x: number; z: number; art: string; width?: number }) {
  const [tex] = useTexture([art]);
  tex.colorSpace = SRGBColorSpace;
  const img = tex.image as { width: number; height: number } | undefined;
  const aspect = img ? img.width / img.height : 0.8;
  const h = width / aspect;
  return (
    <group position={[x, -0.2 + h / 2, z]}>
      {/* A seat back behind the drawing, so the figure does not float */}
      <mesh position={[0, -h * 0.18, -0.03]}>
        <boxGeometry args={[width * 1.05, h * 0.7, 0.03]} />
        <meshStandardMaterial {...WALL} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, h]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.05} color="#d9d3cc" toneMapped={false} />
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
      <CrewMember x={-0.25} z={0.3} art={CREW_ART[0]!} width={0.19} />
      <CrewMember x={0} z={0.33} art={CREW_ART[1]!} width={0.21} />
      <CrewMember x={0.25} z={0.3} art={CREW_ART[2]!} width={0.19} />
    </group>
  );
});
