"use client";

import { PALETTE } from "@/lib/palette";

/**
 * Lighting for a crisp NASA look. Image-based light from the scene's Environment does most of
 * the work; these lights add direction and shadows:
 * - A white key light that casts soft shadows (what grounds objects to the floor).
 * - A low hemisphere fill so shadows never go fully black.
 * - A warm solar-gold rim light for highlights.
 */
export function LightingRig({ intensity = 1, shadowSize = 16 }: { intensity?: number; shadowSize?: number }) {
  return (
    <>
      <hemisphereLight args={[PALETTE.mist, PALETTE.blue, 0.55 * intensity]} />
      <directionalLight
        position={[4, 8, 6]}
        color="#FFFFFF"
        intensity={2.2 * intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
      />
      <directionalLight position={[-6, 4, -5]} color={PALETTE.gold} intensity={0.5 * intensity} />
    </>
  );
}
