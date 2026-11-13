"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, type Group, type PointLight } from "three";
import { addTrauma } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";
import {
  ADAPTER_T,
  HOLD_DOWN,
  SEP2_T,
  SEPARATION_T,
  SPENT_VISIBLE,
  STAGE2_T,
  STAGE3_T,
  detachedPose,
  rocketRise,
} from "./ascent";
import { LaunchSmoke } from "./LaunchSmoke";
import { EscapeTower, LanderBay, NozzleExtension, PetalRing, UllageMotors } from "./Mechanics";

/**
 * The three-stage vehicle in pad-local space, every coordinate a height above the stack's base:
 *   stage 1   2.2 – 11.4   five engines, the big tank, fins
 *   interstage 11.4 – 13.6  four petals that open at the first separation
 *   stage 2   13.6 – 19.0   five engines in the skirt, tank
 *   interstage 19.0 – 20.6  second set of petals
 *   stage 3   20.6 – 23.8   one engine whose nozzle telescopes out
 *   adapter   24.2 – 27.6   four panels folding away from the lander inside
 *   capsule   27.6 – 31.2   service module and command module
 *   tower     31.2 – ROCKET_HEIGHT  the launch escape system
 * Each stage is its own group so it can fall away on its own when it separates.
 */
export function LaunchVehicle({ ignitionAt, burnEndT }: { ignitionAt: number | null; burnEndT: number }) {
  const reduced = useReducedMotion();
  const upper = useRef<Group>(null);
  const stage1 = useRef<Group>(null);
  const stage2 = useRef<Group>(null);
  const flame1 = useRef<Group>(null);
  const flame2 = useRef<Group>(null);
  const flame3 = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const gimbals = useRef<(Group | null)[]>([]);

  useFrame(() => {
    const t = ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    const flicker = reduced || t < 0 ? 1 : 1 + Math.sin(t * 47) * 0.08 + Math.sin(t * 31) * 0.06;
    const rise = t < 0 ? 0 : rocketRise(t);
    const sep1 = t >= SEPARATION_T;
    const sep2 = t >= SEP2_T;

    if (upper.current) {
      upper.current.position.y = rise;
      upper.current.visible = rise < 900;
    }

    // A spent stage keeps its speed, slows, and tumbles away about its own middle.
    const detach = (g: Group | null, sepT: number, mid: number, dir: number, fall: number) => {
      if (!g) return;
      const tau = t - sepT;
      const pose = detachedPose(sepT, tau, { fall, drift: 0.3 * dir, tumble: 0.055 * dir });
      g.rotation.set(pose.tumble * 0.35, 0, pose.tumble);
      g.position.set(pose.drift + Math.sin(pose.tumble) * mid, pose.rise + mid - Math.cos(pose.tumble) * mid, 0);
      g.visible = tau < SPENT_VISIBLE;
    };
    if (stage1.current) {
      if (!sep1) {
        stage1.current.position.set(0, rise, 0);
        stage1.current.rotation.set(0, 0, 0);
        stage1.current.visible = true;
      } else {
        detach(stage1.current, SEPARATION_T, 7.9, 1, 2.2);
      }
    }
    if (stage2.current) {
      if (!sep2) {
        stage2.current.position.set(0, rise, 0);
        stage2.current.rotation.set(0, 0, 0);
      } else {
        detach(stage2.current, SEP2_T, 16.3, -1, 1.8);
      }
    }

    // The four outer engines of stage 1 swing on their gimbals as the vehicle steers.
    gimbals.current.forEach((g, i) => {
      if (!g) return;
      const live = t > HOLD_DOWN - 0.5 && !sep1 ? 1 : 0;
      g.rotation.x = Math.sin(t * 2.3 + i * 1.7) * 0.11 * live;
      g.rotation.z = Math.cos(t * 1.9 + i * 2.1) * 0.11 * live;
    });

    // Stage 1 flame: grows as the clamps release and the stack picks up speed; out at staging.
    if (flame1.current) {
      flame1.current.visible = t >= 0 && !sep1;
      const climb = Math.max(0, t - HOLD_DOWN);
      flame1.current.scale.set(1 + Math.min(climb, 6) * 0.05, Math.min(1, t / 0.9) * (1 + Math.min(climb, 5) * 0.28) * flicker, 1 + Math.min(climb, 6) * 0.05);
    }
    // Stage 2: a broad plume from five engines, until it is dropped.
    if (flame2.current) {
      const on = t >= STAGE2_T && t < Math.min(SEP2_T, burnEndT);
      flame2.current.visible = on;
      if (on) {
        const k = Math.min(1, (t - STAGE2_T) / 0.5);
        const widen = 1 + Math.min(t - STAGE2_T, 8) * 0.07;
        flame2.current.scale.set(widen, k * flicker, widen);
      }
    }
    // Stage 3: one engine, the plume ballooning out in the thin air.
    if (flame3.current) {
      const on = t >= STAGE3_T && t < burnEndT;
      flame3.current.visible = on;
      if (on) {
        const k = Math.min(1, (t - STAGE3_T) / 0.5);
        const widen = 1 + Math.min(t - STAGE3_T, 6) * 0.14;
        flame3.current.scale.set(widen, k * (1 + Math.min(t - STAGE3_T, 6) * 0.1) * flicker, widen);
      }
    }
    // Engine light on the pad, the tower and the smoke; fades as the rocket climbs away.
    if (light.current) {
      const lit = t >= 0 && !sep1;
      light.current.intensity = lit ? Math.min(1, t / 0.6) * 900 * flicker * Math.max(0, 1 - rise / 120) : 0;
      light.current.position.y = rise + 0.5;
    }

    // Rumble while the vehicle is low and loud: keep the trauma topped up, it decays itself.
    if (t >= 0 && t < HOLD_DOWN + 8) addTrauma(t < HOLD_DOWN ? 0.03 : 0.02);
  });

  return (
    <group>
      {/* Mounted from the start at zero intensity, so lighting shaders don't recompile at liftoff. */}
      <pointLight ref={light} color={SCENE_COLORS.flameOuter} intensity={0} distance={90} decay={1.6} position={[0, 0.5, 0]} />

      <group ref={stage1}>
        <FirstStage gimbals={gimbals} />
        <PetalRing
          ignitionAt={ignitionAt}
          at={SEPARATION_T}
          y0={11.4}
          h={2.2}
          r0={1.6}
          r1={1.52}
          color={SCENE_COLORS.nasaBlue}
          open={1.75}
          retro
        />
        <group ref={flame1} visible={false} position={[0, 1.5, 0]}>
          <Flame radius={1.9} length={7.5} />
        </group>
      </group>

      <group ref={stage2}>
        <SecondStage />
        <PetalRing
          ignitionAt={ignitionAt}
          at={SEP2_T}
          y0={19}
          h={1.6}
          r0={1.5}
          r1={1.16}
          color="#2b3445"
          stripe={SCENE_COLORS.nasaRed}
          open={1.7}
          retro
        />
        <UllageMotors ignitionAt={ignitionAt} y={13.7} r={1.55} from={SEPARATION_T - 0.1} to={STAGE2_T + 0.3} />
        <group ref={flame2} visible={false} position={[0, 12.7, 0]}>
          <Flame radius={1.3} length={6} />
        </group>
      </group>

      <group ref={upper}>
        <ThirdStageAndCapsule />
        <UllageMotors ignitionAt={ignitionAt} y={20.7} r={1.17} from={SEP2_T - 0.1} to={STAGE3_T + 0.3} />
        <NozzleExtension ignitionAt={ignitionAt} y={19.5} r={0.62} from={SEP2_T + 0.9} lightAt={STAGE3_T} />
        <group ref={flame3} visible={false} position={[0, 18.9, 0]}>
          <Flame radius={0.8} length={4.2} />
        </group>
        <PetalRing
          ignitionAt={ignitionAt}
          at={ADAPTER_T}
          y0={24.2}
          h={3.4}
          r0={1.16}
          r1={0.96}
          color={SCENE_COLORS.spaceWhite}
          stripe={SCENE_COLORS.nasaRed}
          open={2.0}
          release
        >
          <LanderBay />
        </PetalRing>
        <EscapeTower ignitionAt={ignitionAt} y0={31.2} />
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
          <cylinderGeometry args={[r1, r0, y1 - y0, 20]} />
          <meshStandardMaterial color={color} metalness={color === SCENE_COLORS.steelLight ? 0.5 : 0.15} roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

/** Propellant lines and cable raceways running along a stage's skin. */
function Conduits({ y0, y1, r, count }: { y0: number; y1: number; r: number; count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + 0.4;
        return (
          <mesh key={i} position={[Math.sin(a) * r, (y0 + y1) / 2, Math.cos(a) * r]}>
            <cylinderGeometry args={[0.07, 0.07, y1 - y0, 6]} />
            <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.7} roughness={0.35} />
          </mesh>
        );
      })}
    </>
  );
}

/** Stage 1: engine cluster, thrust skirt with fins, the big tank and its plumbing. */
function FirstStage({ gimbals }: { gimbals: React.MutableRefObject<(Group | null)[]> }) {
  return (
    <group>
      <Sections
        list={[
          [2.2, 3.3, 1.75, 1.6, SCENE_COLORS.steelDark],
          [3.3, 11.4, 1.6, 1.6, SCENE_COLORS.spaceWhite],
          [3.3, 4.2, 1.62, 1.62, SCENE_COLORS.steelDark],
          [5.2, 5.6, 1.62, 1.62, SCENE_COLORS.steelDark],
          [7.5, 7.9, 1.62, 1.62, SCENE_COLORS.nasaRed],
          [10.8, 11.4, 1.62, 1.62, SCENE_COLORS.steelDark],
        ]}
      />
      <Conduits y0={4.4} y1={10.8} r={1.66} count={4} />
      {/* The centre engine is fixed; the four outer ones swing on gimbals */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.22, 0.45, 0.9, 10, 1, true]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.35} side={DoubleSide} />
      </mesh>
      {[
        [0.95, 0],
        [-0.95, 0],
        [0, 0.95],
        [0, -0.95],
      ].map(([x, z], i) => (
        <group key={`${x}${z}`} position={[x!, 2.2, z!]}>
          <group ref={(el) => (gimbals.current[i] = el)}>
            <mesh position={[0, -0.45, 0]}>
              <cylinderGeometry args={[0.22, 0.45, 0.9, 10, 1, true]} />
              <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.35} side={DoubleSide} />
            </mesh>
            <mesh position={[0, 0.0, 0]}>
              <sphereGeometry args={[0.2, 8, 6]} />
              <meshStandardMaterial color="#b0823f" metalness={0.9} roughness={0.3} />
            </mesh>
          </group>
        </group>
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

/** Stage 2: the engine cluster in its skirt (hidden until the first interstage opens) and its tank. */
function SecondStage() {
  return (
    <group>
      <Sections
        list={[
          [13.6, 19, 1.5, 1.5, SCENE_COLORS.spaceWhite],
          [13.6, 14.2, 1.52, 1.52, SCENE_COLORS.steelDark],
          [15.5, 15.8, 1.52, 1.52, SCENE_COLORS.steelDark],
          [18.3, 19, 1.52, 1.52, SCENE_COLORS.steelDark],
        ]}
      />
      <Conduits y0={14.4} y1={18.2} r={1.55} count={3} />
      {[
        [0, 0],
        [0.7, 0],
        [-0.7, 0],
        [0, 0.7],
        [0, -0.7],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x!, 13.2, z!]}>
          <cylinderGeometry args={[0.2, 0.42, 1.2, 10, 1, true]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.35} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Stage 3 with its engine bell, the instrument ring, the service and command modules. */
function ThirdStageAndCapsule() {
  return (
    <group>
      <mesh position={[0, 20.1, 0]}>
        <cylinderGeometry args={[0.3, 0.62, 1.2, 12, 1, true]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.35} side={DoubleSide} />
      </mesh>
      <Sections
        list={[
          [20.6, 23.8, 1.15, 1.15, SCENE_COLORS.spaceWhite],
          [22.0, 22.3, 1.17, 1.17, SCENE_COLORS.steelDark],
          [23.8, 24.2, 1.2, 1.2, SCENE_COLORS.steelDark],
          // Service module, a gold band, then the command module
          [27.6, 29.6, 0.96, 0.96, SCENE_COLORS.steelLight],
          [28.2, 28.5, 0.98, 0.98, SCENE_COLORS.kaptonGold],
          [29.6, 31.2, 0.96, 0.3, SCENE_COLORS.spaceWhite],
        ]}
      />
      <mesh position={[0, 27.5, 0]}>
        <cylinderGeometry args={[0.25, 0.5, 0.6, 10, 1, true]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.35} side={DoubleSide} />
      </mesh>
      {/* Reaction control quads on the service module */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 1.0, 28.9, Math.cos(a) * 1.0]}>
            <boxGeometry args={[0.16, 0.3, 0.16]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.5} />
          </mesh>
        );
      })}
      {/* The tower sits on a short collar */}
      <mesh position={[0, 31.25, 0]}>
        <cylinderGeometry args={[0.32, 0.4, 0.2, 10]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}
