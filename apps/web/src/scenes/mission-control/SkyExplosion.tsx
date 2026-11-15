"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  MathUtils,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type Points,
  type Sprite,
  type SpriteMaterial,
} from "three";
import { seeded } from "@/lib/random";
import { GROUND_Y, PAD } from "./layout";

/** Rocket leaves the pad here and is lost at BOOM, seen from the control room window. */
const START = new Vector3(PAD[0], GROUND_Y + 6, PAD[2]);

/** How each kind of failure looks from the control room: where the vehicle is lost and how it dies. */
interface Variant {
  /** Where it is lost, relative to the pad. */
  boom: [number, number, number];
  /** Blast size, 1 = a full-sized fireball. */
  scale: number;
  /** Sideways drift (m) along the way, as when the wind takes it. */
  swerve: number;
  /** Fraction of the flight after which the engine light goes out (1 = it burns until the blast). */
  engineOut: number;
  /** The colour of the fireball. */
  tint: "fire" | "storm";
}
const VARIANTS: Record<string, Variant> = {
  structural: { boom: [PAD[0] - 45, GROUND_Y + 100, -520], scale: 1, swerve: 0, engineOut: 1, tint: "fire" },
  // The engines quit and the dark stage coasts, then falls: a small, late fireball.
  "fuel-depleted": { boom: [PAD[0] - 30, GROUND_Y + 74, -500], scale: 0.55, swerve: 0, engineOut: 0.5, tint: "fire" },
  // Never gains height: lost low over the sea.
  "slow-climb": { boom: [PAD[0] - 10, GROUND_Y + 30, -430], scale: 0.8, swerve: 0, engineOut: 1, tint: "fire" },
  // Thrown off course before it comes apart.
  "wind-shear": { boom: [PAD[0] - 130, GROUND_Y + 92, -500], scale: 1, swerve: -70, engineOut: 1, tint: "fire" },
  // Struck in the cloud: a blue-white burst.
  lightning: { boom: [PAD[0] - 45, GROUND_Y + 120, -520], scale: 1.15, swerve: 0, engineOut: 1, tint: "storm" },
};
/** Seconds the rocket flies before it is destroyed. */
export const FLY_SECONDS = 1.9;
/** Total length of the sequence in seconds (smoke is still drifting at the end). */
export const EXPLOSION_SECONDS = 31;

export function puff(color: string, size = 128, soft = 0.55) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(soft, color.replace(/[\d.]+\)$/, "0.35)"));
  g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function ringTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(size / 2, size / 2, size * 0.36, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,230,200,0)");
  g.addColorStop(0.7, "rgba(255,240,220,0.9)");
  g.addColorStop(1, "rgba(255,240,220,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

/**
 * The launch vehicle lost in the sky, as the control room sees it: a bright climbing spark with a
 * smoke trail, then a flash, fireball, shockwave ring, flying debris and a cloud of smoke that
 * lingers. `explodeAt` is performance.now() when the sequence starts.
 */
export function SkyExplosion({ explodeAt, cause = "structural" }: { explodeAt: number; cause?: string }) {
  const V = VARIANTS[cause] ?? VARIANTS.structural!;
  const BOOM = useMemo(() => new Vector3(...V.boom), [V]);
  const head = useRef<Group>(null);
  const headMat = useRef<SpriteMaterial>(null);
  const trail = useRef<Points>(null);
  const flash = useRef<Sprite>(null);
  const flashMat = useRef<SpriteMaterial>(null);
  const fire = useRef<Group>(null);
  const ring = useRef<Sprite>(null);
  const ringMat = useRef<SpriteMaterial>(null);
  const debris = useRef<Points>(null);
  const smoke = useRef<Group>(null);

  const puffTex = useMemo(() => puff("rgba(235,235,240,1)"), []);
  const sootTex = useMemo(() => puff("rgba(40,38,40,1)"), []);
  const glowTex = useMemo(() => puff("rgba(255,210,150,1)", 128, 0.3), []);
  const ringTex = useMemo(() => ringTexture(), []);
  const sparkTex = useMemo(() => puff("rgba(255,200,120,1)", 64, 0.2), []);

  const TRAIL_N = 70;
  const trailPos = useMemo(() => new Float32Array(TRAIL_N * 3), []);
  const DEBRIS_N = 110;
  const debrisData = useMemo(() => {
    const r = seeded(77);
    const pos = new Float32Array(DEBRIS_N * 3);
    const vel = Array.from({ length: DEBRIS_N }, () => {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(2 * r() - 1);
      const sp = 20 + r() * 90;
      return new Vector3(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * 0.8, Math.sin(ph) * Math.sin(th) * sp);
    });
    return { pos, vel };
  }, []);
  const smokeData = useMemo(() => {
    const r = seeded(31);
    return Array.from({ length: 16 }, () => ({
      dir: new Vector3(r() - 0.5, r() * 0.7 - 0.1, r() - 0.5).normalize().multiplyScalar(6 + r() * 26),
      size: 26 + r() * 40,
      delay: r() * 0.7,
    }));
  }, []);
  const fireData = useMemo(() => {
    const r = seeded(9);
    const palette =
      V.tint === "storm"
        ? [new Color(3.4, 3.6, 4), new Color(1.4, 2, 3.4), new Color(0.8, 1.3, 3), new Color(0.4, 0.6, 1.6)]
        : [new Color(3.2, 2.6, 1.8), new Color(1.9, 0.95, 0.3), new Color(1.5, 0.5, 0.12), new Color(0.9, 0.22, 0.06)];
    return Array.from({ length: 24 }, (_, i) => ({
      dir: i === 0 ? new Vector3() : new Vector3(r() - 0.5, r() - 0.35, r() - 0.5).normalize().multiplyScalar(0.4 + r() * 0.6),
      size: i === 0 ? 50 : 30 + r() * 34,
      color: palette[i === 0 ? 0 : 1 + Math.floor(r() * 3)],
    }));
  }, [V]);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const t = (performance.now() - explodeAt) / 1000;
    const flyK = MathUtils.clamp(t / FLY_SECONDS, 0, 1);
    const exploded = t >= FLY_SECONDS;
    const te = t - FLY_SECONDS; // seconds since the blast

    // Rocket: a bright spark accelerating along its path, leaving smoke behind.
    const pathK = flyK * flyK;
    const at = (k: number) => {
      tmp.lerpVectors(START, BOOM, k);
      tmp.x += V.swerve * k * k;
    };
    at(pathK);
    if (head.current) {
      head.current.position.copy(tmp);
      head.current.visible = !exploded && t >= 0;
      const s = 10 + 26 * pathK;
      head.current.scale.setScalar(s);
    }
    // The engine light: steady, or fading out when the tanks run dry.
    if (headMat.current) headMat.current.opacity = flyK < V.engineOut ? 1 : Math.max(0, 1 - (flyK - V.engineOut) / 0.12);
    if (trail.current) {
      const geo = trail.current.geometry as BufferGeometry;
      const n = Math.min(TRAIL_N, Math.floor(pathK * TRAIL_N) + 1);
      for (let i = 0; i < TRAIL_N; i++) {
        const k = (i / (TRAIL_N - 1)) * pathK;
        at(k);
        // The trail drifts and widens a little as it ages.
        trailPos[i * 3] = tmp.x + Math.sin(i * 1.7) * 3 * (1 - i / TRAIL_N);
        trailPos[i * 3 + 1] = tmp.y;
        trailPos[i * 3 + 2] = tmp.z;
      }
      (geo.getAttribute("position") as BufferAttribute).needsUpdate = true;
      geo.setDrawRange(0, n);
      (trail.current.material as { opacity: number }).opacity = t >= 0 ? 0.75 * (1 - MathUtils.clamp((te - 8) / 14, 0, 1)) : 0;
    }

    // Blast.
    if (flash.current && flashMat.current) {
      flash.current.visible = exploded && te < 1.2;
      const k = MathUtils.clamp(te / 1.2, 0, 1);
      flash.current.scale.setScalar((60 + 300 * easeOut(k)) * V.scale);
      flashMat.current.opacity = 1 - k;
    }
    if (fire.current) {
      fire.current.visible = exploded && te < 5;
      if (fire.current.visible) {
        const k = MathUtils.clamp(te / 1.8, 0, 1);
        fire.current.children.forEach((child, i) => {
          const d = fireData[i];
          const sp = child as Sprite;
          const grow = easeOut(k);
          // Billowing: each lobe rolls outward and a little upward, wobbling as it goes.
          sp.position.set(
            d.dir.x * (14 + 46 * grow) + Math.sin(te * 3 + i) * 2,
            d.dir.y * (14 + 46 * grow) + 10 * k + Math.cos(te * 2.4 + i) * 2,
            d.dir.z * (14 + 46 * grow),
          );
          sp.scale.setScalar(d.size * V.scale * (0.25 + 1.1 * grow));
          (sp.material as SpriteMaterial).opacity = (i === 0 ? 1 - k : 1 - MathUtils.clamp((te - 0.7) / 4, 0, 1)) * 0.7;
        });
      }
    }
    if (ring.current && ringMat.current) {
      ring.current.visible = exploded && te < 3;
      const k = MathUtils.clamp(te / 2.6, 0, 1);
      ring.current.scale.setScalar((30 + 760 * easeOut(k)) * V.scale);
      ringMat.current.opacity = 0.9 * (1 - k);
    }
    if (debris.current) {
      debris.current.visible = exploded && te < 12;
      if (exploded) {
        const geo = debris.current.geometry as BufferGeometry;
        const tt = Math.max(0, te);
        for (let i = 0; i < DEBRIS_N; i++) {
          const v = debrisData.vel[i];
          debrisData.pos[i * 3] = BOOM.x + v.x * tt;
          debrisData.pos[i * 3 + 1] = BOOM.y + v.y * tt - 0.5 * 9.8 * tt * tt;
          debrisData.pos[i * 3 + 2] = BOOM.z + v.z * tt;
        }
        (geo.getAttribute("position") as BufferAttribute).needsUpdate = true;
        (debris.current.material as { opacity: number }).opacity = 1 - MathUtils.clamp((te - 4) / 7, 0, 1);
      }
    }
    if (smoke.current) {
      smoke.current.visible = exploded;
      smoke.current.children.forEach((child, i) => {
        const d = smokeData[i];
        const k = MathUtils.clamp((te - d.delay) / 5, 0, 1);
        const s = child as Sprite;
        s.position.set(BOOM.x + d.dir.x * k * 2.2, BOOM.y + d.dir.y * k * 2 + k * 14 - k * k * 6, BOOM.z + d.dir.z * k * 2.2);
        s.scale.setScalar(d.size * (0.4 + 1.6 * easeOut(k)));
        (s.material as SpriteMaterial).opacity = k <= 0 ? 0 : 0.85 * (1 - MathUtils.clamp((te - 15) / 11, 0, 1));
      });
    }
  });

  const white = useMemo(() => new Color(3.5, 3, 2.2), []);
  const sparks = useMemo(() => new Color(5, 2.4, 0.8), []);

  return (
    <group>
      <group ref={head} visible={false}>
        <sprite>
          <spriteMaterial ref={headMat} map={glowTex} color={white} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
      <points ref={trail} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={puffTex} size={22} sizeAttenuation transparent depthWrite={false} color="#f4f4f8" opacity={0} />
      </points>

      <group position={BOOM.toArray()}>
        <sprite ref={flash} visible={false}>
          <spriteMaterial ref={flashMat} map={glowTex} color={white} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
        </sprite>
        <group ref={fire} visible={false}>
          {fireData.map((d, i) => (
            <sprite key={i}>
              <spriteMaterial
                map={glowTex}
                color={d.color}
                blending={AdditiveBlending}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          ))}
        </group>
        <sprite ref={ring} visible={false}>
          <spriteMaterial ref={ringMat} map={ringTex} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      </group>

      <points ref={debris} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[debrisData.pos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={sparkTex}
          size={5}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          color={sparks}
          toneMapped={false}
        />
      </points>

      <group ref={smoke} visible={false}>
        {smokeData.map((_, i) => (
          <sprite key={i}>
            <spriteMaterial map={i % 3 === 0 ? sootTex : puffTex} transparent depthWrite={false} opacity={0} />
          </sprite>
        ))}
      </group>
    </group>
  );
}
