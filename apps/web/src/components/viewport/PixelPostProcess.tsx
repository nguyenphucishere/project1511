"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { fullscreenVertex, paletteDitherFragment, weightedOklab } from "@/shaders/paletteDither";
import { PALETTE } from "@/lib/palette";

interface PixelPostProcessProps {
  /** Vertical resolution of the low-res render (pixels). Width follows the aspect ratio. */
  lines?: number;
  dither?: number;
  /** Brightness multiplier before palette matching. */
  exposure?: number;
}

/**
 * Renders the scene into a small render target, then draws it full screen through the
 * palette/dither shader. Mounting this component takes over R3F's render (useFrame priority 1);
 * unmounting it hands rendering back to R3F. HTML overlays are unaffected.
 */
export function PixelPostProcess({ lines = 270, dither = 1, exposure = 1 }: PixelPostProcessProps) {
  const size = useThree((s) => s.size);

  const target = useMemo(
    () =>
      new WebGLRenderTarget(1, 1, {
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        depthBuffer: true,
      }),
    [],
  );

  const post = useMemo(() => {
    const material = new ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: paletteDitherFragment,
      uniforms: {
        uScene: { value: target.texture },
        uResolution: { value: new Vector2(1, 1) },
        // Weighted Oklab of each colour for matching against the (linear) render target...
        uPaletteLab: {
          value: Object.values(PALETTE).map((hex) => {
            const c = new Color(hex); // hex is sRGB; Color stores linear
            return new Vector3(...weightedOklab([c.r, c.g, c.b]));
          }),
        },
        // ...and the untouched sRGB values to write to the canvas, so output is exactly the token.
        uPaletteSRGB: { value: Object.values(PALETTE).map((hex) => new Color().setStyle(hex, "srgb-linear")) },
        uDither: { value: dither },
        uExposure: { value: exposure },
      },
      depthTest: false,
      depthWrite: false,
    });
    const scene = new Scene();
    const quad = new Mesh(new PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);
    return { scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), material, quad };
  }, [target, dither, exposure]);

  useEffect(() => {
    const h = Math.max(90, Math.round(lines));
    const w = Math.max(1, Math.round((h * size.width) / Math.max(1, size.height)));
    target.setSize(w, h);
    post.material.uniforms.uResolution.value.set(w, h);
  }, [size.width, size.height, lines, target, post]);

  useEffect(
    () => () => {
      target.dispose();
      post.material.dispose();
      post.quad.geometry.dispose();
    },
    [target, post],
  );

  useFrame(({ gl, scene, camera }) => {
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(post.scene, post.camera);
  }, 1);

  return null;
}
