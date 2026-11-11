/**
 * Pixel-art post-process: the scene is rendered to a low-resolution target, then this pass
 * upscales it with nearest sampling and maps every pixel onto the 5-colour palette using a
 * 4×4 ordered (Bayer) dither between the two closest palette colours.
 *
 * Colours are compared in Oklab with chroma weighted ×2. Plain RGB distance sends neutral
 * mid-greys (any shaded surface) to orange, because orange is the palette's mid-luminance
 * colour; with chroma weighted, greys fall to the cool blue/deep shadow tones instead.
 *
 * GLSL ES for three.js ShaderMaterial on WebGLRenderer (not compatible with WebGPURenderer).
 * Kept as TS strings so both webpack and Turbopack can bundle them without a loader.
 */

export const CHROMA_WEIGHT = 2.0;

/** Same transform as the shader's oklab(), run once per palette colour on the CPU. */
export function weightedOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * CHROMA_WEIGHT,
    (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) * CHROMA_WEIGHT,
  ];
}

export const fullscreenVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const paletteDitherFragment = /* glsl */ `
uniform sampler2D uScene;
uniform vec2 uResolution;      // low-res target size in pixels
uniform vec3 uPaletteLab[5];    // for matching: weighted Oklab, precomputed by paletteLab()
uniform vec3 uPaletteSRGB[5];   // for output (written straight to the sRGB canvas)
uniform float uDither;          // 0 = hard quantise, 1 = full ordered dither
uniform float uExposure;
varying vec2 vUv;

const float CHROMA_WEIGHT = ${CHROMA_WEIGHT.toFixed(1)};

vec3 oklab(vec3 c) {
  c = max(c, 0.0);
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  vec3 lms = pow(vec3(l, m, s), vec3(1.0 / 3.0));
  vec3 lab = vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z
  );
  return vec3(lab.x, lab.yz * CHROMA_WEIGHT);
}

// Recursive Bayer matrix without arrays: values in [0, 1).
float bayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void main() {
  // Snap to the centre of the low-res texel: every screen pixel in a texel gets one colour.
  vec2 texel = floor(vUv * uResolution);
  vec3 c = oklab(texture2D(uScene, (texel + 0.5) / uResolution).rgb * uExposure);

  // Two nearest palette colours (in weighted Oklab), remembering their sRGB output values.
  float best = 1e9; float second = 1e9;
  vec3 a = vec3(0.0); vec3 b = vec3(0.0);
  vec3 aOut = uPaletteSRGB[0]; vec3 bOut = uPaletteSRGB[0];
  for (int i = 0; i < 5; i++) {
    vec3 p = uPaletteLab[i];
    vec3 d = c - p;
    float dd = dot(d, d);
    if (dd < best) {
      second = best; b = a; bOut = aOut;
      best = dd; a = p; aOut = uPaletteSRGB[i];
    } else if (dd < second) {
      second = dd; b = p; bOut = uPaletteSRGB[i];
    }
  }

  // Where c sits between a and b, thresholded by the Bayer value.
  vec3 ab = b - a;
  float len2 = max(dot(ab, ab), 1e-6);
  float t = clamp(dot(c - a, ab) / len2, 0.0, 1.0);
  // Only dither when c really lies between a and b; off that line the mix would turn into a
  // two-hue checkerboard, so fade it out.
  vec3 off = c - (a + ab * t);
  t *= 1.0 - smoothstep(0.08, 0.25, dot(off, off) / len2);
  float threshold = mix(0.5, bayer4(texel) + 1.0 / 32.0, uDither);
  gl_FragColor = vec4(t > threshold ? bOut : aOut, 1.0);
}
`;
