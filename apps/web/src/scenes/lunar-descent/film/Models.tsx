"use client";

import { forwardRef, useMemo, type Ref } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, Matrix4, Object3D, type Group, type Mesh } from "three";

/* ---------------------------------------------------------------- the lunar module */

const FOIL = { color: "#b98a22", roughness: 0.6, metalness: 0.5 } as const;
const SKIN = { color: "#cfd3da", roughness: 0.45, metalness: 0.5 } as const;
const DARK = { color: "#14171d", roughness: 0.4, metalness: 0.6 } as const;
const LEG = { color: "#8d9098", roughness: 0.5, metalness: 0.6 } as const;

/**
 * The Apollo lunar module Eagle, in metres, standing on its four footpads. Origin: the ground
 * plane under the centre of the descent stage; +Y is up. `flame` scales the faint exhaust glow
 * under the engine bell (the real plume is almost invisible in vacuum).
 */
export const LunarModule = forwardRef<Group, { flame?: number; flameRef?: Ref<Mesh> }>(function LunarModule({ flame = 0, flameRef }, ref) {
  const legs = useMemo(() => [0, 1, 2, 3].map((i) => ({ a: (i * Math.PI) / 2 + Math.PI / 4, key: i })), []);
  return (
    <group ref={ref}>
      {/* Descent stage: an octagonal box wrapped in gold foil */}
      <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[2.35, 2.35, 1.7, 8]} />
        <meshStandardMaterial {...FOIL} flatShading />
      </mesh>
      <mesh position={[0, 1.65, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[2.0, 2.2, 0.35, 8]} />
        <meshStandardMaterial {...DARK} flatShading />
      </mesh>
      {/* Ascent stage: the crew cabin */}
      <mesh position={[0, 4.55, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[1.55, 1.8, 2.3, 8]} />
        <meshStandardMaterial {...SKIN} flatShading />
      </mesh>
      <mesh position={[0, 4.95, 1.55]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[1.1, 0.8, 0.12]} />
        <meshStandardMaterial color="#0b1118" roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh position={[1.1, 4.95, 1.1]} rotation={[0.25, 0.7, 0]}>
        <boxGeometry args={[0.7, 0.55, 0.1]} />
        <meshStandardMaterial color="#0b1118" roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh position={[-1.1, 4.95, 1.1]} rotation={[0.25, -0.7, 0]}>
        <boxGeometry args={[0.7, 0.55, 0.1]} />
        <meshStandardMaterial color="#0b1118" roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Docking tunnel on top, and the rendezvous antenna */}
      <mesh position={[0, 6.0, 0]}>
        <cylinderGeometry args={[0.6, 0.7, 0.7, 12]} />
        <meshStandardMaterial {...LEG} />
      </mesh>
      <mesh position={[-1.5, 6.1, -0.6]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.02, 0.02, 1.8, 6]} />
        <meshStandardMaterial {...LEG} />
      </mesh>
      <mesh position={[-1.9, 6.9, -0.6]} rotation={[0.3, 0, 0.5]}>
        <circleGeometry args={[0.55, 14]} />
        <meshStandardMaterial {...SKIN} side={DoubleSide} />
      </mesh>
      {/* Four landing legs with footpads, and a strut on each */}
      {legs.map(({ a, key }) => (
        <group key={key} rotation={[0, a, 0]}>
          <mesh position={[0, 1.15, 3.2]} rotation={[-0.71, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 2.77, 6]} />
            <meshStandardMaterial {...LEG} />
          </mesh>
          <mesh position={[0, 0.07, 4.1]}>
            <cylinderGeometry args={[0.55, 0.62, 0.14, 14]} />
            <meshStandardMaterial {...LEG} />
          </mesh>
        </group>
      ))}
      {/* The descent engine bell and its faint exhaust */}
      <mesh position={[0, 1.15, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.75, 1.1, 20, 1, true]} />
        <meshStandardMaterial {...DARK} side={DoubleSide} />
      </mesh>
      {(flame > 0 || flameRef) && (
        <mesh ref={flameRef} position={[0, 1.1 - 2.6 * (flame || 1), 0]} rotation={[Math.PI, 0, 0]} scale={[1, flame || 1, 1]} visible={false}>
          <coneGeometry args={[0.95, 5.2, 18, 1, true]} />
          <meshBasicMaterial color="#cfe0ff" transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}
    </group>
  );
});

/* ---------------------------------------------------------------- Columbia */

/** The command and service module in lunar orbit. Origin: the middle of the service module; the nose is +X. */
export function Columbia() {
  return (
    <group>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1.95, 1.95, 7.4, 20]} />
        <meshStandardMaterial color="#d8dbe1" roughness={0.45} metalness={0.4} />
      </mesh>
      <mesh position={[-3.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[1.1, 1.8, 18, 1, true]} />
        <meshStandardMaterial {...DARK} side={DoubleSide} />
      </mesh>
      <mesh position={[4.9, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[1.95, 3.4, 20]} />
        <meshStandardMaterial color="#c9ccd2" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1.97, 1.97, 0.6, 20]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      <mesh position={[-2.2, 2.4, 0]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 6]} />
        <meshStandardMaterial {...LEG} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- the ground */

/** A seeded random stream, so the landscape is the same every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export interface Crater {
  x: number;
  z: number;
  r: number;
}

/** Craters on a square of `size` metres, plus any fixed ones, and the height of the ground at a point. */
export function makeMoonscape(seed: number, size: number, count: number, rMin: number, rMax: number, fixed: Crater[] = [], keepClear = 0) {
  const rand = rng(seed);
  const craters: Crater[] = [...fixed];
  for (let i = 0; i < count; i++) {
    const r = rMin * Math.pow(rMax / rMin, Math.pow(rand(), 1.6));
    const x = (rand() - 0.5) * size;
    const z = (rand() - 0.5) * size;
    // Nothing but level ground where the lander will stand.
    if (Math.hypot(x, z) < r * 1.6 + keepClear) continue;
    craters.push({ x, z, r });
  }
  const heightAt = (x: number, z: number) => {
    let h = 0;
    for (const c of craters) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (Math.abs(dx) > c.r * 1.5 || Math.abs(dz) > c.r * 1.5) continue;
      const d = Math.hypot(dx, dz) / c.r;
      if (d < 1) h -= (1 - d * d) * c.r * 0.17;
      h += Math.exp(-(((d - 1.04) / 0.13) ** 2)) * c.r * 0.04;
    }
    // Gentle undulation so the plain is never flat.
    return h + Math.sin(x * 0.013 + seed) * Math.cos(z * 0.011) * size * 0.0009;
  };
  return { craters, heightAt, size };
}
export type Moonscape = ReturnType<typeof makeMoonscape>;

const SHADE = new Color();

/** A square patch of cratered ground, in metres, centred on the origin, with rocks strewn over it. */
export function Terrain({ scape, seg, rocks, rockMax, crowd }: { scape: Moonscape; seg: number; rocks: number; rockMax: number; crowd?: Crater }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const n = seg + 1;
    const pos = new Float32Array(n * n * 3);
    const col = new Float32Array(n * n * 3);
    const idx: number[] = [];
    const rand = rng(99);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i / seg - 0.5) * scape.size;
        const z = (j / seg - 0.5) * scape.size;
        const h = scape.heightAt(x, z);
        const k = (j * n + i) * 3;
        pos[k] = x;
        pos[k + 1] = h;
        pos[k + 2] = z;
        // Pale regolith, a little darker inside the bowls.
        const base = 0.5 + Math.min(0.14, Math.max(-0.2, h * 0.035)) + (rand() - 0.5) * 0.08;
        SHADE.setRGB(base, base * 0.985, base * 0.95);
        col[k] = SHADE.r;
        col[k + 1] = SHADE.g;
        col[k + 2] = SHADE.b;
      }
    }
    for (let j = 0; j < seg; j++)
      for (let i = 0; i < seg; i++) {
        const a = j * n + i;
        idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("color", new BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [scape, seg]);

  const rockMatrices = useMemo(() => {
    const rand = rng(7);
    const m = new Matrix4();
    const o = new Object3D();
    const matrices = new Float32Array(rocks * 16);
    for (let i = 0; i < rocks; i++) {
      let x = (rand() - 0.5) * scape.size;
      let z = (rand() - 0.5) * scape.size;
      // Half of them pile up round the rim of the crater the crew aims for.
      if (crowd && i % 2 === 0) {
        const a = rand() * Math.PI * 2;
        const rr = crowd.r * (0.85 + rand() * 0.5);
        x = crowd.x + Math.cos(a) * rr;
        z = crowd.z + Math.sin(a) * rr;
      }
      const s = rockMax * Math.pow(rand(), 3) + rockMax * 0.04;
      o.position.set(x, scape.heightAt(x, z) + s * 0.25, z);
      o.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      o.scale.set(s * (0.8 + rand() * 0.6), s * (0.6 + rand() * 0.5), s * (0.8 + rand() * 0.6));
      o.updateMatrix();
      m.copy(o.matrix).toArray(matrices, i * 16);
    }
    return matrices;
  }, [rocks, rockMax, scape, crowd]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
      <instancedMesh
        args={[undefined, undefined, rocks]}
        frustumCulled={false}
        ref={(mesh) => {
          if (!mesh) return;
          mesh.instanceMatrix = new InstancedBufferAttribute(rockMatrices, 16);
          mesh.instanceMatrix.needsUpdate = true;
        }}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8c887f" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
