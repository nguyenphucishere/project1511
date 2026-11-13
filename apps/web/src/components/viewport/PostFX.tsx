"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { Vector2 } from "three";
import { fx } from "@/game/fx";
import { Sharpening } from "./SharpenEffect";

const BASE_ABERRATION = 0.00035;

/**
 * Cinematic post-processing: soft bloom on lights/screens/engine glow, ACES filmic tone mapping,
 * a touch of chromatic aberration (which scenes can push up during violent moments), film grain,
 * a gentle vignette and SMAA anti-aliasing (the composer renders without MSAA on its own).
 * Not mounted while the retro pixel pass is active, since that pass owns the final render.
 */
export function PostFX() {
  const offset = useRef(new Vector2(BASE_ABERRATION, BASE_ABERRATION));
  // A separate full-screen pass, so it only exists while a scene is actually pushing it up.
  const [aberrating, setAberrating] = useState(fx.aberration > 0.0005);
  useFrame(() => {
    const a = BASE_ABERRATION + fx.aberration;
    offset.current.set(a, a);
    const on = fx.aberration > 0.0005;
    if (on !== aberrating) setAberrating(on);
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* Four mip levels at half resolution: the default eight cost ~16 full passes for a glow nobody can tell apart. */}
      <Bloom intensity={0.5} luminanceThreshold={1.0} luminanceSmoothing={0.2} mipmapBlur levels={4} resolutionScale={0.5} />
      {aberrating ? <ChromaticAberration offset={offset.current} radialModulation={false} modulationOffset={0} /> : <></>}
      <Vignette eskil={false} offset={0.25} darkness={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.12} />
      <SMAA />
      <Sharpening strength={0.8} />
    </EffectComposer>
  );
}
