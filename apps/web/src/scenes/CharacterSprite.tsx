"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface SpriteProps {
  /** Where the feet (or the bottom edge of a bust) stand. */
  position: [number, number, number];
  /** One image, or two to alternate between. */
  frames: [string] | [string, string];
  /** Height in metres and the image's width over height. */
  height: number;
  aspect: number;
  /** Seconds on the first frame, then on the second, per loop. */
  holdSeconds?: [number, number];
  /** Walk back and forth along x by this much (metres) while playing. */
  pace?: { range: number; speed: number };
  /** Draw a contact shadow on the floor (full-length figures only). */
  shadow?: boolean;
  /** Keep the sprite upright but turn it to face the camera. */
  billboard?: boolean;
  /** Fixed yaw when not a billboard. */
  yaw?: number;
}

/**
 * A hand-drawn character as a flat figure in the 3D room: it turns to face the camera about the
 * vertical axis only, breathes (scaling from its base) and swaps between its frames now and then.
 */
export function CharacterSprite({ position, frames, height, aspect, holdSeconds = [4.4, 2.2], pace, shadow = true, billboard = true, yaw = 0 }: SpriteProps) {
  const textures = useTexture(frames as string[], (list) => {
    for (const t of Array.isArray(list) ? list : [list]) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
    }
  });
  const list = Array.isArray(textures) ? textures : [textures];
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
    const t = clock.elapsedTime;
    if (pace && !reduced) g.position.x = position[0] + Math.sin(t * pace.speed) * pace.range;
    g.rotation.y = billboard ? Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z) : yaw;
    if (reduced || list.length < 2) {
      material.map = list[0]!;
      return;
    }
    const [a, b] = holdSeconds;
    const phase = t % (a + b);
    const next = phase >= a ? list[1]! : list[0]!;
    if (material.map !== next) {
      material.map = next;
      material.needsUpdate = true;
    }
    const breath = 1 + Math.sin(t * 1.9) * 0.006;
    m.scale.set(1 - (breath - 1) * 0.5, breath, 1);
    m.rotation.z = Math.sin(t * 0.8) * 0.006;
  });

  return (
    <group ref={root} position={position}>
      {shadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <circleGeometry args={[height * 0.18, 24]} />
          <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      <mesh ref={body} position={[0, height / 2, 0]}>
        <planeGeometry args={[height * aspect, height]} />
        <meshBasicMaterial ref={mat} map={list[0]} transparent alphaTest={0.04} toneMapped={false} />
      </mesh>
    </group>
  );
}
