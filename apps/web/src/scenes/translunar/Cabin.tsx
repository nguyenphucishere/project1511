"use client";

import { forwardRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { filmClock } from "./clock";
import { T, plasma } from "./flight";

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
  const crew = useRef<Group>(null);
  const glow = useRef<Mesh>(null);
  const glowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(255,235,190,1)");
    g.addColorStop(0.35, "rgba(255,150,60,0.8)");
    g.addColorStop(1, "rgba(200,60,15,0.25)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, []);
  const tint = useMemo(() => new Color(), []);
  const base = useMemo(() => new Color("#d9d3cc"), []);
  const fireColor = useMemo(() => new Color("#ff9a55"), []);
  // In the entry the only light in the cabin is the fire outside: it glows in the window and lights the crew.
  useFrame(() => {
    const t = filmClock.t;
    const fire = t >= T.REENTRY && t < T.CHUTES ? plasma(t) : 0;
    const flick = 0.8 + 0.2 * Math.sin(t * 41) * Math.sin(t * 13 + 1);
    const level = fire > 0.01 ? Math.min(1, 0.45 + fire * 1.4) * flick : 0;
    if (glow.current) {
      glow.current.visible = level > 0.02;
      (glow.current.material as MeshBasicMaterial).opacity = level;
    }
    tint.copy(base).lerp(fireColor, Math.min(1, fire * 1.4) * flick);
    crew.current?.traverse((o) => {
      const m = (o as Mesh).material as MeshBasicMaterial | undefined;
      if (m && m.map) m.color.copy(tint);
    });
  });
  return (
    <group ref={ref}>
      <mesh ref={glow} position={[0, 0, WINDOW_Z - 0.03]} visible={false}>
        <planeGeometry args={[AP_W + 0.02, AP_H + 0.02]} />
        <meshBasicMaterial map={glowTex} color={[2.4, 1.6, 0.9]} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
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
      <group ref={crew}>
        <CrewMember x={-0.25} z={0.3} art={CREW_ART[0]!} width={0.19} />
        <CrewMember x={0} z={0.33} art={CREW_ART[1]!} width={0.21} />
        <CrewMember x={0.25} z={0.3} art={CREW_ART[2]!} width={0.19} />
      </group>
    </group>
  );
});
