"use client";

import { forwardRef, useMemo } from "react";
import { Effect, EffectAttribute } from "postprocessing";
import { Uniform } from "three";

const fragment = /* glsl */ `
uniform float strength;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Contrast-adaptive sharpening (after AMD's CAS): the less contrast around a pixel, the more it
  // is sharpened, so flat areas gain crispness without halos on strong edges or noise on grain.
  vec3 a = texture2D(inputBuffer, uv + vec2(0.0, -texelSize.y)).rgb;
  vec3 b = texture2D(inputBuffer, uv + vec2(-texelSize.x, 0.0)).rgb;
  vec3 c = inputColor.rgb;
  vec3 d = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;
  vec3 e = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;

  vec3 mn = min(min(min(a, b), min(c, d)), e);
  vec3 mx = max(max(max(a, b), max(c, d)), e);
  vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
  vec3 w = -amp * mix(0.125, 0.2, strength);
  vec3 sharp = (w * (a + b + d + e) + c) / (1.0 + 4.0 * w);
  outputColor = vec4(clamp(sharp, 0.0, 1.0), inputColor.a);
}
`;

class Sharpen extends Effect {
  constructor(strength: number) {
    super("SharpenEffect", fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([["strength", new Uniform(strength)]]),
    });
  }
}

/** Post-process sharpening: lets the scene render below native resolution and still look crisp. */
export const Sharpening = forwardRef<Sharpen, { strength?: number }>(function Sharpening({ strength = 0.8 }, ref) {
  const effect = useMemo(() => new Sharpen(strength), [strength]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
