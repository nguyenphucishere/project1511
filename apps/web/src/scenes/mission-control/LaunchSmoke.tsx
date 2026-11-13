"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Mesh,
} from "three";
import { seeded } from "@/lib/random";
import { SCENE_COLORS } from "@/lib/palette";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ADAPTER_T, HOLD_DOWN, SEP2_T, SEPARATION_T, STAGE2_T, STAGE3_T, rocketRise, rocketSpeed } from "./ascent";
import { STRETCH } from "./flight";
import { PAD } from "./layout";

/**
 * Launch smoke as soft, camera-facing puffs (one instanced draw call):
 *  - the ground cloud: exhaust and deluge steam rolling out of the flame trench and billowing
 *    up around the pad, lit orange by the engines while it is fresh;
 *  - the exhaust trail left behind the climbing rocket;
 *  - a ring puff from the separation motors at staging.
 * Particles live in the pad's local space (this renders inside the pad group).
 */

const MAX = 1600;

/** Heights on the stack (pad-local, above the stack base) where exhaust leaves the engines. */
const STAGE1_NOZZLE_Y = 1.4;
const STAGE2_NOZZLE_Y = 12.6;
const STAGE3_NOZZLE_Y = 18.8;
const INTERSTAGE_Y = 12.5;
const INTERSTAGE2_Y = 19.8;
const ADAPTER_Y = 25.5;

interface LaunchSmokeProps {
  ignitionAt: number | null;
  /** Real seconds after ignition when the last engine stops (orbit or propellant out). */
  burnEndT: number;
}

export function LaunchSmoke({ ignitionAt, burnEndT }: LaunchSmokeProps) {
  const mesh = useRef<Mesh>(null);
  const reduced = useReducedMotion();
  const sim = useMemo(() => new SmokeSim(), []);
  const { geometry, material } = useMemo(() => buildRenderer(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.uniforms.map!.value.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const camLocal = useMemo(() => new Vector3(), []);
  const camDir = useMemo(() => new Vector3(), []);
  const prev = useRef({ t: -1, rise: 0 });
  const carry = useRef({ ground: 0, trail: 0 });

  useFrame(({ camera }, rawDelta) => {
    const dt = Math.min(Math.max(rawDelta, 0), 0.05);
    const t = ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    // Mounted long after ignition (e.g. the failure cutscene restages the pad): nothing to replay.
    if (prev.current.t < 0 && t > 1) prev.current = { t, rise: rocketRise(t) };
    if (t >= 0) {
      emit(sim, carry.current, t, Math.max(prev.current.t, 0), prev.current.rise, dt, burnEndT, reduced);
      prev.current = { t, rise: rocketRise(t) };
    }
    sim.step(dt);
    camLocal.copy(camera.position).sub(PAD_V);
    camera.getWorldDirection(camDir);
    const n = sim.write(geometry, camLocal, camDir);
    geometry.instanceCount = n;
    if (mesh.current) mesh.current.visible = n > 0;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} visible={false} renderOrder={2} />;
}

const PAD_V = new Vector3(...PAD);

/* ---------------------------------------------------------------- emitters */

function emit(
  sim: SmokeSim,
  carry: { ground: number; trail: number },
  t: number,
  prevT: number,
  prevRise: number,
  dt: number,
  burnEndT: number,
  reduced: boolean,
) {
  const rise = rocketRise(t);

  // Ground cloud: heaviest at ignition and while the stack clears the tower, then thinning.
  const groundRate =
    t < HOLD_DOWN + 2.5 * STRETCH ? 85 : t < HOLD_DOWN + 7 * STRETCH ? 85 * (1 - (t - HOLD_DOWN - 2.5 * STRETCH) / (4.5 * STRETCH)) : 0;
  carry.ground += groundRate * (reduced ? 0.5 : 1) * dt;
  while (carry.ground >= 1) {
    carry.ground -= 1;
    sim.spawnGround(t);
  }

  // Exhaust trail from whichever engine is burning.
  const stage1 = t < SEPARATION_T;
  const stage2 = t >= STAGE2_T && t < Math.min(SEP2_T, burnEndT);
  const stage3 = t >= STAGE3_T && t < burnEndT;
  if ((stage1 || stage2 || stage3) && rise > 0.5) {
    const nozzle = stage1 ? STAGE1_NOZZLE_Y : stage2 ? STAGE2_NOZZLE_Y : STAGE3_NOZZLE_Y;
    const rate = stage1 ? 60 : stage2 ? 46 : 30;
    carry.trail += rate * dt;
    const count = Math.floor(carry.trail);
    carry.trail -= count;
    // Spread spawns along this frame's path so a fast rocket leaves a continuous column.
    for (let i = 0; i < count; i++) {
      const k = (i + Math.random()) / Math.max(count, 1);
      const y = prevRise + (rise - prevRise) * k + nozzle;
      sim.spawnTrail(y, rocketSpeed(t), stage1);
    }
  }

  // Separation bolts and retro motors: a ring puff at each interstage, and where the adapter opens.
  const puff = (at: number, y: number, n: number) => {
    if (prevT < at && t >= at) for (let i = 0; i < n; i++) sim.spawnRing(rocketRise(at) + y);
  };
  puff(SEPARATION_T, INTERSTAGE_Y, 48);
  puff(SEP2_T, INTERSTAGE2_Y, 36);
  puff(ADAPTER_T, ADAPTER_Y, 24);
}

/* ---------------------------------------------------------------- simulation */

class SmokeSim {
  // Struct-of-arrays pool; dead particles are swapped out so [0, count) are alive.
  count = 0;
  px = new Float32Array(MAX);
  py = new Float32Array(MAX);
  pz = new Float32Array(MAX);
  vx = new Float32Array(MAX);
  vy = new Float32Array(MAX);
  vz = new Float32Array(MAX);
  age = new Float32Array(MAX);
  life = new Float32Array(MAX);
  size0 = new Float32Array(MAX);
  size1 = new Float32Array(MAX);
  alpha = new Float32Array(MAX);
  rot = new Float32Array(MAX);
  spin = new Float32Array(MAX);
  shade = new Float32Array(MAX);
  heat = new Float32Array(MAX);
  drag = new Float32Array(MAX);
  lift = new Float32Array(MAX);
  private all = [
    this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.age, this.life, this.size0,
    this.size1, this.alpha, this.rot, this.spin, this.shade, this.heat, this.drag, this.lift,
  ];
  private order = new Uint16Array(MAX);
  private depth = new Float32Array(MAX);
  private rand = seeded(42);

  private add(): number {
    // Pool full: recycle the oldest-looking slot instead of dropping the new puff.
    if (this.count >= MAX) return Math.floor(this.rand() * MAX);
    return this.count++;
  }

  private base(i: number, life: number) {
    this.age[i] = 0;
    this.life[i] = life;
    this.rot[i] = this.rand() * Math.PI * 2;
    this.spin[i] = (this.rand() - 0.5) * 0.25;
    this.shade[i] = 0.78 + this.rand() * 0.22;
  }

  spawnGround(t: number) {
    const r = this.rand;
    const i = this.add();
    this.base(i, 7 + r() * 6);
    // Most of the exhaust leaves through the flame trench (±X); the rest rolls out all round.
    const trench = r() < 0.65;
    const side = r() < 0.5 ? -1 : 1;
    const angle = trench ? (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 0.7 : r() * Math.PI * 2;
    const speed = (trench ? 11 : 6) + r() * 8;
    this.px[i] = Math.cos(angle) * (2 + r() * 2);
    this.pz[i] = Math.sin(angle) * (2 + r() * 2);
    this.py[i] = 0.8 + r() * 1.5;
    this.vx[i] = Math.cos(angle) * speed;
    this.vz[i] = Math.sin(angle) * speed;
    this.vy[i] = 0.5 + r() * 1.5;
    this.size0[i] = 2.5 + r() * 2;
    this.size1[i] = 13 + r() * 12;
    this.alpha[i] = 0.75 + r() * 0.2;
    this.heat[i] = t < HOLD_DOWN + 3 * STRETCH ? 1 : 0.6;
    this.drag[i] = 0.55 + r() * 0.3;
    this.lift[i] = 0.35 + r() * 0.5;
  }

  spawnTrail(y: number, rocketV: number, stage1: boolean) {
    const r = this.rand;
    const i = this.add();
    this.base(i, stage1 ? 4 + r() * 2 : 3 + r() * 1.5);
    this.px[i] = (r() - 0.5) * 0.8;
    this.pz[i] = (r() - 0.5) * 0.8;
    this.py[i] = y;
    // Exhaust leaves downward fast relative to the rocket; in the pad frame it is left behind
    // nearly at rest, then spreads.
    this.vx[i] = (r() - 0.5) * 2.5;
    this.vz[i] = (r() - 0.5) * 2.5;
    this.vy[i] = -Math.min(rocketV * 0.15, 6) - r() * 3;
    this.size0[i] = stage1 ? 1.6 : 0.9;
    this.size1[i] = stage1 ? 7 + r() * 4 : 4 + r() * 2;
    this.alpha[i] = stage1 ? 0.7 : 0.4;
    this.heat[i] = 1;
    this.drag[i] = 1.4;
    this.lift[i] = 0.1;
  }

  spawnRing(y: number) {
    const r = this.rand;
    const i = this.add();
    this.base(i, 1.4 + r() * 1.4);
    const a = r() * Math.PI * 2;
    const out = 4 + r() * 7;
    this.px[i] = Math.cos(a) * 1.5;
    this.pz[i] = Math.sin(a) * 1.5;
    this.py[i] = y + (r() - 0.5) * 2;
    this.vx[i] = Math.cos(a) * out;
    this.vz[i] = Math.sin(a) * out;
    this.vy[i] = -3 + r() * 4;
    this.size0[i] = 1 + r();
    this.size1[i] = 4 + r() * 5;
    this.alpha[i] = 0.45 + r() * 0.3;
    this.heat[i] = 0.4;
    this.drag[i] = 1.8;
    this.lift[i] = 0;
  }

  step(dt: number) {
    let i = 0;
    while (i < this.count) {
      this.age[i]! += dt;
      if (this.age[i]! >= this.life[i]!) {
        this.kill(i);
        continue;
      }
      const d = Math.exp(-this.drag[i]! * dt);
      this.vx[i]! *= d;
      this.vz[i]! *= d;
      this.vy[i] = this.vy[i]! * d + this.lift[i]! * dt; // warm smoke keeps rising
      this.px[i]! += this.vx[i]! * dt;
      this.py[i]! += this.vy[i]! * dt;
      this.pz[i]! += this.vz[i]! * dt;
      // The ground stops smoke from sinking through it.
      if (this.py[i]! < 0.5) {
        this.py[i] = 0.5;
        this.vy[i] = Math.abs(this.vy[i]!) * 0.2;
      }
      this.rot[i]! += this.spin[i]! * dt;
      i++;
    }
  }

  private kill(i: number) {
    const last = --this.count;
    if (i === last) return;
    for (const arr of this.all) arr[i] = arr[last]!;
  }

  /** Writes alive particles back-to-front into the instance attributes; returns the count. */
  write(geo: InstancedBufferGeometry, cam: Vector3, dir: Vector3): number {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      this.order[i] = i;
      this.depth[i] = (this.px[i]! - cam.x) * dir.x + (this.py[i]! - cam.y) * dir.y + (this.pz[i]! - cam.z) * dir.z;
    }
    const order = this.order.subarray(0, n);
    order.sort((a, b) => this.depth[b]! - this.depth[a]!);

    const pos = geo.getAttribute("iPos") as InstancedBufferAttribute;
    const data = geo.getAttribute("iData") as InstancedBufferAttribute;
    const p = pos.array as Float32Array;
    const q = data.array as Float32Array;
    for (let k = 0; k < n; k++) {
      const i = order[k]!;
      const life = this.age[i]! / this.life[i]!;
      // Fast growth that eases off, like a billow expanding and slowing.
      const grow = 1 - (1 - life) * (1 - life);
      const size = this.size0[i]! + (this.size1[i]! - this.size0[i]!) * grow;
      const fadeIn = Math.min(1, this.age[i]! / 0.1);
      const fadeOut = 1 - Math.max(0, (life - 0.45) / 0.55);
      p[k * 3] = this.px[i]!;
      p[k * 3 + 1] = this.py[i]!;
      p[k * 3 + 2] = this.pz[i]!;
      q[k * 4] = size;
      q[k * 4 + 1] = this.alpha[i]! * fadeIn * fadeOut * fadeOut;
      q[k * 4 + 2] = this.rot[i]!;
      // Heat glow cools within the first second; the shade rides in the fraction.
      q[k * 4 + 3] = Math.floor(this.heat[i]! * Math.exp(-this.age[i]! * 2.2) * 100) + this.shade[i]! * 0.99;
    }
    pos.needsUpdate = true;
    data.needsUpdate = true;
    pos.clearUpdateRanges();
    data.clearUpdateRanges();
    pos.addUpdateRange(0, n * 3);
    data.addUpdateRange(0, n * 4);
    return n;
  }
}

/* ---------------------------------------------------------------- rendering */

function buildRenderer() {
  const plane = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));
  const iPos = new InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  const iData = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  iPos.setUsage(DynamicDrawUsage);
  iData.setUsage(DynamicDrawUsage);
  geometry.setAttribute("iPos", iPos);
  geometry.setAttribute("iData", iData);
  geometry.instanceCount = 0;

  const material = new ShaderMaterial({
    uniforms: {
      map: { value: puffTexture() },
      smokeLit: { value: new Color(SCENE_COLORS.spaceWhite) },
      smokeShadow: { value: new Color("#8C96AA") },
      glow: { value: new Color(SCENE_COLORS.flameOuter) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 iPos;
      attribute vec4 iData; // size, alpha, rotation, heat*100 + shade
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHeat;
      varying float vShade;
      varying float vUp;
      void main() {
        vUv = uv;
        vAlpha = iData.y;
        vHeat = floor(iData.w) / 100.0;
        vShade = fract(iData.w);
        // Unrotated quad height: the top of each puff is lit, the bottom in shadow.
        vUp = position.y + 0.5;
        float c = cos(iData.z);
        float s = sin(iData.z);
        vec2 corner = mat2(c, s, -s, c) * position.xy * iData.x;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        mv.xy += corner;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec3 smokeLit;
      uniform vec3 smokeShadow;
      uniform vec3 glow;
      varying vec2 vUv;
      varying float vAlpha;
      varying float vHeat;
      varying float vShade;
      varying float vUp;
      void main() {
        vec4 puff = texture2D(map, vUv);
        float a = puff.a * vAlpha;
        if (a < 0.01) discard;
        // Texture red = self-shadowing of the lumps; vUp = sky light from above.
        float light = clamp(puff.r * 0.6 + vUp * 0.5, 0.0, 1.0);
        vec3 col = mix(smokeShadow, smokeLit, light) * vShade;
        col = mix(col, glow, vHeat * (1.0 - vUp * 0.6));
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  return { geometry, material };
}

/** A cauliflower-shaped puff: overlapping soft blobs, alpha for shape, red for lit lumps. */
function puffTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = seeded(9);
  const blobs = Array.from({ length: 16 }, () => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * size * 0.2;
    return { x: size / 2 + Math.cos(a) * d, y: size / 2 + Math.sin(a) * d, r: size * (0.16 + rand() * 0.14) };
  });
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(170,170,170,0.35)");
    g.addColorStop(1, "rgba(90,90,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fade the square's edges so no quad corner ever shows.
  ctx.globalCompositeOperation = "destination-in";
  const edge = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size / 2);
  edge.addColorStop(0, "rgba(0,0,0,1)");
  edge.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);

  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}
