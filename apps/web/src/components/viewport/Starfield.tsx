"use client";

import { useMemo } from "react";
import { PALETTE } from "@/lib/palette";

/** Star size in world units at the distance it is drawn; matches the old 0.7 m star planes. */
const STAR_SIZE = 0.7;

/**
 * Background stars as a single point cloud: one draw call however many stars. Positions are
 * world-space triples, e.g. from a seeded scatter so the sky is the same on every mount.
 */
export function Starfield({ positions }: { positions: readonly (readonly [number, number, number])[] }) {
  const array = useMemo(() => new Float32Array(positions.flat()), [positions]);
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[array, 3]} />
      </bufferGeometry>
      {/* With size attenuation, three scales points by (viewport height / 2) / depth but not by
          the field of view; dividing by tan(35°) (half the 70° fov) keeps STAR_SIZE in metres. */}
      <pointsMaterial color={PALETTE.mist} size={STAR_SIZE / Math.tan((35 * Math.PI) / 180)} sizeAttenuation />
    </points>
  );
}
