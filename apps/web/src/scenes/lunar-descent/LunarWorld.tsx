"use client";

import { memo, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Points, PointsMaterial } from "three";
import { LightingRig } from "@/components/viewport/LightingRig";
import { Starfield } from "@/components/viewport/Starfield";
import { Earth } from "@/components/viewport/Earth";
import { Html, useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  MirroredRepeatWrapping,
  SRGBColorSpace,
} from "three";
import { seeded } from "@/lib/random";
import { Hotspot } from "@/components/viewport/Hotspot";
import { shake } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PALETTE, SCENE_COLORS } from "@/lib/palette";
import { DESCENT_STEPS } from "@/mocks/descent";
import {
  BOULDER_HALF_WIDTH,
  CRATER_CENTER_X,
  CRATER_RADIUS,
  PRECISION_M,
  SITES,
  type LandingSite,
  type SiteId,
} from "./flight";
import {
  CABIN,
  CONSOLE,
  EYE,
  WINDOW,
  switchPosition,
  visualAltitude,
  visualRange,
  type FlightView,
} from "./layout";

interface LunarWorldProps {
  /** Mutable flight state written by the scene every frame; read here, never set. */
  view: MutableRefObject<FlightView>;
  /** Controls already thrown (0-4), for the switch levers. */
  stepsDone: number;
  armed: number | null;
  onPress: (index: number) => void;
}

const BURN_TRAUMA = 0.28;

/**
 * Scene 4 geometry: the Apollo/Artemis Lunar Module cockpit (panoramic window, detailed DSKY computer,
 * Caution & Warning matrix, FDAI 8-ball, four descent switches, and co-pilot astronaut in spacesuit)
 * with the rising lunar crater surface, distant mountain ridges, and glowing Earthrise outside.
 */
export const LunarWorld = memo(function LunarWorld({ view, stepsDone, armed, onPress }: LunarWorldProps) {
  return (
    <>
      <LightingRig intensity={0.85} />
      {/* Harsh stark sunlight in the vacuum of space */}
      <directionalLight position={[-12, 6, -8]} color="#FFFFFF" intensity={2.2} />
      {/* Soft earthlight / cockpit interior bounce fill */}
      <directionalLight position={[6, 4, 2]} color="#93C5FD" intensity={0.6} />

      <BurnRumble view={view} />
      <Cabin />
      <CockpitInstruments view={view} />
      <AstronautPilot />
      <Console view={view} stepsDone={stepsDone} armed={armed} onPress={onPress} />
      <Outside view={view} />
    </>
  );
});

/** The engine shakes the cabin while it burns, harder at high throttle. */
function BurnRumble({ view }: { view: MutableRefObject<FlightView> }) {
  useFrame(() => {
    const v = view.current;
    if (v.engineOn && v.touchdownAt === null) shake.trauma = Math.max(shake.trauma, BURN_TRAUMA * (0.4 + v.throttle));
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
      {/* Flight deck floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.75} />
      </mesh>
      {/* Ceiling with Velcro utility pads and cabin dome light */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} roughness={0.6} />
      </mesh>
      <pointLight position={[0, h - 0.2, 0.4]} color="#FFFBEB" intensity={1.6} distance={4.5} />

      {/* Front cabin bulkhead: brushed titanium & aerospace thermal blankets */}
      <mesh position={[0, WINDOW.bottom / 2, CABIN.front]}>
        <boxGeometry args={[w, WINDOW.bottom, 0.08]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, (WINDOW.top + h) / 2, CABIN.front]}>
        <boxGeometry args={[w, h - WINDOW.top, 0.08]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.4} roughness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WINDOW.maxX + sideW / 2), (WINDOW.bottom + WINDOW.top) / 2, CABIN.front]}>
          <boxGeometry args={[sideW, WINDOW.top - WINDOW.bottom, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* Window frame: brushed aerospace aluminum bezel */}
      {[WINDOW.bottom, WINDOW.top].map((y) => (
        <mesh key={y} position={[0, y, CABIN.front + 0.05]}>
          <boxGeometry args={[WINDOW.maxX - WINDOW.minX + 0.08, 0.04, 0.03]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      {[WINDOW.minX, WINDOW.maxX].map((x) => (
        <mesh key={x} position={[x, (WINDOW.bottom + WINDOW.top) / 2, CABIN.front + 0.05]}>
          <boxGeometry args={[0.04, WINDOW.top - WINDOW.bottom, 0.03]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.75} roughness={0.25} />
        </mesh>
      ))}

      {/* Landing Point Designator (LPD) angle graduation reticle scale etched on glass */}
      {[-0.2, -0.1, 0, 0.1, 0.2].map((dy, i) => (
        <mesh
          key={i}
          position={[0, (WINDOW.bottom + WINDOW.top) / 2 + dy, CABIN.front + 0.02]}
        >
          <planeGeometry args={[0.16 + (i === 2 ? 0.08 : 0), 0.006]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
      ))}
      <mesh position={[0, (WINDOW.bottom + WINDOW.top) / 2, CABIN.front + 0.02]}>
        <planeGeometry args={[0.006, 0.46]} />
        <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
      </mesh>

      {/* Side walls with circuit breaker panels */}
      {[CABIN.minX, CABIN.maxX].map((x) => (
        <group key={x}>
          <mesh position={[x, h / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[d, h]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.65} />
          </mesh>
          {/* Circuit breaker matrix (rows of push-pull white button heads) */}
          <group position={[x + (x < 0 ? 0.04 : -0.04), 1.5, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <mesh>
              <planeGeometry args={[1.2, 0.8]} />
              <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.5} />
            </mesh>
            {[-0.4, -0.2, 0, 0.2, 0.4].flatMap((bx) =>
              [-0.25, -0.1, 0.05, 0.2].map((by) => (
                <mesh key={`${bx}${by}`} position={[bx, by, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              )),
            )}
          </group>
        </group>
      ))}

      {/* Back bulkhead */}
      <mesh position={[0, h / 2, CABIN.back]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Detailed Apollo/Artemis Cockpit Avionics & Displays */
function CockpitInstruments({ view }: { view: MutableRefObject<FlightView> }) {
  const dskyRef = useRef<MeshBasicMaterial>(null);
  const fdaiRef = useRef<Group>(null);
  // Markers on the two tapes of the radar altimeter / rate-of-descent meter.
  const tapeMarks = useRef<(Mesh | null)[]>([]);
  const reduced = useReducedMotion();

  // The tapes read the real flight: radar altitude (0-150 m) and descent rate (-6..+0.5 m/s).
  useFrame(() => {
    const v = view.current;
    const [alt, rate] = tapeMarks.current;
    if (alt) alt.position.y = -0.075 + 0.15 * Math.min(1, Math.max(0, v.altM / 150));
    if (rate) rate.position.y = -0.075 + 0.15 * Math.min(1, Math.max(0, (v.vsMs + 6) / 6.5));
  });

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    // DSKY status light blink
    if (dskyRef.current) {
      dskyRef.current.color.set(Math.sin(t * 4) > 0 ? SCENE_COLORS.screenGreen : "#064E3B");
    }
    // FDAI 8-ball gentle gyro stabilization drift
    if (fdaiRef.current) {
      fdaiRef.current.rotation.x = Math.sin(t * 0.4) * 0.08 + view.current.tilt * 3;
      fdaiRef.current.rotation.y = Math.cos(t * 0.3) * 0.06;
    }
  });

  return (
    <group>
      {/* Center DSKY (Display & Keyboard) Computer Unit */}
      <group position={[-0.75, 1.25, CABIN.front + 0.12]}>
        <mesh>
          <boxGeometry args={[0.34, 0.48, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} />
        </mesh>
        {/* Digital Green Program & Telemetry Displays */}
        <mesh position={[0, 0.12, 0.042]}>
          <planeGeometry args={[0.28, 0.18]} />
          <meshBasicMaterial color="#022C22" />
        </mesh>
        {/* Glowing 7-segment readouts: PROG 64, VERB 06, NOUN 68 */}
        <mesh position={[-0.06, 0.16, 0.044]}>
          <planeGeometry args={[0.1, 0.04]} />
          <meshBasicMaterial ref={dskyRef} color={SCENE_COLORS.screenGreen} />
        </mesh>
        <mesh position={[0.06, 0.16, 0.044]}>
          <planeGeometry args={[0.1, 0.04]} />
          <meshBasicMaterial color={SCENE_COLORS.screenGreen} />
        </mesh>
        {/* Numeric keypad matrix */}
        <mesh position={[0, -0.11, 0.042]}>
          <planeGeometry args={[0.26, 0.16]} />
          <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.4} />
        </mesh>
      </group>

      {/* Caution & Warning 16-Tile Matrix Annunciator */}
      <group position={[-0.75, 1.62, CABIN.front + 0.12]}>
        <mesh>
          <boxGeometry args={[0.34, 0.18, 0.06]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        {[-0.1, -0.03, 0.04, 0.11].flatMap((x) =>
          [-0.04, 0.04].map((y, i) => (
            <mesh key={`${x}${y}`} position={[x, y, 0.032]}>
              <planeGeometry args={[0.06, 0.06]} />
              <meshBasicMaterial
                color={
                  (x < 0 && y > 0)
                    ? SCENE_COLORS.screenAmber
                    : (x > 0 && y < 0)
                    ? SCENE_COLORS.screenGreen
                    : "#1E293B"
                }
              />
            </mesh>
          )),
        )}
      </group>

      {/* FDAI (Flight Director Attitude Indicator / 8-Ball) */}
      <group position={[-0.38, 1.25, CABIN.front + 0.12]}>
        <mesh>
          <boxGeometry args={[0.32, 0.32, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        {/* Outer Bezel */}
        <mesh position={[0, 0, 0.042]}>
          <ringGeometry args={[0.12, 0.14, 24]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} />
        </mesh>
        {/* Gimbal 8-Ball Sphere with contrasting dark/light hemispheres */}
        <group ref={fdaiRef} position={[0, 0, 0.02]}>
          <mesh>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.122, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#1E293B" roughness={0.4} />
          </mesh>
        </group>
      </group>

      {/* Radar Altimeter & Rate-of-Descent Meters */}
      <group position={[-0.38, 1.58, CABIN.front + 0.12]}>
        <mesh>
          <boxGeometry args={[0.32, 0.22, 0.06]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        {/* Dual Vertical Tape Scales */}
        {[-0.07, 0.07].map((x, i) => (
          <group key={x} position={[x, 0, 0.032]}>
            <mesh>
              <planeGeometry args={[0.08, 0.18]} />
              <meshBasicMaterial color="#0F172A" />
            </mesh>
            <mesh
              ref={(m) => {
                tapeMarks.current[i] = m;
              }}
              position={[0, 0.02, 0.002]}
            >
              <planeGeometry args={[0.07, 0.015]} />
              <meshBasicMaterial color={i === 0 ? SCENE_COLORS.screenCyan : SCENE_COLORS.screenGreen} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Animated Lunar Module Pilot (LMP) in authentic NASA Apollo/Artemis spacesuit */
function AstronautPilot() {
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const visorRef = useRef<MeshStandardMaterial>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock: r3fClock }) => {
    if (reduced) return;
    const t = r3fClock.elapsedTime;
    // Suit breathing motion
    if (root.current) {
      root.current.position.y = Math.sin(t * 1.6) * 0.008;
    }
    // Head examining descent checklist and scanning crater landmarks through the window
    if (head.current) {
      head.current.rotation.y = -0.3 + Math.sin(t * 0.7) * 0.22;
      head.current.rotation.x = 0.12 + Math.sin(t * 1.4) * 0.06;
    }
    // Left arm holding flight checklist pad
    if (leftArm.current) {
      leftArm.current.rotation.x = -0.65 + Math.sin(t * 1.2) * 0.04;
    }
  });

  return (
    <group ref={root} position={[0.78, 0, -0.15]} rotation={[0, -Math.PI / 4.8, 0]}>
      {/* Heavy Lunar Overshoes with ribbed silicone soles */}
      {[-0.14, 0.14].map((x) => (
        <group key={x} position={[x, 0.08, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.16, 0.32]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <boxGeometry args={[0.17, 0.04, 0.33]} />
            <meshStandardMaterial color="#334155" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Pressure Suit Legs */}
      {[-0.14, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.52, 0]}>
          <cylinderGeometry args={[0.11, 0.12, 0.74, 12]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.35} />
        </mesh>
      ))}

      {/* Torso: Pristine White Apollo/Artemis Pressure Suit */}
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[0.48, 0.65, 0.34]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.35} />
      </mesh>

      {/* Red & Blue Anodized Aluminum Umbilical Hose Connectors on Chest */}
      <mesh position={[-0.12, 1.26, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} metalness={0.8} />
      </mesh>
      <mesh position={[0.12, 1.26, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} metalness={0.8} />
      </mesh>

      {/* Chest-Mounted Remote Control Unit (RCU) with attitude control switches */}
      <group position={[0, 1.12, 0.2]}>
        <mesh>
          <boxGeometry args={[0.22, 0.18, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.04, 0.042]}>
          <cylinderGeometry args={[0.02, 0.02, 0.03, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.solarGold} />
        </mesh>
      </group>

      {/* PLSS (Portable Life Support System) Backpack */}
      <group position={[0, 1.22, -0.26]}>
        <mesh>
          <boxGeometry args={[0.42, 0.74, 0.24]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>
        {/* Oxygen purge valve */}
        <mesh position={[0.14, 0.28, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} metalness={0.6} />
        </mesh>
        {/* High-gain antenna whip */}
        <mesh position={[-0.16, 0.55, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.45, 6]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.9} />
        </mesh>
      </group>

      {/* Extravehicular Helmet & Gold Solar Sun Visor */}
      <group ref={head} position={[0, 1.64, 0]}>
        {/* White outer helmet shell */}
        <mesh>
          <sphereGeometry args={[0.19, 18, 18]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
        </mesh>
        {/* LEVA Gold reflective visor reflecting space & surface */}
        <mesh position={[0, 0.02, 0.1]}>
          <sphereGeometry args={[0.185, 18, 14, -Math.PI / 2.2, Math.PI / 1.1, 0, Math.PI / 1.4]} />
          <meshStandardMaterial
            ref={visorRef}
            color={SCENE_COLORS.solarGold}
            metalness={0.95}
            roughness={0.12}
          />
        </mesh>
      </group>

      {/* Left arm holding flight checklist book */}
      <group ref={leftArm} position={[-0.28, 1.35, 0]}>
        <mesh position={[0.08, -0.22, 0.18]} rotation={[-0.8, 0.4, 0]}>
          <cylinderGeometry args={[0.08, 0.09, 0.45, 10]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        {/* Glove */}
        <mesh position={[0.16, -0.38, 0.35]}>
          <boxGeometry args={[0.12, 0.12, 0.14]} />
          <meshStandardMaterial color="#0284C7" metalness={0.4} roughness={0.6} />
        </mesh>
        {/* Lunar Descent Checklist Binder */}
        <group position={[0.18, -0.38, 0.44]} rotation={[-0.6, 0.2, 0]}>
          <mesh>
            <boxGeometry args={[0.26, 0.34, 0.03]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
          </mesh>
          <mesh position={[0, 0, 0.018]}>
            <planeGeometry args={[0.22, 0.3]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      </group>

      {/* Right arm resting on console arm-brace */}
      <group position={[0.28, 1.35, 0]}>
        <mesh position={[-0.06, -0.22, 0.18]} rotation={[-0.7, -0.3, 0]}>
          <cylinderGeometry args={[0.08, 0.09, 0.45, 10]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[-0.12, -0.38, 0.35]}>
          <boxGeometry args={[0.12, 0.12, 0.14]} />
          <meshStandardMaterial color="#0284C7" metalness={0.4} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- console */

function Console({ view, stepsDone, armed, onPress }: LunarWorldProps) {
  return (
    <group>
      <mesh position={[0, CONSOLE.y - 0.5, CONSOLE.z]}>
        <boxGeometry args={[CONSOLE.width, 1, CONSOLE.depth]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* NASA Blue & white instrument panel face */}
      <mesh position={[0, CONSOLE.y + 0.01, CONSOLE.z]} rotation={[CONSOLE.tilt * 0.2, 0, 0]}>
        <boxGeometry args={[CONSOLE.width + 0.04, 0.03, CONSOLE.depth]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.55} roughness={0.35} />
      </mesh>
      <ContactLamp view={view} />
      {DESCENT_STEPS.map((step, i) => {
        const done = i < stepsDone;
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

/** Guarded toggle: plate, lamp, and lever */
function Switch({ done, armed }: { done: boolean; armed: boolean }) {
  const reduced = useReducedMotion();
  const lamp = useRef<MeshBasicMaterial>(null);

  useFrame((state) => {
    if (!lamp.current) return;
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

/** The contact light: dark until the probes touch, then it blinks until the engine is cut. */
function ContactLamp({ view }: { view: MutableRefObject<FlightView> }) {
  const reduced = useReducedMotion();
  const lamp = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (!lamp.current) return;
    const lit = view.current.contact && (reduced || view.current.engineOn || view.current.touchdownAt !== null || Math.sin(performance.now() * 0.012) > -0.3);
    lamp.current.color.set(lit ? SCENE_COLORS.screenCyan : SCENE_COLORS.steelMid);
  });
  return (
    <group position={[0, CONSOLE.y + 0.05, CONSOLE.z - 0.2]}>
      <mesh>
        <boxGeometry args={[0.34, 0.08, 0.06]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[0.28, 0.05]} />
        <meshBasicMaterial ref={lamp} color={SCENE_COLORS.steelMid} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- outside */

const SITE_COLOR: Record<SiteId, string> = {
  A: SCENE_COLORS.screenCyan,
  B: SCENE_COLORS.nasaRed,
  C: SCENE_COLORS.screenAmber,
};

type ViewRef = MutableRefObject<FlightView>;

function Outside({ view }: { view: ViewRef }) {
  const reduced = useReducedMotion();
  const root = useRef<Group>(null);
  const surface = useRef<Group>(null);
  const ground = useRef<Group>(null);
  const dust = useRef<Mesh>(null);
  const dustMat = useRef<MeshBasicMaterial>(null);
  const burst = useRef<Mesh>(null);
  const burstMat = useRef<MeshBasicMaterial>(null);

  const craters = useMemo(() => {
    const rand = seeded(11);
    const list: { x: number; z: number; r: number }[] = [];
    while (list.length < 75) {
      const x = (rand() - 0.5) * 320;
      const z = -rand() * 360 + 60;
      const r = 1 + rand() * rand() * 14;
      // Keep the landing strip (all three sites and the crater beside the far one) free of random craters.
      if (Math.hypot(x, z) < 14 || (Math.abs(z) < 18 + r && x > -44 - r && x < 24 + r)) continue;
      list.push({ x, z, r });
    }
    // The crater that makes the far site dangerous.
    list.push({ x: CRATER_CENTER_X, z: 0, r: CRATER_RADIUS });
    return list;
  }, []);

  const boulders = useMemo(() => {
    const rand = seeded(5);
    return Array.from({ length: 14 }, () => ({
      x: (rand() - 0.5) * 7.5,
      z: (rand() - 0.5) * 8.5,
      r: 0.35 + rand() * 0.85,
      rot: rand() * 3,
    }));
  }, []);

  // Distant jagged lunar mountains / crater rims on the horizon
  const mountains = useMemo(() => {
    const rand = seeded(21);
    return Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * Math.PI * 2;
      const dist = 240 + rand() * 40;
      const height = 18 + rand() * 32;
      const baseW = 35 + rand() * 30;
      return {
        x: Math.sin(angle) * dist,
        z: Math.cos(angle) * dist,
        height,
        baseW,
        rot: rand() * Math.PI,
      };
    });
  }, []);

  const stars = useMemo(() => {
    const rand = seeded(3);
    return Array.from({ length: 90 }, () => {
      const az = (rand() - 0.5) * 2.5;
      const el = 0.05 + rand() * 0.95;
      return [Math.sin(az) * 180 * Math.cos(el), Math.sin(el) * 180, -Math.cos(az) * 180 * Math.cos(el)] as const;
    });
  }, []);

  useFrame(() => {
    const v = view.current;
    const now = performance.now();

    if (root.current) {
      root.current.rotation.x = v.tilt;
      // The lander banks a little into its sideways drift.
      const roll = reduced ? 0 : -v.hsMs * 0.012;
      root.current.rotation.z += (roll - root.current.rotation.z) * 0.08;
    }
    if (surface.current) {
      surface.current.position.set(-v.xM, -visualAltitude(v.altM), -visualRange(v.altM));
    }
    if (ground.current) ground.current.position.x = v.xM;

    // Engine wash: a bright ring spreads under the lander in the last 30 m.
    if (dust.current && dustMat.current) {
      const k = v.engineOn && v.touchdownAt === null ? Math.min(1, v.throttle * 1.8) * Math.max(0, 1 - v.altM / 30) : 0;
      dust.current.visible = k > 0.01;
      dust.current.scale.setScalar(2 + k * 5.5);
      dustMat.current.opacity = 0.6 * k;
    }
    // Touchdown: one shock ring; a crash throws a bigger, longer one.
    if (burst.current && burstMat.current) {
      const dur = v.crashed ? 2.6 : 1.8;
      const age = v.touchdownAt === null ? -1 : (now - v.touchdownAt) / 1000;
      const on = age >= 0 && age < dur && !reduced;
      burst.current.visible = on;
      if (on) {
        const p = age / dur;
        burst.current.scale.setScalar((3 + 14 * (1 - (1 - p) * (1 - p))) * (v.crashed ? 1.7 : 1));
        burstMat.current.opacity = 0.75 * (1 - p);
      }
    }
  });

  return (
    <group ref={root} position={EYE}>
      <Starfield positions={stars} />

      {/* Milky Way panorama behind everything, plus the real Earth rising over the horizon */}
      <MilkyWay />
      <group position={[46, 34, -165]}>
        <Earth radius={12} />
      </group>

      {/* External RCS quads just outside the forward windows: they fire when the pilot drifts the lander sideways. */}
      <RcsQuad side={-1} view={view} />
      <RcsQuad side={1} view={view} />

      <group ref={surface}>
        {/* Silver-grey lunar regolith basalt plain */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -110]}>
          <planeGeometry args={[560, 560]} />
          <RegolithMaterial />
        </mesh>

        {/* Distant Lunar Mountain Ranges on the horizon */}
        {mountains.map((m, i) => (
          <mesh key={i} position={[m.x, m.height / 2, m.z]} rotation={[0, m.rot, 0]}>
            <coneGeometry args={[m.baseW, m.height, 6]} />
            <meshStandardMaterial color={SCENE_COLORS.lunarDark} roughness={0.9} flatShading />
          </mesh>
        ))}

        {/* Historic Surveyor probe / Apollo descent stage gleaming in distance */}
        <group position={[-42, 0.4, -90]}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[1.2, 1.2, 1.0, 8]} />
            <meshStandardMaterial color={SCENE_COLORS.kaptonGold} metalness={0.85} roughness={0.2} />
          </mesh>
          {/* High gain dish antenna */}
          <mesh position={[0.6, 2.0, 0]} rotation={[0.4, 0.8, 0]}>
            <cylinderGeometry args={[0.6, 0.05, 0.15, 12]} />
            <meshStandardMaterial color={SCENE_COLORS.spaceWhite} metalness={0.4} />
          </mesh>
        </group>

        {/* Impact craters with raised rims and dark central basins */}
        {craters.map((c, i) => (
          <group key={i} position={[c.x, 0, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
            {/* Crater bright rim with ejecta blanket */}
            <mesh position={[0, 0, 0.04]}>
              <ringGeometry args={[c.r * 0.82, c.r, 24]} />
              <meshStandardMaterial color={SCENE_COLORS.lunarLight} roughness={0.85} />
            </mesh>
            {/* Deep shadowy crater interior */}
            <mesh position={[0, 0, 0.03]}>
              <circleGeometry args={[c.r * 0.82, 24]} />
              <meshStandardMaterial color={SCENE_COLORS.lunarDark} roughness={0.95} />
            </mesh>
          </group>
        ))}

        {/* Hazard boulder field dead ahead of the lander (site B) */}
        {boulders.map((b, i) => (
          <mesh key={i} position={[b.x, b.r * 0.5, b.z]} rotation={[b.rot, b.rot * 0.7, 0]}>
            <dodecahedronGeometry args={[b.r, 0]} />
            <meshStandardMaterial color={SCENE_COLORS.lunarDark} roughness={0.95} flatShading />
          </mesh>
        ))}

        <SiteMarkers view={view} />
        <DustPlume view={view} />

        {/* Engine-wash ring and touchdown shock ring, following the lander sideways */}
        <group ref={ground}>
          <mesh ref={dust} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.4, 1, 24]} />
            <meshBasicMaterial ref={dustMat} color={SCENE_COLORS.lunarLight} transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh ref={burst} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.7, 1, 32]} />
            <meshBasicMaterial ref={burstMat} color={SCENE_COLORS.lunarLight} transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** One external RCS quad. The thruster on the left side pushes the lander right, and vice versa. */
function RcsQuad({ side, view }: { side: -1 | 1; view: ViewRef }) {
  const reduced = useReducedMotion();
  const plume = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);

  useFrame(() => {
    if (!plume.current || !mat.current) return;
    const rcs = view.current.rcs;
    const firing = !reduced && ((side === -1 && rcs === 1) || (side === 1 && rcs === -1));
    plume.current.visible = firing;
    if (firing) {
      const flicker = 0.7 + 0.25 * Math.sin(performance.now() * 0.05);
      mat.current.opacity = flicker;
      plume.current.scale.set(1, 0.8 + 0.4 * Math.sin(performance.now() * 0.07), 1);
    }
  });

  return (
    <group position={[side * 1.4, 0.8, -1.6]} rotation={[0, -side * 0.4, 0]}>
      <mesh>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
      </mesh>
      {/* 4 titanium thruster nozzles */}
      {[
        [0, 0.12, 0],
        [0, -0.12, 0],
        [0.12, 0, 0],
        [-0.12, 0, 0],
      ].map(([px, py, pz], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <cylinderGeometry args={[0.02, 0.05, 0.1, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.titanium} metalness={0.8} />
        </mesh>
      ))}
      {/* Cold-gas exhaust plume, pointing away from the lander */}
      <mesh ref={plume} position={[side * 0.25, 0, 0]} rotation={[0, 0, (side * -Math.PI) / 2]} visible={false}>
        <coneGeometry args={[0.09, 0.35, 12]} />
        <meshBasicMaterial ref={mat} color="#BFDBFE" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

/**
 * The three landing sites on the ground: a ring with a precision band, a light beam and a letter.
 * The chosen one pulses and its beam glows. Hazards are tinted red.
 */
function SiteMarkers({ view }: { view: ViewRef }) {
  const hazard = useRef<Group>(null);
  useFrame(() => {
    if (hazard.current) hazard.current.visible = view.current.showSites;
  });
  return (
    <>
      {SITES.map((s) => (
        <SiteMarker key={s.id} site={s} view={view} />
      ))}
      {/* The crater slope beside site C. */}
      <group ref={hazard} visible={false}>
        <mesh position={[CRATER_CENTER_X, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[CRATER_RADIUS + 0.6, 40]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaRed} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

function SiteMarker({ site, view }: { site: LandingSite; view: ViewRef }) {
  const reduced = useReducedMotion();
  const group = useRef<Group>(null);
  const pulse = useRef<Group>(null);
  const ring = useRef<MeshBasicMaterial>(null);
  const beam = useRef<MeshBasicMaterial>(null);
  const color = SITE_COLOR[site.id];
  // The letter label is DOM (drei Html ignores a hidden parent), so it is mounted only while the sites show.
  const [labelOn, setLabelOn] = useState(false);
  const labelRef = useRef(false);

  useFrame(() => {
    const v = view.current;
    if (group.current) group.current.visible = v.showSites;
    if (labelRef.current !== v.showSites) {
      labelRef.current = v.showSites;
      setLabelOn(v.showSites);
    }
    const selected = v.siteId === site.id;
    const s = reduced ? 1 : 0.75 + 0.25 * Math.sin(performance.now() * 0.003);
    if (ring.current) ring.current.opacity = selected ? 0.55 + 0.4 * s : 0.4;
    // Fades out over the last 30 m: right above the site the beam would be a wall across the window.
    const near = Math.min(1, v.altM / 30);
    if (beam.current) beam.current.opacity = (selected ? 0.28 * s : 0.08) * near;
    if (pulse.current) pulse.current.scale.setScalar(selected && !reduced ? 1 + 0.06 * Math.sin(performance.now() * 0.003) : 1);
  });

  return (
    <group ref={group} position={[site.x, 0.09, 0]} visible={false}>
      <group ref={pulse} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[1.7, 2.1, 40]} />
          <meshBasicMaterial ref={ring} color={color} transparent depthWrite={false} />
        </mesh>
        {[0, 1].map((k) => (
          <mesh key={k} rotation={[0, 0, k * (Math.PI / 2)]}>
            <planeGeometry args={[1.3, 0.16]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} />
          </mesh>
        ))}
        {/* The 3 m precision ring */}
        <mesh>
          <ringGeometry args={[PRECISION_M - 0.07, PRECISION_M, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
        </mesh>
        {site.terrain === "boulders" && (
          <mesh position={[0, 0, -0.02]}>
            <circleGeometry args={[BOULDER_HALF_WIDTH + 0.6, 40]} />
            <meshBasicMaterial color={SCENE_COLORS.nasaRed} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        )}
      </group>
      {/* Beacon beam */}
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 14, 8, 1, true]} />
        <meshBasicMaterial ref={beam} color={color} transparent depthWrite={false} blending={AdditiveBlending} side={DoubleSide} />
      </mesh>
      {labelOn && (
        <Html center position={[0, 2.8, 0]} style={{ pointerEvents: "none" }} zIndexRange={[5, 0]}>
          <span
            className="flex h-6 w-6 items-center justify-center border text-xs font-bold text-space-deep"
            style={{ background: color, borderColor: "#0B192C" }}
          >
            {site.id}
          </span>
        </Html>
      )}
    </group>
  );
}

/** A soft round sprite for the dust, drawn once. */
function makeDustSprite(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const DUST_COUNT = 160;

/**
 * Regolith kicked up by the engine: particles streaming out from under the lander along the
 * ground, denser the harder the engine works and the closer the ground is. Follows the lander sideways.
 */
function DustPlume({ view }: { view: ViewRef }) {
  const reduced = useReducedMotion();
  const group = useRef<Group>(null);
  const points = useRef<Points>(null);
  const mat = useRef<PointsMaterial>(null);

  const seeds = useMemo(() => {
    const rand = seeded(77);
    return Array.from({ length: DUST_COUNT }, () => ({ a: rand() * Math.PI * 2, s: 0.4 + rand() * 0.6, ph: rand(), up: rand() }));
  }, []);
  const positions = useMemo(() => new Float32Array(DUST_COUNT * 3), []);
  const sprite = useMemo(() => makeDustSprite(), []);

  useFrame(() => {
    const v = view.current;
    if (!group.current || !points.current || !mat.current) return;
    const wash = v.engineOn && v.touchdownAt === null ? Math.min(1, v.throttle * 1.8) * Math.max(0, 1 - v.altM / 40) : 0;
    // After touchdown the cloud settles for a moment instead of vanishing.
    const settle = v.touchdownAt === null ? 0 : Math.max(0, 1 - (performance.now() - v.touchdownAt) / 2200) * (v.crashed ? 1 : 0.7);
    const k = Math.max(wash, settle);
    group.current.visible = !reduced && k > 0.02;
    if (!group.current.visible) return;
    group.current.position.x = v.xM;

    const t = performance.now() / 1000;
    for (let i = 0; i < DUST_COUNT; i++) {
      const sd = seeds[i];
      const life = (t * 0.5 + sd.ph) % 1;
      const r = 0.8 + life * 13 * sd.s * (0.5 + k);
      positions[i * 3] = Math.cos(sd.a) * r;
      positions[i * 3 + 1] = 0.15 + Math.sin(life * Math.PI) * 1.1 * sd.up * (0.4 + k);
      positions[i * 3 + 2] = Math.sin(sd.a) * r * 0.75;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    mat.current.opacity = 0.55 * k;
    mat.current.size = 1.2 + k * 1.6;
  });

  return (
    <group ref={group} visible={false}>
      <points ref={points} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={mat}
          map={sprite}
          color={SCENE_COLORS.lunarLight}
          size={1.4}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

const MILKY_TINT = new Color(2.4, 2.5, 2.9);

/** NASA/ESA Milky Way panorama on a huge inverted sphere; never occludes or gets fogged. */
function MilkyWay() {
  const tex = useTexture("/assets/textures/milky_way_4k.jpg", (t) => {
    t.colorSpace = SRGBColorSpace;
  });
  return (
    <mesh rotation={[0.5, 0.4, 0]} renderOrder={-1}>
      <sphereGeometry args={[420, 48, 32]} />
      <meshBasicMaterial map={tex} side={BackSide} depthWrite={false} toneMapped={false} color={MILKY_TINT} />
    </mesh>
  );
}

/** Lunar regolith: the LRO-derived Moon map mirror-tiled over the plain so no seams show. */
function RegolithMaterial() {
  const tex = useTexture("/assets/textures/moon_4k.jpg", (t) => {
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = MirroredRepeatWrapping;
    t.repeat.set(10, 10);
    t.anisotropy = 16;
  });
  return <meshStandardMaterial map={tex} color="#D4D4DA" roughness={0.97} metalness={0} bumpMap={tex} bumpScale={1.2} />;
}
