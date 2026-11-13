"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, type BufferAttribute, type BufferGeometry, type Points } from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";
import { HALL } from "./layout";
import { useHallTextures } from "./textures";

/** Overdriven colours: values above 1 are what makes the post-processing bloom a lamp or a window. */
const LAMP = new Color(4.2, 4.1, 3.8);
const SKYLIGHT = new Color(1.6, 2.1, 3.0);


/**
 * The mirror floor renders the hall a second time, which weaker graphics cards cannot afford.
 * Watch the frame rate once the scene has settled and fall back to a plain glossy floor if it is low.
 */
function useMirrorFloor() {
  const [mirror, setMirror] = useState(true);
  const samples = useRef<number[]>([]);
  const settled = useRef(0);
  useFrame((_, dt) => {
    if (!mirror || samples.current.length >= 150) return;
    settled.current += dt;
    if (settled.current < 3) return; // textures are still uploading
    samples.current.push(dt);
    if (samples.current.length === 150) {
      const sorted = [...samples.current].sort((a, b) => a - b);
      if (sorted[75] > 1 / 28) setMirror(false);
    }
  });
  return mirror;
}

/**
 * The assembly hall: a polished epoxy floor that mirrors the rocket, real concrete, corrugated
 * iron and steel plate, roof trusses, high-bay lamps, skylight strips and the light they throw.
 */
export function Hall() {
  const tex = useHallTextures();
  const mirror = useMirrorFloor();
  const w = HALL.maxX - HALL.minX;
  const d = HALL.maxZ - HALL.minZ;
  const cz = (HALL.minZ + HALL.maxZ) / 2;
  const h = HALL.height;
  const door = { width: 18, height: 34 };
  const lampGrid = useMemo(() => [-12, -4, 4, 12].flatMap((x) => [-10, 0, 10].map((z) => [x, z] as const)), []);

  return (
    <group>
      {/* Polished concrete floor, reflecting everything above it */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]} receiveShadow>
        <planeGeometry args={[w, d]} />
        {mirror ? (
          <MeshReflectorMaterial
            map={tex.floor.map}
            normalMap={tex.floor.normalMap}
            roughnessMap={tex.floor.roughnessMap}
            color="#c8d0d8"
            roughness={1}
            metalness={0.05}
            blur={[280, 90]}
            resolution={768}
            mixBlur={1.1}
            mixStrength={1.35}
            mirror={0.62}
            depthScale={0.5}
            minDepthThreshold={0.7}
            maxDepthThreshold={1.5}
          />
        ) : (
          <meshStandardMaterial
            map={tex.floor.map}
            normalMap={tex.floor.normalMap}
            roughnessMap={tex.floor.roughnessMap}
            color="#c8d0d8"
            roughness={0.7}
            metalness={0.1}
            envMapIntensity={1.4}
          />
        )}
      </mesh>

      {/* Roof: steel deck with trusses */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial {...tex.metalCeiling} color="#59616b" roughness={0.9} metalness={0.6} />
      </mesh>
      {[-14, -8, -2, 4, 10, 16].map((z) => (
        <group key={z} position={[0, h - 1.1, z]}>
          <mesh>
            <boxGeometry args={[w, 0.5, 0.7]} />
            <meshStandardMaterial {...tex.metalGirder} color="#6b7480" metalness={0.8} roughness={0.55} />
          </mesh>
          <mesh position={[0, -1.1, 0]}>
            <boxGeometry args={[w, 0.3, 0.4]} />
            <meshStandardMaterial {...tex.metalGirder} color="#4d555f" metalness={0.8} roughness={0.55} />
          </mesh>
          {Array.from({ length: 13 }, (_, i) => (
            <mesh key={i} position={[-18 + i * 3, -0.55, 0]} rotation={[0, 0, i % 2 ? 0.9 : -0.9]}>
              <boxGeometry args={[0.14, 1.4, 0.14]} />
              <meshStandardMaterial color="#59616b" metalness={0.8} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Back wall: concrete, then the rollout door of corrugated iron */}
      <mesh position={[0, h / 2, HALL.minZ]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial {...tex.wallBack} color="#d4dbe6" roughness={0.95} />
      </mesh>
      <mesh position={[0, door.height / 2, HALL.minZ + 0.03]}>
        <planeGeometry args={[door.width, door.height]} />
        <meshStandardMaterial {...tex.ironDoor} color="#aebccb" metalness={0.75} roughness={0.7} />
      </mesh>
      {[-door.width / 2 - 0.35, door.width / 2 + 0.35].map((x) => (
        <mesh key={x} position={[x, door.height / 2, HALL.minZ + 0.14]}>
          <boxGeometry args={[0.7, door.height, 0.3]} />
          <meshStandardMaterial {...tex.metalPillar} color="#3a424d" metalness={0.8} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, door.height + 0.35, HALL.minZ + 0.14]}>
        <boxGeometry args={[door.width + 1.7, 0.7, 0.3]} />
        <meshStandardMaterial {...tex.metalPillar} color="#3a424d" metalness={0.8} roughness={0.5} />
      </mesh>
      <mesh position={[0, door.height * 0.62, HALL.minZ + 0.07]}>
        <planeGeometry args={[door.width, 1.6]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0, door.height * 0.62 - 1.05, HALL.minZ + 0.075]}>
        <planeGeometry args={[door.width, 0.36]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.55, HALL.minZ + 0.08]}>
        <planeGeometry args={[door.width, 1.1]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
      </mesh>

      {/* Side walls: painted concrete up to 8 m, corrugated iron above, skylight strips at the top */}
      {[HALL.minX, HALL.maxX].map((x) => {
        const rotY = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        const inward = x < 0 ? 1 : -1;
        return (
          <group key={x}>
            <mesh position={[x, 4, cz]} rotation={[0, rotY, 0]}>
              <planeGeometry args={[d, 8]} />
              <meshStandardMaterial {...tex.wallLow} color="#dfe6ef" roughness={0.95} />
            </mesh>
            <mesh position={[x, 8 + (h - 8 - 6) / 2, cz]} rotation={[0, rotY, 0]}>
              <planeGeometry args={[d, h - 8 - 6]} />
              <meshStandardMaterial {...tex.iron} color="#b4c0cd" metalness={0.7} roughness={0.7} />
            </mesh>
            <mesh position={[x + inward * 0.03, h - 3, cz]} rotation={[0, rotY, 0]}>
              <planeGeometry args={[d - 2, 3.2]} />
              <meshBasicMaterial color={SKYLIGHT} toneMapped={false} />
            </mesh>
            {[-12, -6, 0, 6, 12].map((z) => (
              <mesh key={z} position={[x + inward * 0.35, h / 2, z]}>
                <boxGeometry args={[0.7, h, 0.7]} />
                <meshStandardMaterial {...tex.metalPillar} color="#5b6572" metalness={0.8} roughness={0.5} />
              </mesh>
            ))}
            {Array.from({ length: 15 }, (_, i) => (
              <mesh key={i} position={[x + inward * 0.08, h - 3, -14 + i * 2.1]}>
                <boxGeometry args={[0.16, 3.3, 0.14]} />
                <meshStandardMaterial color="#2d343d" metalness={0.8} roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Front wall */}
      <mesh position={[0, h / 2, HALL.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial {...tex.wallLow} color="#dfe6ef" roughness={0.95} />
      </mesh>

      {/* High-bay lamps */}
      {lampGrid.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, h - 2.3, z]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 2.2, 6]} />
            <meshStandardMaterial color="#2d343d" metalness={0.8} roughness={0.5} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.25, 1.05, 0.55, 28, 1, true]} />
            <meshStandardMaterial color="#aab3be" metalness={0.8} roughness={0.35} side={DoubleSide} />
          </mesh>
          <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.95, 28]} />
            <meshBasicMaterial color={LAMP} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Floor markings */}
      {[3, 5, 7, 9, 11, 13, 15].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, z]}>
          <planeGeometry args={[0.3, 1.2]} />
          <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, cz]}>
          <planeGeometry args={[0.2, d]} />
          <meshStandardMaterial color="#1b222b" metalness={0.9} roughness={0.3} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- atmosphere */

const SHAFT_SPOTS: [number, number][] = [[-12, -10], [12, -10], [-12, 10], [12, 10], [-4, -10], [4, -10]];

const SHAFT_SHADER = {
  uniforms: { uColor: { value: new Color(1, 0.95, 0.85) }, uIntensity: { value: 0.1 } },
  vertexShader: `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){
      vUv = uv;
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    uniform vec3 uColor; uniform float uIntensity;
    void main(){
      float fade = pow(clamp(vUv.y, 0.0, 1.0), 1.6);
      float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
      gl_FragColor = vec4(uColor, fade * rim * uIntensity);
    }`,
};

/** Dusty beams of light from the high-bay lamps down to the floor. */
export function LightShafts() {
  const h = HALL.height - 2.5;
  return (
    <group>
      {SHAFT_SPOTS.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, h / 2 + 0.1, z]} renderOrder={5}>
          <coneGeometry args={[5.2, h, 36, 1, true]} />
          <shaderMaterial
            args={[{ ...SHAFT_SHADER, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide }]}
          />
        </mesh>
      ))}
    </group>
  );
}

function dustSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,248,230,1)");
  grad.addColorStop(1, "rgba(255,248,230,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

/** Motes drifting through the beams. */
export function Dust({ count = 520 }: { count?: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<Points>(null);
  const sprite = useMemo(dustSprite, []);
  const data = useMemo(() => {
    const p = new Float32Array(count * 3);
    const v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 36;
      p[i * 3 + 1] = Math.random() * 30 + 0.5;
      p[i * 3 + 2] = HALL.minZ + Math.random() * (HALL.maxZ - HALL.minZ);
      v[i * 3] = (Math.random() - 0.5) * 0.08;
      v[i * 3 + 1] = -0.02 - Math.random() * 0.05;
      v[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    }
    return { p, v };
  }, [count]);

  useFrame(({ clock }, dt) => {
    const pts = ref.current;
    if (!pts || reduced) return;
    const pos = (pts.geometry as BufferGeometry).getAttribute("position") as BufferAttribute;
    const t = clock.elapsedTime;
    const step = Math.min(dt, 0.1) * 6;
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) + (data.v[i * 3 + 1] + Math.sin(t * 0.3 + i) * 0.01) * step;
      if (y < 0.3) y = 31;
      pos.setXYZ(i, pos.getX(i) + data.v[i * 3] * step, y, pos.getZ(i) + data.v[i * 3 + 2] * step);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref} renderOrder={6} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.p, 3]} />
      </bufferGeometry>
      <pointsMaterial map={sprite} size={0.09} transparent opacity={0.5} depthWrite={false} blending={AdditiveBlending} sizeAttenuation color="#fff4dc" />
    </points>
  );
}

/** Giant American Flag & NASA Insignia Murals on the VAB interior walls */
export function VABHeritageMurals() {
  return (
    <group>
      {/* Giant 50-Star American Flag on Left Wall */}
      <group position={[HALL.minX + 0.1, 22, -1]} rotation={[0, Math.PI / 2, 0]}>
        {/* White base */}
        <mesh>
          <planeGeometry args={[14, 7.8]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Red stripes (7 red, 6 white) */}
        {[0, 2, 4, 6].map((i) => (
          <mesh key={i} position={[0, 3.3 - i * 1.2, 0.01]}>
            <planeGeometry args={[14, 0.6]} />
            <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
          </mesh>
        ))}
        {/* Blue Union Canton */}
        <mesh position={[-3.6, 1.65, 0.02]}>
          <planeGeometry args={[6.8, 4.5]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
      </group>

      {/* Giant NASA Insignia Mural on Right Wall */}
      <group position={[HALL.maxX - 0.1, 22, -1]} rotation={[0, -Math.PI / 2, 0]}>
        {/* Outer sphere */}
        <mesh>
          <circleGeometry args={[4.2, 36]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
        {/* Orbit track ring */}
        <mesh position={[0, 0, 0.01]} rotation={[0, 0, 0.4]}>
          <ringGeometry args={[3.8, 4.1, 36]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
        {/* Red vector / chevron */}
        <mesh position={[0.4, 0.2, 0.02]} rotation={[0, 0, -0.6]}>
          <planeGeometry args={[6.4, 0.7]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
      </group>
    </group>
  );
}
