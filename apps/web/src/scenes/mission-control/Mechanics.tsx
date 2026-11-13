"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CylinderGeometry, DoubleSide, MeshBasicMaterial, type BufferGeometry, type Group, type Mesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addTrauma } from "@/game/shake";
import { playSfx, type SfxId } from "@/game/sfx";
import { SCENE_COLORS } from "@/lib/palette";
import { HOLD_DOWN, LES_T } from "./ascent";

/**
 * The hardware of the launch, as it works on a real vehicle (Saturn V, from the flight manual and
 * NASA's history): service arms swing back and latch on the tower; hold-down arms let go; at each
 * stage separation a linear shaped charge cuts the skin in a flash that runs round the ring, solid
 * retrorockets fire on the stage being left, ullage motors on the next, fairings blow off; the
 * interstage is dropped half a minute later by a second cut; the adapter panels are split by shaped
 * charges and pushed open by pyrotechnic thrusters to 45 degrees before springs let them go; the
 * escape tower is cut loose and carried off by its own motor. Everything reads the time since
 * ignition itself, so the camera can cut anywhere and find it moving.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (k: number) => k * k * (3 - 2 * k);
/** 0 before `a`, 1 after `b`, eased in between. */
const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
const since = (ignitionAt: number | null) => (ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000);

type Cue = [offset: number, id: SfxId, trauma?: number];

/** Plays each sound once as the film passes its time (`base` + offset). */
function useCues(base: number, cues: Cue[]) {
  const prev = useRef(-1);
  return (t: number) => {
    for (const [o, id, trauma] of cues) {
      const c = base + o;
      if (prev.current < c && t >= c && t < c + 1) {
        playSfx(id);
        if (trauma) addTrauma(trauma);
      }
    }
    prev.current = t;
  };
}

const STEEL = { color: "#9aa5b1", metalness: 0.85, roughness: 0.3 } as const;
const DARK = { color: SCENE_COLORS.steelDark, metalness: 0.7, roughness: 0.45 } as const;
const BRASS = { color: "#b0823f", metalness: 0.9, roughness: 0.28 } as const;
const FLASH = new MeshBasicMaterial({ color: "#fff4d8", toneMapped: false, blending: AdditiveBlending, transparent: true, depthWrite: false });

/* ---------------------------------------------------------------- tower arms and clamps */

/** A service arm: it swings back from the stack and stops against the tower with a clank. */
export function SwingArm({ ignitionAt, delay = 0 }: { ignitionAt: number | null; delay?: number }) {
  const pivot = useRef<Group>(null);
  const ram = useRef<Mesh>(null);
  const cues = useCues(HOLD_DOWN - 2 + delay, [
    [-0.3, "relay"],
    [0, "hydraulic"],
    [1.3, "clank", 0.12],
  ]);
  useFrame(() => {
    const t = since(ignitionAt);
    const k = span(t, HOLD_DOWN - 2 + delay, HOLD_DOWN - 0.6 + delay);
    if (pivot.current) pivot.current.rotation.y = k * 1.4;
    if (ram.current) ram.current.scale.y = 1 + k * 0.7;
    cues(t);
  });
  return (
    <group ref={pivot}>
      <mesh position={[2.2, 0, 0]}>
        <boxGeometry args={[2.7, 0.22, 0.38]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.5} />
      </mesh>
      {/* Hydraulic ram under the arm, an umbilical plate on the end and its coupling hoses */}
      <mesh ref={ram} position={[1.4, -0.3, 0]} rotation={[0, 0, 0.35]}>
        <cylinderGeometry args={[0.07, 0.07, 1.7, 8]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <mesh position={[3.55, 0, 0]}>
        <boxGeometry args={[0.32, 0.4, 0.5]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
      </mesh>
      {[-0.12, 0.12].map((z) => (
        <mesh key={z} position={[2.2, -0.12, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 2.5, 6]} />
          <meshStandardMaterial color="#1f2937" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Four hold-down arms gripping the skirt; they open at the moment of release. */
export function HoldDownClamps({ ignitionAt }: { ignitionAt: number | null }) {
  const arms = useRef<(Group | null)[]>([]);
  const pistons = useRef<(Mesh | null)[]>([]);
  const cues = useCues(HOLD_DOWN, [
    [-1.6, "relay"],
    [-1.3, "relay"],
    [-1.0, "hydraulic"],
    [-0.15, "clank", 0.3],
    [0, "thud", 0.2],
  ]);
  useFrame(() => {
    const t = since(ignitionAt);
    const open = span(t, HOLD_DOWN - 0.15, HOLD_DOWN + 0.7);
    arms.current.forEach((g) => {
      if (g) g.rotation.z = -open * 1.25;
    });
    pistons.current.forEach((m) => {
      if (m) m.scale.y = 1 + open * 0.9;
    });
    cues(t);
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
            {/* The pivot pin and its retaining plate */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.22]}>
              <cylinderGeometry args={[0.16, 0.16, 0.08, 10]} />
              <meshStandardMaterial {...BRASS} />
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

/* ---------------------------------------------------------------- the cut */

/**
 * A linear shaped charge cutting the skin: a flash that races round the ring in a few hundredths
 * of a second, a shock ring, and chips of skin thrown outward.
 */
export function CutFlash({ ignitionAt, at, y, r, sound = true }: { ignitionAt: number | null; at: number; y: number; r: number; sound?: boolean }) {
  const sparks = useRef<(Mesh | null)[]>([]);
  const chips = useRef<(Mesh | null)[]>([]);
  const shock = useRef<Mesh>(null);
  const cues = useCues(at, sound ? [[0, "pyro", 0.6], [0.02, "thud"]] : []);
  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - at;
    sparks.current.forEach((m, i) => {
      if (!m) return;
      const f = clamp01((s - (i / 16) * 0.06) / 0.3);
      m.visible = f > 0 && f < 1;
      if (m.visible) m.scale.setScalar(0.06 + Math.sin(f * Math.PI) * 0.2);
    });
    chips.current.forEach((m, i) => {
      if (!m) return;
      const tau = s - 0.02;
      m.visible = tau > 0 && tau < 1.4;
      if (!m.visible) return;
      const a = (i / 10) * Math.PI * 2 + i * 0.7;
      const v = 1.8 + (i % 4) * 1.1;
      const up = ((i % 3) - 1) * 1.6;
      m.position.set(Math.sin(a) * (r + v * tau), up * tau, Math.cos(a) * (r + v * tau));
      m.rotation.set(tau * (3 + i), tau * (2 + i * 0.5), 0);
    });
    if (shock.current) {
      const k = clamp01(s / 0.7);
      shock.current.visible = s >= 0 && k < 1;
      shock.current.scale.setScalar(1 + k * 3.5);
      (shock.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.6;
    }
    cues(t);
  });
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} ref={(el) => (sparks.current[i] = el)} position={[Math.sin(a) * r, 0, Math.cos(a) * r]} visible={false} material={FLASH}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        );
      })}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} ref={(el) => (chips.current[i] = el)} visible={false}>
          <boxGeometry args={[0.18, 0.02, 0.12]} />
          <meshStandardMaterial {...STEEL} />
        </mesh>
      ))}
      <mesh ref={shock} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[r, 0.05, 6, 40]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} blending={AdditiveBlending} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Solid retrorockets on the stage being left: a hard plume for under a second. */
export function RetroRockets({
  ignitionAt,
  at,
  y,
  r,
  count = 4,
  dur = 0.8,
  length = 2.6,
  rotate = 0,
}: {
  ignitionAt: number | null;
  at: number;
  y: number;
  r: number;
  count?: number;
  dur?: number;
  length?: number;
  rotate?: number;
}) {
  const group = useRef<Group>(null);
  const cues = useCues(at, [[0, "retro", 0.3]]);
  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - at;
    const on = s > 0 && s < dur;
    if (group.current) {
      group.current.visible = on;
      if (on) group.current.scale.set(1, (1 - (s / dur) * 0.4) * (0.8 + Math.abs(Math.sin(s * 80)) * 0.3), 1);
    }
    cues(t);
  });
  return (
    <group ref={group} position={[0, y, 0]} visible={false}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + rotate;
        return (
          <mesh key={i} position={[Math.sin(a) * r, length * 0.5, Math.cos(a) * r]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.2, length, 8, 1, true]} />
            <meshBasicMaterial color={SCENE_COLORS.flameCore} toneMapped={false} blending={AdditiveBlending} transparent opacity={0.9} depthWrite={false} side={DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Small ullage motors on a stage skirt: they fire briefly to settle the propellant. */
export function UllageMotors({
  ignitionAt,
  y,
  r,
  from,
  to,
  count = 4,
}: {
  ignitionAt: number | null;
  y: number;
  r: number;
  from: number;
  to: number;
  count?: number;
}) {
  const group = useRef<Group>(null);
  const cues = useCues(from, [[0, "gas"]]);
  useFrame(() => {
    const t = since(ignitionAt);
    const on = t >= from && t < to;
    if (group.current) {
      group.current.visible = on;
      if (on) group.current.scale.y = 0.8 + Math.sin(t * 60) * 0.2;
    }
    cues(t);
  });
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 0.1, Math.cos(a) * r]}>
            <cylinderGeometry args={[0.08, 0.12, 0.3, 8]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        );
      })}
      <group ref={group} visible={false}>
        {Array.from({ length: count }, (_, i) => {
          const a = (i / count) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * r, -0.35, Math.cos(a) * r]}>
              <coneGeometry args={[0.13, 0.9, 8, 1, true]} />
              <meshBasicMaterial color={SCENE_COLORS.flameCore} toneMapped={false} blending={AdditiveBlending} transparent opacity={0.85} depthWrite={false} side={DoubleSide} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/** The four engine fairings of stage 1 (each hides a pair of retros) blow off at separation. */
export function Fairings({ ignitionAt, at }: { ignitionAt: number | null; at: number }) {
  const parts = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const t = since(ignitionAt);
    const go = Math.max(0, t - at);
    parts.current.forEach((m, i) => {
      if (!m) return;
      const a = (i * Math.PI) / 2;
      m.visible = go < 2.2;
      const rad = 1.78 + 4.5 * go;
      m.position.set(Math.sin(a) * rad, 3.2 - 0.5 * 3 * go * go, Math.cos(a) * rad);
      m.rotation.set(go * (2 + i), a + go * 1.5, go * 3);
    });
  });
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => (parts.current[i] = el)} position={[Math.sin((i * Math.PI) / 2) * 1.78, 3.2, Math.cos((i * Math.PI) / 2) * 1.78]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <boxGeometry args={[0.55, 1.5, 0.45]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- shells and details */

/** A ring of bolt heads along a stage joint. */
export function FlangeBolts({ y, r, n = 36 }: { y: number; r: number; n?: number }) {
  const geometry = useMemo(() => {
    const list: BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const g = new CylinderGeometry(0.045, 0.045, 0.06, 6);
      g.rotateZ(Math.PI / 2);
      g.rotateY(a);
      g.translate(Math.sin(a) * (r + 0.02), 0, Math.cos(a) * (r + 0.02));
      list.push(g);
    }
    return mergeGeometries(list)!;
  }, [r, n]);
  return (
    <mesh geometry={geometry} position={[0, y, 0]}>
      <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.35} />
    </mesh>
  );
}

/** The interstage: a skirt that stays with stage 2 until the second cut, with its stiffening ribs and hatches. */
export function InterstageShell({ y0, h, r0, r1, color }: { y0: number; h: number; r0: number; r1: number; color: string }) {
  return (
    <group>
      <mesh position={[0, y0 + h / 2, 0]}>
        <cylinderGeometry args={[r1, r0, h, 24, 1, true]} />
        <meshStandardMaterial color={color} metalness={0.2} roughness={0.45} side={DoubleSide} />
      </mesh>
      {/* Bands carrying the shaped-charge cut */}
      {[
        [0.06, r0 + 0.01],
        [h - 0.06, r1 + 0.01],
      ].map(([dy, rr]) => (
        <mesh key={dy} position={[0, y0 + dy!, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[rr!, 0.035, 6, 32]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const rr = r0 + (r1 - r0) * 0.5 + 0.02;
        return (
          <mesh key={i} position={[Math.sin(a) * rr, y0 + h / 2, Math.cos(a) * rr]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.05, h - 0.3, 0.04]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        );
      })}
      {[0.4, 2.0, 3.6, 5.2].map((a) => (
        <mesh key={a} position={[Math.sin(a) * (r0 + 0.03), y0 + h * 0.5, Math.cos(a) * (r0 + 0.03)]} rotation={[0, a, 0]}>
          <boxGeometry args={[0.5, 0.45, 0.04]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
        </mesh>
      ))}
      <FlangeBolts y={y0 + 0.2} r={r0} n={40} />
      <FlangeBolts y={y0 + h - 0.2} r={r1} n={40} />
    </group>
  );
}

/**
 * The instrument unit: the ring of guidance electronics between the third stage and the adapter
 * (inertial platform, flight computer, data adapter, flight control computer), with its access
 * panels, coolant lines and a scatter of status lights blinking out of step.
 */
export function InstrumentUnit({ ignitionAt, y0 }: { ignitionAt: number | null; y0: number }) {
  const leds = useRef<(Mesh | null)[]>([]);
  const mats = useMemo(
    () => ({
      green: new MeshBasicMaterial({ color: "#34d399", toneMapped: false }),
      amber: new MeshBasicMaterial({ color: "#fbbf24", toneMapped: false }),
      red: new MeshBasicMaterial({ color: "#ef4444", toneMapped: false }),
      off: new MeshBasicMaterial({ color: "#1f2937" }),
    }),
    [],
  );
  useFrame(() => {
    const t = since(ignitionAt);
    leds.current.forEach((m, i) => {
      if (!m) return;
      const on = Math.sin(t * (2.1 + i * 0.43) + i * 1.9) > (i % 3 === 0 ? -0.3 : 0.15);
      const want = !on ? mats.off : i % 7 === 0 ? mats.red : i % 3 === 0 ? mats.amber : mats.green;
      if (m.material !== want) m.material = want;
    });
  });
  return (
    <group position={[0, y0, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.4, 24]} />
        <meshStandardMaterial color="#d8dde6" roughness={0.45} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <group key={i} position={[Math.sin(a) * 1.215, 0.2, Math.cos(a) * 1.215]} rotation={[0, a, 0]}>
            <mesh>
              <boxGeometry args={[0.34, 0.3, 0.03]} />
              <meshStandardMaterial color={i % 2 ? "#aab3c0" : "#e5e7eb"} metalness={0.4} roughness={0.5} />
            </mesh>
            {i % 4 === 0 && (
              <mesh position={[0.12, 0.08, 0.03]}>
                <boxGeometry args={[0.07, 0.05, 0.03]} />
                <meshStandardMaterial color="#1f2937" />
              </mesh>
            )}
          </group>
        );
      })}
      {Array.from({ length: 14 }, (_, i) => {
        const a = ((i + 0.5) / 14) * Math.PI * 2;
        return (
          <mesh key={i} ref={(el) => (leds.current[i] = el)} material={mats.off} position={[Math.sin(a) * 1.235, 0.34, Math.cos(a) * 1.235]} rotation={[0, a, 0]}>
            <boxGeometry args={[0.05, 0.03, 0.025]} />
          </mesh>
        );
      })}
      {[0.02, 0.38].map((dy) => (
        <mesh key={dy} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.21, 0.025, 6, 40]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
      <FlangeBolts y={0.04} r={1.2} n={32} />
      <FlangeBolts y={0.36} r={1.2} n={32} />
    </group>
  );
}

/* ---------------------------------------------------------------- the adapter */

/** Where a point given in a hinged panel's own frame ends up in the ring's frame (x out, y up). */
const place = (hx: number, hy: number, angle: number, lx: number, ly: number): [number, number] => [
  hx + lx * Math.cos(angle) - ly * Math.sin(angle),
  hy + lx * Math.sin(angle) + ly * Math.cos(angle),
];

/** A piston between two points: a fixed barrel and a rod that slides out of it. */
function setPiston(barrel: Mesh | null, rod: Mesh | null, a: [number, number], b: [number, number], barrelLen: number) {
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

const PANELS = 4;
/** The panels swing to 45 degrees on pyrotechnic thrusters, then spring free at 2.5 m/s. */
const OPEN_ANGLE = Math.PI / 4;

export interface AdapterPanelsProps {
  ignitionAt: number | null;
  /** Real seconds after ignition when the shaped charges fire. */
  at: number;
  y0: number;
  h: number;
  r0: number;
  r1: number;
  /** Acceleration of the stack, so the panels fall behind it once they are free. */
  stackAccel: number;
}

/**
 * The spacecraft adapter: four panels hinged at the bottom. Shaped charges split the seams and the
 * ring; pyrotechnic thrusters push each panel out on a piston; at 45 degrees the hinge lets go and
 * springs push the panel away, leaving the lander in the open.
 */
export function AdapterPanels({ ignitionAt, at, y0, h, r0, r1, stackAccel }: AdapterPanelsProps) {
  const arc = (Math.PI * 2) / PANELS - 0.05;
  const center = Math.PI / 2 - arc / 2;
  const fly = useRef<(Group | null)[]>([]);
  const hinge = useRef<(Group | null)[]>([]);
  const barrels = useRef<(Mesh | null)[]>([]);
  const rods = useRef<(Mesh | null)[]>([]);
  const seams = useRef<(Mesh | null)[]>([]);
  const cues = useCues(at, [
    [-1.2, "relay"],
    [-0.9, "relay"],
    [-0.55, "relay"],
    [0.1, "gas"],
    [0.3, "hydraulic"],
    [0.95, "clank", 0.15],
    [1.0, "thud"],
  ]);

  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - at;
    const ang = clamp01(s / 0.9) * OPEN_ANGLE;
    const free = Math.max(0, s - 0.9);
    for (let i = 0; i < PANELS; i++) {
      const hg = hinge.current[i];
      if (hg) hg.rotation.z = -ang - free * 0.12;
      const fl = fly.current[i];
      if (fl) {
        fl.position.set(free * 2.5, -0.5 * stackAccel * free * free, 0);
        fl.visible = free < 8;
      }
      // The thruster piston pushes on the panel's outer edge until the hinge lets go.
      const b = place(r0, y0, -ang, -0.2, h * 0.3);
      setPiston(barrels.current[i] ?? null, rods.current[i] ?? null, [r0 - 0.45, y0 + 0.25], b, 0.5);
      const seam = seams.current[i];
      if (seam) seam.visible = s > -0.03 && s < 0.18 && Math.sin(s * 300) > -0.4;
    }
    cues(t);
  });

  return (
    <group>
      {Array.from({ length: PANELS }, (_, i) => {
        const az = (i * Math.PI * 2) / PANELS + Math.PI / PANELS;
        return (
          <group key={i} rotation={[0, az, 0]}>
            <group ref={(el) => (fly.current[i] = el)}>
              <group ref={(el) => (hinge.current[i] = el)} position={[r0, y0, 0]}>
                <mesh position={[-r0, h / 2, 0]}>
                  <cylinderGeometry args={[r1, r0, h, 8, 1, true, center, arc]} />
                  <meshStandardMaterial color={SCENE_COLORS.spaceWhite} metalness={0.15} roughness={0.45} side={DoubleSide} />
                </mesh>
                <mesh position={[-r0 + 0.01, h * 0.5, 0]}>
                  <cylinderGeometry args={[(r0 + r1) / 2 + 0.01, (r0 + r1) / 2 + 0.01, 0.16, 8, 1, true, center, arc]} />
                  <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.5} side={DoubleSide} />
                </mesh>
                {/* The spring hinge: a barrel with its disengaging pin */}
                <mesh position={[0.05, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.5, 8]} />
                  <meshStandardMaterial {...STEEL} />
                </mesh>
              </group>
            </group>
            {/* Pyrotechnic thruster: barrel and piston inside the intact ring */}
            <mesh ref={(el) => (barrels.current[i] = el)} position={[r0 - 0.4, y0 + 0.2, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
            <mesh ref={(el) => (rods.current[i] = el)} position={[r0 - 0.3, y0 + 0.4, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
            {/* The seam where the shaped charge cuts, between this panel and the next */}
            <mesh ref={(el) => (seams.current[i] = el)} position={[r0 * Math.cos(Math.PI / PANELS), y0 + h / 2, r0 * Math.sin(Math.PI / PANELS)]} visible={false}>
              <boxGeometry args={[0.05, h, 0.05]} />
              <meshBasicMaterial color="#fff2cc" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <CutFlash ignitionAt={ignitionAt} at={at} y={y0 + 0.02} r={r0 + 0.02} />
    </group>
  );
}

/* ---------------------------------------------------------------- the escape tower */

/**
 * The launch escape tower: lattice legs, a solid motor with four canted nozzles and two canard fins
 * that flip out. At LES_T the tower is cut loose, the motor lights and it pulls away from the
 * capsule, pitching off to the side.
 */
export function EscapeTower({ ignitionAt, y0 }: { ignitionAt: number | null; y0: number }) {
  const body = useRef<Group>(null);
  const canards = useRef<(Group | null)[]>([]);
  const flame = useRef<Group>(null);
  const cues = useCues(LES_T, [
    [-0.8, "relay"],
    [-0.4, "relay"],
    [-0.05, "pyro", 0.5],
    [0.05, "retro", 0.4],
  ]);
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
    cues(t);
  });
  const motorY = y0 + 3.8;
  return (
    <group>
      <group ref={body}>
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
      <CutFlash ignitionAt={ignitionAt} at={LES_T} y={y0} r={0.55} sound={false} />
    </group>
  );
}
