"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  TorusGeometry,
  type BufferGeometry,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addTrauma } from "@/game/shake";
import { playSfx } from "@/game/sfx";
import { SCENE_COLORS } from "@/lib/palette";
import { HOLD_DOWN, LES_T } from "./ascent";

/**
 * The machinery of the launch, animated to the beat of the film: tower arms swing back, the
 * hold-down clamps let go, and at every separation the stack comes apart like a transformer: latches
 * slide out, bolts fire, shells fold open on hydraulic rams and geared hinges, a skeleton of struts
 * is exposed, retro rockets push the spent stage away and the next engine's nozzle telescopes out.
 * Each part reads the time since ignition itself, so the camera can cut anywhere and find it moving.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (k: number) => k * k * (3 - 2 * k);
/** 0 before `a`, 1 after `b`, eased in between. */
const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
const since = (ignitionAt: number | null) => (ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000);

/** Fires `fn` once as `t` crosses `at`. */
function useCue(at: number, fn: () => void) {
  const prev = useRef(-1);
  return (t: number) => {
    if (prev.current < at && t >= at && t < at + 1) fn();
    prev.current = t;
  };
}

const STEEL = { color: "#9aa5b1", metalness: 0.85, roughness: 0.3 } as const;
const DARK = { color: SCENE_COLORS.steelDark, metalness: 0.7, roughness: 0.45 } as const;
const BRASS = { color: "#b0823f", metalness: 0.9, roughness: 0.28 } as const;

/* ---------------------------------------------------------------- tower arms and clamps */

/** An umbilical arm that holds on until just before ignition, then swings clear of the rocket. */
export function SwingArm({ ignitionAt, delay = 0 }: { ignitionAt: number | null; delay?: number }) {
  const pivot = useRef<Group>(null);
  const cue = useCue(HOLD_DOWN - 2 + delay, () => playSfx("unlatch"));
  useFrame(() => {
    const t = since(ignitionAt);
    if (pivot.current) pivot.current.rotation.y = span(t, HOLD_DOWN - 2 + delay, HOLD_DOWN - 0.6 + delay) * 1.4;
    cue(t);
  });
  return (
    <group ref={pivot}>
      <mesh position={[2.2, 0, 0]}>
        <boxGeometry args={[2.7, 0.22, 0.38]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.5} />
      </mesh>
      {/* Hydraulic ram under the arm and the coupling head at its tip */}
      <mesh position={[1.4, -0.3, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.07, 0.07, 1.7, 8]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[3.55, 0, 0]}>
        <boxGeometry args={[0.32, 0.4, 0.5]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Four hold-down clamps gripping the skirt; they open at the moment of release. */
export function HoldDownClamps({ ignitionAt }: { ignitionAt: number | null }) {
  const arms = useRef<(Group | null)[]>([]);
  const pistons = useRef<(Mesh | null)[]>([]);
  const cue = useCue(HOLD_DOWN - 0.15, () => {
    playSfx("bang");
    addTrauma(0.35);
  });
  const warn = useCue(HOLD_DOWN - 1.1, () => playSfx("unlatch"));
  useFrame(() => {
    const t = since(ignitionAt);
    const open = span(t, HOLD_DOWN - 0.15, HOLD_DOWN + 0.7);
    arms.current.forEach((g) => {
      if (g) g.rotation.z = -open * 1.25;
    });
    pistons.current.forEach((m) => {
      if (m) m.scale.y = 1 + open * 0.9;
    });
    cue(t);
    warn(t);
  });
  return (
    <group position={[0, 2.25, 0]}>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
          <mesh position={[2.1, 0.2, 0]}>
            <boxGeometry args={[0.7, 0.4, 0.6]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
          <group ref={(el) => (arms.current[i] = el)} position={[2.1, 0.5, 0]}>
            <mesh position={[-0.55, 0, 0]}>
              <boxGeometry args={[1.1, 0.22, 0.34]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
            <mesh position={[-1.1, 0.1, 0]}>
              <boxGeometry args={[0.22, 0.5, 0.4]} />
              <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
            </mesh>
            {/* A toothed cog on the pivot */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.22]}>
              <cylinderGeometry args={[0.2, 0.2, 0.08, 10]} />
              <meshStandardMaterial {...BRASS} flatShading />
            </mesh>
          </group>
          <mesh ref={(el) => (pistons.current[i] = el)} position={[2.45, 0.35, 0]} rotation={[0, 0, 0.6]}>
            <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- bolt flashes */

/** A ring of explosive bolts firing at `at`: flashes plus a shock ring racing outward. */
function BoltFlash({ ignitionAt, at, y, r }: { ignitionAt: number | null; at: number; y: number; r: number }) {
  const flashes = useRef<(Mesh | null)[]>([]);
  const shock = useRef<Mesh>(null);
  const cue = useCue(at - 0.15, () => {
    playSfx("bang");
    playSfx("boom");
    addTrauma(0.6);
  });
  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - at;
    const f = clamp01((s + 0.15) / 0.5);
    const flash = s >= -0.15 && s < 0.4 ? Math.sin(f * Math.PI) : 0;
    flashes.current.forEach((m, i) => {
      if (!m) return;
      m.visible = flash > 0.01;
      m.scale.setScalar(0.05 + flash * (0.28 + (i % 3) * 0.06) * (r / 1.6 + 0.4));
    });
    if (shock.current) {
      const k = clamp01((s + 0.1) / 0.8);
      shock.current.visible = k > 0 && k < 1;
      shock.current.scale.setScalar(1 + k * 4);
      (shock.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.7;
    }
    cue(t);
  });
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} ref={(el) => (flashes.current[i] = el)} position={[Math.sin(a) * r, 0, Math.cos(a) * r]} visible={false}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#ffd9a0" toneMapped={false} blending={AdditiveBlending} transparent depthWrite={false} />
          </mesh>
        );
      })}
      <mesh ref={shock} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[r, 0.06, 6, 40]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} blending={AdditiveBlending} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- the petal ring */

/** Where a point given in a hinged panel's own frame ends up in the ring's frame (x out, y up). */
const place = (hx: number, hy: number, angle: number, lx: number, ly: number): [number, number] => [
  hx + lx * Math.cos(angle) - ly * Math.sin(angle),
  hy + lx * Math.sin(angle) + ly * Math.cos(angle),
];

/** A hydraulic ram between two points: a fixed barrel and a rod that slides out of it. */
function setRam(barrel: Mesh | null, rod: Mesh | null, a: [number, number], b: [number, number], barrelLen: number) {
  if (!barrel || !rod) return;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.max(0.2, Math.hypot(dx, dy));
  const nx = dx / len;
  const ny = dy / len;
  const rz = Math.atan2(-dx, dy);
  const bl = Math.min(barrelLen, len);
  barrel.position.set(a[0] + nx * bl * 0.5, a[1] + ny * bl * 0.5, 0);
  barrel.rotation.z = rz;
  barrel.scale.set(1, bl, 1);
  const rl = Math.max(0.01, len - bl);
  rod.position.set(a[0] + nx * (bl + rl * 0.5), a[1] + ny * (bl + rl * 0.5), 0);
  rod.rotation.z = rz;
  rod.scale.set(1, rl, 1);
}

/** The stack's internal skeleton, built once: struts and ring frames as two merged meshes. */
function useLattice(r: number, h: number) {
  return useMemo(() => {
    const struts: BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const g = new BoxGeometry(0.1, h, 0.1);
      g.translate(Math.sin(a) * r * 0.78, h / 2, Math.cos(a) * r * 0.78);
      struts.push(g);
      const d = new CylinderGeometry(0.03, 0.03, r * 1.1, 5);
      d.rotateZ(Math.PI / 2);
      d.rotateY(a + Math.PI / 8);
      d.translate(Math.sin(a + Math.PI / 8) * r * 0.4, h * 0.15, Math.cos(a + Math.PI / 8) * r * 0.4);
      struts.push(d);
    }
    const rings: BufferGeometry[] = [];
    for (const y of [0.1, h * 0.5, h - 0.1]) {
      const t = new TorusGeometry(r * 0.78, 0.05, 6, 24);
      t.rotateX(Math.PI / 2);
      t.translate(0, y, 0);
      rings.push(t);
    }
    return { struts: mergeGeometries(struts)!, rings: mergeGeometries(rings)! };
  }, [r, h]);
}

export interface PetalRingProps {
  ignitionAt: number | null;
  /** Real seconds after ignition when the bolts fire. */
  at: number;
  /** Height of the ring's base and its length along the stack. */
  y0: number;
  h: number;
  /** Radius at the bottom and the top. */
  r0: number;
  r1: number;
  color: string;
  stripe?: string;
  petals?: number;
  /** How far the lower panel swings open, radians (past 1.57 it hangs back along the stage). */
  open?: number;
  /** After opening, the panels let go and tumble away (the spacecraft adapter). */
  release?: boolean;
  /** Retro rockets on the stage below, firing for a moment after the bolts. */
  retro?: boolean;
  /** Something the opening reveals, in the ring's frame (origin at the ring's base). */
  children?: ReactNode;
}

/**
 * A shell that comes apart in four hinged petals. Closed it is a plain ring of the stack. At `at`
 * the latches slide out, the bolts flash, and each petal swings open in two segments on rams and
 * cogs, leaving a lattice of struts and ring frames (and whatever sits inside) in plain sight.
 */
export function PetalRing({
  ignitionAt,
  at,
  y0,
  h,
  r0,
  r1,
  color,
  stripe = SCENE_COLORS.spaceWhite,
  petals = 4,
  open = 1.6,
  release = false,
  retro = false,
  children,
}: PetalRingProps) {
  const lattice = useLattice(r0, h);
  const h1 = h * 0.58;
  const h2 = h - h1;
  const rMid = r0 + ((r1 - r0) * h1) / h;
  const arc = (Math.PI * 2) / petals - 0.06;
  const center = Math.PI / 2 - arc / 2;

  const fly = useRef<(Group | null)[]>([]);
  const lower = useRef<(Group | null)[]>([]);
  const upper = useRef<(Group | null)[]>([]);
  const cogs = useRef<(Group | null)[]>([]);
  const latches = useRef<(Mesh | null)[]>([]);
  const barrels = useRef<(Mesh | null)[]>([]);
  const rods = useRef<(Mesh | null)[]>([]);
  const barrels2 = useRef<(Mesh | null)[]>([]);
  const rods2 = useRef<(Mesh | null)[]>([]);
  const retroRef = useRef<Group>(null);
  const unlatch = useCue(at - 0.9, () => playSfx("unlatch"));
  const tick = useCue(at + 0.5, () => playSfx("tick"));
  const tick2 = useCue(at + 0.8, () => playSfx("tick"));

  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - at;
    const slide = span(s, -0.9, -0.2);
    const o = span(s, -0.05, 1.0);
    const f = span(s, 0.15, 1.3);
    const ang1 = -o * open;
    const ang2 = -f * 1.5;
    const free = release ? Math.max(0, s - 1.4) : 0;
    for (let i = 0; i < petals; i++) {
      const hinge = lower.current[i];
      if (hinge) hinge.rotation.z = ang1;
      const hinge2 = upper.current[i];
      if (hinge2) hinge2.rotation.z = ang2;
      const cog = cogs.current[i];
      if (cog) cog.rotation.z = ang1 * 4;
      const latch = latches.current[i];
      if (latch) latch.position.x = r0 + 0.08 - slide * 0.32;
      const fl = fly.current[i];
      if (fl) {
        fl.position.set(free * 1.8, -0.5 * 2.5 * free * free, 0);
        fl.rotation.z = -free * 0.5;
        fl.visible = free < 6;
      }
      // Ram 1: ring frame to the middle of the lower panel; ram 2 across the fold.
      const a1: [number, number] = [r0 - 0.5, y0 + 0.05];
      const b1 = place(r0, y0, ang1, -0.28, h1 * 0.5);
      setRam(barrels.current[i] ?? null, rods.current[i] ?? null, a1, b1, 0.45);
      const hingeTop = place(r0, y0, ang1, rMid - r0, h1);
      const a2 = place(r0, y0, ang1, -0.28, h1 * 0.92);
      const b2 = place(hingeTop[0], hingeTop[1], ang1 + ang2, -0.28, h2 * 0.45);
      setRam(barrels2.current[i] ?? null, rods2.current[i] ?? null, a2, b2, 0.3);
    }
    if (retroRef.current) retroRef.current.visible = retro && s > 0 && s < 1.1;
    unlatch(t);
    tick(t);
    tick2(t);
  });

  return (
    <group>
      {/* The skeleton and whatever it hides */}
      <group position={[0, y0, 0]}>
        <mesh geometry={lattice.struts}>
          <meshStandardMaterial {...STEEL} />
        </mesh>
        <mesh geometry={lattice.rings}>
          <meshStandardMaterial {...DARK} />
        </mesh>
        {children}
      </group>

      {Array.from({ length: petals }, (_, i) => {
        const az = (i * Math.PI * 2) / petals + Math.PI / petals;
        return (
          <group key={i} rotation={[0, az, 0]}>
            <group ref={(el) => (fly.current[i] = el)}>
              <group ref={(el) => (lower.current[i] = el)} position={[r0, y0, 0]}>
                <mesh position={[-r0, h1 / 2, 0]}>
                  <cylinderGeometry args={[rMid, r0, h1, 8, 1, true, center, arc]} />
                  <meshStandardMaterial color={color} metalness={0.2} roughness={0.4} side={DoubleSide} />
                </mesh>
                {/* A light band along the lower edge, and the geared hinge with its barrels */}
                <mesh position={[-r0, 0.12, 0]}>
                  <cylinderGeometry args={[r0 + 0.012, r0 + 0.012, 0.18, 8, 1, true, center, arc]} />
                  <meshStandardMaterial color={stripe} roughness={0.5} side={DoubleSide} />
                </mesh>
                <group ref={(el) => (cogs.current[i] = el)} position={[0.04, 0, arc * r0 * 0.5 + 0.05]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.2, 0.2, 0.1, 10]} />
                    <meshStandardMaterial {...BRASS} flatShading />
                  </mesh>
                </group>
                <mesh position={[0.04, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.075, 0.075, arc * r0 * 0.95, 8]} />
                  <meshStandardMaterial {...STEEL} />
                </mesh>

                <group ref={(el) => (upper.current[i] = el)} position={[rMid - r0, h1, 0]}>
                  <mesh position={[-rMid, h2 / 2, 0]}>
                    <cylinderGeometry args={[r1, rMid, h2, 8, 1, true, center, arc]} />
                    <meshStandardMaterial color={color} metalness={0.2} roughness={0.4} side={DoubleSide} />
                  </mesh>
                  <mesh position={[0.02, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.06, 0.06, arc * rMid * 0.9, 8]} />
                    <meshStandardMaterial {...STEEL} />
                  </mesh>
                </group>
              </group>
              {/* Rams live in the ring's frame, updated every frame from the panel angles */}
              <mesh ref={(el) => (barrels.current[i] = el)} position={[r0 - 0.4, y0 + 0.2, 0.35]}>
                <cylinderGeometry args={[0.07, 0.07, 1, 8]} />
                <meshStandardMaterial {...DARK} />
              </mesh>
              <mesh ref={(el) => (rods.current[i] = el)} position={[r0 - 0.3, y0 + 0.4, 0.35]}>
                <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
                <meshStandardMaterial {...STEEL} />
              </mesh>
              <mesh ref={(el) => (barrels2.current[i] = el)} position={[r0 - 0.4, y0 + h1, -0.35]}>
                <cylinderGeometry args={[0.055, 0.055, 1, 8]} />
                <meshStandardMaterial {...DARK} />
              </mesh>
              <mesh ref={(el) => (rods2.current[i] = el)} position={[r0 - 0.3, y0 + h1, -0.35]}>
                <cylinderGeometry args={[0.032, 0.032, 1, 8]} />
                <meshStandardMaterial {...STEEL} />
              </mesh>
            </group>
            {/* Latch pin that slides out of the lower edge just before the bolts fire */}
            <mesh ref={(el) => (latches.current[i] = el)} position={[r0 + 0.08, y0 + 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.5, 8]} />
              <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
            </mesh>
          </group>
        );
      })}

      <BoltFlash ignitionAt={ignitionAt} at={at} y={y0 + 0.02} r={r0 + 0.02} />

      {/* Retro rockets pushing the spent stage back */}
      <group ref={retroRef} visible={false} position={[0, y0 - 0.9, 0]}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          return (
            <mesh key={i} position={[Math.sin(a) * (r0 + 0.1), 0.6, Math.cos(a) * (r0 + 0.1)]}>
              <coneGeometry args={[0.14, 1.3, 8, 1, true]} />
              <meshBasicMaterial color={SCENE_COLORS.flameCore} toneMapped={false} blending={AdditiveBlending} transparent opacity={0.9} depthWrite={false} side={DoubleSide} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- engine details */

/** Four small ullage motors on a stage skirt: they fire briefly to settle the propellant. */
export function UllageMotors({ ignitionAt, y, r, from, to }: { ignitionAt: number | null; y: number; r: number; from: number; to: number }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const t = since(ignitionAt);
    const on = t >= from && t < to;
    if (group.current) {
      group.current.visible = on;
      if (on) group.current.scale.y = 0.8 + Math.sin(t * 60) * 0.2;
    }
  });
  return (
    <group position={[0, y, 0]}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 0.1, Math.cos(a) * r]}>
            <cylinderGeometry args={[0.08, 0.12, 0.3, 8]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        );
      })}
      <group ref={group} visible={false}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2;
          return (
            <mesh key={i} position={[Math.sin(a) * r, -0.35, Math.cos(a) * r]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.13, 0.9, 8, 1, true]} />
              <meshBasicMaterial color={SCENE_COLORS.flameCore} toneMapped={false} blending={AdditiveBlending} transparent opacity={0.85} depthWrite={false} side={DoubleSide} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** Three telescoping rings slide out of an engine bell, then the engine lights. */
export function NozzleExtension({
  ignitionAt,
  y,
  r,
  from,
  lightAt,
}: {
  ignitionAt: number | null;
  /** Height of the bell's lower rim. */
  y: number;
  r: number;
  from: number;
  lightAt: number;
}) {
  const rings = useRef<(Mesh | null)[]>([]);
  const glow = useRef<MeshBasicMaterial>(null);
  const c1 = useCue(from + 0.15, () => playSfx("tick"));
  const c2 = useCue(from + 0.35, () => playSfx("tick"));
  const c3 = useCue(from + 0.55, () => playSfx("tick"));
  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - from;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const slide = span(s, i * 0.2, 0.4 + i * 0.2);
      m.position.y = y + 0.1 - (i + 1) * slide * 0.34;
      m.visible = s > 0;
    });
    if (glow.current) glow.current.opacity = t >= lightAt - 0.2 ? clamp01((t - lightAt + 0.2) / 0.3) * 0.9 : 0;
    c1(t);
    c2(t);
    c3(t);
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} position={[0, y, 0]} visible={false}>
          <cylinderGeometry args={[r + i * 0.1, r + 0.12 + i * 0.12, 0.36, 18, 1, true]} />
          <meshStandardMaterial {...BRASS} color={i === 1 ? "#a8733f" : "#8a5a3a"} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, y + 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.95, 16]} />
        <meshBasicMaterial ref={glow} color={SCENE_COLORS.flameCore} toneMapped={false} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- the escape tower */

/**
 * The launch escape tower: lattice legs, a solid motor with four canted nozzles and two canard fins
 * that flip out. At LES_T the bolts fire, the motor lights and the whole tower pulls away from the
 * capsule, pitching off to the side.
 */
export function EscapeTower({ ignitionAt, y0 }: { ignitionAt: number | null; y0: number }) {
  const body = useRef<Group>(null);
  const canards = useRef<(Group | null)[]>([]);
  const flame = useRef<Group>(null);
  const cue = useCue(LES_T, () => {
    playSfx("ignition");
    addTrauma(0.5);
  });
  useFrame(() => {
    const t = since(ignitionAt);
    const tau = t - LES_T;
    if (body.current) {
      const go = Math.max(0, tau);
      body.current.position.set(0.5 * 1.2 * go * go, 7 * go + 1.2 * go * go, 0);
      body.current.rotation.z = -Math.min(1.25, go * 0.32);
      body.current.visible = tau < 7;
    }
    const flip = span(tau, -0.6, -0.1) * 1.5;
    canards.current.forEach((c) => {
      if (c) c.rotation.z = flip;
    });
    if (flame.current) {
      const on = tau >= 0 && tau < 3.2;
      flame.current.visible = on;
      if (on) flame.current.scale.set(1, (1 + Math.sin(tau * 50) * 0.12) * (tau < 0.4 ? tau / 0.4 : 1), 1);
    }
    cue(t);
  });
  const motorY = y0 + 3.8;
  return (
    <group>
      <group ref={body} position={[0, 0, 0]}>
        {/* Truss legs and bracing */}
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.5, y0 + 1.8, Math.cos(a) * 0.5]} rotation={[Math.cos(a) * 0.23, 0, -Math.sin(a) * 0.23]}>
              <cylinderGeometry args={[0.03, 0.04, 3.7, 5]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
          );
        })}
        {[0.7, 1.7, 2.7].map((dy) => (
          <mesh key={dy} position={[0, y0 + dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.72 - dy * 0.1, 0.025, 5, 16]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        ))}
        {/* Motor, skirt with nozzles, nose and the canards */}
        <mesh position={[0, motorY + 0.6, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 2.4, 12]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.45} />
        </mesh>
        <mesh position={[0, motorY + 2.3, 0]}>
          <coneGeometry args={[0.3, 1.3, 12]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.4} />
        </mesh>
        <mesh position={[0, motorY - 0.65, 0]}>
          <cylinderGeometry args={[0.4, 0.34, 0.35, 12]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.3, motorY - 0.95, Math.cos(a) * 0.3]} rotation={[Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5]}>
              <cylinderGeometry args={[0.07, 0.12, 0.4, 8, 1, true]} />
              <meshStandardMaterial {...BRASS} side={DoubleSide} />
            </mesh>
          );
        })}
        {[1, -1].map((side, i) => (
          <group key={side} position={[0.3 * side, motorY + 1.8, 0]} scale={[side, 1, 1]}>
            <group ref={(el) => (canards.current[i] = el)}>
              <mesh position={[0.35, 0, 0]}>
                <boxGeometry args={[0.7, 0.04, 0.34]} />
                <meshStandardMaterial {...STEEL} />
              </mesh>
            </group>
          </group>
        ))}
        {/* The motor's own plume, pointing back down at the capsule */}
        <group ref={flame} position={[0, motorY - 1.1, 0]} visible={false}>
          <mesh position={[0, -1, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.45, 2.4, 10, 1, true]} />
            <meshBasicMaterial color={SCENE_COLORS.flameOuter} side={DoubleSide} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.7, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.24, 1.6, 10]} />
            <meshBasicMaterial color={SCENE_COLORS.flameCore} toneMapped={false} />
          </mesh>
        </group>
      </group>
      <BoltFlash ignitionAt={ignitionAt} at={LES_T} y={y0} r={0.55} />
    </group>
  );
}

/* ---------------------------------------------------------------- inside the adapter */

/** The lunar module folded inside the adapter, seen when its panels open. */
export function LanderBay() {
  return (
    <group position={[0, 0.2, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 1.4, 8]} />
        <meshStandardMaterial color={SCENE_COLORS.kaptonGold} metalness={0.85} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <cylinderGeometry args={[0.6, 0.7, 0.9, 8]} />
        <meshStandardMaterial color="#cfd3d8" metalness={0.6} roughness={0.35} flatShading />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.95, 1.0, Math.cos(a) * 0.95]} rotation={[Math.cos(a) * -0.25, 0, Math.sin(a) * 0.25]}>
            <boxGeometry args={[0.07, 1.8, 0.07]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        );
      })}
    </group>
  );
}
