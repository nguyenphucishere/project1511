"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferGeometry, CanvasTexture, Float32BufferAttribute, PerspectiveCamera, type Group, type Points, type ShaderMaterial, type SpriteMaterial } from "three";

/**
 * The fire of a reentry, drawn as what it is: a white-hot shock layer glowing in front of the heat shield,
 * and a stream of incandescent gas and burning heat-shield material flowing back past the capsule, hottest
 * and brightest right behind the shoulders, cooling from white to yellow to orange to dull red, and thinning
 * away. Every ember is placed from its age in the vertex shader, so it costs nothing per frame but the clock.
 *
 * The capsule's local frame: -Z is the way it flies (the heat shield's face), +Z the way the air streams.
 * `flowRef` is the group that holds the stream, so the parent can keep it aligned with the airflow when the
 * capsule is tipped to it. `heat` is read every frame (0 to 1).
 */
const EMBERS = 1800;
const STREAM_LENGTH = 13;

const VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uHeat;
  uniform float uScale;
  varying float vAge;
  varying float vAlpha;
  void main() {
    float rate = 0.5 + 0.45 * aSeed.w;
    float age = fract(uTime * rate + aSeed.x);
    // Streams back (+Z), a little slower the older it gets.
    float z = 0.1 + STREAM_LENGTH * (age * (0.55 + 0.6 * aSeed.w));
    // The stream is widest just behind the shoulders and thins as it cools and runs out.
    float spread = (0.55 + 0.4 * aSeed.z) * (1.15 - 0.75 * age);
    float ang = aSeed.y * 6.2831853 + 0.9 * sin(uTime * 1.7 + aSeed.x * 40.0) * age;
    vec3 p = vec3(cos(ang) * spread, sin(ang) * spread, z);
    // Turbulence that grows with distance, so the edge is ragged and alive.
    p.xy += 0.32 * age * vec2(sin(uTime * 7.3 + aSeed.x * 61.0), cos(uTime * 6.1 + aSeed.y * 47.0));
    vAge = age;
    vAlpha = min(1.0, uHeat * 1.1) * 0.32 * pow(1.0 - age, 1.5) * smoothstep(0.0, 0.03, age);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = (0.55 + 1.0 * aSeed.z) * (1.0 - 0.5 * age);
    gl_PointSize = max(1.0, size * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`.replace("STREAM_LENGTH", STREAM_LENGTH.toFixed(1));

const FRAG = /* glsl */ `
  varying float vAge;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = pow(clamp(1.0 - d, 0.0, 1.0), 1.8);
    vec3 white = vec3(2.4, 2.0, 1.3);
    vec3 orange = vec3(2.1, 0.8, 0.2);
    vec3 red = vec3(1.1, 0.16, 0.05);
    vec3 col = vAge < 0.2 ? mix(white, orange, vAge / 0.2) : mix(orange, red, clamp((vAge - 0.2) / 0.7, 0.0, 1.0));
    gl_FragColor = vec4(col, soft * vAlpha);
  }
`;

function glowTexture(stops: [number, string][]) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, color] of stops) g.addColorStop(at, color);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export function Plasma({ heat, flowRef }: { heat: React.RefObject<number>; flowRef: React.RefObject<Group | null> }) {
  const points = useRef<Points>(null);
  const mat = useRef<ShaderMaterial>(null);
  const core = useRef<SpriteMaterial>(null);
  const halo = useRef<SpriteMaterial>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const seed = new Float32Array(EMBERS * 4);
    let s = 1;
    // A fixed pseudo-random sequence, so the fire looks the same every time.
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < seed.length; i++) seed[i] = rnd();
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(EMBERS * 3), 3));
    g.setAttribute("aSeed", new Float32BufferAttribute(seed, 4));
    g.boundingSphere = null;
    return g;
  }, []);
  const coreTex = useMemo(() => glowTexture([[0, "rgba(255,250,235,1)"], [0.25, "rgba(255,226,150,0.85)"], [0.6, "rgba(255,140,50,0.35)"], [1, "rgba(255,90,20,0)"]]), []);
  const haloTex = useMemo(() => glowTexture([[0, "rgba(255,170,90,0.55)"], [0.5, "rgba(255,110,40,0.22)"], [1, "rgba(255,70,20,0)"]]), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uHeat: { value: 0 }, uScale: { value: 600 } }), []);

  useFrame(({ clock, camera, size }) => {
    const h = heat.current ?? 0;
    // Through the material itself: the uniforms the renderer actually holds (as the sea does).
    const u = mat.current?.uniforms;
    if (u) {
      u.uTime!.value = clock.elapsedTime;
      u.uHeat!.value = h;
      const fov = camera instanceof PerspectiveCamera ? camera.fov : 40;
      u.uScale!.value = size.height / (2 * Math.tan((fov * Math.PI) / 360));
    }
    const flick = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 41) * Math.sin(clock.elapsedTime * 13 + 1);
    if (core.current) core.current.opacity = Math.min(1, h * 1.5) * flick;
    if (halo.current) halo.current.opacity = Math.min(0.6, h * 0.9);
  });

  return (
    <>
      {/* The shock layer: a white-hot glow in front of the heat shield, and a wider orange halo around it */}
      <sprite position={[0, 0, -0.5]} scale={[2.3, 2.3, 1]} renderOrder={3}>
        <spriteMaterial ref={core} map={coreTex} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite position={[0, 0, 0.1]} scale={[4.2, 4.2, 1]} renderOrder={2}>
        <spriteMaterial ref={halo} map={haloTex} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      {/* The stream, kept aligned with the airflow */}
      <group ref={flowRef}>
        <points ref={points} geometry={geometry} frustumCulled={false} renderOrder={1}>
          <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </points>
      </group>
    </>
  );
}
