"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  MathUtils,
  NormalBlending,
  Vector3,
  type Group,
  type PointLight,
  type Points,
  type Sprite,
  type SpriteMaterial,
} from "three";
import { seeded } from "@/lib/random";
import { rocketRise } from "./ascent";
import { BLASTS, LEAK_LEAD, blastCentre, boomFilm, hullPose, lesPose, type Blast } from "./boomFilm";
import { GROUND_Y, PAD } from "./layout";
import { puff, ringTexture } from "./SkyExplosion";

/**
 * The boom film's breakup (dev-only, for trailer footage): a fire leak at the engine bay, the
 * rupture, a fireball that rolls into black smoke, two more blasts as the tanks go, burning debris
 * falling on smoke trails, the escape tower pulling the capsule clear, and the first stage's hull
 * hitting the ground by the pad. Every position is a pure function of the film clock.
 */

const easeOut = (x: number) => 1 - (1 - x) ** 3;
const clamp01 = (x: number) => MathUtils.clamp(x, 0, 1);
const FLOOR = GROUND_Y + 0.6;

/** Fire colour by age: white-hot, yellow, orange, deep red, almost black. */
const FIRE_RAMP = [
  new Color(6, 5.2, 4),
  new Color(4.2, 2.6, 0.9),
  new Color(2.6, 1.05, 0.22),
  new Color(1.2, 0.3, 0.06),
  new Color(0.25, 0.06, 0.02),
];
function fireColour(age: number, out: Color) {
  const k = clamp01(age) * (FIRE_RAMP.length - 1);
  const i = Math.min(FIRE_RAMP.length - 2, Math.floor(k));
  return out.copy(FIRE_RAMP[i]!).lerp(FIRE_RAMP[i + 1]!, k - i);
}

/* ---------------------------------------------------------------- one blast */

const FIRE_N = 34;
const SOOT_N = 26;

function BlastCloud({ blast, clock }: { blast: Blast; clock: { s: number } }) {
  const glow = useMemo(() => puff("rgba(255,220,170,1)", 128, 0.28), []);
  const soft = useMemo(() => puff("rgba(255,255,255,1)", 128, 0.5), []);
  const ringTex = useMemo(() => ringTexture(), []);
  const root = useRef<Group>(null);
  const flash = useRef<Sprite>(null);
  const ring = useRef<Sprite>(null);
  const fire = useRef<Group>(null);
  const soot = useRef<Group>(null);
  const data = useMemo(() => {
    const r = seeded(blast.seed);
    const lobe = () => new Vector3(r() - 0.5, r() * 0.9 - 0.3, r() - 0.5).normalize();
    return {
      fire: Array.from({ length: FIRE_N }, (_, i) => ({ dir: i < 3 ? new Vector3(0, 0, 0) : lobe(), reach: 0.35 + r() * 0.75, size: 0.6 + r() * 0.8, life: 0.75 + r() * 0.6, spin: r() * 6 })),
      soot: Array.from({ length: SOOT_N }, () => ({ dir: lobe(), reach: 0.5 + r() * 0.8, size: 0.7 + r() * 0.7, delay: 0.35 + r() * 0.9, shade: 0.06 + r() * 0.1 })),
    };
  }, [blast.seed]);

  useFrame(() => {
    const te = clock.s - blast.s;
    const on = boomFilm.t !== null && te >= 0;
    if (root.current) {
      root.current.visible = on;
      if (!on) return;
      root.current.position.set(...blast.pos());
    }
    const S = blast.scale;
    if (flash.current) {
      const k = clamp01(te / 0.9);
      flash.current.visible = te < 0.9;
      flash.current.scale.setScalar(S * (70 + 520 * easeOut(k)));
      (flash.current.material as SpriteMaterial).opacity = (1 - k) ** 1.6;
    }
    if (ring.current) {
      const k = clamp01(te / 1.7);
      ring.current.visible = te < 1.7;
      ring.current.scale.setScalar(S * (20 + 820 * easeOut(k)));
      (ring.current.material as SpriteMaterial).opacity = 0.85 * (1 - k);
    }
    // The fireball: lobes punch out fast, slow down, rise on their own heat and cool through the ramp.
    fire.current?.children.forEach((c, i) => {
      const d = data.fire[i]!;
      const sp = c as Sprite;
      const grow = easeOut(clamp01(te / 2.2));
      const R = S * 46 * d.reach * grow;
      sp.position.set(d.dir.x * R + Math.sin(te * 2 + d.spin) * 1.5 * S, d.dir.y * R + te * 5.5 * S, d.dir.z * R);
      sp.scale.setScalar(S * (14 + 46 * grow) * d.size);
      const age = te / (4.2 * d.life);
      const m = sp.material as SpriteMaterial;
      fireColour(age, m.color);
      m.opacity = age >= 1 ? 0 : (1 - age * age) * 0.8;
      m.rotation = d.spin + te * 0.25;
    });
    // Black smoke boils out of the fire and keeps climbing.
    soot.current?.children.forEach((c, i) => {
      const d = data.soot[i]!;
      const sp = c as Sprite;
      const k = clamp01((te - d.delay) / 6);
      const R = S * 52 * d.reach * easeOut(clamp01((te - d.delay) / 3));
      sp.visible = te > d.delay;
      sp.position.set(d.dir.x * R + te * 1.6, d.dir.y * R + te * 4.2 * S + k * 10, d.dir.z * R);
      sp.scale.setScalar(S * (26 + 80 * easeOut(k)) * d.size);
      const m = sp.material as SpriteMaterial;
      // Lit from inside by the fire at first, then a dark grey cloud.
      const hot = clamp01(1 - (te - d.delay) / 2.4);
      m.color.setRGB(d.shade + hot * 0.9, d.shade + hot * 0.35, d.shade + hot * 0.1);
      m.opacity = 0.93 * clamp01((te - d.delay) / 0.6);
      m.rotation = i + te * 0.08;
    });
  });

  return (
    <group ref={root} visible={false}>
      <group ref={soot}>
        {data.soot.map((_, i) => (
          <sprite key={i} renderOrder={1}>
            <spriteMaterial map={soft} transparent depthWrite={false} blending={NormalBlending} opacity={0} />
          </sprite>
        ))}
      </group>
      <group ref={fire}>
        {data.fire.map((_, i) => (
          <sprite key={i} renderOrder={2}>
            <spriteMaterial map={glow} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} opacity={0} />
          </sprite>
        ))}
      </group>
      <sprite ref={flash} renderOrder={3}>
        <spriteMaterial map={glow} color={new Color(8, 7, 6)} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={ring} renderOrder={3}>
        <spriteMaterial map={ringTex} color={new Color(3, 2.8, 2.6)} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

/* ---------------------------------------------------------------- debris */

const CHUNK_N = 34;
const TRAIL_N = 26;
const TRAIL_DT = 0.085;
const SPARK_N = 520;
const DRAG = 0.32;

/** Ballistic flight with air drag: where a piece thrown at `v` from `p` is after `tau` seconds. */
function fly(p: Vector3, v: Vector3, tau: number, out: Vector3) {
  const e = (1 - Math.exp(-DRAG * tau)) / DRAG;
  out.set(p.x + v.x * e, p.y + v.y * e - 9.8 * (tau - e) / DRAG, p.z + v.z * e);
  if (out.y < FLOOR) out.y = FLOOR;
  return out;
}

function Debris({ clock }: { clock: { s: number } }) {
  const glow = useMemo(() => puff("rgba(255,200,130,1)", 64, 0.22), []);
  const smokeTex = useMemo(() => puff("rgba(255,255,255,1)", 64, 0.45), []);
  const chunks = useRef<Group>(null);
  const trails = useRef<Points>(null);
  const sparks = useRef<Points>(null);
  const tmp = useMemo(() => new Vector3(), []);

  const data = useMemo(() => {
    const r = seeded(404);
    const dir = (up: number, sp: number) => {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(2 * r() - 1);
      return new Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.7 + up, Math.sin(ph) * Math.sin(th)).multiplyScalar(sp);
    };
    return {
      chunks: Array.from({ length: CHUNK_N }, (_, i) => ({
        // Half from the first blast, half from the second one lower down.
        s: i % 2 ? 0 : 1.1,
        off: new Vector3(r() * 6 - 3, (i % 2 ? 14 : 2) + r() * 6, r() * 6 - 3),
        v: dir(0.35, 22 + r() * 48),
        size: 0.5 + r() * 1.6,
        rot: new Vector3(r() * 4, r() * 4, r() * 4),
        burn: 3 + r() * 6,
      })),
      sparks: Array.from({ length: SPARK_N }, (_, i) => ({ s: i % 3 === 0 ? 1.1 : 0, v: dir(0.15, 25 + r() * 95), off: new Vector3(r() * 8 - 4, 4 + r() * 18, r() * 8 - 4) })),
      trailPos: new Float32Array(CHUNK_N * TRAIL_N * 3),
      sparkPos: new Float32Array(SPARK_N * 3),
    };
  }, []);

  useFrame(() => {
    const on = boomFilm.t !== null && clock.s >= 0;
    if (chunks.current) chunks.current.visible = on;
    if (trails.current) trails.current.visible = on;
    if (sparks.current) sparks.current.visible = on;
    if (!on) return;
    const s = clock.s;
    const base = new Vector3(PAD[0], PAD[1] + rocketRise(boomFilm.t!), PAD[2]);
    const origin = new Vector3();

    data.chunks.forEach((c, i) => {
      const tau = s - c.s;
      origin.copy(base).add(c.off);
      const g = chunks.current?.children[i] as Group | undefined;
      if (g) {
        g.visible = tau >= 0;
        fly(origin, c.v, Math.max(0, tau), tmp);
        g.position.copy(tmp);
        const grounded = tmp.y <= FLOOR + 0.01;
        if (!grounded) g.rotation.set(c.rot.x * tau, c.rot.y * tau, c.rot.z * tau);
        const fire = g.children[1] as Sprite;
        const m = fire.material as SpriteMaterial;
        const flick = 0.75 + 0.25 * Math.sin(s * 31 + i * 7);
        m.opacity = tau < 0 ? 0 : clamp01(1 - tau / c.burn) * flick;
        fire.scale.setScalar(c.size * (3.2 + (grounded ? 2 : 0)));
      }
      // The smoke trail: where the piece was a moment ago, drifting with the wind and spreading.
      for (let j = 0; j < TRAIL_N; j++) {
        const back = j * TRAIL_DT;
        const tt = Math.max(0, tau - back);
        fly(origin, c.v, tt, tmp);
        const o = (i * TRAIL_N + j) * 3;
        data.trailPos[o] = tmp.x + back * 1.8;
        data.trailPos[o + 1] = tmp.y + back * 1.1;
        data.trailPos[o + 2] = tmp.z;
      }
    });
    if (trails.current) {
      (trails.current.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
      (trails.current.material as { opacity: number }).opacity = 0.55 * clamp01(1 - (s - 9) / 8);
    }
    data.sparks.forEach((p, i) => {
      const tau = Math.max(0, s - p.s);
      origin.copy(base).add(p.off);
      fly(origin, p.v, tau, tmp);
      if (s < p.s) tmp.copy(origin);
      data.sparkPos[i * 3] = tmp.x;
      data.sparkPos[i * 3 + 1] = tmp.y;
      data.sparkPos[i * 3 + 2] = tmp.z;
    });
    if (sparks.current) {
      (sparks.current.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
      (sparks.current.material as { opacity: number }).opacity = clamp01(1 - (s - 3) / 5);
    }
  });

  const sparkColour = useMemo(() => new Color(6, 3, 1), []);
  const fireColour0 = useMemo(() => new Color(5, 2.4, 0.7), []);
  return (
    <>
      <group ref={chunks} visible={false}>
        {data.chunks.map((c, i) => (
          <group key={i}>
            <mesh scale={[c.size * 1.4, c.size * 0.5, c.size]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#2a2522" roughness={0.9} metalness={0.3} emissive="#3a1205" />
            </mesh>
            <sprite>
              <spriteMaterial map={glow} color={fireColour0} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
            </sprite>
          </group>
        ))}
      </group>
      <points ref={trails} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.trailPos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={smokeTex} size={5} sizeAttenuation transparent depthWrite={false} color="#8a8784" opacity={0.55} />
      </points>
      <points ref={sparks} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.sparkPos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={glow} size={2.2} sizeAttenuation transparent depthWrite={false} blending={AdditiveBlending} color={sparkColour} toneMapped={false} />
      </points>
    </>
  );
}

/* ---------------------------------------------------------------- the hull, the escape tower, the leak */

function Hull({ clock }: { clock: { s: number } }) {
  const glow = useMemo(() => puff("rgba(255,190,110,1)", 64, 0.25), []);
  const smokeTex = useMemo(() => puff("rgba(255,255,255,1)", 64, 0.45), []);
  const g = useRef<Group>(null);
  const trail = useRef<Points>(null);
  const pos = useMemo(() => new Float32Array(40 * 3), []);
  useFrame(() => {
    const s = clock.s;
    const on = boomFilm.t !== null && s >= 1.1;
    if (g.current) {
      g.current.visible = on;
      if (on) {
        const h = hullPose(s);
        g.current.position.set(...h.pos);
        g.current.rotation.set(0.25 + h.spin * 0.4, 0, 0.3 + h.spin);
        const f = g.current.children[1] as Sprite;
        f.scale.setScalar(h.landed ? 0 : 14 + Math.sin(s * 27) * 2);
      }
    }
    if (trail.current) {
      trail.current.visible = on;
      for (let j = 0; j < 40; j++) {
        const h = hullPose(Math.max(1.1, s - j * 0.1)).pos;
        pos[j * 3] = h[0] + j * 0.15;
        pos[j * 3 + 1] = h[1] + j * 0.12;
        pos[j * 3 + 2] = h[2];
      }
      (trail.current.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    }
  });
  return (
    <>
      <group ref={g} visible={false}>
        <mesh>
          <cylinderGeometry args={[2.1, 2.3, 13, 18, 1, true]} />
          <meshStandardMaterial color="#d9d6cf" roughness={0.7} metalness={0.2} emissive="#401004" side={2} />
        </mesh>
        <sprite renderOrder={2}>
          <spriteMaterial map={glow} color={new Color(5, 2.2, 0.6)} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      <points ref={trail} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={smokeTex} size={9} sizeAttenuation transparent depthWrite={false} color="#3b3836" opacity={0.85} />
      </points>
    </>
  );
}

function EscapeTower({ clock }: { clock: { s: number } }) {
  const glow = useMemo(() => puff("rgba(255,235,200,1)", 64, 0.25), []);
  const smokeTex = useMemo(() => puff("rgba(255,255,255,1)", 64, 0.45), []);
  const g = useRef<Group>(null);
  const plume = useRef<Sprite>(null);
  const trail = useRef<Points>(null);
  const pos = useMemo(() => new Float32Array(60 * 3), []);
  useFrame(() => {
    const s = clock.s;
    const on = boomFilm.t !== null && s >= 0.1;
    const l = lesPose(s);
    if (g.current) {
      g.current.visible = on;
      g.current.position.set(...l.pos);
      g.current.rotation.z = MathUtils.clamp(l.age * 0.12, 0, 0.35);
    }
    if (plume.current) {
      plume.current.visible = l.burning;
      plume.current.scale.setScalar(6 + Math.sin(s * 40) * 0.8);
    }
    if (trail.current) {
      trail.current.visible = on && l.age > 0;
      for (let j = 0; j < 60; j++) {
        const p = lesPose(Math.max(0.3, s - j * 0.06)).pos;
        pos[j * 3] = p[0] + j * 0.05;
        pos[j * 3 + 1] = p[1] - 2;
        pos[j * 3 + 2] = p[2];
      }
      (trail.current.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
    }
  });
  return (
    <>
      <group ref={g} visible={false}>
        {/* The command module and the tower on top of it. */}
        <mesh position={[0, 0, 0]}>
          <coneGeometry args={[1.5, 1.9, 20]} />
          <meshStandardMaterial color="#c9ccd2" metalness={0.75} roughness={0.3} />
        </mesh>
        <mesh position={[0, 2.6, 0]}>
          <cylinderGeometry args={[0.1, 0.35, 3.2, 8]} />
          <meshStandardMaterial color="#b3261e" roughness={0.5} />
        </mesh>
        <mesh position={[0, 4.6, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 1.6, 10]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
        </mesh>
        <sprite ref={plume} position={[0, 3.6, 0]} renderOrder={2}>
          <spriteMaterial map={glow} color={new Color(6, 4.6, 2.6)} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      <points ref={trail} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pos, 3]} />
        </bufferGeometry>
        <pointsMaterial map={smokeTex} size={4.5} sizeAttenuation transparent depthWrite={false} color="#e9e6e1" opacity={0.8} />
      </points>
    </>
  );
}

/** The leak: fire licking out of the engine bay, growing, until the stack comes apart. */
function Leak({ clock }: { clock: { s: number } }) {
  const glow = useMemo(() => puff("rgba(255,200,120,1)", 64, 0.25), []);
  const g = useRef<Group>(null);
  const r = useMemo(() => seeded(5), []);
  const jitter = useMemo(() => Array.from({ length: 10 }, () => r()), [r]);
  useFrame(() => {
    const s = clock.s;
    const on = boomFilm.t !== null && s >= -LEAK_LEAD && s < 0.2;
    if (!g.current) return;
    g.current.visible = on;
    if (!on) return;
    const k = clamp01((s + LEAK_LEAD) / LEAK_LEAD);
    g.current.position.set(PAD[0] + 2.1, PAD[1] + rocketRise(boomFilm.t! + s) + 3 + k * 4, PAD[2] + 0.4);
    g.current.children.forEach((c, i) => {
      const sp = c as Sprite;
      const j = jitter[i]!;
      // A jet that streams out sideways and is swept down by the airflow.
      sp.position.set(0.6 + i * 0.55 * (0.6 + k), -i * (0.9 + k * 1.4), Math.sin(s * 19 + i) * 0.3);
      sp.scale.setScalar((0.8 + i * 0.35) * (0.6 + 2.4 * k) * (0.8 + 0.4 * Math.sin(s * 37 + j * 9)));
      (sp.material as SpriteMaterial).opacity = (1 - i / 10) * (0.5 + 0.5 * k);
    });
  });
  return (
    <group ref={g} visible={false}>
      {jitter.map((_, i) => (
        <sprite key={i} renderOrder={2}>
          <spriteMaterial map={glow} color={new Color(5, 2.3 - i * 0.12, 0.6)} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- the whole breakup */

export function RocketBreakup({ ignitionAt }: { ignitionAt: number | null }) {
  const clock = useMemo(() => ({ s: -999 }), []);
  const light = useRef<PointLight>(null);
  const groundLight = useRef<PointLight>(null);
  useFrame(() => {
    const t = ignitionAt === null || boomFilm.t === null ? -999 : (performance.now() - ignitionAt) / 1000;
    clock.s = boomFilm.t === null ? -999 : t - boomFilm.t;
    const s = clock.s;
    // The blasts light up everything: the pad, the tower, the crowd, the smoke.
    let k = 0;
    for (const b of BLASTS) {
      const te = s - b.s;
      if (te >= 0) k = Math.max(k, b.scale * (Math.exp(-te * 3.2) * 4 + Math.exp(-te * 0.45) * 0.7));
    }
    const flicker = 0.85 + 0.15 * Math.sin(s * 29) * Math.sin(s * 13);
    if (light.current) {
      light.current.position.set(...blastCentre());
      light.current.intensity = k * 26000 * flicker;
    }
    if (groundLight.current) {
      const h = hullPose(s);
      groundLight.current.position.set(h.pos[0], GROUND_Y + 4, h.pos[2]);
      groundLight.current.intensity = h.landed ? (3000 + 9000 * Math.exp(-(s - BLASTS[3]!.s) * 1.5)) * flicker : 0;
    }
  });
  return (
    <group>
      <pointLight ref={light} color="#ffb070" intensity={0} distance={900} decay={1.5} />
      <pointLight ref={groundLight} color="#ff8a3c" intensity={0} distance={300} decay={1.5} />
      <Leak clock={clock} />
      {BLASTS.map((b) => (
        <BlastCloud key={b.seed} blast={b} clock={clock} />
      ))}
      <Debris clock={clock} />
      <Hull clock={clock} />
      <EscapeTower clock={clock} />
    </group>
  );
}

