"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { addTrauma } from "@/game/shake";
import { playSfx } from "@/game/sfx";
import { SCENE_COLORS } from "@/lib/palette";
import { HOLD_DOWN, SEPARATION_T, STAGE2_T } from "./ascent";

/**
 * The machinery of the launch, animated to the beat of the film: tower arms swing back, the
 * hold-down clamps let go, the interstage splits like a transformer (bolts fire, petals unfold on
 * hydraulic arms, a skeleton of struts is exposed), retro rockets push the spent stage away and the
 * upper engine's nozzle extension telescopes out just before ignition.
 * Each part reads the time since ignition itself, so the camera can cut anywhere and find it moving.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (k: number) => k * k * (3 - 2 * k);
/** 0 before `a`, 1 after `b`, eased in between. */
const span = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
const since = (ignitionAt: number | null) => (ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000);

/** Fires `fn` once as `t` crosses `at` (and never while rewinding to a fresh launch). */
function useCue(at: number, fn: () => void) {
  const prev = useRef(-1);
  return (t: number) => {
    if (prev.current < at && t >= at && t < at + 1) fn();
    prev.current = t;
  };
}

const STEEL = { color: "#9aa5b1", metalness: 0.85, roughness: 0.3 } as const;
const DARK = { color: SCENE_COLORS.steelDark, metalness: 0.7, roughness: 0.45 } as const;

/* ---------------------------------------------------------------- tower arms and clamps */

/** An umbilical arm that holds on until just before ignition, then swings clear of the rocket. */
export function SwingArm({ ignitionAt, delay = 0 }: { ignitionAt: number | null; delay?: number }) {
  const pivot = useRef<Group>(null);
  const cue = useCue(HOLD_DOWN - 1 + delay, () => playSfx("unlatch"));
  useFrame(() => {
    const t = since(ignitionAt);
    if (pivot.current) pivot.current.rotation.y = span(t, HOLD_DOWN - 1 + delay, HOLD_DOWN - 0.1 + delay) * 1.4;
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
  const cue = useCue(HOLD_DOWN - 0.15, () => {
    playSfx("bang");
    addTrauma(0.3);
  });
  useFrame(() => {
    const t = since(ignitionAt);
    const open = span(t, HOLD_DOWN - 0.15, HOLD_DOWN + 0.5);
    arms.current.forEach((g) => {
      if (g) g.rotation.z = -open * 1.25;
    });
    cue(t);
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
          </group>
          <mesh position={[2.45, 0.35, 0]} rotation={[0, 0, 0.6]}>
            <cylinderGeometry args={[0.06, 0.06, 0.8, 8]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- the interstage */

const PETALS = 4;
const RING_Y = 12;

/**
 * The interstage between the stages, in stage-1 local space. Closed it looks like a plain blue ring.
 * At separation the bolts flash, four petals fold out in two segments on hydraulic rams, and the
 * body is gone, leaving a lattice of struts and ring frames around the upper engine.
 */
export function Interstage({ ignitionAt }: { ignitionAt: number | null }) {
  const body = useRef<Mesh>(null);
  const petals = useRef<(Group | null)[]>([]);
  const folds = useRef<(Group | null)[]>([]);
  const flashes = useRef<(Mesh | null)[]>([]);
  const shock = useRef<Mesh>(null);
  const retro = useRef<Group>(null);
  const cue = useCue(SEPARATION_T - 0.15, () => {
    playSfx("bang");
    playSfx("boom");
    addTrauma(0.6);
  });

  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - SEPARATION_T;
    // Petals open from the instant the bolts fire; the lower segment first, then the fold-out.
    const open = span(s, -0.05, 0.85);
    const fold = span(s, 0.1, 1.0);
    if (body.current) body.current.visible = s < 0.02;
    petals.current.forEach((g) => {
      if (g) g.rotation.z = 0.19 - open * 1.35;
    });
    folds.current.forEach((g) => {
      if (g) g.rotation.z = -fold * 1.5;
    });
    // Explosive bolts: a ring of flashes and a shock ring racing outward.
    const f = clamp01((s + 0.15) / 0.5);
    const flash = s >= -0.15 && s < 0.4 ? Math.sin(f * Math.PI) : 0;
    flashes.current.forEach((m, i) => {
      if (!m) return;
      m.visible = flash > 0.01;
      m.scale.setScalar(0.05 + flash * (0.3 + (i % 3) * 0.06));
    });
    if (shock.current) {
      const k = clamp01((s + 0.1) / 0.7);
      shock.current.visible = k > 0 && k < 1;
      shock.current.scale.setScalar(1 + k * 4);
      (shock.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.7;
    }
    // Retro rockets on the spent stage's shoulder.
    if (retro.current) retro.current.visible = s > 0 && s < 0.9;
    cue(t);
  });

  return (
    <group>
      {/* The closed ring */}
      <mesh ref={body} position={[0, RING_Y + 0.8, 0]}>
        <cylinderGeometry args={[1.3, 1.6, 1.6, 20]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} metalness={0.15} roughness={0.4} />
      </mesh>

      {/* The lattice that is revealed: struts, ring frames and a hub of spokes */}
      <group>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.sin(a) * 1.2, RING_Y + 0.8, Math.cos(a) * 1.2]}>
              <boxGeometry args={[0.1, 1.6, 0.1]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
          );
        })}
        {[RING_Y + 0.15, RING_Y + 0.8, RING_Y + 1.45].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.25, 0.05, 8, 32]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
        ))}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.65, RING_Y + 0.15, Math.cos(a) * 0.65]} rotation={[0, a, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
          );
        })}
      </group>

      {/* The petals: hinged at the bottom ring, a second segment folding out at the top */}
      {Array.from({ length: PETALS }, (_, i) => {
        const az = (i * Math.PI * 2) / PETALS + Math.PI / 4;
        return (
          <group key={i} rotation={[0, az, 0]}>
            <group ref={(el) => (petals.current[i] = el)} position={[1.62, RING_Y, 0]} rotation={[0, 0, 0.19]}>
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[0.05, 0.8, 2.15]} />
                <meshStandardMaterial color={SCENE_COLORS.nasaBlue} metalness={0.15} roughness={0.4} />
              </mesh>
              <mesh position={[0.03, 0.4, 0]}>
                <boxGeometry args={[0.02, 0.1, 2.15]} />
                <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.5} />
              </mesh>
              {/* Hydraulic ram: bracket from the ring to the middle of the petal */}
              <mesh position={[-0.28, 0.32, 0]} rotation={[0, 0, 0.7]}>
                <cylinderGeometry args={[0.045, 0.045, 0.7, 8]} />
                <meshStandardMaterial {...STEEL} />
              </mesh>
              <group ref={(el) => (folds.current[i] = el)} position={[0, 0.8, 0]} rotation={[0, 0, 0]}>
                <mesh position={[-0.03, 0.4, 0]}>
                  <boxGeometry args={[0.05, 0.8, 1.7]} />
                  <meshStandardMaterial color={SCENE_COLORS.nasaBlue} metalness={0.15} roughness={0.4} />
                </mesh>
                <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 1.9, 8]} />
                  <meshStandardMaterial {...STEEL} />
                </mesh>
              </group>
            </group>
          </group>
        );
      })}

      {/* Separation bolts firing, and the shock ring */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} ref={(el) => (flashes.current[i] = el)} position={[Math.sin(a) * 1.62, RING_Y + 0.02, Math.cos(a) * 1.62]} visible={false}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#ffd9a0" toneMapped={false} blending={AdditiveBlending} transparent depthWrite={false} />
          </mesh>
        );
      })}
      <mesh ref={shock} position={[0, RING_Y, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[1.6, 0.06, 6, 40]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} blending={AdditiveBlending} transparent depthWrite={false} />
      </mesh>

      {/* Retro rockets pushing the spent stage back */}
      <group ref={retro} visible={false}>
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2;
          return (
            <group key={i} position={[Math.sin(a) * 1.75, 11.5, Math.cos(a) * 1.75]}>
              <mesh position={[0, 0.55, 0]} rotation={[0, 0, 0]}>
                <coneGeometry args={[0.14, 1.3, 8, 1, true]} />
                <meshBasicMaterial color={SCENE_COLORS.flameCore} toneMapped={false} blending={AdditiveBlending} transparent opacity={0.9} depthWrite={false} side={DoubleSide} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- upper engine nozzle */

/** Three telescoping rings slide out of the upper engine's bell, then the engine lights. */
export function NozzleExtension({ ignitionAt }: { ignitionAt: number | null }) {
  const rings = useRef<(Mesh | null)[]>([]);
  const glow = useRef<MeshBasicMaterial>(null);
  const cue1 = useCue(SEPARATION_T + 0.45, () => playSfx("tick"));
  const cue2 = useCue(SEPARATION_T + 0.6, () => playSfx("tick"));
  const cue3 = useCue(SEPARATION_T + 0.75, () => playSfx("tick"));
  useFrame(() => {
    const t = since(ignitionAt);
    const s = t - SEPARATION_T;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const slide = span(s, 0.3 + i * 0.15, 0.7 + i * 0.15);
      m.position.y = 12.45 - 0.16 - (i + 1) * slide * 0.3;
      m.visible = s > 0.28;
    });
    if (glow.current) glow.current.opacity = t >= STAGE2_T - 0.2 ? clamp01((t - STAGE2_T + 0.2) / 0.3) * 0.9 : 0;
    cue1(t);
    cue2(t);
    cue3(t);
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} position={[0, 12.3, 0]} visible={false}>
          <cylinderGeometry args={[0.72 + i * 0.1, 0.84 + i * 0.12, 0.34, 18, 1, true]} />
          <meshStandardMaterial color={i === 1 ? "#a8733f" : "#8a5a3a"} metalness={0.85} roughness={0.3} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 12.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 16]} />
        <meshBasicMaterial ref={glow} color={SCENE_COLORS.flameCore} toneMapped={false} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
