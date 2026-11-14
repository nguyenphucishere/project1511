"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, type Group, type ShaderMaterial, Vector3 } from "three";
import { filmClock } from "./clock";
import { SEA, T } from "./flight";

/** Direction to the afternoon sun at the splashdown set (low, ahead and to the left). */
export const SEA_SUN = new Vector3(-0.35, 0.42, -0.8).normalize();

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSun;
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 horizon = vec3(0.78, 0.87, 0.96);
    vec3 zenith = vec3(0.14, 0.38, 0.8);
    vec3 col = mix(horizon, zenith, pow(up, 0.55));
    float s = max(dot(d, uSun), 0.0);
    col += vec3(1.0, 0.85, 0.6) * (pow(s, 24.0) * 0.35 + pow(s, 600.0) * 4.0);
    // Soft cloud deck
    vec2 uv = d.xz / (d.y + 0.35) * 2.2;
    float c = n2(uv) * 0.55 + n2(uv * 2.3) * 0.3 + n2(uv * 5.0) * 0.15;
    float cloud = smoothstep(0.52, 0.8, c) * smoothstep(0.0, 0.25, d.y);
    col = mix(col, vec3(0.97, 0.97, 1.0), cloud * 0.75);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SEA_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const SEA_FRAG = /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 uSun;
  uniform float uTime;
  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;
    // A few crossing swells; the normal is their gradient.
    vec2 g = vec2(0.0);
    g += vec2(cos(p.x * 0.35 + t * 0.8), 0.3 * cos(p.y * 0.2 + t * 0.5)) * 0.06;
    float w2 = cos(p.x * 0.9 + p.y * 0.7 - t * 1.3) * 0.035;
    g += vec2(w2, w2);
    g += vec2(cos(p.y * 2.1 + t * 1.9), cos(p.x * 1.7 - t * 1.6)) * 0.018;
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 deep = vec3(0.01, 0.1, 0.19);
    vec3 shallow = vec3(0.05, 0.3, 0.4);
    vec3 col = mix(deep, shallow, 0.25 + 0.5 * n.y * n.y);
    vec3 sky = vec3(0.6, 0.78, 0.94);
    col = mix(col, sky, fres * 0.75);
    vec3 r = reflect(-uSun, n);
    float spec = pow(max(dot(r, v), 0.0), 220.0);
    col += vec3(1.0, 0.9, 0.7) * spec * 3.0;
    // Haze toward the horizon
    float dist = length(cameraPosition.xz - vWorld.xz);
    col = mix(col, vec3(0.78, 0.87, 0.96), smoothstep(150.0, 2600.0, dist));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SKY_UNIFORMS = { uSun: { value: SEA_SUN } };
const SEA_UNIFORMS = { uSun: { value: SEA_SUN }, uTime: { value: 0 } };

/**
 * The splashdown set: a sky dome and an ocean far away from the space scenes, so the camera can
 * simply cut there. Both are hand-written shaders (no textures), shown only for those shots.
 */
export function SeaSet() {
  const group = useRef<Group>(null);
  const sea = useRef<ShaderMaterial>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible = filmClock.t >= T.CHUTES - 0.5;
    if (sea.current) sea.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group ref={group} position={SEA}>
      <mesh renderOrder={-2}>
        <sphereGeometry args={[3000, 32, 24]} />
        <shaderMaterial vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} uniforms={SKY_UNIFORMS} side={BackSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8000, 8000, 1, 1]} />
        <shaderMaterial ref={sea} vertexShader={SEA_VERT} fragmentShader={SEA_FRAG} uniforms={SEA_UNIFORMS} toneMapped={false} />
      </mesh>
    </group>
  );
}
