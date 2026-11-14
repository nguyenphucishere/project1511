"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Height of the doctor in the room, metres. The frames are 474 x 1000 px with the feet on the bottom edge. */
const HEIGHT = 1.78;
const WIDTH = HEIGHT * (474 / 1000);

/** One loop: she stands with her hands in her pockets, then waves, then settles back. */
const IDLE_SECONDS = 4.4;
const WAVE_SECONDS = 2.2;

const FRAMES = ["/assets/characters/doctor/idle.webp", "/assets/characters/doctor/wave.webp"];

/**
 * The flight surgeon: a hand-drawn two-frame character standing in the medical bay. The sprite
 * always turns to face the camera (about the vertical axis only, so she stays upright), breathes
 * while idle, and swaps to the waving pose now and then with a small sway.
 */
export function DoctorSprite({ position }: { position: [number, number, number] }) {
  const [idle, wave] = useTexture(FRAMES, (list) => {
    for (const t of Array.isArray(list) ? list : [list]) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
    }
  });
  const root = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const camera = useThree((s) => s.camera);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    const g = root.current;
    const m = body.current;
    const material = mat.current;
    if (!g || !m || !material) return;
    // Face the viewer, upright.
    g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
    if (reduced) {
      material.map = idle;
      return;
    }
    const t = clock.elapsedTime;
    const phase = t % (IDLE_SECONDS + WAVE_SECONDS);
    const waving = phase >= IDLE_SECONDS;
    const next = waving ? wave : idle;
    if (material.map !== next) {
      material.map = next;
      material.needsUpdate = true;
    }
    // Breathing keeps the feet planted (the sprite scales from its base); waving adds a sway.
    const breath = 1 + Math.sin(t * 1.9) * 0.006;
    m.scale.set(1 - (breath - 1) * 0.5, breath, 1);
    m.rotation.z = waving ? Math.sin((phase - IDLE_SECONDS) * 7) * 0.025 : Math.sin(t * 0.8) * 0.006;
  });

  return (
    <group ref={root} position={position}>
      {/* A soft contact shadow so she stands on the floor rather than floating. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[0.32, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {/* Scaled from the feet: the plane's origin is moved up by half its height. */}
      <mesh ref={body} position={[0, HEIGHT / 2, 0]} scale={1}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial ref={mat} map={idle} transparent alphaTest={0.04} toneMapped={false} />
      </mesh>
    </group>
  );
}
