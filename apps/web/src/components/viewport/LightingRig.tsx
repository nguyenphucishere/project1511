"use client";

import { PALETTE } from "@/lib/palette";

/**
 * Lighting tuned for the 5-colour pixel pass: a neutral mist key keeps surfaces close to their
 * own palette colour (tinted light pushes them between two palette colours and the dither turns
 * that into noise); a cool blue/deep hemisphere shades the sides; a weak gold rim adds warmth.
 * No shadows: the pixel pass flattens them and they are the costliest part of a frame.
 */
export function LightingRig({ intensity = 1 }: { intensity?: number }) {
  return (
    <>
      <hemisphereLight args={[PALETTE.mist, PALETTE.deep, 1.6 * intensity]} />
      <directionalLight position={[3, 6, 5]} color={PALETTE.mist} intensity={2.4 * intensity} />
      <directionalLight position={[-5, 3, -4]} color={PALETTE.gold} intensity={0.12 * intensity} />
    </>
  );
}
