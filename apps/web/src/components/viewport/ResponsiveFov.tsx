"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera } from "three";

const BASE_VFOV = 70;
const MIN_HFOV = 55;
const MAX_VFOV = 100;

/**
 * Keeps enough horizontal view on tall (phone portrait) screens: a fixed vertical FOV of 70°
 * leaves only ~36° across at 390×844, which feels like looking through a tube.
 */
export function ResponsiveFov() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = width / Math.max(1, height);
    const needed = 2 * Math.atan(Math.tan(MathUtils.degToRad(MIN_HFOV) / 2) / aspect);
    camera.fov = Math.min(MAX_VFOV, Math.max(BASE_VFOV, MathUtils.radToDeg(needed)));
    camera.updateProjectionMatrix();
  }, [camera, width, height]);

  return null;
}
