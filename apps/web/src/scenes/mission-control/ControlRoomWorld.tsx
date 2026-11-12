"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, DoubleSide, type Group, type MeshBasicMaterial } from "three";
import { LightingRig } from "@/components/viewport/LightingRig";
import { Starfield } from "@/components/viewport/Starfield";
import { seeded } from "@/lib/random";
import { addTrauma } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";
import { GROUND_Y, PAD, ROCKET_HEIGHT, ROOM, TIER, WINDOW } from "./layout";

interface ControlRoomWorldProps {
  /** performance.now() at ignition (T-0), or null while the rocket waits on the pad. */
  ignitionAt: number | null;
}

/** Seconds of engine build-up before the clamps release. */
const HOLD_DOWN = 1.2;
/** Visual climb acceleration (m/s²): slow enough to read, fast enough to feel heavy. */
const CLIMB = 3.5;

/**
 * Scene 3 geometry: the control room's back tier and front row, the window, and outside the
 * rocket on its pad at dawn. The launch itself is DOM-driven; this only plays the liftoff.
 */
export function ControlRoomWorld({ ignitionAt }: ControlRoomWorldProps) {
  return (
    <>
      <LightingRig />
      <Room />
      <Consoles />
      <MissionStaff />
      <Outside />
      {/* Remount per launch so smoke and position reset for the replacement vehicle. */}
      <LaunchPad key={ignitionAt ?? "idle"} ignitionAt={ignitionAt} />
    </>
  );
}

/* ---------------------------------------------------------------- inside */

function Room() {
  const w = ROOM.maxX - ROOM.minX;
  const d = ROOM.maxZ - ROOM.minZ;
  const cz = (ROOM.minZ + ROOM.maxZ) / 2;
  const h = ROOM.height;
  const sideW = (w - (WINDOW.maxX - WINDOW.minX)) / 2;
  return (
    <group>
      {/* Anti-static slate floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.75} metalness={0.15} />
      </mesh>
      {/* Center NASA Blue aisle walkway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -0.5]}>
        <planeGeometry args={[2.6, d - 2]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.85} />
      </mesh>
      {/* Acoustic light ceiling with recessed lighting panels */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.8} />
      </mesh>
      {[-3.2, 0, 3.2].map((x) => (
        <mesh key={x} rotation={[Math.PI / 2, 0, 0]} position={[x, h - 0.02, -0.6]}>
          <planeGeometry args={[1.6, 0.5]} />
          <meshBasicMaterial color={SCENE_COLORS.spaceWhite} />
        </mesh>
      ))}
      {/* Raised back tier the director sits on */}
      <mesh position={[0, TIER.y / 2, (TIER.frontZ + ROOM.maxZ) / 2]}>
        <boxGeometry args={[w, TIER.y, ROOM.maxZ - TIER.frontZ]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[0, TIER.y + 0.01, TIER.frontZ + 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 0.1]} />
        <meshBasicMaterial color={SCENE_COLORS.solarGold} />
      </mesh>
      {/* Front wall: bright aerospace wall panel with NASA blue dado & dark window frame */}
      <mesh position={[0, WINDOW.bottom / 2, ROOM.minZ]}>
        <boxGeometry args={[w, WINDOW.bottom, 0.2]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.6} />
      </mesh>
      {/* NASA Blue & Red racing stripe along lower wall */}
      <mesh position={[0, WINDOW.bottom - 0.18, ROOM.minZ + 0.11]}>
        <boxGeometry args={[w, 0.12, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      <mesh position={[0, WINDOW.bottom - 0.09, ROOM.minZ + 0.11]}>
        <boxGeometry args={[w, 0.04, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
      {/* Upper header wall */}
      <mesh position={[0, (WINDOW.top + h) / 2, ROOM.minZ]}>
        <boxGeometry args={[w, h - WINDOW.top, 0.2]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWall} roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WINDOW.maxX + sideW / 2), (WINDOW.bottom + WINDOW.top) / 2, ROOM.minZ]}>
          <boxGeometry args={[sideW, WINDOW.top - WINDOW.bottom, 0.2]} />
          <meshStandardMaterial color={SCENE_COLORS.cleanroomWall} roughness={0.6} />
        </mesh>
      ))}
      {/* Brushed steel window mullions */}
      {[-2.4, 2.6].map((x) => (
        <mesh key={x} position={[x, (WINDOW.bottom + WINDOW.top) / 2, ROOM.minZ]}>
          <boxGeometry args={[0.12, WINDOW.top - WINDOW.bottom, 0.14]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Side and back walls */}
      {[ROOM.minX, ROOM.maxX].map((x) => (
        <mesh key={x} position={[x, h / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, h / 2, ROOM.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** A realistic multi-monitor flight controller console desk with keyboards, switches & chairs. */
function Desk({ position, width, screens }: { position: [number, number, number]; width: number; screens: number }) {
  const slots = Array.from({ length: screens }, (_, i) => (i + 0.5) * (width / screens) - width / 2);
  return (
    <group position={position}>
      {/* Sleek charcoal metallic cabinet base */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[width, 0.8, 0.7]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.35} roughness={0.55} />
      </mesh>
      {/* NASA Blue front accent band */}
      <mesh position={[0, 0.65, 0.355]}>
        <boxGeometry args={[width, 0.12, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.4} />
      </mesh>
      {/* Crisp white worktop */}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.84]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} metalness={0.05} />
      </mesh>
      {/* Desk props: keyboards, status lamps, red abort button & coffee mug */}
      {slots.map((x, i) => (
        <group key={x}>
          {/* Monitor housing */}
          <group position={[x, 1.1, -0.18]} rotation={[-0.18, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.66, 0.44, 0.06]} />
              <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.4} roughness={0.5} />
            </mesh>
            {/* Dark glass screen */}
            <mesh position={[0, 0, 0.032]}>
              <planeGeometry args={[0.58, 0.36]} />
              <meshBasicMaterial color={SCENE_COLORS.screenGlass} />
            </mesh>
            {/* Multi-colored telemetry data: cyan bars, green GO lamp, gold waveform */}
            <mesh position={[-0.15, 0.1, 0.035]}>
              <planeGeometry args={[0.2, 0.03]} />
              <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
            </mesh>
            <mesh position={[0.18, 0.1, 0.035]}>
              <planeGeometry args={[0.1, 0.03]} />
              <meshBasicMaterial color={i % 2 === 0 ? SCENE_COLORS.screenGreen : SCENE_COLORS.screenAmber} />
            </mesh>
            <mesh position={[0, 0.01, 0.035]}>
              <planeGeometry args={[0.46, 0.02]} />
              <meshBasicMaterial color={i % 3 === 0 ? SCENE_COLORS.solarGold : SCENE_COLORS.screenCyan} />
            </mesh>
            <mesh position={[-0.08, -0.07, 0.035]}>
              <planeGeometry args={[0.3, 0.025]} />
              <meshBasicMaterial color={SCENE_COLORS.screenGreen} />
            </mesh>
            <mesh position={[0.19, -0.07, 0.035]}>
              <planeGeometry args={[0.08, 0.025]} />
              <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
            </mesh>
          </group>

          {/* Keyboard pad */}
          <mesh position={[x, 0.855, 0.15]} rotation={[0.06, 0, 0]}>
            <boxGeometry args={[0.36, 0.02, 0.14]} />
            <meshStandardMaterial color={SCENE_COLORS.steelMid} roughness={0.6} />
          </mesh>
          {/* Red & Green physical switches next to keyboard */}
          <mesh position={[x + 0.24, 0.855, 0.14]}>
            <boxGeometry args={[0.04, 0.025, 0.04]} />
            <meshBasicMaterial color={i === 1 ? SCENE_COLORS.nasaRed : SCENE_COLORS.screenGreen} />
          </mesh>
        </group>
      ))}
      {/* Swivel operator chair */}
      <group position={[0, 0, 0.65]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.48, 0.07, 0.46]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.78, 0.2]}>
          <boxGeometry args={[0.44, 0.56, 0.07]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.42, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function Consoles() {
  return (
    <group>
      {/* Front row on the main floor */}
      <Desk position={[-3.4, 0, -1.6]} width={2.8} screens={3} />
      <Desk position={[0, 0, -1.6]} width={2.8} screens={3} />
      <Desk position={[3.4, 0, -1.6]} width={2.8} screens={3} />
    </group>
  );
}

/* ---------------------------------------------------------------- staff */

/** Flight controllers seated at the consoles + NASA engineers walking back and forth. */
function MissionStaff() {
  return (
    <group>
      {/* Seated flight controllers operating the consoles with headsets */}
      <SeatedOperator position={[-3.4, 0, -0.95]} shirtColor={SCENE_COLORS.spaceWhite} tieColor={SCENE_COLORS.nasaBlue} phase={0} />
      <SeatedOperator position={[0, 0, -0.95]} shirtColor={SCENE_COLORS.nasaBlue} tieColor={SCENE_COLORS.nasaRed} phase={1.7} />
      <SeatedOperator position={[3.4, 0, -0.95]} shirtColor={SCENE_COLORS.spaceWhite} tieColor={SCENE_COLORS.steelDark} phase={3.1} />

      {/* Walking engineers patrolling the main aisle and window corridor */}
      <WalkingStaff
        z={0.25}
        minX={-4.6}
        maxX={4.6}
        speed={1.25}
        phase={0.2}
        shirtColor={SCENE_COLORS.spaceWhite}
        pantsColor={SCENE_COLORS.steelDark}
        badgeColor={SCENE_COLORS.nasaBlue}
        prop="clipboard"
      />
      <WalkingStaff
        z={-2.55}
        minX={-4.8}
        maxX={-0.6}
        speed={1.05}
        phase={2.1}
        shirtColor={SCENE_COLORS.nasaBlue}
        pantsColor="#64748B"
        badgeColor={SCENE_COLORS.nasaRed}
        prop="tablet"
      />
      <WalkingStaff
        z={-2.55}
        minX={0.8}
        maxX={4.8}
        speed={1.15}
        phase={4.3}
        shirtColor={SCENE_COLORS.nasaBlueBright}
        pantsColor={SCENE_COLORS.steelDark}
        badgeColor={SCENE_COLORS.solarGold}
        prop="clipboard"
      />
    </group>
  );
}

/** Flight controller seated on a console chair, typing and checking monitors. */
function SeatedOperator({
  position,
  shirtColor,
  tieColor,
  phase,
}: {
  position: [number, number, number];
  shirtColor: string;
  tieColor: string;
  phase: number;
}) {
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime + phase;
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.75) * 0.24;
      head.current.rotation.x = Math.sin(t * 1.1) * 0.05;
    }
    if (leftArm.current) leftArm.current.rotation.x = -0.75 + Math.sin(t * 6.5) * 0.06;
    if (rightArm.current) rightArm.current.rotation.x = -0.75 + Math.cos(t * 7.2) * 0.06;
  });

  return (
    <group position={position}>
      {/* Bent legs resting on floor */}
      {[-0.1, 0.1].map((lx) => (
        <group key={lx} position={[lx, 0.45, -0.05]}>
          <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.13, 0.34, 0.13]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.22, -0.28]}>
            <boxGeometry args={[0.12, 0.42, 0.12]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Torso */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.36, 0.46, 0.2]} />
        <meshStandardMaterial color={shirtColor} roughness={0.65} />
      </mesh>
      {/* Tie / Collar accent */}
      <mesh position={[0, 0.76, -0.105]}>
        <boxGeometry args={[0.06, 0.28, 0.02]} />
        <meshStandardMaterial color={tieColor} />
      </mesh>
      {/* Head + Hair + Comms Headset */}
      <group ref={head} position={[0, 1.07, 0]}>
        <mesh>
          <boxGeometry args={[0.2, 0.22, 0.2]} />
          <meshStandardMaterial color="#E2B49A" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.09, 0.02]}>
          <boxGeometry args={[0.21, 0.08, 0.22]} />
          <meshStandardMaterial color="#1E293B" roughness={0.85} />
        </mesh>
        {/* Headset band & ear cups */}
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.24, 0.03, 0.04]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        <mesh position={[-0.11, 0, 0]}>
          <boxGeometry args={[0.03, 0.09, 0.09]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
        <mesh position={[0.11, 0, 0]}>
          <boxGeometry args={[0.03, 0.09, 0.09]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
      </group>
      {/* Arms typing at keyboard */}
      <group ref={leftArm} position={[-0.22, 0.88, -0.02]}>
        <mesh position={[0, -0.18, 0]}>
          <boxGeometry args={[0.1, 0.36, 0.1]} />
          <meshStandardMaterial color={shirtColor} roughness={0.65} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.22, 0.88, -0.02]}>
        <mesh position={[0, -0.18, 0]}>
          <boxGeometry args={[0.1, 0.36, 0.1]} />
          <meshStandardMaterial color={shirtColor} roughness={0.65} />
        </mesh>
      </group>
    </group>
  );
}

/** Animated NASA engineer walking back and forth with arm/leg stride and clipboard or tablet. */
function WalkingStaff({
  z,
  minX,
  maxX,
  speed,
  phase,
  shirtColor,
  pantsColor,
  badgeColor,
  prop,
}: {
  z: number;
  minX: number;
  maxX: number;
  speed: number;
  phase: number;
  shirtColor: string;
  pantsColor: string;
  badgeColor: string;
  prop: "clipboard" | "tablet";
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (!root.current) return;
    const mid = (minX + maxX) / 2;
    const amp = (maxX - minX) / 2;
    if (reduced) {
      root.current.position.set(mid, 0, z);
      return;
    }

    // Smooth ping-pong walk using a clamped triangle-like wave with brief inspection pauses at ends
    const t = clock.elapsedTime * speed * 0.45 + phase;
    const rawSin = Math.sin(t);
    const clamped = Math.max(-0.96, Math.min(0.96, rawSin * 1.15)) / 0.96;
    const x = mid + clamped * amp;
    const vel = Math.cos(t);
    const moving = Math.abs(rawSin * 1.15) < 0.96;

    root.current.position.set(x, 0, z);
    // Face +X (PI/2) or -X (-PI/2) smoothly
    const targetYaw = vel >= 0 ? Math.PI / 2 : -Math.PI / 2;
    root.current.rotation.y = targetYaw;

    const stride = moving ? Math.sin(clock.elapsedTime * speed * 5.2 + phase) : 0;
    const bob = moving ? Math.abs(stride) * 0.03 : 0;

    if (body.current) body.current.position.y = bob;
    if (leftLeg.current) leftLeg.current.rotation.x = stride * 0.48;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride * 0.48;
    if (leftArm.current) leftArm.current.rotation.x = -stride * 0.35;
    if (rightArm.current) rightArm.current.rotation.x = -0.55 + stride * 0.12;
  });

  return (
    <group ref={root} position={[(minX + maxX) / 2, 0, z]}>
      <group ref={body}>
        {/* Legs */}
        <group ref={leftLeg} position={[-0.1, 0.72, 0]}>
          <mesh position={[0, -0.34, 0]}>
            <boxGeometry args={[0.14, 0.68, 0.14]} />
            <meshStandardMaterial color={pantsColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.69, 0.03]}>
            <boxGeometry args={[0.14, 0.07, 0.22]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.1, 0.72, 0]}>
          <mesh position={[0, -0.34, 0]}>
            <boxGeometry args={[0.14, 0.68, 0.14]} />
            <meshStandardMaterial color={pantsColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.69, 0.03]}>
            <boxGeometry args={[0.14, 0.07, 0.22]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>

        {/* Torso */}
        <mesh position={[0, 1.04, 0]}>
          <boxGeometry args={[0.38, 0.52, 0.22]} />
          <meshStandardMaterial color={shirtColor} roughness={0.65} />
        </mesh>
        {/* NASA ID Lanyard Badge */}
        <mesh position={[0.09, 1.1, 0.115]}>
          <planeGeometry args={[0.07, 0.1]} />
          <meshBasicMaterial color={badgeColor} />
        </mesh>

        {/* Head + Hair + Headset */}
        <group position={[0, 1.44, 0]}>
          <mesh>
            <boxGeometry args={[0.21, 0.23, 0.21]} />
            <meshStandardMaterial color="#E2B49A" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.1, -0.01]}>
            <boxGeometry args={[0.22, 0.08, 0.23]} />
            <meshStandardMaterial color="#1E293B" roughness={0.85} />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArm} position={[-0.25, 1.24, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <boxGeometry args={[0.11, 0.44, 0.11]} />
            <meshStandardMaterial color={shirtColor} roughness={0.65} />
          </mesh>
        </group>

        {/* Right Arm holding Clipboard or Glowing Telemetry Tablet */}
        <group ref={rightArm} position={[0.25, 1.24, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <boxGeometry args={[0.11, 0.44, 0.11]} />
            <meshStandardMaterial color={shirtColor} roughness={0.65} />
          </mesh>
          <mesh position={[0, -0.44, 0.14]} rotation={[Math.PI / 3, 0, 0]}>
            <boxGeometry args={[0.22, 0.28, 0.03]} />
            <meshStandardMaterial color={prop === "tablet" ? SCENE_COLORS.steelDark : "#92400E"} />
          </mesh>
          {prop === "tablet" && (
            <mesh position={[0, -0.43, 0.155]} rotation={[Math.PI / 3, 0, 0]}>
              <planeGeometry args={[0.18, 0.22]} />
              <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- outside */

function Outside() {
  const stars = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: 85 }, () => [(rand() - 0.5) * 420, 48 + rand() * 115, -210 - rand() * 35] as const);
  }, []);

  return (
    <group>
      {/* Seamless atmospheric dawn sky dome & ocean horizon */}
      <SkyAndOcean />
      <Starfield positions={stars} />
      <DriftingClouds />

      {/* Coastal Florida Space Coast Terrain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, -100]}>
        <planeGeometry args={[900, 260]} />
        <meshStandardMaterial color={SCENE_COLORS.grass} roughness={0.95} />
      </mesh>
      {/* Lighter coastal grass / sand dunes near shore */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-45, GROUND_Y + 0.008, -145]}>
        <planeGeometry args={[240, 80]} />
        <meshStandardMaterial color={SCENE_COLORS.grassLight} roughness={0.95} />
      </mesh>

      {/* Roadways, Crawlerway & Concrete Apron */}
      <RoadNetwork />

      {/* Fuel Farm, Radar Dishes, Perimeter Towers & Coastal Trees */}
      <SpaceportFacilities />

      {/* Crawler-Transporter, Fuel Tankers, Red Fire Trucks & Moving Crew Astrovan */}
      <SupportVehicles />
    </group>
  );
}

/** Curved multi-band sky dome + distant Atlantic Ocean horizon so edges never clip. */
function SkyAndOcean() {
  return (
    <group>
      {/* Deep cosmic upper sky dome */}
      <mesh position={[0, GROUND_Y, -20]}>
        <sphereGeometry args={[360, 32, 16]} />
        <meshBasicMaterial color={SCENE_COLORS.skyUpper} side={BackSide} />
      </mesh>
      {/* Curved atmospheric bands wrapping around horizon */}
      <mesh position={[0, GROUND_Y + 34, -20]}>
        <cylinderGeometry args={[340, 340, 44, 48, 1, true]} />
        <meshBasicMaterial color={SCENE_COLORS.skyMid} side={BackSide} />
      </mesh>
      <mesh position={[0, GROUND_Y + 10, -20]}>
        <cylinderGeometry args={[335, 335, 20, 48, 1, true]} />
        <meshBasicMaterial color={SCENE_COLORS.skyHorizon} side={BackSide} />
      </mesh>
      {/* Warm dawn glow along the eastern horizon */}
      <mesh position={[-70, GROUND_Y + 4, -245]} rotation={[0, 0.2, 0]}>
        <planeGeometry args={[280, 10]} />
        <meshBasicMaterial color={SCENE_COLORS.dawnGlow} transparent opacity={0.85} />
      </mesh>
      <mesh position={[-75, GROUND_Y + 1.8, -240]} rotation={[0, 0.2, 0]}>
        <planeGeometry args={[120, 4]} />
        <meshBasicMaterial color={SCENE_COLORS.sunCore} />
      </mesh>
      {/* Atlantic Ocean horizon strip beyond the coastal scrubland */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y - 0.05, -260]}>
        <planeGeometry args={[900, 120]} />
        <meshStandardMaterial color="#1E4B7A" roughness={0.35} metalness={0.2} />
      </mesh>
    </group>
  );
}

/** Multi-puff 3D clouds gently drifting across the dawn sky. */
function DriftingClouds() {
  const group = useRef<Group>(null);
  const reduced = useReducedMotion();

  const clouds = useMemo(
    () => [
      { pos: [-78, GROUND_Y + 26, -155] as const, s: 1.5 },
      { pos: [-28, GROUND_Y + 34, -175] as const, s: 1.8 },
      { pos: [38, GROUND_Y + 28, -160] as const, s: 1.6 },
      { pos: [88, GROUND_Y + 23, -150] as const, s: 1.35 },
      { pos: [-110, GROUND_Y + 20, -145] as const, s: 1.2 },
      { pos: [12, GROUND_Y + 40, -195] as const, s: 2.1 },
    ],
    [],
  );

  useFrame(({ clock }) => {
    if (!group.current || reduced) return;
    group.current.position.x = Math.sin(clock.elapsedTime * 0.04) * 14;
  });

  return (
    <group ref={group}>
      {clouds.map((c, idx) => (
        <group key={idx} position={c.pos} scale={c.s}>
          {/* Lower sunlit warm cloud base */}
          <mesh position={[0, -0.7, 0]} scale={[3.4, 0.85, 1.3]}>
            <icosahedronGeometry args={[1.6, 1]} />
            <meshStandardMaterial color="#FED7AA" roughness={0.95} flatShading />
          </mesh>
          {/* Upper fluffy white puffs */}
          <mesh position={[-2.2, 0.3, 0.2]} scale={[1.6, 1.1, 1.2]}>
            <icosahedronGeometry args={[1.5, 1]} />
            <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0.2, 0.9, -0.1]} scale={[2.0, 1.35, 1.4]}>
            <icosahedronGeometry args={[1.6, 1]} />
            <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[2.6, 0.2, 0.3]} scale={[1.5, 1.0, 1.1]}>
            <icosahedronGeometry args={[1.4, 1]} />
            <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Main highway, cross service road, perimeter loop, crawlerway, and dashed markings. */
function RoadNetwork() {
  const dashes = useMemo(() => Array.from({ length: 14 }, (_, i) => -22 - i * 5), []);
  const crossDashes = useMemo(() => Array.from({ length: 24 }, (_, i) => -58 + i * 5), []);

  return (
    <group>
      {/* Concrete Launch Pad Apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PAD[0], GROUND_Y + 0.018, PAD[2]]}>
        <planeGeometry args={[46, 38]} />
        <meshStandardMaterial color={SCENE_COLORS.concreteFloor} roughness={0.85} />
      </mesh>
      {/* Pad Apron Perimeter Curb / Yellow Safety Border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PAD[0], GROUND_Y + 0.022, PAD[2] + 18.8]}>
        <planeGeometry args={[46, 0.35]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>

      {/* Main Asphalt Access Road leading straight from Control Room to Pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, GROUND_Y + 0.02, -62]}>
        <planeGeometry args={[4.4, 92]} />
        <meshStandardMaterial color={SCENE_COLORS.asphalt} roughness={0.9} />
      </mesh>
      {/* Road concrete shoulders */}
      {[-2.4, 2.4].map((dx) => (
        <mesh key={dx} rotation={[-Math.PI / 2, 0, 0]} position={[3 + dx, GROUND_Y + 0.019, -62]}>
          <planeGeometry args={[0.45, 92]} />
          <meshStandardMaterial color={SCENE_COLORS.concreteFloor} roughness={0.85} />
        </mesh>
      ))}
      {/* Dashed yellow center line on Main Road */}
      {dashes.map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[3, GROUND_Y + 0.025, z]}>
          <planeGeometry args={[0.15, 2.4]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
      ))}

      {/* Cross Service Road running East-West across the Spaceport (z = -56) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y + 0.022, -56]}>
        <planeGeometry args={[180, 4.6]} />
        <meshStandardMaterial color={SCENE_COLORS.asphalt} roughness={0.9} />
      </mesh>
      {crossDashes.map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, GROUND_Y + 0.026, -56]}>
          <planeGeometry args={[2.4, 0.15]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
      ))}

      {/* Service Road branch to Cryogenic Fuel Farm & Radar Station */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-26, GROUND_Y + 0.021, -70]}>
        <planeGeometry args={[3.4, 28]} />
        <meshStandardMaterial color={SCENE_COLORS.asphalt} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[34, GROUND_Y + 0.021, -64]}>
        <planeGeometry args={[3.4, 16]} />
        <meshStandardMaterial color={SCENE_COLORS.asphalt} roughness={0.9} />
      </mesh>

      {/* Twin-Track Heavy Gravel Crawlerway coming from the VAB */}
      <group position={[-12, GROUND_Y + 0.016, -72]} rotation={[0, 0.45, 0]}>
        {[-2.2, 2.2].map((dx) => (
          <mesh key={dx} rotation={[-Math.PI / 2, 0, 0]} position={[dx, 0, 0]}>
            <planeGeometry args={[2.6, 56]} />
            <meshStandardMaterial color="#9CA3AF" roughness={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Fuel tanks, pipelines, rotating radar dishes, perimeter floodlight masts, and coastal trees. */
function SpaceportFacilities() {
  const dish1 = useRef<Group>(null);
  const dish2 = useRef<Group>(null);
  const reduced = useReducedMotion();

  const trees = useMemo(() => {
    const rand = seeded(42);
    const list: { x: number; z: number; h: number }[] = [];
    for (let i = 0; i < 45; i++) {
      const x = (rand() - 0.5) * 165;
      const z = -34 - rand() * 88;
      // Keep roads and concrete apron clear of trees
      if (Math.abs(x - 3) < 7 || Math.abs(z + 56) < 7) continue;
      if (Math.abs(x - PAD[0]) < 28 && Math.abs(z - PAD[2]) < 24) continue;
      if (Math.abs(x + 26) < 11 && Math.abs(z + 78) < 12) continue;
      if (Math.abs(x - 34) < 10 && Math.abs(z + 68) < 10) continue;
      list.push({ x, z, h: 2.2 + rand() * 2.4 });
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    if (dish1.current) dish1.current.rotation.y = Math.sin(t * 0.35) * 0.45 - 0.5;
    if (dish2.current) dish2.current.rotation.y = Math.cos(t * 0.28) * 0.4 + 0.4;
  });

  return (
    <group>
      {/* Cryogenic Fuel Farm (LOX & LH2 White Spheres + Piping to Pad) */}
      <group position={[-26, GROUND_Y, -78]}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[14, 0.3, 10]} />
          <meshStandardMaterial color={SCENE_COLORS.concreteFloor} roughness={0.85} />
        </mesh>
        {[-3.4, 3.4].map((dx, i) => (
          <group key={dx} position={[dx, 0, 0]}>
            <mesh position={[0, 3.2, 0]}>
              <sphereGeometry args={[2.5, 20, 14]} />
              <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.35} metalness={0.15} />
            </mesh>
            {/* NASA Blue equator band on fuel tank */}
            <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.51, 0.12, 8, 24]} />
              <meshStandardMaterial color={i === 0 ? SCENE_COLORS.nasaBlue : SCENE_COLORS.nasaRed} />
            </mesh>
            {/* Support legs */}
            {[0, 1, 2, 3].map((k) => {
              const a = (k * Math.PI) / 2 + Math.PI / 4;
              return (
                <mesh key={k} position={[Math.cos(a) * 1.6, 1.5, Math.sin(a) * 1.6]}>
                  <cylinderGeometry args={[0.14, 0.18, 3.0, 8]} />
                  <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.5} />
                </mesh>
              );
            })}
          </group>
        ))}
        {/* Cryo pipeline connecting fuel farm to launch pad */}
        <mesh position={[15, 0.65, -5]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 20, 10]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} roughness={0.25} />
        </mesh>
      </group>

      {/* Telemetry & Radar Tracking Station (Right of Pad) */}
      <group position={[34, GROUND_Y, -68]}>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[9, 2.8, 6]} />
          <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.85, 0]}>
          <boxGeometry args={[9.3, 0.2, 6.3]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
        {[-2.4, 2.4].map((dx, i) => (
          <group key={dx} position={[dx, 2.95, 0]}>
            <mesh position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.3, 0.45, 1.8, 10]} />
              <meshStandardMaterial color={SCENE_COLORS.steelMid} />
            </mesh>
            <group ref={i === 0 ? dish1 : dish2} position={[0, 2.0, 0]} rotation={[-0.45, 0, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[1.6, 0.35, 0.7, 16, 1, true]} />
                <meshStandardMaterial color={SCENE_COLORS.spaceWhite} side={DoubleSide} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0, 0.85]}>
                <sphereGeometry args={[0.16, 8, 8]} />
                <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* 4 Pad Corner Floodlight Towers */}
      {[
        [-18, -15],
        [18, -15],
        [-18, 15],
        [18, 15],
      ].map(([dx, dz], idx) => (
        <group key={idx} position={[PAD[0] + dx, GROUND_Y, PAD[2] + dz]}>
          <mesh position={[0, 7.5, 0]}>
            <cylinderGeometry args={[0.14, 0.25, 15, 8]} />
            <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} />
          </mesh>
          <mesh position={[0, 15.1, 0]}>
            <boxGeometry args={[1.6, 0.7, 0.5]} />
            <meshBasicMaterial color={SCENE_COLORS.spaceWhite} />
          </mesh>
        </group>
      ))}

      {/* Coastal Florida Scrub Trees & Palms */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, GROUND_Y, t.z]}>
          <mesh position={[0, t.h * 0.3, 0]}>
            <cylinderGeometry args={[0.12, 0.18, t.h * 0.6, 6]} />
            <meshStandardMaterial color="#5C4033" roughness={0.95} />
          </mesh>
          <mesh position={[0, t.h * 0.75, 0]}>
            <coneGeometry args={[t.h * 0.42, t.h * 0.7, 7]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#1B4332" : "#2D6A4F"} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Crawler-Transporter, Fuel Tankers, Red Fire Trucks & Moving NASA Crew Astrovan. */
function SupportVehicles() {
  const astrovan = useRef<Group>(null);
  const strobe1 = useRef<MeshBasicMaterial>(null);
  const strobe2 = useRef<MeshBasicMaterial>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!reduced) {
      // NASA Astrovan cruising smoothly along the East-West cross service road
      if (astrovan.current) {
        const span = 110;
        const pos = ((t * 5.2 + 45) % span) - span / 2;
        astrovan.current.position.x = pos;
      }
      // Emergency Fire Truck flashing beacons
      const flash = Math.sin(t * 9) > 0;
      if (strobe1.current) strobe1.current.color.set(flash ? SCENE_COLORS.nasaRed : SCENE_COLORS.solarGold);
      if (strobe2.current) strobe2.current.color.set(flash ? SCENE_COLORS.solarGold : SCENE_COLORS.nasaRed);
    }
  });

  return (
    <group>
      {/* Heavy NASA Crawler-Transporter parked near the crawlerway */}
      <group position={[-15, GROUND_Y, -63]} rotation={[0, 0.45, 0]}>
        {/* Main steel platform */}
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[6.2, 0.85, 7.6]} />
          <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.45} roughness={0.5} />
        </mesh>
        {/* Yellow hazard trim */}
        <mesh position={[0, 1.35, 3.82]}>
          <boxGeometry args={[6.2, 0.22, 0.05]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
        {/* White control cab */}
        <mesh position={[1.8, 1.85, 2.9]}>
          <boxGeometry args={[1.6, 0.9, 1.2]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} />
        </mesh>
        {/* 4 Tracked Crawler Bogies */}
        {[-2.4, 2.4].flatMap((tx) =>
          [-2.6, 2.6].map((tz) => (
            <mesh key={`${tx}${tz}`} position={[tx, 0.45, tz]}>
              <boxGeometry args={[1.2, 0.9, 2.2]} />
              <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.85} />
            </mesh>
          )),
        )}
      </group>

      {/* Cryogenic Fuel Tanker Trucks parked along the road */}
      <FuelTanker position={[-20, GROUND_Y, -69]} rotationY={0.15} />
      <FuelTanker position={[-13, GROUND_Y, -75]} rotationY={-0.3} />

      {/* Two NASA Emergency Fire & Rescue Crash Trucks standing by */}
      <FireTruck position={[-8, GROUND_Y, -56]} rotationY={Math.PI / 2} strobeRef={strobe1} />
      <FireTruck position={[18, GROUND_Y, -64]} rotationY={-0.6} strobeRef={strobe2} />

      {/* Moving Silver/White NASA Crew Transport Astrovan on the cross service road */}
      <group ref={astrovan} position={[0, GROUND_Y, -54.8]}>
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[4.2, 1.3, 1.7]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.35} />
        </mesh>
        {/* NASA Blue stripe */}
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[4.24, 0.28, 1.74]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
        {/* Tinted panoramic cabin windows */}
        <mesh position={[0.4, 1.1, 0]}>
          <boxGeometry args={[2.8, 0.45, 1.73]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Glowing yellow headlights */}
        <mesh position={[2.12, 0.55, 0.55]}>
          <boxGeometry args={[0.06, 0.16, 0.22]} />
          <meshBasicMaterial color={SCENE_COLORS.sunCore} />
        </mesh>
        <mesh position={[2.12, 0.55, -0.55]}>
          <boxGeometry args={[0.06, 0.16, 0.22]} />
          <meshBasicMaterial color={SCENE_COLORS.sunCore} />
        </mesh>
        {/* 4 Wheels */}
        {[-1.3, 1.3].flatMap((wx) =>
          [-0.82, 0.82].map((wz) => (
            <mesh key={`${wx}${wz}`} position={[wx, 0.32, wz]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.32, 0.32, 0.24, 12]} />
              <meshStandardMaterial color="#111827" roughness={0.9} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

function FuelTanker({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Cab */}
      <mesh position={[0, 0.9, 2.2]}>
        <boxGeometry args={[1.6, 1.3, 1.5]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} />
      </mesh>
      <mesh position={[0, 1.1, 2.96]}>
        <planeGeometry args={[1.3, 0.5]} />
        <meshBasicMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      {/* Cylindrical aluminum cryo tank */}
      <mesh position={[0, 1.15, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 3.9, 14]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.65} roughness={0.25} />
      </mesh>
      {/* NASA Blue & Red hazard placard */}
      <mesh position={[0, 1.15, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.4, 14]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {/* Wheels */}
      {[-0.82, 0.82].flatMap((wx) =>
        [-1.8, -0.4, 2.2].map((wz) => (
          <mesh key={`${wx}${wz}`} position={[wx, 0.32, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.24, 10]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        )),
      )}
    </group>
  );
}

function FireTruck({
  position,
  rotationY,
  strobeRef,
}: {
  position: [number, number, number];
  rotationY: number;
  strobeRef: React.RefObject<MeshBasicMaterial | null>;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[1.7, 1.3, 4.4]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.4} />
      </mesh>
      {/* White roof cap */}
      <mesh position={[0, 1.63, 0]}>
        <boxGeometry args={[1.6, 0.1, 4.2]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} />
      </mesh>
      {/* Yellow safety stripe */}
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[1.74, 0.16, 4.44]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>
      {/* Flashing emergency strobe lightbar */}
      <mesh position={[0, 1.78, 1.4]}>
        <boxGeometry args={[0.9, 0.18, 0.28]} />
        <meshBasicMaterial ref={strobeRef} color={SCENE_COLORS.solarGold} />
      </mesh>
      {/* Wheels */}
      {[-0.86, 0.86].flatMap((wx) =>
        [-1.4, 1.4].map((wz) => (
          <mesh key={`${wx}${wz}`} position={[wx, 0.35, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.25, 10]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        )),
      )}
    </group>
  );
}

function LaunchPad({ ignitionAt }: { ignitionAt: number | null }) {
  const reduced = useReducedMotion();
  const rocket = useRef<Group>(null);
  const plume = useRef<Group>(null);
  const smoke = useRef<Group>(null);
  const flame = useRef<Group>(null);

  useFrame(() => {
    const t = ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    const lit = t >= 0;
    if (plume.current) plume.current.visible = lit;
    if (smoke.current) smoke.current.visible = lit;
    if (!lit) return;

    // Engines build up on the clamps, then the stack climbs with constant acceleration.
    const climbT = Math.max(0, t - HOLD_DOWN);
    const rise = 0.5 * CLIMB * climbT * climbT;
    if (rocket.current) {
      rocket.current.position.y = rise;
      rocket.current.visible = rise < 400;
    }
    if (flame.current) {
      const flicker = reduced ? 1 : 1 + Math.sin(t * 47) * 0.08 + Math.sin(t * 31) * 0.06;
      flame.current.scale.set(1, Math.min(1, t / 0.6) * (1 + Math.min(climbT, 3) * 0.4) * flicker, 1);
    }
    if (smoke.current) {
      // Exhaust cloud spreading out from the pad and drifting up, independent of the rocket.
      const grow = Math.min(1, t / 3.5);
      smoke.current.scale.set(0.3 + grow * 1.4, 0.3 + grow, 0.3 + grow * 1.4);
      smoke.current.position.y = Math.min(t, 8) * 0.25;
    }
    // Rumble while the vehicle is low and loud: keep the trauma topped up, it decays itself.
    if (t < HOLD_DOWN + 6) addTrauma(t < HOLD_DOWN ? 0.03 : 0.02);
  });

  return (
    <group position={PAD}>
      {/* Concrete flame trench & steel launch pedestal with angled ramps */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[12, 2, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.concreteDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.65, 8.2]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[6.5, 1.2, 6]} />
        <meshStandardMaterial color={SCENE_COLORS.concreteFloor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[5.5, 0.3, 5.5]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Iconic NASA Red Steel Umbilical Launch Tower with Cross-Bracing & Crew Access Arm */}
      <group position={[-5.5, 0, 0]}>
        {[-0.9, 0.9].flatMap((x) =>
          [-0.9, 0.9].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 18, z]}>
              <boxGeometry args={[0.32, 36, 0.32]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.45} metalness={0.3} />
            </mesh>
          )),
        )}
        {/* Elevator core shaft */}
        <mesh position={[-0.3, 16, 0]}>
          <boxGeometry args={[0.7, 32, 0.7]} />
          <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.4} />
        </mesh>
        {[4, 8, 12, 16, 20, 24, 28, 32].map((y) => (
          <group key={y}>
            <mesh position={[0, y, 0]}>
              <boxGeometry args={[2.1, 0.28, 2.1]} />
              <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.5} />
            </mesh>
            {/* Diagonal X-bracing truss */}
            <mesh position={[0, y - 2, 0.92]} rotation={[0, 0, 0.52]}>
              <boxGeometry args={[0.12, 4.3, 0.12]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
            </mesh>
            <mesh position={[0, y - 2, 0.92]} rotation={[0, 0, -0.52]}>
              <boxGeometry args={[0.12, 4.3, 0.12]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
            </mesh>
            {/* Umbilical swing arms */}
            {(y === 12 || y === 16 || y === 20) && (
              <mesh position={[2.2, y, 0]}>
                <boxGeometry args={[2.7, 0.22, 0.38]} />
                <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.5} />
              </mesh>
            )}
          </group>
        ))}
        {/* White Crew Access Arm & White Room at capsule height */}
        <mesh position={[2.3, 24.4, 0]}>
          <boxGeometry args={[3.2, 0.55, 0.7]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} />
        </mesh>
        {/* Lightning mast spire + Aircraft warning beacon on top */}
        <mesh position={[0, 38.2, 0]}>
          <cylinderGeometry args={[0.04, 0.16, 4.5, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} />
        </mesh>
        <mesh position={[0, 40.5, 0]}>
          <sphereGeometry args={[0.35, 10, 8]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
      </group>

      <group ref={rocket} position={[0, 0, 0]}>
        <MiniRocket />
        <group ref={plume} visible={false} position={[0, 2.2, 0]}>
          {/* Flame cone hangs below the engines; its scale stretches it downward. */}
          <group ref={flame}>
            <group position={[0, -3, 0]}>
              <mesh rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[1.6, 6.5, 12, 1, true]} />
                <meshBasicMaterial color={SCENE_COLORS.flameOuter} side={DoubleSide} />
              </mesh>
              <mesh rotation={[Math.PI, 0, 0]} position={[0, 0.9, 0]}>
                <coneGeometry args={[0.95, 4.5, 12]} />
                <meshBasicMaterial color={SCENE_COLORS.flameCore} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      <group ref={smoke} visible={false} position={[0, 0, 0]}>
        {[
          [-6, 2, 1, 4],
          [6, 2.4, -1, 4.5],
          [-2.5, 3, 4, 3.5],
          [3, 2.6, 4.5, 3.8],
          [0, 4, -3, 4],
          [-9, 1.6, -2, 3],
          [9.5, 1.8, 2, 3.2],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <icosahedronGeometry args={[r, 0]} />
            <meshStandardMaterial color={SCENE_COLORS.spaceWhite} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Saturn-style NASA rocket with crisp white fuselage, blue/red stripes & metallic engine section. */
function MiniRocket() {
  const sections: [number, number, number, number, string][] = [
    // [y0, y1, rBottom, rTop, colour]
    [2.2, 3.3, 1.75, 1.6, SCENE_COLORS.steelDark],
    [3.3, 12, 1.6, 1.6, SCENE_COLORS.spaceWhite],
    [12, 13.6, 1.6, 1.3, SCENE_COLORS.nasaBlue],
    [13.6, 19.2, 1.3, 1.3, SCENE_COLORS.spaceWhite],
    [19.2, 22.2, 1.3, 1.0, SCENE_COLORS.spaceWhite],
    [22.2, 24.2, 1.0, 1.0, SCENE_COLORS.steelLight],
    [24.2, 25.6, 1.0, 0.3, SCENE_COLORS.spaceWhite],
    [25.6, 29.2, 0.22, 0.22, SCENE_COLORS.spaceWhite],
    [29.2, ROCKET_HEIGHT, 0.22, 0.01, SCENE_COLORS.nasaRed],
  ];
  return (
    <group>
      {sections.map(([y0, y1, r0, r1, color]) => (
        <mesh key={y0} position={[0, (y0 + y1) / 2, 0]}>
          <cylinderGeometry args={[r1, r0, y1 - y0, 16]} />
          <meshStandardMaterial color={color} metalness={color === SCENE_COLORS.steelLight ? 0.5 : 0.15} roughness={0.4} />
        </mesh>
      ))}
      {/* Black & Red aerospace roll-pattern stripes */}
      {[[3.3, 4.2], [7.5, 7.9], [11.4, 12]].map(([y0, y1], idx) => (
        <mesh key={y0} position={[0, (y0 + y1) / 2, 0]}>
          <cylinderGeometry args={[1.62, 1.62, y1 - y0, 16]} />
          <meshStandardMaterial color={idx === 1 ? SCENE_COLORS.nasaRed : SCENE_COLORS.steelDark} />
        </mesh>
      ))}
    </group>
  );
}
