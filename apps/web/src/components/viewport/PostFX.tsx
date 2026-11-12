"use client";

import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Cinematic post-processing: soft bloom on lights/screens/engine glow, ACES filmic tone mapping,
 * a gentle vignette and SMAA anti-aliasing (the composer renders without MSAA on its own).
 * Not mounted while the retro pixel pass is active, since that pass owns the final render.
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom intensity={0.5} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}
