"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BackSide, BufferGeometry, Float32BufferAttribute, type Mesh, type Points, type PointsMaterial, type ShaderMaterial } from "three";
import { nominalAltitudeKm } from "./flight";

/**
 * The sky gives way to space with height, as it does in life: the blue thins from about 25 km
 * (clouds and haze are long gone), the stars start to show, and by 65 km it is black.
 */
export const SPACE_FROM_KM = 25;
export const SPACE_TO_KM = 65;

const RADIUS = 620;
const smooth = (x: number) => x * x * (3 - 2 * x);

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Black above the horizon, below it the Earth: deep ocean, cloud swirls, and on the night side a
 * scatter of city lights, with a bright thin limb between them.
 */
const FRAGMENT = /* glsl */ `
uniform float uFade;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 space = vec3(0.004, 0.006, 0.02);
  vec3 col = space;
  if (h <= 0.0) {
    // Look down the sphere onto a plane of Earth that foreshortens toward the limb.
    vec2 p = dir.xz / max(0.06, -h) * 0.55 + vec2(uTime * 0.012, uTime * 0.004);
    float land = smoothstep(0.52, 0.62, fbm(p * 0.9 + 3.0));
    float cloud = smoothstep(0.45, 0.8, fbm(p * 1.7 + vec2(fbm(p * 0.8) * 2.0)));
    float day = smoothstep(-0.25, 0.35, dir.x + 0.1 * sin(p.y * 0.7));
    vec3 ocean = mix(vec3(0.01, 0.04, 0.12), vec3(0.04, 0.2, 0.5), smoothstep(-0.9, -0.05, h));
    vec3 ground = mix(ocean, vec3(0.28, 0.3, 0.16), land * 0.8);
    vec3 lit = mix(ground * 0.12, ground * 1.5, day);
    lit = mix(lit, vec3(0.9, 0.95, 1.0) * mix(0.25, 1.0, day), cloud * 0.85);
    // Cities glow on the dark side, mostly along the coasts.
    float city = step(0.985, hash(floor(p * 70.0))) * (1.0 - day) * (0.3 + land) * (1.0 - cloud * 0.8);
    lit += vec3(1.0, 0.75, 0.35) * city * 1.6;
    col = lit;
  }
  col += vec3(0.35, 0.65, 1.0) * exp(-abs(h) * 22.0) * 0.85;
  // The sun just coming up over the limb to the right: a hot core, an orange fan along the horizon
  // and a thin blue-white atmosphere line that brightens toward it.
  vec3 sun = normalize(vec3(0.82, 0.03, 0.57));
  float sd = max(dot(dir, sun), 0.0);
  col += vec3(1.0, 0.93, 0.8) * pow(sd, 900.0) * 6.0;
  col += vec3(1.0, 0.55, 0.2) * pow(sd, 18.0) * exp(-abs(h) * 14.0) * 0.9;
  col += vec3(1.0, 0.8, 0.55) * pow(sd, 140.0) * 0.8;
  col += vec3(0.5, 0.75, 1.0) * exp(-abs(h) * 70.0) * (0.4 + 1.4 * pow(sd, 3.0));
  col += vec3(0.08, 0.16, 0.35) * exp(-max(h, 0.0) * 9.0) * 0.5;
  gl_FragColor = vec4(col, uFade);
}`;

/**
 * Leaving the atmosphere. A dome that follows the camera and fades in over the blue HDRI sky,
 * turning it into black space with stars above and the bright limb of the Earth below.
 */
export function SpaceDome({ ignitionAt }: { ignitionAt: number | null }) {
  const dome = useRef<Mesh>(null);
  const stars = useRef<Points>(null);
  const domeMat = useRef<ShaderMaterial>(null);
  const starMat = useRef<PointsMaterial>(null);

  const starGeometry = useMemo(() => {
    const g = new BufferGeometry();
    const n = 1400;
    const p = new Float32Array(n * 3);
    let s = 12345;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      // Upper hemisphere only: the Earth is below.
      const y = rnd() * 0.97 + 0.03;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      p[i * 3] = Math.cos(a) * r * (RADIUS - 5);
      p[i * 3 + 1] = y * (RADIUS - 5);
      p[i * 3 + 2] = Math.sin(a) * r * (RADIUS - 5);
    }
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    return g;
  }, []);

  useFrame(({ camera }) => {
    const t = ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    const k = t < 0 ? 0 : smooth(Math.min(1, Math.max(0, (nominalAltitudeKm(t) - SPACE_FROM_KM) / (SPACE_TO_KM - SPACE_FROM_KM))));
    const on = k > 0.003;
    if (dome.current) {
      dome.current.visible = on;
      dome.current.position.copy(camera.position);
    }
    if (stars.current) {
      stars.current.visible = on;
      stars.current.position.copy(camera.position);
    }
    if (domeMat.current) {
      domeMat.current.uniforms.uFade!.value = k;
      domeMat.current.uniforms.uTime!.value = t;
    }
    if (starMat.current) starMat.current.opacity = k * k;
  });

  return (
    <>
      <mesh ref={dome} frustumCulled={false} visible={false} renderOrder={-2}>
        <sphereGeometry args={[RADIUS, 32, 16]} />
        <shaderMaterial
          ref={domeMat}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          uniforms={{ uFade: { value: 0 }, uTime: { value: 0 } }}
          side={BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
      <points ref={stars} geometry={starGeometry} frustumCulled={false} visible={false} renderOrder={-1}>
        <pointsMaterial
          ref={starMat}
          color="#dfe9ff"
          size={1.8}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </>
  );
}
