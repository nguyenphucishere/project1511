"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CatmullRomCurve3, Color, DoubleSide, InstancedMesh, Object3D, Vector3 } from "three";
import { gaugeFace, panelFace } from "./textures";

export interface CabinMood {
  /** The colour of the cabin lights and of the alarm beacon. */
  light: string;
  /** What the window shows. */
  window: string;
  windowIntensity: number;
  /** The three warning lamps above the crew. */
  lamps: string[];
  /** Beacon sweep speed, 0 for none. */
  beacon: number;
}

const DARK = "#1b1e25";
/** Where the three couches stand (x), left to right. */
export const CREW_X = [-1.35, 0, 1.35] as const;

function Cable({ pts, r = 0.018, color = "#15171b" }: { pts: [number, number, number][]; r?: number; color?: string }) {
  const curve = useMemo(() => new CatmullRomCurve3(pts.map((p) => new Vector3(...p))), [pts]);
  return (
    <mesh>
      <tubeGeometry args={[curve, 32, r, 8, false]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </mesh>
  );
}

/** Toggle switches in rows: a bushing, a lever and a ball tip, drawn as three instanced meshes. */
function Switches({ rows, cols, origin, lit }: { rows: number; cols: number; origin: [number, number, number]; lit: string }) {
  const lever = useRef<InstancedMesh>(null);
  const tip = useRef<InstancedMesh>(null);
  const base = useRef<InstancedMesh>(null);
  useEffect(() => {
    const o = new Object3D();
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const up = Math.sin(r * 12.9 + c * 78.2) > 0;
        const x = origin[0] + c * 0.13;
        const y = origin[1] - r * 0.15;
        o.position.set(x, y, origin[2]);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        base.current?.setMatrixAt(i, o.matrix);
        o.position.set(x, y + (up ? 0.022 : -0.022), origin[2] + 0.03);
        o.rotation.set(up ? -0.55 : 0.55, 0, 0);
        o.updateMatrix();
        lever.current?.setMatrixAt(i, o.matrix);
        o.position.set(x, y + (up ? 0.04 : -0.04), origin[2] + 0.05);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        tip.current?.setMatrixAt(i, o.matrix);
        i++;
      }
    }
    for (const m of [base, lever, tip]) if (m.current) m.current.instanceMatrix.needsUpdate = true;
  }, [rows, cols, origin]);
  const n = rows * cols;
  return (
    <group>
      <instancedMesh ref={base} args={[undefined, undefined, n]}>
        <cylinderGeometry args={[0.022, 0.022, 0.03, 10]} />
        <meshStandardMaterial color="#9aa0ab" metalness={0.9} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={lever} args={[undefined, undefined, n]}>
        <cylinderGeometry args={[0.006, 0.006, 0.06, 6]} />
        <meshStandardMaterial color="#c4c9d1" metalness={0.9} roughness={0.25} />
      </instancedMesh>
      <instancedMesh ref={tip} args={[undefined, undefined, n]}>
        <sphereGeometry args={[0.011, 8, 6]} />
        <meshStandardMaterial color="#b9bec8" emissive={lit} emissiveIntensity={0.05} metalness={0.8} roughness={0.35} />
      </instancedMesh>
    </group>
  );
}

function Gauge({ position, size = 0.2, needle }: { position: [number, number, number]; size?: number; needle: number }) {
  const face = useMemo(() => gaugeFace(), []);
  const ref = useRef<Object3D>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = -needle + Math.sin(clock.elapsedTime * 9 + position[0] * 5) * 0.03;
  });
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[size * 0.62, size * 0.62, 0.06, 36]} />
        <meshStandardMaterial color="#9aa0ab" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <circleGeometry args={[size * 0.55, 36]} />
        <meshStandardMaterial map={face} roughness={0.5} emissive="#ffffff" emissiveMap={face} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <circleGeometry args={[size * 0.55, 36]} />
        <meshPhysicalMaterial transparent opacity={0.08} roughness={0.02} clearcoat={1} envMapIntensity={2} depthWrite={false} />
      </mesh>
      <group ref={ref} position={[0, 0, 0.04]}>
        <mesh position={[0, size * 0.22, 0]}>
          <boxGeometry args={[0.008, size * 0.46, 0.004]} />
          <meshStandardMaterial color="#e8412e" emissive="#e8412e" emissiveIntensity={0.4} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.045]}>
        <cylinderGeometry args={[0.012, 0.012, 0.01, 10]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

/**
 * The command module seen from the instrument panel: a stencilled panel with rows of switches and
 * gauges, a bolted hatch window, ribbed walls with cable runs, the three couches with their
 * harness straps, and an alarm beacon sweeping red light across everything.
 */
export function CabinInterior3D({ mood, shake = 0 }: { mood: CabinMood; shake?: number }) {
  const { map, rough } = useMemo(() => panelFace(), []);
  const beacon = useRef<Object3D>(null);
  const beaconLight = useRef<Object3D>(null);
  const lampColor = useMemo(() => mood.lamps.map((c) => new Color(c)), [mood.lamps]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (mood.beacon && beacon.current) {
      beacon.current.rotation.y = t * mood.beacon;
      const flick = 0.75 + Math.abs(Math.sin(t * mood.beacon * 0.5)) * 0.25;
      if (beaconLight.current) (beaconLight.current as unknown as { intensity: number }).intensity = 5 * flick;
    }
  });

  return (
    <group>
      {/* Back wall: the instrument panel. */}
      <mesh position={[0, 0.25, -1.62]}>
        <planeGeometry args={[7.4, 3.7]} />
        <meshStandardMaterial map={map} roughnessMap={rough} roughness={1} metalness={0.45} color="#c8ccd6" />
      </mesh>
      <mesh position={[0, 0.25, -1.66]}>
        <boxGeometry args={[7.6, 3.8, 0.1]} />
        <meshStandardMaterial color={DARK} roughness={0.9} />
      </mesh>

      {/* Side walls with ribs, ceiling with ribs. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 3.55, 0.2, -0.3]}>
            <boxGeometry args={[0.2, 3.7, 3.4]} />
            <meshStandardMaterial color="#262a33" roughness={0.8} metalness={0.4} />
          </mesh>
          {[-1.4, -0.7, 0, 0.7, 1.3].map((z) => (
            <mesh key={z} position={[s * 3.42, 0.2, z]}>
              <boxGeometry args={[0.12, 3.7, 0.09]} />
              <meshStandardMaterial color="#3a3f4a" roughness={0.6} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 2.1, -0.3]}>
        <boxGeometry args={[7.2, 0.2, 3.6]} />
        <meshStandardMaterial color="#20232b" roughness={0.85} metalness={0.4} />
      </mesh>
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <mesh key={x} position={[x, 1.98, -0.3]}>
          <boxGeometry args={[0.09, 0.12, 3.6]} />
          <meshStandardMaterial color="#3a3f4a" roughness={0.6} metalness={0.7} />
        </mesh>
      ))}

      {/* The hatch window: a thick ring with bolts, glass and a light behind it. */}
      <group position={[0, 0.62, -1.52]}>
        <mesh>
          <circleGeometry args={[0.6, 48]} />
          <meshBasicMaterial color={mood.window} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[0.6, 48]} />
          <meshPhysicalMaterial transparent opacity={0.16} roughness={0.02} clearcoat={1} envMapIntensity={2.4} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <torusGeometry args={[0.66, 0.07, 16, 56]} />
          <meshStandardMaterial color="#8a909c" metalness={0.95} roughness={0.35} />
        </mesh>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 16) * Math.PI * 2) * 0.66, Math.sin((i / 16) * Math.PI * 2) * 0.66, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.05, 6]} />
            <meshStandardMaterial color="#c5cad3" metalness={0.95} roughness={0.25} />
          </mesh>
        ))}
        <pointLight color={mood.window} intensity={mood.windowIntensity * 0.7} distance={4} position={[0, 0, 0.5]} />
      </group>

      {/* Warning lamps above the crew. */}
      {mood.lamps.map((c, i) => (
        <group key={i} position={[(i - 1) * 1.35, 1.5, -1.5]}>
          <RoundedBox args={[0.75, 0.3, 0.1]} radius={0.03} smoothness={3}>
            <meshStandardMaterial color="#0b0c10" roughness={0.5} metalness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0, 0.06]}>
            <planeGeometry args={[0.6, 0.16]} />
            <meshBasicMaterial color={lampColor[i]} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0, 0.4]} color={c} intensity={1.6} distance={3.4} />
        </group>
      ))}

      {/* Switch banks and gauges. */}
      <Switches rows={4} cols={11} origin={[-3.1, 1.05, -1.55]} lit={mood.light} />
      <Switches rows={4} cols={11} origin={[1.7, 1.05, -1.55]} lit={mood.light} />
      <Switches rows={3} cols={6} origin={[-0.62, -0.35, -1.55]} lit={mood.light} />
      {[-2.4, -1.7, 1.7, 2.4].map((gx, i) => (
        <Gauge key={gx} position={[gx, 0.0 + (i % 2) * 0.28, -1.54]} needle={1.6 + i * 0.5} />
      ))}

      {/* Cable runs along the ceiling and down the walls. */}
      <Cable pts={[[-3.4, 1.9, 0.6], [-2.2, 1.85, -0.4], [-0.8, 1.9, -1.4], [-0.6, 1.2, -1.58]]} />
      <Cable pts={[[3.4, 1.9, 0.5], [2.2, 1.86, -0.5], [0.9, 1.92, -1.4], [0.7, 1.2, -1.58]]} r={0.022} />
      <Cable pts={[[-3.4, 1.7, 0.9], [-3.3, 0.6, 0.2], [-3.2, -0.6, -0.9]]} r={0.03} color="#2a2d35" />
      <Cable pts={[[3.4, 1.7, 0.9], [3.3, 0.5, 0.1], [3.2, -0.7, -0.9]]} r={0.03} color="#2a2d35" />

      {/* Couches with headrests, and the harness straps. */}
      {CREW_X.map((x) => (
        <group key={x}>
          <RoundedBox args={[1.05, 1.7, 0.34]} radius={0.08} smoothness={3} position={[x, -0.7, -0.62]}>
            <meshStandardMaterial color="#1a1d23" roughness={0.9} />
          </RoundedBox>
          <RoundedBox args={[0.5, 0.36, 0.2]} radius={0.07} smoothness={3} position={[x, 0.18, -0.55]}>
            <meshStandardMaterial color="#24272e" roughness={0.9} />
          </RoundedBox>
          {[-0.34, 0.34].map((sx) => (
            <mesh key={sx} position={[x + sx, -0.72, 0.28]} rotation={[0.12, 0, sx > 0 ? -0.2 : 0.2]}>
              <boxGeometry args={[0.07, 0.95, 0.012]} />
              <meshStandardMaterial color="#d7d2c4" roughness={0.9} side={DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}

      {/* The alarm beacon: a red spot that sweeps across the crew. */}
      {mood.beacon > 0 && (
        <group ref={beacon} position={[0, 1.7, -0.9]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 0.14, 16]} />
            <meshStandardMaterial color={mood.light} emissive={mood.light} emissiveIntensity={2.4} toneMapped={false} />
          </mesh>
          <spotLight ref={beaconLight as never} color={mood.light} angle={0.55} penumbra={0.6} distance={7} decay={1.6} intensity={5} position={[0, 0, 0]} target-position={[0, -1, 3]} />
        </group>
      )}

      {/* A little floating dust in the beam. */}
      <Dust shake={shake} />
    </group>
  );
}

function Dust({ shake }: { shake: number }) {
  const ref = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: Math.sin(i * 12.3) * 2.6, y: Math.cos(i * 7.7) * 1.2 + 0.2, z: Math.sin(i * 3.1) * 1.2 + 0.6, s: 0.2 + (i % 7) * 0.12 })), []);
  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seeds.forEach((d, i) => {
      o.position.set(d.x + Math.sin(t * d.s + i) * 0.12, d.y + Math.sin(t * d.s * 1.3 + i * 2) * 0.1 + t * 0.0, d.z + Math.cos(t * d.s + i) * 0.1);
      o.scale.setScalar(0.5 + shake * 0.6);
      o.updateMatrix();
      ref.current?.setMatrixAt(i, o.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 70]} frustumCulled={false}>
      <sphereGeometry args={[0.008, 6, 4]} />
      <meshBasicMaterial color="#e8eaf0" transparent opacity={0.55} />
    </instancedMesh>
  );
}
