"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { NoToneMapping, PCFSoftShadowMap } from "three";
import { useSettingsStore } from "@/game/settingsStore";
import { FirstPersonCamera } from "./FirstPersonCamera";
import { PrecompileScene } from "./PrecompileScene";
import { PixelPostProcess } from "./PixelPostProcess";
import { PostFX } from "./PostFX";
import { ResponsiveFov } from "./ResponsiveFov";
import { ShadowEnabler } from "./ShadowEnabler";
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
      // Up to 2x device pixels for sharp edges on retina/4K screens. The pixel pass renders at
      // ~270 lines regardless, so it never pays for the extra resolution.
      dpr={pixelFX ? [1, 1] : [1, 2]}
      shadows={{ type: PCFSoftShadowMap }}
      // Tone mapping is done by PostFX (ACES) or left off for the pixel pass; the composer
      // brings its own MSAA, so the default framebuffer only needs AA in the plain path.
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: NoToneMapping }}
      camera={{ fov: 70, near: 0.05, far: 900, position: [0, 1.6, 0] }}
    >
      <color attach="background" args={[PALETTE.deep]} />
      <ResponsiveFov />
      <FirstPersonCamera />
      <Suspense fallback={null}>
        {/* Studio image-based light: gives metal and glossy plastic something to reflect.
            Scenes may mount their own <Environment> (e.g. a sky) which then takes over. */}
        <Environment files="/assets/env/studio.hdr" environmentIntensity={0.6} />
        {children}
      </Suspense>
      <ShadowEnabler />
      <PrecompileScene />
      {pixelFX ? <PixelPostProcess /> : <PostFX />}
    </Canvas>
  );
}
