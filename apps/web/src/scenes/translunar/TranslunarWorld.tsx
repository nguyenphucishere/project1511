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
import { R_EARTH, SUN, T, cabinEye, cabinLook, frameAt, mul, plasma, shipPose, viewKind } from "./flight";

const MILKY_TINT = new Color(2.2, 2.3, 2.7);

/** The NASA/ESA Milky Way panorama on a huge inverted sphere that travels with the camera. */
function Stars({ skyRef }: { skyRef: React.RefObject<Mesh | null> }) {
  const tex = useTexture("/assets/textures/milky_way_4k.jpg", (t) => {
    t.colorSpace = SRGBColorSpace;
  });
  return (
    <mesh ref={skyRef} rotation={[0.6, 0.4, 0.2]} renderOrder={-3} frustumCulled={false}>
      <sphereGeometry args={[4200, 48, 32]} />
      <meshBasicMaterial map={tex} side={BackSide} depthWrite={false} toneMapped={false} color={MILKY_TINT} />
    </mesh>
  );
}

/** Writes the film clock first thing every frame, so everything else reads one instant. */
function FilmClock({ startAt, from, to }: { startAt: number | null; from: number; to: number }) {
  useFrame(() => {
    filmClock.t = startAt === null ? from : Math.min(to - 0.001, from + (performance.now() - startAt) / 1000);
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
          // In the entry the only light in the cabin is the fire outside: orange, and flickering with it.
          const fire = t >= T.REENTRY && t < T.CHUTES ? plasma(t) : 0;
          lampRef.current.color.set(fire > 0.02 ? "#ff9a4d" : "#ffcf9e");
          lampRef.current.intensity = fire > 0.02 ? 0.25 + 2.6 * fire * (0.72 + 0.28 * Math.sin(t * 37) * Math.sin(t * 11 + 1)) : t >= 124 ? 0.9 : 0.1;
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
      if (skyRef.current) skyRef.current.position.copy(camera.position);
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
