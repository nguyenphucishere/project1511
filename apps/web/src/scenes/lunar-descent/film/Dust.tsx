"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, CanvasTexture, type Points, type PointsMaterial } from "three";
import { filmClock } from "./clock";

const N = 1100;

/**
 * Dust thrown out from under the engine. In vacuum it does not billow: every grain flies out low
 * and flat on its own arc and falls straight back, so the cloud is a thin fast ring. `power` (0..1)
 * is read every frame and sets how much is in the air.
 */
export function Dust({ origin, power }: { origin: [number, number, number]; power: (t: number) => number }) {
  const ref = useRef<Points>(null);
  const mat = useRef<PointsMaterial>(null);
  const { geometry, grains } = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(N * 3), 3));
    const grains = Array.from({ length: N }, (_, i) => ({
      a: (i * 2.399963) % (Math.PI * 2),
      speed: 8 + ((i * 37) % 100) * 0.5,
      phase: ((i * 53) % 100) / 100,
      lift: 0.8 + ((i * 29) % 60) / 20,
      tag: ((i * 97) % 100) / 100,
    }));
    return { geometry: g, grains };
  }, []);

  // A soft round grain, so the cloud is dust and not a scatter of squares.
  const sprite = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }, []);

  useFrame(() => {
    const p = ref.current;
    if (!p) return;
    const k = Math.min(1, Math.max(0, power(filmClock.t)));
    p.visible = k > 0.01;
    if (mat.current) mat.current.opacity = 0.55 * Math.min(1, k * 1.4);
    if (!p.visible) return;
    const attr = geometry.getAttribute("position") as BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = filmClock.t;
    for (let i = 0; i < N; i++) {
      const g = grains[i]!;
      // Each grain lives about 2.4 s: out along the ground, up a little, and back down.
      const life = (t * 0.42 + g.phase) % 1;
      const hidden = g.tag > k;
      const r = 1.2 + life * g.speed * 2.4;
      const h = hidden ? -50 : 0.15 + g.lift * Math.sin(life * Math.PI) * (1 - life * 0.4);
      arr[i * 3] = origin[0] + Math.cos(g.a) * r;
      arr[i * 3 + 1] = origin[1] + h;
      arr[i * 3 + 2] = origin[2] + Math.sin(g.a) * r;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial ref={mat} map={sprite} color="#c9c3b6" size={0.9} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
    </points>
  );
}
