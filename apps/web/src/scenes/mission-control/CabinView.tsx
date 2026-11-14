"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  type Group,
  type PointLight,
} from "three";
import { bake, type BakePart } from "./bake";
import { CABIN_FROM, cabinEyeY } from "./docking";

/**
 * The view from inside the command module, for the quiet end of the film: a window in the cabin
 * wall with the Earth beyond it, a panel of switches and lights under it and the backs of two
 * helmets in the foreground. Everything is in world orientation with the eye at the group's
 * origin looking along +z; the group follows the capsule.
 */

const WALL = "#2b303a";
const WALL_LIGHT = "#3a414d";
const METAL = "#9aa4b0";

const WINDOW_Z = 1.15;
const OPEN_W = 0.42;
const OPEN_H = 0.27;

export function CabinView({ ignitionAt }: { ignitionAt: number | null }) {
  const root = useRef<Group>(null);
  const glow = useRef<PointLight>(null);
  const lights = useRef<Group>(null);

  const panel = useMemo(() => {
    const parts: BakePart[] = [];
    const sw = new CylinderGeometry(0.012, 0.012, 0.07, 6);
    const base = new CylinderGeometry(0.024, 0.024, 0.02, 8);
    const gauge = new CylinderGeometry(0.07, 0.07, 0.03, 20);
    const needle = new BoxGeometry(0.004, 0.05, 0.004);
    const knob = new CylinderGeometry(0.028, 0.032, 0.035, 10);
    const bolt = new SphereGeometry(0.008, 6, 4);
    // Three rows of toggle switches, each on its own little bezel
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 18; i++) {
        const x = -0.8 + i * 0.094;
        const z = row * 0.1;
        const lean = (((i * 7 + row * 3) % 5) - 2) * 0.12;
        parts.push({ g: base, color: "#0f1217", at: [x, 0.012, z] });
        parts.push({
          g: sw,
          color: METAL,
          at: [x, 0.05, z],
          rot: [lean, 0, 0],
        });
      }
    }
    // Gauges
    for (let i = 0; i < 4; i++) {
      const x = -0.55 + i * 0.37;
      parts.push({
        g: gauge,
        color: "#0b0d11",
        at: [x, 0.02, 0.5],
        rot: [0, 0, 0],
      });
      parts.push({
        g: needle,
        color: "#ff8a3d",
        at: [x, 0.04, 0.5],
        rot: [0, i * 0.7 - 0.8, Math.PI / 2],
      });
    }
    // Rotary knobs
    for (let i = 0; i < 6; i++) {
      parts.push({
        g: knob,
        color: "#c4cbd4",
        at: [-0.9 + i * 0.36, 0.03, 0.32],
      });
    }
    // Panel screws
    for (let i = 0; i < 22; i++) {
      parts.push({
        g: bolt,
        color: METAL,
        at: [-1.02 + i * 0.094, 0.004, 0.61],
      });
      parts.push({
        g: bolt,
        color: METAL,
        at: [-1.02 + i * 0.094, 0.004, -0.06],
      });
    }
    return bake(parts);
  }, []);

  /** Rivets round the window's bezel. */
  const rivets = useMemo(() => {
    const g = new SphereGeometry(0.012, 6, 4);
    const parts: BakePart[] = [];
    const w = OPEN_W + 0.09;
    const h = OPEN_H + 0.09;
    for (let i = 0; i <= 22; i++) {
      const x = -w + (i / 22) * 2 * w;
      parts.push(
        { g, color: METAL, at: [x, h, 0] },
        { g, color: METAL, at: [x, -h, 0] },
      );
    }
    for (let i = 1; i < 14; i++) {
      const y = -h + (i / 14) * 2 * h;
      parts.push(
        { g, color: METAL, at: [w, y, 0] },
        { g, color: METAL, at: [-w, y, 0] },
      );
    }
    return bake(parts);
  }, []);

  /** The seams of the cabin wall: ribs that run into the window frame. */
  const ribs = useMemo(() => {
    const parts: BakePart[] = [];
    const rib = new BoxGeometry(0.035, 1.7, 0.03);
    const rail = new BoxGeometry(2.6, 0.03, 0.03);
    for (const x of [-1.0, -0.78, 0.78, 1.0])
      parts.push({ g: rib, color: WALL_LIGHT, at: [x, 0, 0] });
    for (const y of [-0.65, 0.5, 0.62])
      parts.push({ g: rail, color: WALL_LIGHT, at: [0, y, 0] });
    return bake(parts);
  }, []);

  useFrame(({ clock }) => {
    const t =
      ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    const on = t >= CABIN_FROM;
    if (root.current) {
      root.current.visible = on;
      if (on) root.current.position.set(0, cabinEyeY(t), 0);
    }
    if (glow.current) {
      glow.current.intensity = on ? 1.1 : 0;
      if (on) glow.current.position.set(0, cabinEyeY(t) + 0.1, 0.8);
    }
    // The panel's indicator lamps breathe slowly
    if (lights.current && on) {
      lights.current.children.forEach((c, i) => {
        c.scale.setScalar(
          0.8 + 0.2 * Math.sin(clock.elapsedTime * (1.2 + i * 0.37) + i),
        );
      });
    }
  });

  const lamps: [number, number, string][] = [
    [-0.7, 0.3, "#37e08a"],
    [-0.6, 0.3, "#37e08a"],
    [-0.5, 0.3, "#ffb020"],
    [-0.3, 0.3, "#37e08a"],
    [0.25, 0.3, "#ff4d3d"],
    [0.4, 0.3, "#37e08a"],
    [0.55, 0.3, "#ffb020"],
    [0.7, 0.3, "#37e08a"],
  ];

  return (
    <>
      {/* Earthshine through the glass. Kept outside the hidden group: the renderer counts only visible
        lights, and a light appearing mid-film recompiles every material in the scene (a freeze). */}
      <pointLight
        ref={glow}
        position={[0, 0.1, 0.8]}
        color="#7aa8ff"
        intensity={0}
        distance={4}
        decay={1.5}
      />
      <group ref={root} visible={false}>
        {/* The wall the window is cut in: four slabs round the opening */}
        <mesh position={[0, OPEN_H + 0.45, WINDOW_Z + 0.03]}>
          <boxGeometry args={[3.2, 0.9, 0.06]} />
          <meshStandardMaterial color={WALL} metalness={0.4} roughness={0.55} />
        </mesh>
        <mesh position={[0, -OPEN_H - 0.45, WINDOW_Z + 0.03]}>
          <boxGeometry args={[3.2, 0.9, 0.06]} />
          <meshStandardMaterial color={WALL} metalness={0.4} roughness={0.55} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (OPEN_W + 0.9), 0, WINDOW_Z + 0.03]}>
            <boxGeometry args={[1.8, OPEN_H * 2, 0.06]} />
            <meshStandardMaterial
              color={WALL}
              metalness={0.4}
              roughness={0.55}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, WINDOW_Z - 0.01]} geometry={ribs}>
          <meshStandardMaterial vertexColors metalness={0.5} roughness={0.5} />
        </mesh>

        {/* A thick bezel round the opening, rivets along it */}
        {[
          [0, OPEN_H + 0.03, OPEN_W * 2 + 0.12, 0.06],
          [0, -OPEN_H - 0.03, OPEN_W * 2 + 0.12, 0.06],
        ].map(([x, y, w, h]) => (
          <mesh key={`${y}`} position={[x!, y!, WINDOW_Z - 0.04]}>
            <boxGeometry args={[w!, h!, 0.09]} />
            <meshStandardMaterial
              color={METAL}
              metalness={0.85}
              roughness={0.32}
            />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (OPEN_W + 0.03), 0, WINDOW_Z - 0.04]}>
            <boxGeometry args={[0.06, OPEN_H * 2, 0.09]} />
            <meshStandardMaterial
              color={METAL}
              metalness={0.85}
              roughness={0.32}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, WINDOW_Z - 0.09]} geometry={rivets}>
          <meshStandardMaterial vertexColors metalness={0.9} roughness={0.3} />
        </mesh>
        {/* The glass: a faint sheen, so the window reads as a window */}
        <mesh position={[0, 0, WINDOW_Z + 0.04]}>
          <planeGeometry args={[OPEN_W * 2, OPEN_H * 2]} />
          <meshBasicMaterial
            color="#9bc2ff"
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </mesh>

        {/* Side walls, floor and ceiling, so the eye is inside a room */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.55, 0, 0.5]}>
            <boxGeometry args={[0.06, 2, 2.4]} />
            <meshStandardMaterial
              color={WALL_LIGHT}
              metalness={0.3}
              roughness={0.6}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.85, 0.5]}>
          <boxGeometry args={[3.2, 0.06, 2.4]} />
          <meshStandardMaterial color={WALL} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.85, 0.5]}>
          <boxGeometry args={[3.2, 0.06, 2.4]} />
          <meshStandardMaterial color={WALL} roughness={0.6} />
        </mesh>

        {/* The switch panel under the window, tilted toward the crew */}
        <group position={[0, -0.66, 0.55]} rotation={[-0.5, 0, 0]}>
          <mesh position={[0, -0.005, 0.28]}>
            <boxGeometry args={[2.3, 0.025, 0.72]} />
            <meshStandardMaterial
              color="#1c2028"
              metalness={0.5}
              roughness={0.5}
            />
          </mesh>
          <mesh geometry={panel} position={[0.02, 0.01, 0.05]}>
            <meshStandardMaterial
              vertexColors
              metalness={0.35}
              roughness={0.5}
            />
          </mesh>
          <group ref={lights} position={[0, 0.02, 0.05]}>
            {lamps.map(([x, z, c], i) => (
              <mesh key={i} position={[x, 0.01, z]}>
                <sphereGeometry args={[0.016, 8, 6]} />
                <meshBasicMaterial color={c} toneMapped={false} />
              </mesh>
            ))}
          </group>
        </group>

        {/* Two crew, seen from behind: white suits, helmets, the cloth caps under them */}
        <Crewman x={-0.9} y={-0.4} z={0.42} lean={0.18} scale={0.8} />
        <Crewman x={0.86} y={-0.46} z={0.4} lean={-0.14} scale={0.8} />
      </group>
    </>
  );
}

/** The back and shoulders of a suited crewman looking out at the window, helmet on. */
function Crewman({
  x,
  y,
  z,
  lean,
  scale = 1,
}: {
  x: number;
  y: number;
  z: number;
  lean: number;
  scale?: number;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, lean, 0]} scale={scale}>
      {/* Torso and shoulders */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.52, 0.42, 0.26]} />
        <meshStandardMaterial color="#c9cfd7" roughness={0.8} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.28, -0.1, 0.03]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#bfc6cf" roughness={0.8} />
        </mesh>
      ))}
      {/* Life support strap and hose */}
      <mesh position={[0, -0.18, -0.14]}>
        <boxGeometry args={[0.3, 0.3, 0.05]} />
        <meshStandardMaterial color="#cfd5dc" roughness={0.6} />
      </mesh>
      <mesh position={[0.13, -0.02, -0.12]} rotation={[0.3, 0, 0.2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.25, 6]} />
        <meshStandardMaterial color="#1f2430" roughness={0.6} />
      </mesh>
      {/* Neck ring, helmet and the gold visor beyond it */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.095, 0.11, 0.06, 14]} />
        <meshStandardMaterial
          color="#b9c0c9"
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.17, 0.02]}>
        <sphereGeometry args={[0.15, 18, 14]} />
        <meshStandardMaterial color="#cfd5dc" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.17, 0.09]} scale={[0.95, 0.8, 0.9]}>
        <sphereGeometry args={[0.15, 18, 14, 0, Math.PI * 2, 0, Math.PI]} />
        <meshStandardMaterial
          color="#d9a441"
          metalness={0.95}
          roughness={0.12}
        />
      </mesh>
      {/* Communications headset lines on the helmet's rear */}
      <mesh position={[0, 0.2, -0.13]}>
        <boxGeometry args={[0.06, 0.1, 0.03]} />
        <meshStandardMaterial color="#c8ced6" roughness={0.5} />
      </mesh>
    </group>
  );
}
