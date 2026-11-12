"use client";

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { clearTrauma, shake } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const DECAY = 0.9; // trauma lost per second
const MAX_YAW = 0.012; // radians at full trauma
const MAX_PITCH = 0.018;
const MAX_ROLL = 0.01;

/**
 * Adds a smooth, decaying wobble to the camera's rotation. It must render after
 * FirstPersonCamera: that one sets the rotation absolutely each frame, so this offset never
 * accumulates and the look direction is never changed. Position is left alone on purpose.
 * Off when the player asks for reduced motion.
 */
export function CameraShake() {
  const camera = useThree((s) => s.camera);
  const reduced = useReducedMotion();

  useEffect(() => clearTrauma, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(Math.max(rawDelta, 0), 0.1);
    if (shake.trauma <= 0) return;
    shake.trauma = Math.max(0, shake.trauma - DECAY * dt);
    if (reduced) return;
    const s = shake.trauma * shake.trauma;
    const t = state.clock.elapsedTime * 28;
    // Summed sines instead of Math.random(): random-per-frame buzzes like static.
    camera.rotation.x += MAX_PITCH * s * Math.sin(t * 1.7 + 0.3);
    camera.rotation.y += MAX_YAW * s * Math.sin(t * 1.3 + 1.1);
    camera.rotation.z += MAX_ROLL * s * Math.sin(t * 0.9 + 2.0);
  });

  return null;
}
