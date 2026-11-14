"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Group } from "three";
import { filmClock } from "./clock";
import { SEA, T } from "./flight";

/** One helicopter: a body, a tail and a spinning rotor. Positioned each frame by the parent. */
function Helicopter({ rotor }: { rotor: React.RefObject<Group | null> }) {
  return (
    <>
      <mesh>
        <boxGeometry args={[2.2, 1.6, 5]} />
        <meshStandardMaterial color="#d8dde3" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.3, -4.6]}>
        <boxGeometry args={[0.5, 0.6, 4.4]} />
        <meshStandardMaterial color="#c9ced4" roughness={0.6} />
      </mesh>
      <group ref={rotor} position={[0, 1.2, 0]}>
        <mesh>
          <boxGeometry args={[9, 0.06, 0.45]} />
          <meshStandardMaterial color="#2a2d31" />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[9, 0.06, 0.45]} />
          <meshStandardMaterial color="#2a2d31" />
        </mesh>
      </group>
    </>
  );
}

/** Where a helicopter is at film time t: in from far off, then circling the capsule at a hover. */
function helicopterAt(t: number, phase: number): [number, number, number, number] {
  const arrive = Math.min(1, Math.max(0, (t - (T.CHUTES + 14 + phase * 4)) / 24));
  const s = arrive * arrive * (3 - 2 * arrive);
  const ang = phase * 2.4 + t * 0.12;
  const r = 70 * (1 - s) + (16 + phase * 6) * s;
  const x = -260 * (1 - s) + Math.cos(ang) * r * s;
  const z = -420 * (1 - s) + Math.sin(ang) * r * s;
  const y = 120 * (1 - s) + (13 + phase * 3) * s;
  return [x, y, z, -ang];
}

/**
 * The recovery: the carrier far off, two helicopters coming in and hovering, and, once the capsule is
 * down, the flotation collar and the swimmers' raft. Placed relative to the splashdown point.
 */
export function Recovery() {
  const root = useRef<Group>(null);
  const heli = [useRef<Group>(null), useRef<Group>(null)];
  const rotor = [useRef<Group>(null), useRef<Group>(null)];
  const collar = useRef<Group>(null);
  useFrame(() => {
    const t = filmClock.t;
    const g = root.current;
    if (!g) return;
    g.visible = t >= T.CHUTES - 0.5;
    if (!g.visible) return;
    heli.forEach((ref, i) => {
      const h = ref.current;
      if (!h) return;
      const [x, y, z, yaw] = helicopterAt(t, i);
      h.position.set(x, y + Math.sin(t * 1.7 + i) * 0.25, z);
      h.rotation.set(0.05 * Math.sin(t * 0.9 + i), yaw, 0);
      const r = rotor[i]!.current;
      if (r) r.rotation.y = t * 38;
    });
    // The collar goes round the capsule soon after it is down, and floats it level.
    const c = collar.current;
    if (c) {
      const k = Math.min(1, Math.max(0, (t - (T.TOUCHDOWN + 5)) / 3));
      c.visible = k > 0;
      c.scale.setScalar(0.3 + 0.7 * k);
      c.position.y = 0.25 + Math.sin(t * 1.3) * 0.08;
    }
  });
  return (
    <group ref={root} position={SEA} visible={false}>
      {/* The carrier, far off on the horizon */}
      <group position={[700, 0, -900]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 4.5, 0]}>
          <boxGeometry args={[130, 9, 20]} />
          <meshStandardMaterial color="#6f7882" roughness={0.8} />
        </mesh>
        <mesh position={[0, 9.4, 0]}>
          <boxGeometry args={[134, 0.8, 34]} />
          <meshStandardMaterial color="#57606a" roughness={0.9} />
        </mesh>
        <mesh position={[14, 15, 12]}>
          <boxGeometry args={[12, 11, 5]} />
          <meshStandardMaterial color="#7a838d" roughness={0.8} />
        </mesh>
        {/* The mast on the island, and the aircraft parked along the deck */}
        <mesh position={[14, 24, 12]}>
          <boxGeometry args={[0.8, 8, 0.8]} />
          <meshStandardMaterial color="#444b53" />
        </mesh>
        {[-48, -34, -18, 22, 38, 52].map((x, i) => (
          <mesh key={x} position={[x, 10.6, i % 2 ? -7 : 4]}>
            <boxGeometry args={[6, 1.4, 2.2]} />
            <meshStandardMaterial color="#3f4650" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 9.85, 0]}>
          <boxGeometry args={[128, 0.05, 0.6]} />
          <meshStandardMaterial color="#e6e1d3" />
        </mesh>
      </group>
      <group ref={heli[0]}>
        <Helicopter rotor={rotor[0]!} />
      </group>
      <group ref={heli[1]}>
        <Helicopter rotor={rotor[1]!} />
      </group>
      {/* The flotation collar and the swimmers' raft */}
      <group ref={collar} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.4, 0.45, 12, 32]} />
          <meshStandardMaterial color="#ff7a1a" roughness={0.7} />
        </mesh>
        <mesh position={[5.5, -0.1, 3]}>
          <boxGeometry args={[3.2, 0.5, 1.6]} />
          <meshStandardMaterial color="#ff7a1a" roughness={0.7} side={DoubleSide} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos(i * 2.1 + 0.4) * 2.9, -0.05, Math.sin(i * 2.1 + 0.4) * 2.9]}>
            <sphereGeometry args={[0.28, 12, 10]} />
            <meshStandardMaterial color="#1b1f24" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
