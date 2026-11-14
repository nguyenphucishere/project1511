"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Vector3 } from "three";

const scale = new Vector3();

/** Smaller than this (metres, world radius) a mesh is not worth a place in the shadow pass. */
const MIN_CASTER_RADIUS = 0.3;

/** World radius of a mesh, worked out once: the shadow of a bolt or a rivet is not worth drawing. */
function casterRadius(o: Mesh): number {
  const cached = o.userData.shadowRadius as number | undefined;
  if (cached !== undefined) return cached;
  const g = o.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  o.updateWorldMatrix(true, false);
  o.matrixWorld.decompose(o.position.clone(), o.quaternion.clone(), scale);
  const radius = (g.boundingSphere?.radius ?? 0) * Math.max(scale.x, scale.y, scale.z);
  o.userData.shadowRadius = radius;
  return radius;
}

/**
 * Turns shadows on for every opaque mesh in the scene. Scene content is authored declaratively
 * without per-mesh flags, so this walks the graph about once a second to also catch meshes that
 * mount later (staff, vehicles, props). Transparent meshes (glass, dust, glow) never cast.
 */
export function ShadowEnabler() {
  const frame = useRef(0);
  useFrame(({ scene, gl }) => {
    // Re-render the shadow map every fourth frame, not every frame: the light and the set pieces
    // barely move, and the shadow pass is one of the heaviest parts of the frame.
    gl.shadowMap.autoUpdate = false;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __gl?: unknown; __scene?: unknown }).__gl = gl;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __scene?: unknown }).__scene = scene;
    if (frame.current % 4 === 0) gl.shadowMap.needsUpdate = true;
    if (frame.current++ % 45 !== 0) return;
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const transparent = !!mat?.transparent;
      o.receiveShadow = !transparent;
      o.castShadow = !transparent && mat?.type !== "MeshBasicMaterial" && casterRadius(o) >= MIN_CASTER_RADIUS;
    });
  });
  return null;
}
