"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Object3D } from "three";

/**
 * Compiles every shader the launch film will ever use before the film starts. The rigs, the fairings
 * and the epilogue are hidden until their moment, and a hidden object is skipped by the renderer, so
 * its materials would otherwise compile the first frame it appears: a 150–300 ms freeze right in the
 * middle of a separation. Here everything is made visible for one `compile` (no draw, nothing
 * flashes on screen) and put back exactly as it was.
 */
export function Warmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    // Dev-only handle for profiling (renderer.info shows programs and geometries as they appear).
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __gl?: unknown }).__gl = gl;
    // A moment after mount, so every sibling has had its own effects and refs set.
    const id = window.setTimeout(() => {
      const saved: [Object3D, boolean, boolean][] = [];
      scene.traverse((o) => {
        saved.push([o, o.visible, o.frustumCulled]);
        o.visible = true;
      });
      try {
        gl.compile(scene, camera);
      } finally {
        for (const [o, visible, culled] of saved) {
          o.visible = visible;
          o.frustumCulled = culled;
        }
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [gl, scene, camera]);
  return null;
}
