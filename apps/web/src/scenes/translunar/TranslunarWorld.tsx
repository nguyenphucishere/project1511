"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  BackSide,
  Color,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type DirectionalLight,
  type Group,
  type Mesh,
  type PointLight,
  AdditiveBlending,
  type MeshBasicMaterial,
} from "three";
import { Earth } from "@/components/viewport/Earth";
import { useSceneStore, type CameraRig } from "@/game/sceneStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Warmup } from "../mission-control/Warmup";
import { Cabin, WINDOW_Z } from "./Cabin";
import { MoonBody } from "./MoonBody";
import { Recovery } from "./Recovery";
import { SEA_SUN, SeaSet } from "./SeaSet";
import { ReentryCapsule, Ship, Stage } from "./Spacecraft";
import { filmClock } from "./clock";
import { filmTimeAt } from "./flight";
import { R_EARTH, SUN, T, cabinEye, cabinLook, frameAt, SEA_ARRIVAL, entryState, mul, plasma, shipPose, viewKind } from "./flight";

const MILKY_TINT = new Color(2.2, 2.3, 2.7);

/** The colour of the sky behind the capsule as it falls: black in space, then deepening blue, then daylight by the thick air. */
const SKY_STOPS: [number, Color][] = [
  [100, new Color("#000000")],
  [70, new Color("#03060d")],
  [45, new Color("#040c1e")],
  [25, new Color("#102f5e")],
  [12, new Color("#4a82bf")],
  [7, new Color("#c7dff3")],
];
const skyScratch = new Color();
function skyAt(altKm: number): Color {
  if (altKm >= SKY_STOPS[0]![0]) return skyScratch.copy(SKY_STOPS[0]![1]);
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [a1, c1] = SKY_STOPS[i]!;
    if (altKm >= a1) {
      const [a0, c0] = SKY_STOPS[i - 1]!;
      return skyScratch.copy(c0).lerp(c1, (a0 - altKm) / (a0 - a1));
    }
  }
  return skyScratch.copy(SKY_STOPS[SKY_STOPS.length - 1]![1]);
}

/** The NASA/ESA Milky Way panorama on a huge inverted sphere that travels with the camera. */
function Stars({ skyRef }: { skyRef: React.RefObject<Mesh | null> }) {
  const tex = useTexture("/assets/textures/milky_way_4k.jpg", (t) => {
    t.colorSpace = SRGBColorSpace;
  });
  return (
    <mesh ref={skyRef} rotation={[0.6, 0.4, 0.2]} renderOrder={-3} frustumCulled={false}>
      <sphereGeometry args={[4200, 48, 32]} />
      <meshBasicMaterial map={tex} side={BackSide} depthWrite={false} toneMapped={false} color={MILKY_TINT} transparent blending={AdditiveBlending} />
    </mesh>
  );
}

/** Writes the film clock first thing every frame, so everything else reads one instant. */
function FilmClock({ startAt, from, to }: { startAt: number | null; from: number; to: number }) {
  useFrame(() => {
    filmClock.t = startAt === null ? from : Math.min(to - 0.001, filmTimeAt(from, (performance.now() - startAt) / 1000));
  }, -100);
  return null;
}

const m4 = new Matrix4();
const qA = new Quaternion();
const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const vD = new Vector3();

/** The camera: every shot is a pure function of the film time (see flight.ts), cut hard. */
function FilmCamera({
  skyRef,
  cabinRef,
  lampRef,
  sunRef,
  seaSunRef,
  fillRef,
}: {
  skyRef: React.RefObject<Mesh | null>;
  cabinRef: React.RefObject<Group | null>;
  lampRef: React.RefObject<PointLight | null>;
  sunRef: React.RefObject<DirectionalLight | null>;
  seaSunRef: React.RefObject<DirectionalLight | null>;
  fillRef: React.RefObject<{ intensity: number } | null>;
}) {
  const setCameraRig = useSceneStore((s) => s.setCameraRig);
  const scene = useThree((s) => s.scene);
  const reduced = useReducedMotion();

  useEffect(() => {
    const rig: CameraRig = (camera) => {
      const t = filmClock.t;
      const shot = frameAt(t);
      const kind = viewKind(t);
      const aspect = camera instanceof PerspectiveCamera ? camera.aspect : 1.78;
      let fov = shot.fov;
      // Tall screens: widen so the subject still fits.
      if (aspect < 1.3) fov = Math.min(95, fov * (1 + (1.3 - aspect) * 0.55));
      if (camera instanceof PerspectiveCamera) {
        camera.near = 0.05;
        camera.far = 7000;
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      // Lighting for the set the camera is in. Lights stay in the scene the whole film (changing
      // how many are lit recompiles every material); they are simply turned up or down.
      const sea = kind === "sea";
      if (sunRef.current) sunRef.current.intensity = sea ? 0 : 3.6;
      if (seaSunRef.current) seaSunRef.current.intensity = sea ? 3.2 : 0;
      if (fillRef.current) fillRef.current.intensity = sea ? 0.7 : 0.05;
      scene.environmentIntensity = sea ? 0.55 : 0.1;
      if (skyRef.current) skyRef.current.visible = !sea;

      if (kind === "cabin") {
        const pose = shipPose(t);
        const look = cabinLook(t, pose);
        // Cabin frame: -Z along the look direction, +Y toward the crew's up.
        vA.set(-look[0], -look[1], -look[2]);
        vB.set(...pose.up).cross(vA).normalize();
        vC.copy(vA).cross(vB).normalize();
        m4.makeBasis(vB, vC, vA);
        qA.setFromRotationMatrix(m4);
        const cabin = cabinRef.current;
        if (cabin) {
          cabin.position.set(...pose.pos);
          cabin.quaternion.copy(qA);
        }
        const eye = cabinEye(t);
        vD.set(...eye).applyQuaternion(qA).add(vA.set(...pose.pos));
        camera.position.copy(vD);
        if (lampRef.current) {
          lampRef.current.position.set(0, 0.3, 0.5).applyQuaternion(qA).add(vA.set(...pose.pos));
          lampRef.current.intensity = t >= 124 ? 0.9 : 0.1;
        }
        vD.set(0, 0, WINDOW_Z).applyQuaternion(qA).add(vA.set(...pose.pos));
        camera.up.copy(vC);
        camera.lookAt(vD);
      } else {
        if (lampRef.current) lampRef.current.intensity = 0;
        const wob = reduced ? 0 : shot.shake;
        camera.position.set(
          shot.pos[0] + Math.sin(t * 57) * wob,
          shot.pos[1] + Math.sin(t * 71 + 1) * wob,
          shot.pos[2] + Math.sin(t * 43 + 2) * wob,
        );
        camera.up.set(...shot.up);
        camera.lookAt(shot.aim[0], shot.aim[1], shot.aim[2]);
      }
      if (skyRef.current) {
        skyRef.current.position.copy(camera.position);
        // Falling into the air the stars go out: full in space, dim in the stratosphere, nearly gone below.
        const alt = t >= T.REENTRY && t < SEA_ARRIVAL ? entryState(t).altKm : 999;
        const stars = alt > 100 ? 1 : Math.max(0.06, (alt - 15) / 85);
        ((skyRef.current.material as MeshBasicMaterial).color as Color).copy(MILKY_TINT).multiplyScalar(stars);
        // And the sky itself takes colour behind them.
        scene.background = alt < 100 ? skyAt(alt) : null;
      }
    };
    setCameraRig(rig);
    return () => setCameraRig(null);
  }, [setCameraRig, scene, reduced, skyRef, cabinRef, lampRef, sunRef, seaSunRef, fillRef]);

  return null;
}

const SUN_POS = mul(SUN, 300) as [number, number, number];
const SEA_SUN_POS = SEA_SUN.clone().multiplyScalar(300).toArray() as [number, number, number];

interface TranslunarWorldProps {
  /** performance.now() when the film started, or null while it waits at its first frame. */
  startAt: number | null;
  /** Film time at which this part starts, and where it freezes on its last frame. */
  from: number;
  to: number;
  /** Called once every texture is loaded and every shader is compiled: the film can start. */
  onReady?: () => void;
}

/**
 * The flight to the Moon and home: the Earth, the Moon, a spacecraft and the cameras that cut
 * between them. Everything moves as a function of the film clock (see flight.ts).
 */
export function TranslunarWorld({ startAt, from, to, onReady }: TranslunarWorldProps) {
  const skyRef = useRef<Mesh>(null);
  const cabinRef = useRef<Group>(null);
  const lampRef = useRef<PointLight>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const seaSunRef = useRef<DirectionalLight>(null);
  const fillRef = useRef<{ intensity: number }>(null);

  // This component only mounts once the textures have loaded (it sits inside the canvas's
  // Suspense); the warm-up compile then needs a moment before the first frame can be smooth.
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const id = window.setTimeout(() => ready.current?.(), 700);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <>
      <FilmClock startAt={startAt} from={from} to={to} />
      <FilmCamera skyRef={skyRef} cabinRef={cabinRef} lampRef={lampRef} sunRef={sunRef} seaSunRef={seaSunRef} fillRef={fillRef} />
      <Stars skyRef={skyRef} />

      <directionalLight ref={sunRef} position={SUN_POS} intensity={3.6} color="#fff4e6" />
      <directionalLight ref={seaSunRef} position={SEA_SUN_POS} intensity={0} color="#fff1dc" />
      {/* Earthshine: a faint blue light from the Earth, which fills in the shadowed Moon. */}
      <directionalLight position={[0, 40, 300]} intensity={0.9} color="#9bb8ff" />
      <ambientLight ref={fillRef as React.RefObject<never>} intensity={0.05} color="#8fa6d8" />
      <pointLight ref={lampRef} intensity={0} color="#ffcf9e" distance={4} decay={1.4} />

      <Earth radius={R_EARTH} spin={0.003} nightGlow={0.05} />
      <MoonBody />

      <Stage />
      <Ship />
      <ReentryCapsule />
      <Cabin ref={cabinRef} />
      <SeaSet />
      <Recovery />
      <Warmup />
    </>
  );
}
