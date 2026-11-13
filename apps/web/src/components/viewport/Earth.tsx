"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AdditiveBlending, BackSide, Color, type Group, SRGBColorSpace } from "three";

/** Fresnel rim shader: bright where the surface grazes the view direction. */
const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), uPower);
    gl_FragColor = vec4(uColor * f * 1.6, f);
  }
`;

/**
 * The real Earth from NASA Blue Marble imagery: day map, drifting cloud layer and a glowing
 * blue atmosphere. `radius` is in scene metres; position it with the parent group.
 */
export function Earth({ radius = 7, spin = 0.01 }: { radius?: number; spin?: number }) {
  const [day, clouds] = useTexture(["/assets/textures/earth_day_6k.jpg", "/assets/textures/earth_clouds_4k.jpg"], (t) => {
    for (const tex of t) {
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 16;
    }
  });
  const group = useRef<Group>(null);
  const cloudRef = useRef<Group>(null);
  const atmosphereUniforms = useMemo(() => ({ uColor: { value: new Color("#5AA9FF") }, uPower: { value: 2.6 } }), []);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * spin;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * spin * 0.35;
  });

  return (
    <>
      <group ref={group} rotation={[0.1, 2.2, 0]}>
        <mesh>
          <sphereGeometry args={[radius, 96, 64]} />
          <meshStandardMaterial map={day} roughness={0.9} metalness={0} emissiveMap={day} emissive="#183A6B" emissiveIntensity={0.35} />
        </mesh>
        <group ref={cloudRef}>
          <mesh>
            <sphereGeometry args={[radius * 1.012, 96, 64]} />
            <meshStandardMaterial map={clouds} alphaMap={clouds} transparent opacity={0.85} depthWrite={false} roughness={1} />
          </mesh>
        </group>
      </group>
      {/* Atmosphere glow, drawn on the inside of a slightly larger sphere so it halos the limb. */}
      <mesh>
        <sphereGeometry args={[radius * 1.16, 64, 48]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={atmosphereUniforms}
          side={BackSide}
          blending={AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
