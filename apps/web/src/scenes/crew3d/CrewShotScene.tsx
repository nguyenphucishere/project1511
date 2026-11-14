"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { BackSide } from "three";
import { PostFX } from "@/components/viewport/PostFX";
import { CabinInterior3D, CREW_X, type CabinMood } from "./CabinInterior3D";
import { CrewMember3D } from "./CrewMember3D";

export type CrewMood = "structural" | "fuel-depleted" | "slow-climb" | "wind-shear" | "lightning";

interface Look {
  cabin: CabinMood;
  key: string;
  keyI: number;
  fill: string;
  fog: string;
  /** Head yaw for [Armstrong, Collins, Aldrin]. */
  yaw: [number, number, number];
  fear: number;
  shake: number;
  roll: number;
}

export const LOOKS: Record<CrewMood, Look> = {
  structural: { cabin: { light: "#ff2a1a", window: "#ff8a35", windowIntensity: 6, lamps: ["#ff2a1a", "#ff2a1a", "#ffb000"], beacon: 3.2 }, key: "#ff5a3a", keyI: 0.8, fill: "#3a2630", fog: "#150608", yaw: [0.7, -0.3, -0.75], fear: 0.95, shake: 0.7, roll: 0.05 },
  "fuel-depleted": { cabin: { light: "#7aa8ff", window: "#4a78d8", windowIntensity: 3, lamps: ["#ffb000", "#7aa8ff", "#ffb000"], beacon: 0 }, key: "#8fb4ff", keyI: 0.7, fill: "#101c38", fog: "#04070f", yaw: [0.85, -0.4, -0.85], fear: 0.3, shake: 0, roll: 0 },
  "slow-climb": { cabin: { light: "#ffa030", window: "#ffc070", windowIntensity: 5, lamps: ["#ffb000", "#ffb000", "#ff2a1a"], beacon: 1.6 }, key: "#ff9a3a", keyI: 1.0, fill: "#2c1c10", fog: "#120a03", yaw: [0.55, -0.2, -0.65], fear: 0.7, shake: 0.35, roll: 0.09 },
  "wind-shear": { cabin: { light: "#ff3a2a", window: "#a8c8ff", windowIntensity: 4, lamps: ["#ff2a1a", "#ffb000", "#ff2a1a"], beacon: 4.4 }, key: "#cfe4ff", keyI: 1.2, fill: "#16213a", fog: "#080f20", yaw: [0.65, -0.25, -0.55], fear: 0.9, shake: 1, roll: 0.22 },
  lightning: { cabin: { light: "#ff2a1a", window: "#ffffff", windowIntensity: 14, lamps: ["#ff2a1a", "#ff2a1a", "#ff2a1a"], beacon: 2.4 }, key: "#ffffff", keyI: 1.5, fill: "#222a44", fog: "#04060c", yaw: [0.75, -0.35, -0.8], fear: 1, shake: 0.5, roll: 0.04 },
};

function Rig({ look, shot }: { look: Look; shot: "wide" | "close" }) {
  const camera = useThree((s) => s.camera);
  const base = useRef({ x: 0, y: 0 });
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = look.shake * 0.02;
    const push = shot === "close" ? 1.9 : 4.0;
    camera.position.set(
      (shot === "close" ? -1.0 : 0) + Math.sin(t * 31) * a + base.current.x,
      shot === "close" ? 0.28 : 0.12,
      push + Math.sin(t * 0.2) * 0.04,
    );
    camera.lookAt(shot === "close" ? -0.6 : 0, shot === "close" ? 0.2 : 0.1, 0);
    camera.rotation.z += look.roll + Math.cos(t * 27) * a * 0.6;
  });
  return null;
}

/** The three crew in their couches under a sweeping alarm light, shot from the instrument panel. */
export function CrewShotScene({ mood, shot = "wide", low = false, post = true }: { mood: CrewMood; shot?: "wide" | "close"; low?: boolean; post?: boolean }) {
  const look = LOOKS[mood];
  const names: [string, string, string] = ["ARMSTRONG", "COLLINS", "ALDRIN"];
  return (
    <>
      <color attach="background" args={[look.fog]} />
      <fog attach="fog" args={[look.fog, 5, 12]} />
      <Rig look={look} shot={shot} />

      <CabinInterior3D mood={look.cabin} shake={look.shake} />
      <CrewMember3D name={names[0]} x={CREW_X[0]} yaw={look.yaw[0]} pitch={0.03} fear={look.fear} accent="#2d63c8" low={low} />
      <CrewMember3D name={names[1]} x={0} yaw={look.yaw[1]} pitch={0.05} fear={look.fear} accent="#d8742a" low={low} />
      <CrewMember3D name={names[2]} x={CREW_X[2]} yaw={look.yaw[2]} pitch={0.02} fear={look.fear} accent="#3a9a5e" low={low} />

      <ambientLight color="#8e98b0" intensity={0.55} />
      <directionalLight color={look.key} intensity={look.keyI} position={[-2.5, 2.4, 3]} />
      <directionalLight color={look.cabin.window} intensity={look.keyI * 0.7} position={[0, 1.2, -3]} />
      <hemisphereLight args={["#c4cde2", "#2a2420", 0.7]} />

      <Environment resolution={256}>
        {/* a dim, warm room around the crew, so the gold visors reflect a cabin and not black nothing */}
        <mesh scale={40}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color="#2a2824" side={BackSide} toneMapped={false} />
        </mesh>
        <Lightformer form="rect" color={look.key} intensity={look.keyI * 1.6} position={[-3, 1.6, 2.5]} scale={[3, 1.2, 1]} />
        <Lightformer form="rect" color={look.cabin.window} intensity={look.cabin.windowIntensity} position={[0, 1, -3]} scale={[3, 2, 1]} />
        <Lightformer form="circle" color={look.cabin.lamps[0]!} intensity={5} position={[3, 0.5, 2]} scale={1.5} />
        <Lightformer form="rect" color="#ffffff" intensity={1.2} position={[0, 3, 1]} scale={[4, 0.6, 1]} />
        <Lightformer form="rect" color="#9fb0d0" intensity={0.9} position={[-4, 0, 0]} scale={[1, 3, 1]} />
        <Lightformer form="rect" color="#d8c9a8" intensity={0.8} position={[4, 0.5, 0.5]} scale={[1, 3, 1]} />
      </Environment>

      {post && <PostFX />}
    </>
  );
}
