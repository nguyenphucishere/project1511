"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, type Group, type PointLight } from "three";
import { addTrauma } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";
import { HOLD_DOWN, SEPARATION_T, STAGE2_T, rocketRise, spentStagePose } from "./ascent";
import { LaunchSmoke } from "./LaunchSmoke";
import { ROCKET_HEIGHT } from "./layout";

/** How long the spent stage stays drawn after separation (it is far below by then). */
const SPENT_VISIBLE = 7;

/**
 * The two-stage vehicle in pad-local space. Stage 1 (engines, tank, interstage) burns from
 * ignition to separation, then falls away tumbling; the upper stack coasts for a moment, lights
 * its smaller engine and carries on until the burn ends (orbit, or propellant out).
 */
export function LaunchVehicle({ ignitionAt, burnEndT }: { ignitionAt: number | null; burnEndT: number }) {
  const reduced = useReducedMotion();
  const upper = useRef<Group>(null);
  const stage1 = useRef<Group>(null);
  const flame1 = useRef<Group>(null);
  const flame2 = useRef<Group>(null);
  const light = useRef<PointLight>(null);

  useFrame(() => {
    const t = ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    const flicker = reduced || t < 0 ? 1 : 1 + Math.sin(t * 47) * 0.08 + Math.sin(t * 31) * 0.06;
    const rise = t < 0 ? 0 : rocketRise(t);
    const separated = t >= SEPARATION_T;

    if (upper.current) {
      upper.current.position.y = rise;
      upper.current.visible = rise < 420;
    }

    if (stage1.current) {
      if (!separated) {
        stage1.current.position.set(0, rise, 0);
        stage1.current.rotation.set(0, 0, 0);
        stage1.current.visible = true;
      } else {
        const tau = t - SEPARATION_T;
        const pose = spentStagePose(tau);
        // Tumble about the stage's middle, not its base.
        const mid = 7.9;
        stage1.current.rotation.set(pose.tumble * 0.35, 0, pose.tumble);
        stage1.current.position.set(pose.drift + Math.sin(pose.tumble) * mid, pose.rise + mid - Math.cos(pose.tumble) * mid, 0);
        stage1.current.visible = tau < SPENT_VISIBLE;
      }
    }

    // Stage 1 flame: grows as the clamps release and the stack picks up speed; out at staging.
    if (flame1.current) {
      flame1.current.visible = t >= 0 && !separated;
      const climb = Math.max(0, t - HOLD_DOWN);
      flame1.current.scale.set(1 + Math.min(climb, 4) * 0.08, Math.min(1, t / 0.6) * (1 + Math.min(climb, 3) * 0.4) * flicker, 1 + Math.min(climb, 4) * 0.08);
    }
    // Stage 2 flame: smaller engine, but the plume balloons out in the thin upper air.
    if (flame2.current) {
      const on = t >= STAGE2_T && t < burnEndT;
      flame2.current.visible = on;
      if (on) {
        const k = Math.min(1, (t - STAGE2_T) / 0.35);
        const widen = 1 + Math.min(t - STAGE2_T, 5) * 0.18;
        flame2.current.scale.set(widen, k * (1 + Math.min(t - STAGE2_T, 5) * 0.12) * flicker, widen);
      }
    }
    // Engine light on the pad, the tower and the smoke; fades as the rocket climbs away.
    if (light.current) {
      const lit = t >= 0 && !separated;
      light.current.intensity = lit ? Math.min(1, t / 0.4) * 900 * flicker * Math.max(0, 1 - rise / 120) : 0;
      light.current.position.y = rise + 0.5;
    }

    // Rumble while the vehicle is low and loud: keep the trauma topped up, it decays itself.
    if (t >= 0 && t < HOLD_DOWN + 6) addTrauma(t < HOLD_DOWN ? 0.03 : 0.02);
  });

  return (
    <group>
      {/* Mounted from the start at zero intensity, so lighting shaders don't recompile at liftoff. */}
      <pointLight ref={light} color={SCENE_COLORS.flameOuter} intensity={0} distance={90} decay={1.6} position={[0, 0.5, 0]} />

      <group ref={stage1}>
        <FirstStage />
        <group ref={flame1} visible={false} position={[0, 1.5, 0]}>
          <Flame radius={1.7} length={7} />
        </group>
      </group>

      <group ref={upper}>
        <UpperStack />
        <group ref={flame2} visible={false} position={[0, 12.55, 0]}>
          <Flame radius={0.75} length={4.5} />
        </group>
      </group>

      <LaunchSmoke ignitionAt={ignitionAt} burnEndT={burnEndT} />
    </group>
  );
}

/** Outer flame, bright core and a soft additive glow; the group's Y scale stretches it down. */
function Flame({ radius, length }: { radius: number; length: number }) {
  return (
    <group position={[0, -length / 2, 0]}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[radius, length, 14, 1, true]} />
        <meshBasicMaterial color={SCENE_COLORS.flameOuter} side={DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, length * 0.14, 0]}>
        <coneGeometry args={[radius * 0.58, length * 0.7, 14]} />
        <meshBasicMaterial color={SCENE_COLORS.flameCore} />
      </mesh>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, -length * 0.05, 0]}>
        <coneGeometry args={[radius * 1.6, length * 1.25, 14, 1, true]} />
        <meshBasicMaterial
          color={SCENE_COLORS.flameOuter}
          transparent
          opacity={0.28}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

type Section = [y0: number, y1: number, rBottom: number, rTop: number, colour: string];

function Sections({ list }: { list: Section[] }) {
  return (
    <>
      {list.map(([y0, y1, r0, r1, color]) => (
        <mesh key={`${y0}-${color}`} position={[0, (y0 + y1) / 2, 0]}>
          <cylinderGeometry args={[r1, r0, y1 - y0, 16]} />
          <meshStandardMaterial color={color} metalness={color === SCENE_COLORS.steelLight ? 0.5 : 0.15} roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

/** Stage 1: engine cluster, thrust skirt with fins, the big tank, and the interstage ring. */
function FirstStage() {
  return (
    <group>
      <Sections
        list={[
          [2.2, 3.3, 1.75, 1.6, SCENE_COLORS.steelDark],
          [3.3, 12, 1.6, 1.6, SCENE_COLORS.spaceWhite],
          [3.3, 4.2, 1.62, 1.62, SCENE_COLORS.steelDark],
          [7.5, 7.9, 1.62, 1.62, SCENE_COLORS.nasaRed],
          [11.4, 12, 1.62, 1.62, SCENE_COLORS.steelDark],
          // Interstage: travels with stage 1 and hides the stage 2 engine until separation.
          [12, 13.6, 1.6, 1.3, SCENE_COLORS.nasaBlue],
        ]}
      />
      {/* Five engine bells under the skirt */}
      {[
        [0, 0],
        [0.95, 0],
        [-0.95, 0],
        [0, 0.95],
        [0, -0.95],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 1.75, z]}>
          <cylinderGeometry args={[0.22, 0.45, 0.9, 10, 1, true]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.35} side={DoubleSide} />
        </mesh>
      ))}
      {/* Four fins */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
          <mesh position={[1.95, 3.1, 0]}>
            <boxGeometry args={[0.9, 1.8, 0.12]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Stage 2 with its engine bell, the spacecraft adapter, the capsule and the escape tower. */
function UpperStack() {
  return (
    <group>
      <mesh position={[0, 13.05, 0]}>
        <cylinderGeometry args={[0.32, 0.72, 1.1, 12, 1, true]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.35} side={DoubleSide} />
      </mesh>
      <Sections
        list={[
          [13.6, 19.2, 1.3, 1.3, SCENE_COLORS.spaceWhite],
          [15.8, 16.2, 1.32, 1.32, SCENE_COLORS.steelDark],
          [19.2, 22.2, 1.3, 1.0, SCENE_COLORS.spaceWhite],
          [22.2, 24.2, 1.0, 1.0, SCENE_COLORS.steelLight],
          [24.2, 25.6, 1.0, 0.3, SCENE_COLORS.spaceWhite],
          [25.6, 29.2, 0.22, 0.22, SCENE_COLORS.spaceWhite],
          [29.2, ROCKET_HEIGHT, 0.22, 0.01, SCENE_COLORS.nasaRed],
        ]}
      />
    </group>
  );
}
