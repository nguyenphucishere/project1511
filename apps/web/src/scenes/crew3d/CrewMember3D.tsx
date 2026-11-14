"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CatmullRomCurve3, DoubleSide, LatheGeometry, Vector2, Vector3, type Group } from "three";
import { fabricBump, flagPatch, nameTape, suitGrime } from "./textures";

export interface CrewProps {
  name: string;
  x: number;
  /** Where he looks, radians about the vertical (positive turns toward +x). */
  yaw: number;
  /** Nod, radians (positive looks down). */
  pitch?: number;
  /** 0 to 1: how fast he breathes. */
  fear?: number;
  /** The anodised colour of his neck lock ring and name-tape accent. */
  accent?: string;
  /** Fewer segments for weak machines. */
  low?: boolean;
}

const SUIT = "#ece8de";
const METAL = "#a7adb8";

/** A neck-ring profile: a stepped collar of the kind the helmet locks onto. */
const RING_PROFILE = [
  new Vector2(0.285, 0),
  new Vector2(0.325, 0),
  new Vector2(0.33, 0.035),
  new Vector2(0.305, 0.05),
  new Vector2(0.305, 0.085),
  new Vector2(0.345, 0.095),
  new Vector2(0.345, 0.135),
  new Vector2(0.31, 0.15),
  new Vector2(0.285, 0.15),
];

function Hose({ from, to, sag, color = "#d9702a" }: { from: [number, number, number]; to: [number, number, number]; sag: number; color?: string }) {
  const geo = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const mid = a.clone().lerp(b, 0.5).add(new Vector3(0, -sag, 0.12));
    return new CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).add(new Vector3(0, 0, 0.06)), mid, mid.clone().lerp(b, 0.5), b]);
  }, [from, to, sag]);
  return (
    <mesh>
      <tubeGeometry args={[geo, 28, 0.015, 10, false]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} />
    </mesh>
  );
}

// How the helmet meets the suit. The bubble is a sphere cut flat at the neck ring, so nothing of it
// hangs below the collar, and the cut edge lands exactly on the ring.
const RING_H = 0.8; // height scale of the neck ring profile
const RING_Y = -0.2; // the fixed ring sits on the top of the chest
const RING_TOP = RING_Y + 0.15 * RING_H;
const BUBBLE_R = 0.4;
const BUBBLE_SY = 1.06;
const CUT_THETA = 2.31; // where the bubble is cut flat (radians from the top)
// Height of the bubble's centre above the cut plane.
const BUBBLE_C = -Math.cos(CUT_THETA) * BUBBLE_R * BUBBLE_SY;

/**
 * One crew member from the chest up, in the white pressure suit he launches in: stitched fabric
 * with a weave and grime, a stepped neck ring with its lock tabs, hoses, chest connectors, name
 * tape and flag patch, and a glass helmet with a gold sun visor over a comm cap.
 *
 * Looking: the whole upper body turns a little in its straps, and the helmet turns the rest of the
 * way on the bearing at the top of the neck ring. The oxygen port is bolted to the fixed half of the
 * ring, not to the head.
 */
export function CrewMember3D({ name, x, yaw, pitch = 0, fear = 0.5, accent = "#2d63c8", low = false }: CrewProps) {
  const bump = useMemo(() => fabricBump(), []);
  const grime = useMemo(() => suitGrime(), []);
  const tape = useMemo(() => nameTape(name), [name]);
  const flag = useMemo(() => flagPatch(), []);
  const ring = useMemo(() => new LatheGeometry(RING_PROFILE, low ? 24 : 48), [low]);
  const body = useRef<Group>(null);
  const chest = useRef<Group>(null);
  const helmet = useRef<Group>(null);
  const seg = low ? 20 : 40;
  const side = Math.sign(yaw) || 1;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const rate = 1.6 + fear * 3.4;
    const breath = Math.sin(t * rate + x);
    if (chest.current) chest.current.scale.set(1 + breath * 0.012, 1 + breath * 0.02, 1);
    // The body turns a third of the way, leaning toward who he looks at; the helmet turns the rest.
    if (body.current) {
      body.current.rotation.y = yaw * 0.35;
      body.current.rotation.z = -side * Math.min(0.06, Math.abs(yaw) * 0.08);
    }
    if (helmet.current) {
      helmet.current.rotation.y = yaw * 0.65 + Math.sin(t * 0.7 + x * 3) * 0.012;
      helmet.current.rotation.x = pitch + Math.sin(t * rate * 0.5 + x) * 0.008;
    }
  });

  const suitMat = { color: SUIT, roughness: 0.88, metalness: 0, bumpMap: bump, bumpScale: 0.9, map: grime } as const;

  return (
    <group position={[x, 0, 0]}>
      <group ref={body} position={[0, -0.9, 0]}>
        <group position={[0, 0.9, 0]}>
          {/* Torso and shoulders. */}
          <group ref={chest}>
            <RoundedBox args={[0.88, 0.86, 0.54]} radius={0.15} smoothness={low ? 2 : 5} position={[0, -0.78, -0.04]}>
              <meshStandardMaterial {...suitMat} />
            </RoundedBox>
            <RoundedBox args={[0.72, 0.34, 0.46]} radius={0.12} smoothness={low ? 2 : 4} position={[0, -0.36, 0]}>
              <meshStandardMaterial {...suitMat} />
            </RoundedBox>
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh position={[s * 0.43, -0.5, 0]} scale={[1, 0.86, 1]}>
                  <sphereGeometry args={[0.16, seg, seg / 2]} />
                  <meshStandardMaterial {...suitMat} />
                </mesh>
                <mesh position={[s * 0.5, -0.84, 0.08]} rotation={[-0.5, 0, s * 0.12]}>
                  <capsuleGeometry args={[0.11, 0.4, 6, seg / 2]} />
                  <meshStandardMaterial {...suitMat} />
                </mesh>
                {[0, 1, 2].map((k) => (
                  <mesh key={k} position={[s * (0.48 + k * 0.012), -0.7 - k * 0.07, 0.04 + k * 0.03]} rotation={[Math.PI / 2 - 0.5, 0, s * 0.12]}>
                    <torusGeometry args={[0.115, 0.012, 8, seg]} />
                    <meshStandardMaterial color="#d3cfc3" roughness={0.9} />
                  </mesh>
                ))}
                {s === -1 && (
                  <mesh position={[-0.48, -0.46, 0.12]} rotation={[0.1, -0.5, 0.05]}>
                    <planeGeometry args={[0.15, 0.1]} />
                    <meshStandardMaterial map={flag} roughness={0.9} side={DoubleSide} />
                  </mesh>
                )}
              </group>
            ))}
            {[-0.26, 0.26].map((sx) => (
              <mesh key={sx} position={[sx, -0.78, 0.236]}>
                <boxGeometry args={[0.006, 0.8, 0.004]} />
                <meshStandardMaterial color="#8c887c" roughness={1} />
              </mesh>
            ))}
            <mesh position={[0.26, -0.5, 0.249]}>
              <planeGeometry args={[0.24, 0.06]} />
              <meshStandardMaterial map={tape} roughness={0.85} />
            </mesh>
            {/* Chest connectors: oxygen in, water out, comms. */}
            {[
              { px: -0.22, c: accent },
              { px: 0, c: "#c43a2a" },
              { px: 0.22, c: "#26292f" },
            ].map(({ px, c }) => (
              <group key={px} position={[px, -0.82, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.058, 0.064, 0.05, seg / 2]} />
                  <meshStandardMaterial color={c} metalness={0.65} roughness={0.32} />
                </mesh>
                <mesh position={[0, 0.03, 0]}>
                  <torusGeometry args={[0.05, 0.012, 8, seg / 2]} />
                  <meshStandardMaterial color={METAL} metalness={0.9} roughness={0.28} />
                </mesh>
                <mesh position={[0, 0.045, 0]}>
                  <cylinderGeometry args={[0.024, 0.024, 0.02, 10]} />
                  <meshStandardMaterial color="#15171b" roughness={0.5} metalness={0.4} />
                </mesh>
              </group>
            ))}
            <Hose from={[-0.22, -0.82, 0.3]} to={[-0.5, -1.12, 0.22]} sag={0.12} />
            <Hose from={[0.22, -0.82, 0.3]} to={[0.5, -1.12, 0.22]} sag={0.1} color="#4a5058" />
            <Hose from={[0, -0.82, 0.3]} to={[0.14, -0.5, 0.2]} sag={0.02} color="#d9702a" />
          </group>

          {/* The fixed half of the neck ring, sitting on the chest, with the oxygen port bolted to it. */}
          <group position={[0, RING_Y, 0]}>
            <group scale={[1, RING_H, 1]}>
              <mesh geometry={ring}>
                <meshStandardMaterial color={METAL} metalness={0.95} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.075, 0]}>
                <torusGeometry args={[0.328, 0.024, 10, low ? 32 : 64]} />
                <meshStandardMaterial color={accent} metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
            <mesh position={[-0.13, 0.06, 0.318]} rotation={[Math.PI / 2 - 0.35, 0, 0.25]}>
              <cylinderGeometry args={[0.038, 0.044, 0.06, 14]} />
              <meshStandardMaterial color="#c43a2a" metalness={0.6} roughness={0.35} />
            </mesh>
          </group>

          {/* The helmet, turning on the bearing at the top of the ring. Its bubble is cut flat at the ring. */}
          <group ref={helmet} position={[0, RING_TOP, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.322, 0.03, 12, low ? 40 : 72]} />
              <meshStandardMaterial color={METAL} metalness={0.95} roughness={0.28} />
            </mesh>
            {/* the neck dam: a dark rubber seal across the ring, so the helmet is not open at the bottom */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
              <circleGeometry args={[0.3, low ? 24 : 40]} />
              <meshStandardMaterial color="#1c1f26" roughness={0.9} />
            </mesh>
            {Array.from({ length: 8 }, (_, i) => (
              <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 0.345, 0.0, Math.sin((i / 8) * Math.PI * 2) * 0.345]} rotation={[0, -(i / 8) * Math.PI * 2, 0]}>
                <boxGeometry args={[0.03, 0.03, 0.05]} />
                <meshStandardMaterial color="#c9ced6" metalness={0.9} roughness={0.25} />
              </mesh>
            ))}
            <group position={[0, BUBBLE_C, 0]}>
              {/* the man inside: jaw, comm cap and ear cups */}
              <mesh position={[0, -0.03, 0.045]}>
                <sphereGeometry args={[0.18, seg, seg / 2]} />
                <meshStandardMaterial color="#b98a6c" roughness={0.75} />
              </mesh>
              <mesh rotation={[0.1, 0, 0]}>
                <sphereGeometry args={[0.19, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
                <meshStandardMaterial color="#e8e3d6" roughness={0.85} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * 0.182, -0.015, 0.01]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.05, 0.05, 0.035, 16]} />
                  <meshStandardMaterial color="#17191d" roughness={0.45} metalness={0.3} />
                </mesh>
              ))}
              {/* glass bubble, open at the bottom */}
              <mesh scale={[1, BUBBLE_SY, 1.02]}>
                <sphereGeometry args={[BUBBLE_R, low ? 32 : 56, low ? 24 : 40, 0, Math.PI * 2, 0, CUT_THETA]} />
                <meshPhysicalMaterial color="#dce6f4" transparent opacity={0.13} roughness={0.02} metalness={0} clearcoat={1} clearcoatRoughness={0.03} envMapIntensity={2.2} depthWrite={false} side={DoubleSide} />
              </mesh>
              {/* the gold sun visor, down over the whole face */}
              <mesh scale={[1, BUBBLE_SY, 1.02]}>
                <sphereGeometry args={[BUBBLE_R + 0.006, low ? 32 : 56, low ? 20 : 32, Math.PI / 2 - 1.2, 2.4, 0.5, 1.5]} />
                <meshPhysicalMaterial color="#e0b650" metalness={1} roughness={0.14} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={3.6} side={DoubleSide} />
              </mesh>
              {/* visor pivots and rails on the sides */}
              {[-1, 1].map((s) => (
                <group key={s}>
                  <mesh position={[s * 0.39, 0.0, 0.06]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
                    <meshStandardMaterial color={METAL} metalness={0.95} roughness={0.25} />
                  </mesh>
                  <mesh position={[s * 0.385, 0.07, 0.1]} rotation={[0.3, 0, s * -0.2]}>
                    <boxGeometry args={[0.02, 0.2, 0.05]} />
                    <meshStandardMaterial color={METAL} metalness={0.9} roughness={0.3} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
