"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { LightingRig } from "@/components/viewport/LightingRig";
import { Starfield } from "@/components/viewport/Starfield";
import { seeded } from "@/lib/random";
import { Hotspot } from "@/components/viewport/Hotspot";
import { shake } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PALETTE, SCENE_COLORS } from "@/lib/palette";
import { DESCENT_STEPS, sampleAt } from "@/mocks/descent";
import {
  CABIN,
  CONSOLE,
  EYE,
  SITE_OFFSET_X,
  WINDOW,
  driftAt,
  missionTimeNow,
  switchPosition,
  tiltAt,
  visualAltitude,
  visualRange,
  type DescentClock,
} from "./layout";

interface LunarWorldProps {
  clock: DescentClock;
  /** Index of the switch the player may press now, or null while a segment plays. */
  armed: number | null;
  onPress: (index: number) => void;
  /** Lit from the moment the probes touch until engine stop. */
  contactLight: boolean;
  /** performance.now() at touchdown, for the dust burst. */
  touchdownAt: number | null;
}

/** Rumble kept on the camera while the descent engine burns (trauma², so this stays gentle). */
const BURN_TRAUMA = 0.28;

/**
 * Scene 4 geometry: the lander cabin (window, console, four descent switches) and outside the
 * lunar surface rising to meet it. All motion is derived each frame from the descent clock.
 */
/** Memoised: the panel clock re-renders the scene ~12 times a second, and none of these props change then. */
export const LunarWorld = memo(function LunarWorld({ clock, armed, onPress, contactLight, touchdownAt }: LunarWorldProps) {
  return (
    <>
      <LightingRig intensity={0.8} />
      {/* Low sun from the left: long light across the ground, the lander's side in shade. */}
      <directionalLight position={[-8, 2.5, -3]} color={PALETTE.mist} intensity={1.6} />
      <BurnRumble clock={clock} />
      <Cabin />
      <Console clock={clock} armed={armed} onPress={onPress} contactLight={contactLight} />
      <Outside clock={clock} touchdownAt={touchdownAt} />
    </>
  );
});

function BurnRumble({ clock }: { clock: DescentClock }) {
  useFrame(() => {
    // Engine lit from powered descent until the player calls engine stop.
    if (clock.stepsDone >= 1 && clock.stepsDone <= 3) shake.trauma = Math.max(shake.trauma, BURN_TRAUMA);
  });
  return null;
}

/* ---------------------------------------------------------------- cabin */

function Cabin() {
  const w = CABIN.maxX - CABIN.minX;
  const d = CABIN.back - CABIN.front;
  const cz = (CABIN.front + CABIN.back) / 2;
  const h = CABIN.height;
  const sideW = (w - (WINDOW.maxX - WINDOW.minX)) / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.8} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} roughness={0.7} />
      </mesh>
      {/* Front cabin bulkhead: brushed aerospace slate-titanium */}
      <mesh position={[0, WINDOW.bottom / 2, CABIN.front]}>
        <boxGeometry args={[w, WINDOW.bottom, 0.08]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh position={[0, (WINDOW.top + h) / 2, CABIN.front]}>
        <boxGeometry args={[w, h - WINDOW.top, 0.08]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.35} roughness={0.55} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WINDOW.maxX + sideW / 2), (WINDOW.bottom + WINDOW.top) / 2, CABIN.front]}>
          <boxGeometry args={[sideW, WINDOW.top - WINDOW.bottom, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.35} roughness={0.55} />
        </mesh>
      ))}
      {/* Window frame: brushed aluminum bezel, with a glowing cyan sighting reticle on the glass. */}
      {[WINDOW.bottom, WINDOW.top].map((y) => (
        <mesh key={y} position={[0, y, CABIN.front + 0.05]}>
          <boxGeometry args={[WINDOW.maxX - WINDOW.minX + 0.08, 0.04, 0.02]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {[WINDOW.minX, WINDOW.maxX].map((x) => (
        <mesh key={x} position={[x, (WINDOW.bottom + WINDOW.top) / 2, CABIN.front + 0.05]}>
          <boxGeometry args={[0.04, WINDOW.top - WINDOW.bottom, 0.02]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, (WINDOW.bottom + WINDOW.top) / 2, CABIN.front + 0.02]} rotation={[0, 0, i * (Math.PI / 2)]}>
          <planeGeometry args={[0.18, 0.008]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
      ))}
      {[CABIN.minX, CABIN.maxX].map((x) => (
        <mesh key={x} position={[x, h / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, h / 2, CABIN.back]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.7} />
      </mesh>
      <pointLight position={[0, 2.2, 0.6]} color={SCENE_COLORS.spaceWhite} intensity={1.5} distance={5} />
    </group>
  );
}

/* ---------------------------------------------------------------- console */

function Console({
  clock,
  armed,
  onPress,
  contactLight,
}: Pick<LunarWorldProps, "clock" | "armed" | "onPress" | "contactLight">) {
  return (
    <group>
      <mesh position={[0, CONSOLE.y - 0.5, CONSOLE.z]}>
        <boxGeometry args={[CONSOLE.width, 1, CONSOLE.depth]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* NASA Blue & white instrument panel face */}
      <mesh position={[0, CONSOLE.y + 0.01, CONSOLE.z]} rotation={[CONSOLE.tilt * 0.2, 0, 0]}>
        <boxGeometry args={[CONSOLE.width + 0.04, 0.03, CONSOLE.depth]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.5} roughness={0.4} />
      </mesh>
      <ContactLamp lit={contactLight} />
      {DESCENT_STEPS.map((step, i) => {
        const done = i < clock.stepsDone;
        const sw = <Switch done={done} armed={armed === i} />;
        return armed === i ? (
          <Hotspot key={step.id} id={`switch-${step.id}`} label={step.label} position={switchPosition(i)} markerHeight={0.2} markerScale={0.4} onActivate={() => onPress(i)}>
            {sw}
          </Hotspot>
        ) : (
          <group key={step.id} position={switchPosition(i)}>
            {sw}
          </group>
        );
      })}
    </group>
  );
}

/** A guarded toggle: plate, lamp, and a lever that flips up once thrown. */
function Switch({ done, armed }: { done: boolean; armed: boolean }) {
  const reduced = useReducedMotion();
  const lamp = useRef<MeshBasicMaterial>(null);
  useFrame((state) => {
    if (!lamp.current) return;
    // The armed switch's lamp blinks gold; thrown ones glow green; the rest stay dark.
    const on = armed ? reduced || Math.sin(state.clock.elapsedTime * 6) > -0.2 : done;
    lamp.current.color.set(armed ? (on ? SCENE_COLORS.solarGold : SCENE_COLORS.steelDark) : done ? SCENE_COLORS.screenGreen : SCENE_COLORS.steelDark);
  });
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.24, 0.03, 0.2]} />
        <meshStandardMaterial color={armed ? SCENE_COLORS.nasaRed : SCENE_COLORS.steelLight} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.05, done ? -0.03 : 0.03]} rotation={[done ? -0.6 : 0.6, 0, 0]}>
        <boxGeometry args={[0.035, 0.1, 0.035]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.025, -0.075]}>
        <boxGeometry args={[0.07, 0.025, 0.035]} />
        <meshBasicMaterial ref={lamp} color={SCENE_COLORS.steelDark} />
      </mesh>
    </group>
  );
}

function ContactLamp({ lit }: { lit: boolean }) {
  return (
    <group position={[0, CONSOLE.y + 0.05, CONSOLE.z - 0.2]}>
      <mesh>
        <boxGeometry args={[0.34, 0.08, 0.06]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[0.28, 0.05]} />
        <meshBasicMaterial color={lit ? SCENE_COLORS.screenCyan : SCENE_COLORS.steelMid} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- outside */

function Outside({ clock, touchdownAt }: { clock: DescentClock; touchdownAt: number | null }) {
  const reduced = useReducedMotion();
  const root = useRef<Group>(null);
  const surface = useRef<Group>(null);
  const reticle = useRef<Group>(null);
  const dust = useRef<Mesh>(null);
  const dustMat = useRef<MeshBasicMaterial>(null);
  const burst = useRef<Mesh>(null);
  const burstMat = useRef<MeshBasicMaterial>(null);

  const craters = useMemo(() => {
    const rand = seeded(11);
    const list: { x: number; z: number; r: number }[] = [];
    while (list.length < 70) {
      const x = (rand() - 0.5) * 300;
      const z = -rand() * 340 + 60;
      const r = 1 + rand() * rand() * 12;
      // Keep the approach line and both landing spots clean.
      if (Math.hypot(x, z) < 14 || Math.hypot(x - SITE_OFFSET_X, z) < 10) continue;
      list.push({ x, z, r });
    }
    return list;
  }, []);
  const boulders = useMemo(() => {
    const rand = seeded(5);
    return Array.from({ length: 11 }, () => ({
      x: (rand() - 0.5) * 7,
      z: (rand() - 0.5) * 8,
      r: 0.35 + rand() * 0.8,
      rot: rand() * 3,
    }));
  }, []);
  const stars = useMemo(() => {
    const rand = seeded(3);
    return Array.from({ length: 80 }, () => {
      const az = (rand() - 0.5) * 2.4;
      const el = 0.05 + rand() * 0.9;
      return [Math.sin(az) * 170 * Math.cos(el), Math.sin(el) * 170, -Math.cos(az) * 170 * Math.cos(el)] as const;
    });
  }, []);

  useFrame(() => {
    const now = performance.now();
    const t = missionTimeNow(clock, now);
    const { altM } = sampleAt(t);
    if (root.current) root.current.rotation.x = tiltAt(t);
    if (surface.current) {
      surface.current.position.set(-driftAt(t), -visualAltitude(altM), -visualRange(altM));
    }
    if (reticle.current) reticle.current.visible = clock.stepsDone >= 3 && touchdownAt === null;
    // Engine wash: dust streams out from under the lander in the last 25 m.
    if (dust.current && dustMat.current) {
      const k = clock.stepsDone >= 3 && touchdownAt === null ? Math.max(0, 1 - altM / 25) : 0;
      dust.current.visible = k > 0;
      dust.current.scale.setScalar(2 + k * 5);
      dustMat.current.opacity = 0.55 * k;
    }
    if (burst.current && burstMat.current) {
      const age = touchdownAt === null ? -1 : (now - touchdownAt) / 1000;
      const on = age >= 0 && age < 1.8 && !reduced;
      burst.current.visible = on;
      if (on) {
        const p = age / 1.8;
        burst.current.scale.setScalar(3 + 14 * (1 - (1 - p) * (1 - p)));
        burstMat.current.opacity = 0.7 * (1 - p);
      }
    }
  });

  return (
    <group ref={root} position={EYE}>
      <Starfield positions={stars} />
      {/* Earth: vibrant blue ocean planet with white cloud swirls */}
      <mesh position={[38, 30, -165]}>
        <sphereGeometry args={[7, 24, 16]} />
        <meshStandardMaterial color={SCENE_COLORS.earthBlue} emissive="#0B3D91" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[36.2, 31.6, -158.5]}>
        <sphereGeometry args={[2.2, 12, 8]} />
        <meshBasicMaterial color={SCENE_COLORS.earthCloud} />
      </mesh>

      <group ref={surface}>
        {/* Realistic grey/silver lunar regolith */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -110]}>
          <planeGeometry args={[520, 520]} />
          <meshStandardMaterial color={SCENE_COLORS.lunarMid} roughness={0.95} />
        </mesh>
        {craters.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh position={[0, 0, 0.04]}>
              <ringGeometry args={[c.r * 0.82, c.r, 20]} />
              <meshStandardMaterial color={SCENE_COLORS.lunarLight} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <circleGeometry args={[c.r * 0.82, 20]} />
              <meshStandardMaterial color={SCENE_COLORS.lunarDark} roughness={0.95} />
            </mesh>
          </group>
        ))}
        {/* The boulder field on the original aim point: realistic dark lunar rock */}
        {boulders.map((b, i) => (
          <mesh key={i} position={[b.x, b.r * 0.5, b.z]} rotation={[b.rot, b.rot * 0.7, 0]}>
            <dodecahedronGeometry args={[b.r, 0]} />
            <meshStandardMaterial color={SCENE_COLORS.lunarDark} roughness={0.9} flatShading />
          </mesh>
        ))}
        <group ref={reticle} position={[SITE_OFFSET_X, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <mesh>
            <ringGeometry args={[1.7, 2.1, 32]} />
            <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
          </mesh>
          {[0, 1].map((k) => (
            <mesh key={k} rotation={[0, 0, k * (Math.PI / 2)]}>
              <planeGeometry args={[1.2, 0.18]} />
              <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
            </mesh>
          ))}
        </group>
        <mesh ref={dust} position={[SITE_OFFSET_X, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.4, 1, 24]} />
          <meshBasicMaterial ref={dustMat} color={SCENE_COLORS.lunarLight} transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh ref={burst} position={[SITE_OFFSET_X, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.7, 1, 32]} />
          <meshBasicMaterial ref={burstMat} color={SCENE_COLORS.lunarLight} transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
