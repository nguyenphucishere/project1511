"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

/**
 * Turns shadows on for every opaque mesh in the scene. Scene content is authored declaratively
 * without per-mesh flags, so this walks the graph a few times a second to also catch meshes that
 * mount later (staff, vehicles, props). Transparent meshes (glass, dust, glow) never cast.
 */
export function ShadowEnabler() {
  const frame = useRef(0);
  useFrame(({ scene }) => {
    if (frame.current++ % 20 !== 0) return;
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const transparent = !!mat?.transparent;
      o.receiveShadow = !transparent;
      o.castShadow = !transparent && mat?.type !== "MeshBasicMaterial";
    });
  });
  return null;
}
