"use client";

import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Object3D } from "three";

/**
 * Compiles every material in the scene when it mounts, hidden ones included (exhaust, smoke,
 * dust). Otherwise their shaders compile the first time they appear, and that frame hitches at
 * the biggest moment of the scene (measured: 83 ms at liftoff on an M1). Must render after the
 * scene content. Unlike drei's <Preload>, no cube-camera pass.
 */
export function PrecompileScene() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useLayoutEffect(() => {
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    gl.compile(scene, camera);
    for (const o of hidden) o.visible = false;
  }, [gl, scene, camera]);

  return null;
}
