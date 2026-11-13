import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface BakePart {
  g: BufferGeometry;
  /** "#rrggbb" */
  color: string;
  at: [number, number, number];
  rot?: [number, number, number];
  /** Full transform, when a position and Euler angles are not enough. */
  matrix?: Matrix4;
}

/** Small parts merged into one geometry, each part keeping its own vertex colour. */
export function bake(parts: BakePart[]): BufferGeometry {
  const list = parts.map(({ g, color, at, rot, matrix }) => {
    const m = matrix ? matrix.clone() : new Matrix4().makeRotationFromEuler(new Euler(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0));
    if (!matrix) m.setPosition(...at);
    const c = g.clone().applyMatrix4(m);
    const n = c.attributes.position!.count;
    const rgb = new Float32Array(n * 3);
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const gr = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    for (let i = 0; i < n; i++) {
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = gr;
      rgb[i * 3 + 2] = b;
    }
    c.setAttribute("color", new Float32BufferAttribute(rgb, 3));
    return c;
  });
  return mergeGeometries(list)!;
}
