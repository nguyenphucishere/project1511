"use client";

import { Canvas } from "@react-three/fiber";
import { useSettingsStore } from "@/game/settingsStore";
import { FirstPersonCamera } from "./FirstPersonCamera";
import { PixelPostProcess } from "./PixelPostProcess";
import { ResponsiveFov } from "./ResponsiveFov";
import { PALETTE } from "@/lib/palette";

export interface WorldCanvasInnerProps {
  children: React.ReactNode;
  /** Short description of what the scene shows, for screen readers. */
  label: string;
}

/** The R3F canvas. Browser-only: always load it through WorldCanvas (dynamic, ssr: false). */
export default function WorldCanvasInner({ children, label }: WorldCanvasInnerProps) {
  const pixelFX = useSettingsStore((s) => s.pixelFX);

  return (
    <Canvas
      role="img"
      aria-label={label}
      className="touch-none"
      // The pixel pass renders at ~270 lines, so device pixels above 1.5 only cost fill rate.
      dpr={[1, 1.5]}
      gl={{ antialias: !pixelFX, powerPreference: "high-performance" }}
      camera={{ fov: 70, near: 0.05, far: 200, position: [0, 1.6, 0] }}
    >
      <color attach="background" args={[PALETTE.deep]} />
      <ResponsiveFov />
      <FirstPersonCamera />
      {children}
      {pixelFX && <PixelPostProcess />}
    </Canvas>
  );
}
