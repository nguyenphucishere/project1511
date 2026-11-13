"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MathUtils,
  type BufferAttribute,
  type BufferGeometry,
  type Group,
  type MeshBasicMaterial,
  type Points,
  type PointLight,
} from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";

const SPARK_HOT = new Color(5, 2.6, 0.7);
const ARC = new Color(3.2, 4.2, 5.5);

/**
 * Welding sparks: bright points thrown from the torch that fall in arcs and bounce off the floor,
 * plus the blue-white flare of the arc itself. Positions are in the parent's local frame.
 */
export function WeldSparks({ count = 70, floorY = -1, intensity = 1 }: { count?: number; floorY?: number; intensity?: number }) {
  const reduced = useReducedMotion();
  const pts = useRef<Points>(null);
  const light = useRef<PointLight>(null);
  const flare = useRef<MeshBasicMaterial>(null);
  const state = useMemo(() => {
    const p = new Float32Array(count * 3);
    const v = new Float32Array(count * 3);
    const life = new Float32Array(count);
    for (let i = 0; i < count; i++) life[i] = Math.random();
    return { p, v, life };
  }, [count]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = pts.current?.geometry as BufferGeometry | undefined;
    if (!g) return;
    const pos = g.getAttribute("position") as BufferAttribute;
    // The torch strikes in bursts: on for a while, a pause, on again.
    const on = !reduced && Math.sin(clock.elapsedTime * 1.3) > -0.55;
    for (let i = 0; i < count; i++) {
      state.life[i] -= dt * 1.6;
      if (state.life[i] <= 0) {
        if (!on) {
          state.p[i * 3 + 1] = -999;
          state.life[i] = 0.2;
          pos.setXYZ(i, 0, -999, 0);
          continue;
        }
        state.life[i] = 0.5 + Math.random() * 0.7;
        state.p[i * 3] = 0;
        state.p[i * 3 + 1] = 0;
        state.p[i * 3 + 2] = 0;
        state.v[i * 3] = (Math.random() - 0.5) * 2.6;
        state.v[i * 3 + 1] = 0.6 + Math.random() * 2.2;
        state.v[i * 3 + 2] = (Math.random() - 0.2) * 2.4;
      }
      state.v[i * 3 + 1] -= 9.8 * dt;
      state.p[i * 3] += state.v[i * 3] * dt;
      state.p[i * 3 + 1] += state.v[i * 3 + 1] * dt;
      state.p[i * 3 + 2] += state.v[i * 3 + 2] * dt;
      if (state.p[i * 3 + 1] < floorY) {
        state.p[i * 3 + 1] = floorY;
        state.v[i * 3 + 1] *= -0.35;
        state.v[i * 3] *= 0.6;
        state.v[i * 3 + 2] *= 0.6;
      }
      pos.setXYZ(i, state.p[i * 3], state.p[i * 3 + 1], state.p[i * 3 + 2]);
    }
    pos.needsUpdate = true;
    const flick = on ? 0.55 + Math.random() * 0.45 : 0;
    if (light.current) light.current.intensity = flick * 14 * intensity;
    if (flare.current) flare.current.opacity = flick;
  });

  return (
    <group>
      <points ref={pts} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[state.p, 3]} />
        </bufferGeometry>
        <pointsMaterial color={SPARK_HOT} size={0.05} sizeAttenuation transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </points>
      <mesh>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshBasicMaterial ref={flare} color={ARC} transparent toneMapped={false} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color="#7dd3fc" intensity={0} distance={7} decay={1.6} />
    </group>
  );
}

/** A technician kneeling at the engine skirt, welding. Sparks bounce on the polished floor. */
export function FloorWelder() {
  const arm = useRef<Group>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    if (arm.current && !reduced) arm.current.rotation.z = Math.sin(clock.elapsedTime * 1.3) * 0.15;
  });
  return (
    <group position={[2.55, 0, 1.95]} rotation={[0, -2.2, 0]}>
      <mesh position={[0, 0.1, 0.18]}>
        <boxGeometry args={[0.16, 0.14, 0.45]} />
        <meshStandardMaterial color="#374151" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.34, 0.02]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.2, 0.5, 0.22]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.38, 0.55, 0.24]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.18, 0.12]}>
        <boxGeometry args={[0.24, 0.26, 0.26]} />
        <meshStandardMaterial color="#12161c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.18, 0.26]}>
        <planeGeometry args={[0.13, 0.08]} />
        <meshBasicMaterial color="#fbbf24" toneMapped={false} />
      </mesh>
      <group ref={arm} position={[0.12, 0.95, 0.26]}>
        <mesh position={[0, -0.02, 0.28]} rotation={[1.2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.6, 8]} />
          <meshStandardMaterial color="#cfd6de" metalness={0.8} roughness={0.35} />
        </mesh>
        <group position={[0, 0.18, 0.58]}>
          <WeldSparks floorY={-0.95} />
        </group>
      </group>
      <mesh position={[-0.55, 0.45, -0.1]}>
        <cylinderGeometry args={[0.1, 0.1, 0.9, 14]} />
        <meshStandardMaterial color="#dc2626" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

interface WalkerProps {
  path: [number, number][];
  speed?: number;
  vest?: string;
  suit?: string;
  carrying?: "crate" | "tablet" | "none";
  phase?: number;
}

/** A technician pacing a path back and forth, legs swinging. */
export function Walker({ path, speed = 0.9, vest = "#ea580c", suit = "#374151", carrying = "none", phase = 0 }: WalkerProps) {
  const root = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const reduced = useReducedMotion();
  const lengths = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i < path.length; i++) out.push(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    return out;
  }, [path]);
  const total = lengths.reduce((a, b) => a + b, 0);

  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const dist = reduced ? 0 : (clock.elapsedTime * speed + phase * total) % (total * 2);
    const forward = dist <= total;
    let d = forward ? dist : total * 2 - dist;
    let seg = 0;
    while (seg < lengths.length - 1 && d > lengths[seg]) {
      d -= lengths[seg];
      seg++;
    }
    const a = path[seg];
    const b = path[seg + 1];
    const k = lengths[seg] ? d / lengths[seg] : 0;
    g.position.set(MathUtils.lerp(a[0], b[0], k), 0, MathUtils.lerp(a[1], b[1], k));
    const sign = forward ? 1 : -1;
    g.rotation.y = Math.atan2((b[0] - a[0]) * sign, (b[1] - a[1]) * sign);
    const stride = reduced ? 0 : Math.sin(clock.elapsedTime * speed * 7) * 0.5;
    if (legL.current) legL.current.rotation.x = stride;
    if (legR.current) legR.current.rotation.x = -stride;
  });

  return (
    <group ref={root}>
      {[-0.1, 0.1].map((x, i) => (
        <group key={x} ref={i === 0 ? legL : legR} position={[x, 0.78, 0]}>
          <mesh position={[0, -0.36, 0]}>
            <boxGeometry args={[0.14, 0.74, 0.18]} />
            <meshStandardMaterial color={suit} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.74, 0.04]}>
            <boxGeometry args={[0.15, 0.1, 0.26]} />
            <meshStandardMaterial color="#1f2937" roughness={0.7} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.42, 0.62, 0.26]} />
        <meshStandardMaterial color={vest} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.15, 0.133]}>
        <planeGeometry args={[0.38, 0.07]} />
        <meshBasicMaterial color="#e0f2fe" />
      </mesh>
      <mesh position={[0, 1.58, 0]}>
        <sphereGeometry args={[0.13, 14, 12]} />
        <meshStandardMaterial color="#e6b98c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </mesh>
      {carrying === "crate" && (
        <mesh position={[0, 1.0, 0.32]}>
          <boxGeometry args={[0.5, 0.36, 0.34]} />
          <meshStandardMaterial color="#8a6a3a" roughness={0.8} />
        </mesh>
      )}
      {carrying === "tablet" && (
        <group position={[0, 1.05, 0.26]} rotation={[-0.5, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.26, 0.34, 0.03]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, 0, 0.018]}>
            <planeGeometry args={[0.22, 0.3]} />
            <meshBasicMaterial color={SCENE_COLORS.screenCyan} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Set while a loudspeaker announcement plays; the horns pulse with it. */
export const pa = { active: false };

/** Horn speakers on the side pillars. */
export function Loudspeakers() {
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    const k = pa.active ? 0.5 + Math.sin(clock.elapsedTime * 14) * 0.5 : 0;
    for (const m of mats.current) m?.color.setRGB(0.2 + k * 2.2, 0.2 + k * 1.6, 0.1 + k * 0.4);
  });
  const spots: [number, number, number, number][] = [
    [-19.2, 7.5, -6, Math.PI / 2],
    [-19.2, 7.5, 6, Math.PI / 2],
    [19.2, 7.5, -6, -Math.PI / 2],
    [19.2, 7.5, 6, -Math.PI / 2],
  ];
  return (
    <group>
      {spots.map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, r, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.38, 0.09, 0.6, 18, 1, true]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.3} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.45]}>
            <circleGeometry args={[0.24, 18]} />
            <meshBasicMaterial ref={(m) => void (mats.current[i] = m)} color="#333" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.25, 0.25, 0.2]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.45} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
