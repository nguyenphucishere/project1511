"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { SRGBColorSpace, type WebGLProgramParametersWithUniforms } from "three";
import { MOON, R_MOON } from "./flight";

/**
 * The 4K Moon map is only enough from far away; flying a hundred kilometres above it needs finer
 * detail. This adds, in the shader, a few octaves of noise and two scales of crater-like cells,
 * both as brightness and as a bump, faded out with distance so far views stay clean.
 */
const NOISE = /* glsl */ `
  varying vec3 vObj;
  float h31(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  // Crater-like bowls: distance to the nearest of eight jittered points, shaped into a dip with a rim.
  float bowls(vec3 p) {
    vec3 c = floor(p + 0.5);
    float best = 9.0;
    for (int i = 0; i < 8; i++) {
      vec3 o = vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1)) - 0.5 + 0.0;
      vec3 cell = c + o;
      vec3 j = vec3(h31(cell), h31(cell + 7.3), h31(cell + 13.1)) - 0.5;
      float d = length(p - (cell + j * 0.6));
      best = min(best, d);
    }
    float r = best / 0.55;
    float dip = -smoothstep(1.0, 0.0, r) * 0.9;
    float rim = smoothstep(0.7, 1.0, r) * smoothstep(1.35, 1.0, r) * 0.5;
    return dip + rim;
  }
  float moonHeight(vec3 p) {
    float h = 0.0;
    h += bowls(p * 0.9) * 0.9;
    h += bowls(p * 3.1 + 5.0) * 0.5;
    h += bowls(p * 11.0 + 9.0) * 0.25;
    h += (vnoise(p * 14.0) - 0.5) * 0.1;
    return h;
  }
`;

function patch(shader: WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${NOISE}`)
    .replace(
      "#include <map_fragment>",
      `#include <map_fragment>
       float detailFade = 1.0 - smoothstep(6.0, 70.0, length(vViewPosition));
       // Far views (most of the film) skip the noise entirely; near views compute it once for both uses.
       float hh = 0.0;
       if (detailFade > 0.0) hh = moonHeight(vObj);
       diffuseColor.rgb *= 1.0 + hh * 0.38 * detailFade;`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
       {
         float bh = hh * detailFade;
         vec3 dp1 = dFdx(-vViewPosition);
         vec3 dp2 = dFdy(-vViewPosition);
         float dh1 = dFdx(bh);
         float dh2 = dFdy(bh);
         vec3 r1 = cross(dp2, normal);
         vec3 r2 = cross(normal, dp1);
         float det = dot(dp1, r1);
         float sgn = det < 0.0 ? -1.0 : 1.0;
         vec3 grad = sgn * (dh1 * r1 + dh2 * r2);
         normal = normalize(abs(det) * normal - 0.035 * grad);
       }`,
    );
}

/** The Moon: LRO imagery on a sphere that keeps its near side turned toward the Earth. */
export function MoonBody() {
  const map = useTexture("/assets/textures/moon_4k.jpg", (t) => {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 16;
  });
  const key = useMemo(() => "moon-detail", []);
  return (
    <mesh position={MOON} rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[R_MOON, 96, 72]} />
      <meshStandardMaterial map={map} color="#cfcfd4" roughness={1} metalness={0} onBeforeCompile={patch} customProgramCacheKey={() => key} />
    </mesh>
  );
}
