"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { rocketRise } from "./ascent";
import type { Vec3 } from "@/game/sceneStore";
import { bake, type BakePart } from "./bake";
import { PAD } from "./layout";
import { mood } from "./mood";

/**
 * A crowd of onlookers: the people who came to watch the launch, or who stopped what they were
 * doing wherever they happened to be. They face the rocket, tip their heads back to follow it up
 * and throw their arms up when it reaches orbit.
 *
 * Drawn as instanced meshes: legs, torsos, heads, two-segment arms with hands, and the gear the
 * people hold. A quarter lift a DSLR to their eye, some raise binoculars, a few stand behind a
 * tripod with a long white telephoto lens; each pair of arms is solved so the hands stay on the
 * gear while the head and lens tilt up with the rocket.
 */

const JACKETS = ["#e2e8f0", "#fc3d21", "#1d63dc", "#facc15", "#10b981", "#94a3b8", "#f8fafc", "#f97316", "#0b3d91"];
const SKIN = ["#e2b49a", "#c68642", "#8d5524", "#f1c27d", "#ffdbac"];
const PANTS = ["#1e293b", "#334155", "#475569", "#111827"];

/** Length of each arm segment, shoulder to elbow and elbow to wrist. */
const SEG = 0.28;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Gear = "none" | "camera" | "binoculars" | "tripod";

interface Person {
  x: number;
  z: number;
  yaw: number;
  height: number;
  phase: number;
  gear: Gear;
  /** Index within its gear's instanced mesh. */
  slot: number;
}

/* ---- the gear: each is one merged geometry, the +z axis is where it points ---- */

function cameraGeometry(): BufferGeometry {
  const parts: BakePart[] = [
    { g: new BoxGeometry(0.15, 0.1, 0.075), color: "#15181d", at: [0, 0, 0] }, // body
    { g: new BoxGeometry(0.045, 0.105, 0.06), color: "#0e1013", at: [0.07, -0.005, 0.0] }, // grip
    { g: new BoxGeometry(0.06, 0.035, 0.05), color: "#15181d", at: [0, 0.067, -0.005] }, // prism
    { g: new BoxGeometry(0.03, 0.012, 0.03), color: "#2a2f37", at: [-0.04, 0.056, 0.0] }, // mode dial
    { g: new CylinderGeometry(0.04, 0.04, 0.025, 14), color: "#24282f", at: [0, 0, 0.05], rot: [Math.PI / 2, 0, 0] }, // lens mount
    { g: new CylinderGeometry(0.037, 0.04, 0.11, 14), color: "#1c1f25", at: [0, 0, 0.12], rot: [Math.PI / 2, 0, 0] }, // barrel
    { g: new CylinderGeometry(0.043, 0.043, 0.016, 14), color: "#8a919b", at: [0, 0, 0.1], rot: [Math.PI / 2, 0, 0] }, // focus ring
    { g: new CylinderGeometry(0.046, 0.04, 0.03, 14), color: "#15181d", at: [0, 0, 0.195], rot: [Math.PI / 2, 0, 0] }, // hood
    { g: new CylinderGeometry(0.034, 0.034, 0.006, 14), color: "#2e5fb0", at: [0, 0, 0.184], rot: [Math.PI / 2, 0, 0] }, // coated glass
    { g: new BoxGeometry(0.012, 0.008, 0.006), color: "#e03131", at: [0.055, 0.04, 0.038] }, // red dot
  ];
  return bake(parts);
}

export function binocularGeometry(): BufferGeometry {
  const parts: BakePart[] = [];
  for (const s of [-1, 1]) {
    const x = s * 0.052;
    parts.push({ g: new CylinderGeometry(0.038, 0.04, 0.16, 12), color: "#1a1d22", at: [x, 0, 0.06], rot: [Math.PI / 2, 0, 0] });
    parts.push({ g: new CylinderGeometry(0.052, 0.05, 0.07, 14), color: "#20242b", at: [x, 0, 0.14], rot: [Math.PI / 2, 0, 0] });
    parts.push({ g: new CylinderGeometry(0.046, 0.046, 0.006, 14), color: "#3a73d6", at: [x, 0, 0.178], rot: [Math.PI / 2, 0, 0] });
    parts.push({ g: new CylinderGeometry(0.03, 0.026, 0.045, 10), color: "#0d0f12", at: [x, 0, -0.045], rot: [Math.PI / 2, 0, 0] });
    parts.push({ g: new CylinderGeometry(0.034, 0.03, 0.016, 10), color: "#07080a", at: [x, 0, -0.072], rot: [Math.PI / 2, 0, 0] });
  }
  parts.push({ g: new BoxGeometry(0.06, 0.03, 0.08), color: "#15181d", at: [0, 0, 0.04] }); // hinge bridge
  parts.push({ g: new CylinderGeometry(0.018, 0.018, 0.034, 10), color: "#9aa3ae", at: [0, 0.024, 0.05], rot: [0, 0, Math.PI / 2] }); // focus wheel
  return bake(parts);
}

/** The head of a tripod rig: body, a long white telephoto lens with its red ring, hood and glass. */
function rigGeometry(): BufferGeometry {
  const parts: BakePart[] = [
    { g: new BoxGeometry(0.16, 0.13, 0.11), color: "#15181d", at: [0, 0, -0.14] },
    { g: new BoxGeometry(0.05, 0.03, 0.06), color: "#15181d", at: [0, 0.08, -0.14] },
    { g: new BoxGeometry(0.05, 0.05, 0.05), color: "#0c0d10", at: [0, 0.02, -0.21] }, // viewfinder
    { g: new CylinderGeometry(0.05, 0.05, 0.06, 12), color: "#2b3038", at: [0, 0, -0.07], rot: [Math.PI / 2, 0, 0] },
    { g: new CylinderGeometry(0.075, 0.062, 0.52, 16), color: "#e9ebee", at: [0, 0, 0.22], rot: [Math.PI / 2, 0, 0] },
    { g: new CylinderGeometry(0.06, 0.057, 0.34, 16), color: "#dfe2e6", at: [0, 0, 0.62], rot: [Math.PI / 2, 0, 0] },
    { g: new CylinderGeometry(0.078, 0.078, 0.022, 16), color: "#c1121f", at: [0, 0, 0.12], rot: [Math.PI / 2, 0, 0] },
    { g: new CylinderGeometry(0.067, 0.067, 0.03, 16), color: "#1a1d22", at: [0, 0, 0.44], rot: [Math.PI / 2, 0, 0] },
    { g: new CylinderGeometry(0.082, 0.07, 0.14, 16), color: "#15171b", at: [0, 0, 0.84], rot: [Math.PI / 2, 0, 0] },
    { g: new CylinderGeometry(0.058, 0.058, 0.008, 16), color: "#2a5db8", at: [0, 0, 0.778], rot: [Math.PI / 2, 0, 0] },
    { g: new BoxGeometry(0.03, 0.06, 0.18), color: "#2b3038", at: [0, -0.09, 0.2] }, // collar foot
    { g: new CylinderGeometry(0.04, 0.05, 0.05, 10), color: "#6c7480", at: [0, -0.14, 0.2] }, // tripod head
  ];
  return bake(parts);
}

/** Three tripod legs spread to the ground under a head at `top` height. */
function tripodGeometry(top: number): BufferGeometry {
  const parts: BakePart[] = [];
  const up = new Vector3(0, 1, 0);
  const q = new Quaternion();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const foot = new Vector3(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
    const head = new Vector3(0, top, 0);
    const dir = head.clone().sub(foot);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    const mid = foot.clone().add(head).multiplyScalar(0.5);
    const m = new Matrix4().compose(mid, q, new Vector3(1, 1, 1));
    parts.push({ g: new CylinderGeometry(0.014, 0.02, len, 6), color: "#1a1d22", at: [0, 0, 0], matrix: m });
    parts.push({ g: new SphereGeometry(0.026, 6, 4), color: "#0b0c0e", at: [foot.x, foot.y + 0.01, foot.z] });
  }
  parts.push({ g: new CylinderGeometry(0.05, 0.05, 0.04, 10), color: "#6c7480", at: [0, top - 0.02, 0] });
  return bake(parts);
}

const RIG_TOP = 1.18;
/** How far in front of its owner the tripod stands. */
const RIG_AHEAD = 0.62;

export function Crowd({
  position,
  count,
  radius,
  ignitionAt,
  seed = 1,
}: {
  /** World position of the crowd's centre, on the ground. */
  position: Vec3;
  count: number;
  radius: number;
  ignitionAt: number | null;
  seed?: number;
}) {
  const legs = useRef<InstancedMesh>(null);
  const torsos = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const uppers = useRef<InstancedMesh>(null);
  const fores = useRef<InstancedMesh>(null);
  const hands = useRef<InstancedMesh>(null);
  const cams = useRef<InstancedMesh>(null);
  const binos = useRef<InstancedMesh>(null);
  const rigs = useRef<InstancedMesh>(null);
  const tripods = useRef<InstancedMesh>(null);

  const { people, counts } = useMemo(() => {
    const r = rng(seed);
    const list: Person[] = [];
    const n = { camera: 0, binoculars: 0, tripod: 0 };
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * radius;
      const x = position[0] + Math.cos(a) * d;
      const z = position[2] + Math.sin(a) * d;
      // Everybody faces the pad.
      const yaw = Math.atan2(PAD[0] - x, PAD[2] - z);
      const roll = r();
      const gear: Gear = roll < 0.26 ? "camera" : roll < 0.42 ? "binoculars" : roll < 0.52 ? "tripod" : "none";
      const slot = gear === "none" ? 0 : n[gear]++;
      list.push({ x, z, yaw, height: 0.9 + r() * 0.25, phase: r() * 6.28, gear, slot });
    }
    return { people: list, counts: n };
  }, [position, count, radius, seed]);

  const geometries = useMemo(() => {
    const legsG = new BoxGeometry(0.34, 0.74, 0.2);
    legsG.translate(0, 0.37, 0);
    const torsoG = new BoxGeometry(0.42, 0.6, 0.25);
    torsoG.translate(0, 1.04, 0);
    // A face you can read from the front: eyes, a hair cap and hair down the back of the head.
    const headG = bake([
      { g: new BoxGeometry(0.22, 0.24, 0.22), color: "#ffffff", at: [0, 0, 0] },
      { g: new BoxGeometry(0.235, 0.07, 0.235), color: "#1c1612", at: [0, 0.105, -0.005] },
      { g: new BoxGeometry(0.235, 0.2, 0.07), color: "#1c1612", at: [0, 0.02, -0.095] },
      { g: new BoxGeometry(0.035, 0.03, 0.012), color: "#0a0a0a", at: [-0.05, 0.025, 0.112] },
      { g: new BoxGeometry(0.035, 0.03, 0.012), color: "#0a0a0a", at: [0.05, 0.025, 0.112] },
      { g: new BoxGeometry(0.06, 0.018, 0.012), color: "#8a4b3c", at: [0, -0.055, 0.112] },
    ]);
    const upperG = new BoxGeometry(0.1, SEG, 0.1);
    upperG.translate(0, -SEG / 2, 0);
    const foreG = new BoxGeometry(0.085, SEG, 0.085);
    foreG.translate(0, -SEG / 2, 0);
    const handG = new BoxGeometry(0.09, 0.09, 0.09);
    return {
      legsG,
      torsoG,
      headG,
      upperG,
      foreG,
      handG,
      camG: cameraGeometry(),
      binoG: binocularGeometry(),
      rigG: rigGeometry(),
      tripodG: tripodGeometry(RIG_TOP),
    };
  }, []);

  useLayoutEffect(() => {
    const r = rng(seed + 99);
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const scale = new Vector3();
    const pos = new Vector3();
    const color = new Color();
    people.forEach((p, i) => {
      const h = p.height;
      q.setFromAxisAngle(up, p.yaw);
      pos.set(p.x, position[1], p.z);
      scale.set(1, h, 1);
      m.compose(pos, q, scale);
      legs.current!.setMatrixAt(i, m);
      legs.current!.setColorAt(i, color.set(PANTS[Math.floor(r() * PANTS.length)]!));
      torsos.current!.setMatrixAt(i, m);
      const jacket = JACKETS[Math.floor(r() * JACKETS.length)]!;
      torsos.current!.setColorAt(i, color.set(jacket));
      const skin = SKIN[Math.floor(r() * SKIN.length)]!;
      heads.current!.setColorAt(i, color.set(skin));
      for (const k of [i * 2, i * 2 + 1]) {
        uppers.current!.setColorAt(k, color.set(jacket));
        fores.current!.setColorAt(k, color.set(jacket));
        hands.current!.setColorAt(k, color.set(skin));
      }
      if (p.gear === "tripod") {
        // The legs stand fixed in front of the owner.
        pos.set(p.x + Math.sin(p.yaw) * RIG_AHEAD, position[1], p.z + Math.cos(p.yaw) * RIG_AHEAD);
        m.compose(pos, q, new Vector3(1, 1, 1));
        tripods.current!.setMatrixAt(p.slot, m);
      }
    });
    for (const mesh of [legs.current, torsos.current, heads.current, uppers.current, fores.current, hands.current, tripods.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [people, position, seed]);

  const dummy = useMemo(() => new Object3D(), []);
  const offset = useMemo(() => new Matrix4(), []);
  const devM = useMemo(() => new Matrix4(), []);
  const lastJoy = useRef(-1);
  useFrame(({ clock }) => {
    const t = ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    const rise = t < 0 ? 0 : rocketRise(t);
    const joy = mood.joy > 0 ? 1 : 0;
    const first = lastJoy.current === -1;
    const need = first || joy > 0 || lastJoy.current !== joy || t >= 0;
    if (!need) return;
    lastJoy.current = joy;
    const time = clock.elapsedTime;
    const gy = position[1];

    for (let i = 0; i < people.length; i++) {
      const p = people[i]!;
      const h = p.height;
      const sy = Math.sin(p.yaw);
      const cy = Math.cos(p.yaw);
      // Heads follow the rocket up the sky.
      const dx = PAD[0] - p.x;
      const dz = PAD[2] - p.z;
      const dist = Math.hypot(dx, dz);
      const tilt = t >= 0 ? Math.atan2(rise + 26, dist) : 0.12;
      const pitch = p.gear === "none" ? tilt * 0.8 : Math.min(tilt, 1.2);
      const hy = gy + 1.5 * h;
      dummy.position.set(p.x, hy, p.z);
      dummy.rotation.set(-pitch, p.yaw, 0, "YXZ");
      dummy.updateMatrix();
      heads.current!.setMatrixAt(i, dummy.matrix);

      // Where the hands have to go: the gear at the eye, or the tripod's body.
      let tx = 0;
      let ty = 0;
      let tz = 0;
      let holding = false;
      if (joy === 0 && p.gear !== "none") {
        holding = true;
        if (p.gear === "tripod") {
          const rx = p.x + sy * RIG_AHEAD;
          const rz = p.z + cy * RIG_AHEAD;
          const ry = gy + RIG_TOP + 0.1;
          dummy.position.set(rx, ry, rz);
          dummy.rotation.set(-Math.min(tilt, 1.3), p.yaw, 0, "YXZ");
          dummy.updateMatrix();
          rigs.current!.setMatrixAt(p.slot, dummy.matrix);
          // Hands rest on the body of the camera
          tx = rx - sy * 0.1;
          tz = rz - cy * 0.1;
          ty = ry - 0.02;
        } else {
          offset.makeTranslation(0, p.gear === "camera" ? -0.025 : -0.015, p.gear === "camera" ? 0.2 : 0.16);
          devM.multiplyMatrices(dummy.matrix, offset);
          const mesh = p.gear === "camera" ? cams.current! : binos.current!;
          mesh.setMatrixAt(p.slot, devM);
          tx = devM.elements[12]!;
          ty = devM.elements[13]!;
          tz = devM.elements[14]!;
        }
      } else if (p.gear === "tripod") {
        // Cheering: the camera is left alone, pointing where it was.
        const rx = p.x + sy * RIG_AHEAD;
        const rz = p.z + cy * RIG_AHEAD;
        dummy.position.set(rx, gy + RIG_TOP + 0.1, rz);
        dummy.rotation.set(-Math.min(tilt, 1.3), p.yaw, 0, "YXZ");
        dummy.updateMatrix();
        rigs.current!.setMatrixAt(p.slot, dummy.matrix);
      } else if (p.gear !== "none") {
        // Cheering: the camera or binoculars hang from the neck on the chest.
        dummy.position.set(p.x + sy * 0.16, gy + 1.15 * h, p.z + cy * 0.16);
        dummy.rotation.set(0.5, p.yaw, 0, "YXZ");
        dummy.updateMatrix();
        (p.gear === "camera" ? cams.current! : binos.current!).setMatrixAt(p.slot, dummy.matrix);
      }

      // Two-segment arms: shoulder, elbow, hand.
      for (const side of [-1, 1] as const) {
        const k = i * 2 + (side === -1 ? 0 : 1);
        const sxo = 0.25 * side;
        const sx = p.x + sxo * cy;
        const sz = p.z - sxo * sy;
        const sh = gy + 1.32 * h;
        let th1: number;
        let th2: number;
        let psi = 0;
        const roll = 0;
        if (holding) {
          // Hands sit either side of the gear, so the target is offset along the person's right.
          const hx = tx + (side * 0.045) * cy;
          const hz = tz - (side * 0.045) * sy;
          const ddx = hx - sx;
          const ddz = hz - sz;
          const f = ddx * sy + ddz * cy;
          const l = ddx * cy - ddz * sy;
          psi = Math.atan2(l, Math.max(0.01, f));
          const fp = Math.hypot(f, l);
          const dy = ty - sh;
          const reach = Math.min(2 * SEG * 0.995, Math.max(0.12, Math.hypot(fp, dy)));
          const phi = Math.atan2(fp, -dy);
          const alpha = Math.acos(reach / (2 * SEG));
          th1 = phi - alpha;
          th2 = phi + alpha;
        } else if (joy > 0) {
          th1 = Math.PI * 0.88 + Math.sin(time * 9 + p.phase) * 0.22;
          th2 = th1 + 0.1;
        } else {
          th1 = 0.05;
          th2 = 0.18;
        }
        const yawA = p.yaw + psi;
        dummy.position.set(sx, sh, sz);
        dummy.rotation.set(-th1, yawA, roll, "YXZ");
        dummy.updateMatrix();
        uppers.current!.setMatrixAt(k, dummy.matrix);
        // Elbow, then wrist, in the arm's own plane
        const hs = Math.sin(yawA);
        const hc = Math.cos(yawA);
        const ex = sx + hs * Math.sin(th1) * SEG;
        const ez = sz + hc * Math.sin(th1) * SEG;
        const ey = sh - Math.cos(th1) * SEG;
        dummy.position.set(ex, ey, ez);
        dummy.rotation.set(-th2, yawA, roll, "YXZ");
        dummy.updateMatrix();
        fores.current!.setMatrixAt(k, dummy.matrix);
        dummy.position.set(ex + hs * Math.sin(th2) * SEG, ey - Math.cos(th2) * SEG, ez + hc * Math.sin(th2) * SEG);
        dummy.rotation.set(0, yawA, 0);
        dummy.updateMatrix();
        hands.current!.setMatrixAt(k, dummy.matrix);
      }
    }
    for (const mesh of [heads.current, uppers.current, fores.current, hands.current, cams.current, binos.current, rigs.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const material = <meshStandardMaterial roughness={0.85} />;
  const gearMaterial = <meshStandardMaterial vertexColors metalness={0.55} roughness={0.35} />;
  return (
    <group>
      <instancedMesh ref={legs} args={[geometries.legsG, undefined, count]} frustumCulled={false}>
        {material}
      </instancedMesh>
      <instancedMesh ref={torsos} args={[geometries.torsoG, undefined, count]} frustumCulled={false}>
        {material}
      </instancedMesh>
      <instancedMesh ref={heads} args={[geometries.headG, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={uppers} args={[geometries.upperG, undefined, count * 2]} frustumCulled={false}>
        {material}
      </instancedMesh>
      <instancedMesh ref={fores} args={[geometries.foreG, undefined, count * 2]} frustumCulled={false}>
        {material}
      </instancedMesh>
      <instancedMesh ref={hands} args={[geometries.handG, undefined, count * 2]} frustumCulled={false}>
        {material}
      </instancedMesh>
      <instancedMesh ref={cams} args={[geometries.camG, undefined, Math.max(1, counts.camera)]} frustumCulled={false}>
        {gearMaterial}
      </instancedMesh>
      <instancedMesh ref={binos} args={[geometries.binoG, undefined, Math.max(1, counts.binoculars)]} frustumCulled={false}>
        {gearMaterial}
      </instancedMesh>
      <instancedMesh ref={rigs} args={[geometries.rigG, undefined, Math.max(1, counts.tripod)]} frustumCulled={false}>
        {gearMaterial}
      </instancedMesh>
      <instancedMesh ref={tripods} args={[geometries.tripodG, undefined, Math.max(1, counts.tripod)]} frustumCulled={false}>
        {gearMaterial}
      </instancedMesh>
    </group>
  );
}
