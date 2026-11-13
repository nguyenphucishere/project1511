"use client";

import { PALETTE } from "@/lib/palette";

/**
 * Lighting tuned for bright, crisp NASA aerospace aesthetic:
 * - Bright clean white key light brings out surfaces clearly.
 * - Deep navy/NASA blue hemisphere gives realistic space contrast.
 * - Gentle solar gold rim light adds warm highlights.
 */
export function LightingRig({ intensity = 1.25 }: { intensity?: number }) {
  return (
    <>
      <hemisphereLight args={[PALETTE.mist, PALETTE.blue, 2.2 * intensity]} />
      <directionalLight position={[4, 8, 6]} color="#FFFFFF" intensity={3.5 * intensity} />
      <directionalLight position={[-6, 4, -5]} color={PALETTE.gold} intensity={0.6 * intensity} />
      <directionalLight position={[0, -4, 2]} color={PALETTE.blue} intensity={0.4 * intensity} />
    </>
  );
}
