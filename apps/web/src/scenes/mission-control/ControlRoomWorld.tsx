"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DoubleSide,
  MathUtils,
  PerspectiveCamera,
  Vector3,
  type Camera,
  type Group,
  type MeshBasicMaterial,
} from "three";
import { LightingRig } from "@/components/viewport/LightingRig";
import { Environment } from "@react-three/drei";
import { seeded } from "@/lib/random";
import { useSceneStore, type CameraRig } from "@/game/sceneStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";
import { rocketRise, rocketSpeed } from "./ascent";
import { LaunchVehicle } from "./LaunchVehicle";
import { Warmup } from "./Warmup";
import { shotAt } from "./launchShots";
import { HoldDownClamps, SwingArm } from "./Mechanics";
import { Crowd, binocularGeometry } from "./Crowd";
import { SpaceDome } from "./SpaceDome";
import {
  BEACH_R,
  CROWD_BEACH,
  CROWD_FIELD,
  FIELD_R,
  GROUND_Y,
  LAUNCH_VANTAGE,
  PAD,
  ROCKET_HEIGHT,
  ROOM,
  TIER,
  WINDOW,
} from "./layout";
import { mood } from "./mood";
import { SkyExplosion } from "./SkyExplosion";

interface ControlRoomWorldProps {
  /** performance.now() at ignition (T-0), or null while the rocket waits on the pad. */
  ignitionAt: number | null;
  /** From the launch command on: the camera leaves the console to watch the rocket outside. */
  launchView: boolean;
  /** Real seconds after ignition when the last engine shuts down (orbit, or propellant out). */
  burnEndT: number;
  /** performance.now() when the vehicle is lost in the sky (failure cutscene), or null. */
  explodeAt?: number | null;
  /** What brought the vehicle down: shapes how it is lost. */
  explodeCause?: string;
}

/**
 * Scene 3 geometry: the control room's back tier and front row, the window, and outside the
 * rocket on its pad at dawn. The launch itself is DOM-driven; this only plays the liftoff.
 */
export function ControlRoomWorld({
  ignitionAt,
  launchView,
  burnEndT,
  explodeAt = null,
  explodeCause,
}: ControlRoomWorldProps) {
  // The pad is remounted for every replacement vehicle (smoke and positions reset), but NOT for the
  // first launch: the vehicle already stands there with its shaders compiled and geometry uploaded,
  // and rebuilding all of it at the moment of ignition was a 300 ms freeze at liftoff.
  const stage = useRef({ ignitionAt, count: 0 });
  if (stage.current.ignitionAt !== ignitionAt) {
    if (stage.current.ignitionAt !== null) stage.current.count++;
    stage.current.ignitionAt = ignitionAt;
  }
  return (
    <>
      <LaunchCamera active={launchView} ignitionAt={ignitionAt} />
      <LightingRig />
      <Room />
      <Consoles />
      <MissionStaff />
      <Outside />
      <SpaceDome ignitionAt={ignitionAt} />
      <Crowd
        position={CROWD_FIELD}
        count={110}
        radius={FIELD_R}
        ignitionAt={ignitionAt}
        seed={3}
      />
      <Crowd
        position={CROWD_BEACH}
        count={70}
        radius={BEACH_R}
        ignitionAt={ignitionAt}
        seed={8}
      />
      <LaunchPad
        key={stage.current.count}
        ignitionAt={ignitionAt}
        burnEndT={burnEndT}
      />
      {explodeAt !== null && <SkyExplosion explodeAt={explodeAt} cause={explodeCause} />}
    </>
  );
}

/* ---------------------------------------------------------------- launch camera */

/** Seconds to fly from the console, out through the window, to the vantage point. */
const FLY_OUT = 3.2;
/** Where the flight path crosses the window: centred, just past the glass. */
const WINDOW_GATE = new Vector3(0, 2.1, ROOM.minZ - 3);
/** How fast the aim catches up with the rocket (1/s); the lead below cancels the lag. */
const AIM_RATE = 5;
/** As the rocket climbs, the camera backs away and cranes up a little to keep it framed. */
const PULL_BACK = 0.22;
const CRANE = 0.18;
/** Telephoto follow: zoom in as the rocket gets farther, like a tracking camera at a launch. */
const ZOOM_REF_DIST = 60;
const MAX_ZOOM = 5;
const ZOOM_RATE = 2.5;

const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;

/**
 * Cinematic launch view. On the launch command the camera dollies off the flight director's
 * tier, out through the big window and down to a spot near the pad; from ignition it tracks
 * the rocket as it climbs. Clearing it (hold, anomaly → adjust) cuts back to the console.
 */
function LaunchCamera({
  active,
  ignitionAt,
}: {
  active: boolean;
  ignitionAt: number | null;
}) {
  const setCameraRig = useSceneStore((s) => s.setCameraRig);
  const reduced = useReducedMotion();
  // Read per frame, so ignition doesn't restart the fly-out.
  const ignition = useRef(ignitionAt);
  ignition.current = ignitionAt;

  useEffect(() => {
    if (!active) return;
    const vantage = new Vector3(...LAUNCH_VANTAGE);
    const pad = new Vector3(...PAD);
    // Horizontal direction from the pad to the vantage: the camera backs away along it.
    const away = vantage.clone().sub(pad).setY(0).normalize();
    const start = new Vector3();
    const aim = new Vector3();
    const goal = new Vector3();
    const pos = new Vector3();
    let started = false;
    let elapsed = 0;
    let lens: Camera | null = null;
    let lastShot = "";

    const rig: CameraRig = (camera, dt) => {
      if (!started) {
        // Start exactly where the player was looking, so the move begins without a jump.
        start.copy(camera.position);
        camera.getWorldDirection(aim).multiplyScalar(90).add(start);
        started = true;
      }
      elapsed += dt;
      const k = reduced ? 1 : easeInOut(Math.min(1, elapsed / FLY_OUT));
      // Quadratic Bézier: console → (window gate) → vantage.
      const a = (1 - k) * (1 - k);
      const b = 2 * k * (1 - k);
      const c = k * k;
      pos.set(
        a * start.x + b * WINDOW_GATE.x + c * vantage.x,
        a * start.y + b * WINDOW_GATE.y + c * vantage.y,
        a * start.z + b * WINDOW_GATE.z + c * vantage.z,
      );

      const t =
        ignition.current === null
          ? -1
          : (performance.now() - ignition.current) / 1000;
      const rise = t < 0 ? 0 : rocketRise(t);

      // From ignition the launch is cut like a film: a new angle every few seconds.
      if (t >= 0 && !reduced) {
        const shot = shotAt(t);
        const cut = shot.id !== lastShot;
        lastShot = shot.id;
        const f = shot.frame({
          t,
          rise,
          speed: rocketSpeed(t),
          pad: [pad.x, pad.y, pad.z],
        });
        // Engine rumble shakes the lens, fading as the shot calms down.
        const shake = f.shake;
        camera.position.set(
          f.pos[0] + Math.sin(t * 57) * shake,
          f.pos[1] + Math.sin(t * 71 + 1) * shake,
          f.pos[2] + Math.sin(t * 43 + 2) * shake,
        );
        goal.set(f.aim[0], f.aim[1], f.aim[2]);
        if (cut) aim.copy(goal);
        else aim.lerp(goal, 1 - Math.exp(-f.rate * dt));
        camera.lookAt(aim);
        if (camera instanceof PerspectiveCamera) {
          lens = camera;
          const want = Math.min(
            MAX_ZOOM,
            Math.max(f.zoom, camera.position.distanceTo(goal) / ZOOM_REF_DIST),
          );
          camera.zoom = cut
            ? want
            : camera.zoom +
              (want - camera.zoom) * (1 - Math.exp(-ZOOM_RATE * dt));
          camera.updateProjectionMatrix();
        }
        return;
      }
      pos.addScaledVector(away, rise * PULL_BACK);
      pos.y += rise * CRANE;
      camera.position.copy(pos);

      // Aim at the middle of the stack, led by its speed so the smoothing doesn't trail it.
      const lead = t < 0 ? 0 : rocketSpeed(t) / AIM_RATE;
      goal.set(pad.x, pad.y + rise + lead + ROCKET_HEIGHT * 0.55, pad.z);
      aim.lerp(goal, reduced ? 1 : 1 - Math.exp(-AIM_RATE * dt));
      camera.lookAt(aim);

      if (camera instanceof PerspectiveCamera) {
        lens = camera;
        const want = Math.min(
          MAX_ZOOM,
          Math.max(1, camera.position.distanceTo(goal) / ZOOM_REF_DIST),
        );
        camera.zoom +=
          (want - camera.zoom) * (reduced ? 1 : 1 - Math.exp(-ZOOM_RATE * dt));
        camera.updateProjectionMatrix();
      }
    };

    setCameraRig(rig);
    return () => {
      setCameraRig(null);
      // Back to the naked eye at the console.
      if (lens instanceof PerspectiveCamera) {
        lens.zoom = 1;
        lens.updateProjectionMatrix();
      }
    };
  }, [active, reduced, setCameraRig]);

  return null;
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
        <meshStandardMaterial
          color={SCENE_COLORS.steelDark}
          roughness={0.75}
          metalness={0.15}
        />
      </mesh>
      {/* Center NASA Blue aisle walkway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -0.5]}>
        <planeGeometry args={[2.6, d - 2]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.85} />
      </mesh>
      {/* Acoustic light ceiling with recessed lighting panels */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={SCENE_COLORS.cleanroomWallLower}
          roughness={0.8}
        />
      </mesh>
      {[-3.2, 0, 3.2].map((x) => (
        <mesh
          key={x}
          rotation={[Math.PI / 2, 0, 0]}
          position={[x, h - 0.02, -0.6]}
        >
          <planeGeometry args={[1.6, 0.5]} />
          <meshBasicMaterial color={SCENE_COLORS.spaceWhite} />
        </mesh>
      ))}
      {/* Raised back tier the director sits on */}
      <mesh position={[0, TIER.y / 2, (TIER.frontZ + ROOM.maxZ) / 2]}>
        <boxGeometry args={[w, TIER.y, ROOM.maxZ - TIER.frontZ]} />
        <meshStandardMaterial
          color={SCENE_COLORS.steelMid}
          roughness={0.65}
          metalness={0.25}
        />
      </mesh>
      <mesh
        position={[0, TIER.y + 0.01, TIER.frontZ + 0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[w, 0.1]} />
        <meshBasicMaterial color={SCENE_COLORS.solarGold} />
      </mesh>
      {/* Front wall: bright aerospace wall panel with NASA blue dado & dark window frame */}
      <mesh position={[0, WINDOW.bottom / 2, ROOM.minZ]}>
        <boxGeometry args={[w, WINDOW.bottom, 0.2]} />
        <meshStandardMaterial
          color={SCENE_COLORS.cleanroomWallLower}
          roughness={0.6}
        />
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
        <meshStandardMaterial
          color={SCENE_COLORS.cleanroomWall}
          roughness={0.6}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[
            s * (WINDOW.maxX + sideW / 2),
            (WINDOW.bottom + WINDOW.top) / 2,
            ROOM.minZ,
          ]}
        >
          <boxGeometry args={[sideW, WINDOW.top - WINDOW.bottom, 0.2]} />
          <meshStandardMaterial
            color={SCENE_COLORS.cleanroomWall}
            roughness={0.6}
          />
        </mesh>
      ))}
      {/* Brushed steel window mullions */}
      {[-2.4, 2.6].map((x) => (
        <mesh
          key={x}
          position={[x, (WINDOW.bottom + WINDOW.top) / 2, ROOM.minZ]}
        >
          <boxGeometry args={[0.12, WINDOW.top - WINDOW.bottom, 0.14]} />
          <meshStandardMaterial
            color={SCENE_COLORS.steelDark}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* Side and back walls */}
      {[ROOM.minX, ROOM.maxX].map((x) => (
        <mesh
          key={x}
          position={[x, h / 2, cz]}
          rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial
            color={SCENE_COLORS.cleanroomWallLower}
            roughness={0.7}
          />
        </mesh>
      ))}
      <mesh position={[0, h / 2, ROOM.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color={SCENE_COLORS.cleanroomWallLower}
          roughness={0.7}
        />
      </mesh>
    </group>
  );
}

/** A realistic multi-monitor flight controller console desk with keyboards, switches & chairs. */
function Desk({
  position,
  width,
  screens,
}: {
  position: [number, number, number];
  width: number;
  screens: number;
}) {
  const slots = Array.from(
    { length: screens },
    (_, i) => (i + 0.5) * (width / screens) - width / 2,
  );
  return (
    <group position={position}>
      {/* Sleek charcoal metallic cabinet base */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[width, 0.8, 0.7]} />
        <meshStandardMaterial
          color={SCENE_COLORS.steelDark}
          metalness={0.35}
          roughness={0.55}
        />
      </mesh>
      {/* NASA Blue front accent band */}
      <mesh position={[0, 0.65, 0.355]}>
        <boxGeometry args={[width, 0.12, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.4} />
      </mesh>
      {/* Crisp white worktop */}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.84]} />
        <meshStandardMaterial
          color={SCENE_COLORS.spaceWhite}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
      {/* Desk props: keyboards, status lamps, red abort button & coffee mug */}
      {slots.map((x, i) => (
        <group key={x}>
          {/* Monitor housing */}
          <group position={[x, 1.1, -0.18]} rotation={[-0.18, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.66, 0.44, 0.06]} />
              <meshStandardMaterial
                color={SCENE_COLORS.steelDark}
                metalness={0.4}
                roughness={0.5}
              />
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
              <meshBasicMaterial
                color={
                  i % 2 === 0
                    ? SCENE_COLORS.screenGreen
                    : SCENE_COLORS.screenAmber
                }
              />
            </mesh>
            <mesh position={[0, 0.01, 0.035]}>
              <planeGeometry args={[0.46, 0.02]} />
              <meshBasicMaterial
                color={
                  i % 3 === 0 ? SCENE_COLORS.solarGold : SCENE_COLORS.screenCyan
                }
              />
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
            <meshStandardMaterial
              color={SCENE_COLORS.steelMid}
              roughness={0.6}
            />
          </mesh>
          {/* Red & Green physical switches next to keyboard */}
          <mesh position={[x + 0.24, 0.855, 0.14]}>
            <boxGeometry args={[0.04, 0.025, 0.04]} />
            <meshBasicMaterial
              color={i === 1 ? SCENE_COLORS.nasaRed : SCENE_COLORS.screenGreen}
            />
          </mesh>
        </group>
      ))}
      {/* Swivel operator chair */}
      <group position={[0, 0, 0.65]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.48, 0.07, 0.46]} />
          <meshStandardMaterial
            color={SCENE_COLORS.steelDark}
            roughness={0.7}
          />
        </mesh>
        <mesh position={[0, 0.78, 0.2]}>
          <boxGeometry args={[0.44, 0.56, 0.07]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.42, 8]} />
          <meshStandardMaterial
            color={SCENE_COLORS.steelLight}
            metalness={0.7}
            roughness={0.3}
          />
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
      <SeatedOperator
        position={[-3.4, 0, -0.95]}
        shirtColor={SCENE_COLORS.spaceWhite}
        tieColor={SCENE_COLORS.nasaBlue}
        phase={0}
      />
      <SeatedOperator
        position={[0, 0, -0.95]}
        shirtColor={SCENE_COLORS.nasaBlue}
        tieColor={SCENE_COLORS.nasaRed}
        phase={1.7}
      />
      <SeatedOperator
        position={[3.4, 0, -0.95]}
        shirtColor={SCENE_COLORS.spaceWhite}
        tieColor={SCENE_COLORS.steelDark}
        phase={3.1}
      />

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
const binocularGeo = binocularGeometry();

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
  const binoculars = useRef<Group>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (binoculars.current)
      binoculars.current.visible =
        mood.hush > 0 && mood.joy === 0 && mood.dismay === 0;
    if (mood.dismay > 0) {
      // Work stops: head drops forward, both hands come up to the face.
      if (head.current) {
        head.current.rotation.x = MathUtils.lerp(
          head.current.rotation.x,
          0.55,
          0.08,
        );
        head.current.rotation.y = MathUtils.lerp(
          head.current.rotation.y,
          0,
          0.08,
        );
      }
      if (leftArm.current)
        leftArm.current.rotation.x = MathUtils.lerp(
          leftArm.current.rotation.x,
          -2.55,
          0.08,
        );
      if (rightArm.current)
        rightArm.current.rotation.x = MathUtils.lerp(
          rightArm.current.rotation.x,
          -2.55,
          0.08,
        );
      return;
    }
    if (mood.joy > 0) {
      // Standing ovation in the chair: arms thrown up, head back.
      const t = clock.elapsedTime * 7 + phase;
      if (head.current) {
        head.current.rotation.x = MathUtils.lerp(
          head.current.rotation.x,
          -0.35,
          0.12,
        );
        head.current.rotation.y = MathUtils.lerp(
          head.current.rotation.y,
          0,
          0.1,
        );
      }
      if (leftArm.current)
        leftArm.current.rotation.x = MathUtils.lerp(
          leftArm.current.rotation.x,
          -3.0 + Math.sin(t) * 0.25,
          0.15,
        );
      if (rightArm.current)
        rightArm.current.rotation.x = MathUtils.lerp(
          rightArm.current.rotation.x,
          -3.0 + Math.cos(t * 1.1) * 0.25,
          0.15,
        );
      return;
    }
    if (mood.hush > 0) {
      // Work stops. Eyes front on the window, both hands clasped at the mouth.
      if (head.current) {
        head.current.rotation.x = MathUtils.lerp(
          head.current.rotation.x,
          -0.08,
          0.06,
        );
        head.current.rotation.y = MathUtils.lerp(
          head.current.rotation.y,
          0,
          0.06,
        );
      }
      if (leftArm.current)
        leftArm.current.rotation.x = MathUtils.lerp(
          leftArm.current.rotation.x,
          -2.0,
          0.05,
        );
      if (rightArm.current)
        rightArm.current.rotation.x = MathUtils.lerp(
          rightArm.current.rotation.x,
          -2.0,
          0.05,
        );
      return;
    }
    if (reduced) return;
    const t = clock.elapsedTime + phase;
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.75) * 0.24;
      head.current.rotation.x = Math.sin(t * 1.1) * 0.05;
    }
    if (leftArm.current)
      leftArm.current.rotation.x = -0.75 + Math.sin(t * 6.5) * 0.06;
    if (rightArm.current)
      rightArm.current.rotation.x = -0.75 + Math.cos(t * 7.2) * 0.06;
  });

  return (
    <group position={position}>
      {/* Bent legs resting on floor */}
      {[-0.1, 0.1].map((lx) => (
        <group key={lx} position={[lx, 0.45, -0.05]}>
          <mesh position={[0, 0, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.13, 0.34, 0.13]} />
            <meshStandardMaterial
              color={SCENE_COLORS.steelDark}
              roughness={0.8}
            />
          </mesh>
          <mesh position={[0, -0.22, -0.28]}>
            <boxGeometry args={[0.12, 0.42, 0.12]} />
            <meshStandardMaterial
              color={SCENE_COLORS.steelDark}
              roughness={0.8}
            />
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
        {/* Binoculars, raised to the eyes while the room holds its breath, both hands on them */}
        <group ref={binoculars} visible={false}>
          <group position={[0, 0.02, -0.13]} rotation={[0, Math.PI, 0]}>
            <mesh geometry={binocularGeo}>
              <meshStandardMaterial
                vertexColors
                metalness={0.55}
                roughness={0.35}
              />
            </mesh>
          </group>
          {[-1, 1].map((side) => {
            const hand: [number, number, number] = [side * 0.1, 0.0, -0.17];
            const elbow: [number, number, number] = [side * 0.21, -0.23, -0.04];
            const d: [number, number, number] = [
              elbow[0] - hand[0],
              elbow[1] - hand[1],
              elbow[2] - hand[2],
            ];
            const len = Math.hypot(...d);
            return (
              <group key={side}>
                <mesh position={hand}>
                  <boxGeometry args={[0.055, 0.05, 0.06]} />
                  <meshStandardMaterial color="#E2B49A" roughness={0.6} />
                </mesh>
                <mesh
                  position={[
                    (hand[0] + elbow[0]) / 2,
                    (hand[1] + elbow[1]) / 2,
                    (hand[2] + elbow[2]) / 2,
                  ]}
                  rotation={[
                    -Math.asin(d[1] / len),
                    Math.atan2(d[0], d[2]),
                    0,
                    "YXZ",
                  ]}
                >
                  <boxGeometry args={[0.07, 0.07, len]} />
                  <meshStandardMaterial color={shirtColor} roughness={0.65} />
                </mesh>
              </group>
            );
          })}
        </group>
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
    if (mood.dismay > 0 || mood.hush > 0 || mood.joy > 0) {
      // Freeze in place, turn toward the window, hands on head (or, once it works, thrown in the air).
      root.current.rotation.y = MathUtils.lerp(
        root.current.rotation.y,
        Math.PI,
        0.06,
      );
      for (const leg of [leftLeg.current, rightLeg.current])
        if (leg) leg.rotation.x = MathUtils.lerp(leg.rotation.x, 0, 0.1);
      const armUp =
        mood.joy > 0
          ? -3.0 + Math.sin(clock.elapsedTime * 8 + phase) * 0.25
          : mood.hush > 0
            ? -2.0
            : -2.6;
      for (const arm of [leftArm.current, rightArm.current])
        if (arm) arm.rotation.x = MathUtils.lerp(arm.rotation.x, armUp, 0.08);
      if (body.current)
        body.current.rotation.x = MathUtils.lerp(
          body.current.rotation.x,
          0.18,
          0.06,
        );
      return;
    }
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

    const stride = moving
      ? Math.sin(clock.elapsedTime * speed * 5.2 + phase)
      : 0;
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
            <meshStandardMaterial
              color={prop === "tablet" ? SCENE_COLORS.steelDark : "#92400E"}
            />
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
  return (
    <group>
      {/* Real dawn-sky HDRI (background + image-based light) and the ocean horizon */}
      <Environment
        files="/assets/env/sky_day.hdr"
        background
        environmentIntensity={1.0}
        backgroundIntensity={1}
      />
      <Ocean />

      {/* Coastal Florida Space Coast Terrain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, -100]}>
        <planeGeometry args={[900, 260]} />
        <meshStandardMaterial color={SCENE_COLORS.grass} roughness={0.95} />
      </mesh>
      {/* Lighter coastal grass / sand dunes near shore */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-45, GROUND_Y + 0.008, -145]}
      >
        <planeGeometry args={[240, 80]} />
        <meshStandardMaterial
          color={SCENE_COLORS.grassLight}
          roughness={0.95}
        />
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

/** Distant Atlantic Ocean strip beyond the coastal scrubland; the sky itself is the HDRI. */
function Ocean() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y - 0.05, -260]}>
      <planeGeometry args={[900, 120]} />
      <meshStandardMaterial
        color="#1E4B7A"
        roughness={0.25}
        metalness={0.3}
        envMapIntensity={1.4}
      />
    </mesh>
  );
}

/** Main highway, cross service road, perimeter loop, crawlerway, and dashed markings. */
function RoadNetwork() {
  const dashes = useMemo(
    () => Array.from({ length: 14 }, (_, i) => -22 - i * 5),
    [],
  );
  const crossDashes = useMemo(
    () => Array.from({ length: 24 }, (_, i) => -58 + i * 5),
    [],
  );

  return (
    <group>
      {/* Concrete Launch Pad Apron */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[PAD[0], GROUND_Y + 0.018, PAD[2]]}
      >
        <planeGeometry args={[46, 38]} />
        <meshStandardMaterial
          color={SCENE_COLORS.concreteFloor}
          roughness={0.85}
        />
      </mesh>
      {/* Pad Apron Perimeter Curb / Yellow Safety Border */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[PAD[0], GROUND_Y + 0.022, PAD[2] + 18.8]}
      >
        <planeGeometry args={[46, 0.35]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>

      {/* Main Asphalt Access Road leading straight from Control Room to Pad */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[3, GROUND_Y + 0.02, -62]}
      >
        <planeGeometry args={[4.4, 92]} />
        <meshStandardMaterial color={SCENE_COLORS.asphalt} roughness={0.9} />
      </mesh>
      {/* Road concrete shoulders */}
      {[-2.4, 2.4].map((dx) => (
        <mesh
          key={dx}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[3 + dx, GROUND_Y + 0.019, -62]}
        >
          <planeGeometry args={[0.45, 92]} />
          <meshStandardMaterial
            color={SCENE_COLORS.concreteFloor}
            roughness={0.85}
          />
        </mesh>
      ))}
      {/* Dashed yellow center line on Main Road */}
      {dashes.map((z) => (
        <mesh
          key={z}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[3, GROUND_Y + 0.025, z]}
        >
          <planeGeometry args={[0.15, 2.4]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
      ))}

      {/* Cross Service Road running East-West across the Spaceport (z = -56) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, GROUND_Y + 0.022, -56]}
      >
        <planeGeometry args={[180, 4.6]} />
        <meshStandardMaterial color={SCENE_COLORS.asphalt} roughness={0.9} />
      </mesh>
      {crossDashes.map((x) => (
        <mesh
          key={x}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, GROUND_Y + 0.026, -56]}
        >
          <planeGeometry args={[2.4, 0.15]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
      ))}

      {/* Service Road branch to Cryogenic Fuel Farm & Radar Station */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-26, GROUND_Y + 0.021, -70]}
      >
        <planeGeometry args={[3.4, 28]} />
        <meshStandardMaterial color={SCENE_COLORS.asphalt} roughness={0.9} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[34, GROUND_Y + 0.021, -64]}
      >
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
    if (dish1.current)
      dish1.current.rotation.y = Math.sin(t * 0.35) * 0.45 - 0.5;
    if (dish2.current)
      dish2.current.rotation.y = Math.cos(t * 0.28) * 0.4 + 0.4;
  });

  return (
    <group>
      {/* Cryogenic Fuel Farm (LOX & LH2 White Spheres + Piping to Pad) */}
      <group position={[-26, GROUND_Y, -78]}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[14, 0.3, 10]} />
          <meshStandardMaterial
            color={SCENE_COLORS.concreteFloor}
            roughness={0.85}
          />
        </mesh>
        {[-3.4, 3.4].map((dx, i) => (
          <group key={dx} position={[dx, 0, 0]}>
            <mesh position={[0, 3.2, 0]}>
              <sphereGeometry args={[2.5, 20, 14]} />
              <meshStandardMaterial
                color={SCENE_COLORS.spaceWhite}
                roughness={0.35}
                metalness={0.15}
              />
            </mesh>
            {/* NASA Blue equator band on fuel tank */}
            <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.51, 0.12, 8, 24]} />
              <meshStandardMaterial
                color={i === 0 ? SCENE_COLORS.nasaBlue : SCENE_COLORS.nasaRed}
              />
            </mesh>
            {/* Support legs */}
            {[0, 1, 2, 3].map((k) => {
              const a = (k * Math.PI) / 2 + Math.PI / 4;
              return (
                <mesh
                  key={k}
                  position={[Math.cos(a) * 1.6, 1.5, Math.sin(a) * 1.6]}
                >
                  <cylinderGeometry args={[0.14, 0.18, 3.0, 8]} />
                  <meshStandardMaterial
                    color={SCENE_COLORS.steelLight}
                    metalness={0.5}
                  />
                </mesh>
              );
            })}
          </group>
        ))}
        {/* Cryo pipeline connecting fuel farm to launch pad */}
        <mesh position={[15, 0.65, -5]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 20, 10]} />
          <meshStandardMaterial
            color={SCENE_COLORS.aluminum}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* Telemetry & Radar Tracking Station (Right of Pad) */}
      <group position={[34, GROUND_Y, -68]}>
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[9, 2.8, 6]} />
          <meshStandardMaterial
            color={SCENE_COLORS.cleanroomWallLower}
            roughness={0.7}
          />
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
            <group
              ref={i === 0 ? dish1 : dish2}
              position={[0, 2.0, 0]}
              rotation={[-0.45, 0, 0]}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[1.6, 0.35, 0.7, 16, 1, true]} />
                <meshStandardMaterial
                  color={SCENE_COLORS.spaceWhite}
                  side={DoubleSide}
                  roughness={0.4}
                />
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
            <meshStandardMaterial
              color={SCENE_COLORS.steelLight}
              metalness={0.6}
            />
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
            <meshStandardMaterial
              color={i % 2 === 0 ? "#1B4332" : "#2D6A4F"}
              roughness={0.9}
              flatShading
            />
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
      if (strobe1.current)
        strobe1.current.color.set(
          flash ? SCENE_COLORS.nasaRed : SCENE_COLORS.solarGold,
        );
      if (strobe2.current)
        strobe2.current.color.set(
          flash ? SCENE_COLORS.solarGold : SCENE_COLORS.nasaRed,
        );
    }
  });

  return (
    <group>
      {/* Heavy NASA Crawler-Transporter parked near the crawlerway */}
      <group position={[-15, GROUND_Y, -63]} rotation={[0, 0.45, 0]}>
        {/* Main steel platform */}
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[6.2, 0.85, 7.6]} />
          <meshStandardMaterial
            color={SCENE_COLORS.steelMid}
            metalness={0.45}
            roughness={0.5}
          />
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
              <meshStandardMaterial
                color={SCENE_COLORS.steelDark}
                roughness={0.85}
              />
            </mesh>
          )),
        )}
      </group>

      {/* Cryogenic Fuel Tanker Trucks parked along the road */}
      <FuelTanker position={[-20, GROUND_Y, -69]} rotationY={0.15} />
      <FuelTanker position={[-13, GROUND_Y, -75]} rotationY={-0.3} />

      {/* Two NASA Emergency Fire & Rescue Crash Trucks standing by */}
      <FireTruck
        position={[-8, GROUND_Y, -56]}
        rotationY={Math.PI / 2}
        strobeRef={strobe1}
      />
      <FireTruck
        position={[18, GROUND_Y, -64]}
        rotationY={-0.6}
        strobeRef={strobe2}
      />

      {/* Moving Silver/White NASA Crew Transport Astrovan on the cross service road */}
      <group ref={astrovan} position={[0, GROUND_Y, -54.8]}>
        <mesh position={[0, 0.85, 0]}>
          <boxGeometry args={[4.2, 1.3, 1.7]} />
          <meshStandardMaterial
            color={SCENE_COLORS.spaceWhite}
            roughness={0.35}
          />
        </mesh>
        {/* NASA Blue stripe */}
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[4.24, 0.28, 1.74]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
        {/* Tinted panoramic cabin windows */}
        <mesh position={[0.4, 1.1, 0]}>
          <boxGeometry args={[2.8, 0.45, 1.73]} />
          <meshStandardMaterial
            color={SCENE_COLORS.steelDark}
            metalness={0.6}
            roughness={0.2}
          />
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
            <mesh
              key={`${wx}${wz}`}
              position={[wx, 0.32, wz]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.32, 0.32, 0.24, 12]} />
              <meshStandardMaterial color="#111827" roughness={0.9} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}

function FuelTanker({
  position,
  rotationY,
}: {
  position: [number, number, number];
  rotationY: number;
}) {
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
        <meshStandardMaterial
          color={SCENE_COLORS.aluminum}
          metalness={0.65}
          roughness={0.25}
        />
      </mesh>
      {/* NASA Blue & Red hazard placard */}
      <mesh position={[0, 1.15, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.4, 14]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {/* Wheels */}
      {[-0.82, 0.82].flatMap((wx) =>
        [-1.8, -0.4, 2.2].map((wz) => (
          <mesh
            key={`${wx}${wz}`}
            position={[wx, 0.32, wz]}
            rotation={[Math.PI / 2, 0, 0]}
          >
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
          <mesh
            key={`${wx}${wz}`}
            position={[wx, 0.35, wz]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.35, 0.35, 0.25, 10]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        )),
      )}
    </group>
  );
}

/** The pad, its umbilical tower, and the vehicle standing on it. */
function LaunchPad({
  ignitionAt,
  burnEndT,
}: {
  ignitionAt: number | null;
  burnEndT: number;
}) {
  return (
    <group position={PAD}>
      <HoldDownClamps ignitionAt={ignitionAt} />
      {/* Concrete flame trench & steel launch pedestal with angled ramps */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[12, 2, 12]} />
        <meshStandardMaterial
          color={SCENE_COLORS.concreteDark}
          roughness={0.85}
        />
      </mesh>
      <mesh position={[0, 0.65, 8.2]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[6.5, 1.2, 6]} />
        <meshStandardMaterial
          color={SCENE_COLORS.concreteFloor}
          roughness={0.85}
        />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[5.5, 0.3, 5.5]} />
        <meshStandardMaterial
          color={SCENE_COLORS.steelDark}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>
      {/* Iconic NASA Red Steel Umbilical Launch Tower with Cross-Bracing & Crew Access Arm */}
      <group position={[-5.5, 0, 0]}>
        {[-0.9, 0.9].flatMap((x) =>
          [-0.9, 0.9].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 18, z]}>
              <boxGeometry args={[0.32, 36, 0.32]} />
              <meshStandardMaterial
                color={SCENE_COLORS.nasaRed}
                roughness={0.45}
                metalness={0.3}
              />
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
              <meshStandardMaterial
                color={SCENE_COLORS.spaceWhite}
                roughness={0.5}
              />
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
              <group position={[0.5, y, 0]}>
                <SwingArm
                  ignitionAt={ignitionAt}
                  delay={((y - 12) / 8) * 0.35}
                />
              </group>
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

      <LaunchVehicle ignitionAt={ignitionAt} burnEndT={burnEndT} />
      <Warmup />
    </group>
  );
}
