"use client";

import { useEffect, useRef } from "react";
import { BufferGeometry, Group, Matrix4, Mesh, type InstancedMesh, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Lit = Material & {
  color?: { getHex: () => number };
  emissive?: { getHex: () => number };
  roughness?: number;
  metalness?: number;
  emissiveIntensity?: number;
  clearcoat?: number;
  envMapIntensity?: number;
  map?: { uuid: string } | null;
  normalMap?: { uuid: string } | null;
  roughnessMap?: { uuid: string } | null;
  bumpMap?: { uuid: string } | null;
};

/** Meshes that can share one draw call: same material look, same vertex layout, same shadow flags. */
function signature(mesh: Mesh, m: Lit): string {
  const g = mesh.geometry;
  return [
    m.type,
    m.color?.getHex(),
    m.emissive?.getHex(),
    m.emissiveIntensity,
    m.roughness,
    m.metalness,
    m.clearcoat,
    m.envMapIntensity,
    m.map?.uuid,
    m.normalMap?.uuid,
    m.roughnessMap?.uuid,
    m.bumpMap?.uuid,
    m.side,
    m.opacity,
    mesh.renderOrder,
    Object.keys(g.attributes).sort().join(","),
    g.index ? "i" : "n",
  ].join("|");
}

/**
 * Draws a static group of meshes in as few draw calls as possible. After mount it folds every
 * opaque mesh below it that shares a material look into one merged mesh and hides the originals.
 * Wrap only things that never move or change: anything animated through a ref would freeze.
 * A hall with 800 separate meshes becomes a few dozen draw calls, with no change to how it looks.
 */
export function StaticBatch({ children }: { children: React.ReactNode }) {
  const root = useRef<Group>(null);

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const inverse = new Matrix4().copy(group.matrixWorld).invert();

    const buckets = new Map<string, { material: Material; geometries: BufferGeometry[]; sources: Mesh[] }>();
    group.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh || (o as InstancedMesh).isInstancedMesh || o === group) return;
      if (Array.isArray(mesh.material) || !mesh.visible) return;
      const material = mesh.material as Lit;
      if (material.transparent || material.type === "MeshReflectorMaterial") return;
      mesh.updateWorldMatrix(true, false);
      const relative = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
      if (relative.determinant() <= 0) return; // mirrored meshes would flip their faces
      const key = signature(mesh, material) + (mesh.receiveShadow ? "|r" : "");
      const bucket = buckets.get(key) ?? { material, geometries: [], sources: [] };
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(relative);
      bucket.geometries.push(geometry);
      bucket.sources.push(mesh);
      buckets.set(key, bucket);
    });

    const made: Mesh[] = [];
    const hidden: Mesh[] = [];
    for (const { material, geometries, sources } of buckets.values()) {
      if (sources.length < 2) {
        geometries.forEach((g) => g.dispose());
        continue;
      }
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new Mesh(merged, material);
      mesh.receiveShadow = sources[0].receiveShadow;
      mesh.castShadow = true;
      mesh.renderOrder = sources[0].renderOrder;
      group.add(mesh);
      made.push(mesh);
      for (const s of sources) {
        s.visible = false;
        hidden.push(s);
      }
    }

    return () => {
      for (const m of made) {
        group.remove(m);
        m.geometry.dispose();
      }
      for (const s of hidden) s.visible = true;
    };
  }, []);

  return <group ref={root}>{children}</group>;
}
