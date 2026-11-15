"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
} from "three";
import { filmClock } from "./clock";
import { Plasma } from "./Plasma";
import {
  SEA,
  T,
  SEA_ARRIVAL,
  capsuleAltitude,
  clamp01,
  MAIN_DELAY,
  homePosition,
  landedTilt,
  norm,
  sub,
  petals,
  plasma,
  reentryPosition,
  shipPose,
  stagePose,
  thrust,
  viewKind,
  type Pose,
  type Vec,
} from "./flight";

/** Aim an object's +Z along `fwd`, with `up` overhead. */
const m4 = new Matrix4();
const zero = new Vector3();
const toward = new Vector3();
const upVec = new Vector3();
export function orient(obj: Group | Mesh, pose: Pose) {
  obj.position.set(...pose.pos);
  toward.set(-pose.fwd[0], -pose.fwd[1], -pose.fwd[2]);
  upVec.set(...pose.up);
  m4.lookAt(zero, toward, upVec);
  obj.quaternion.setFromRotationMatrix(m4);
}

const WHITE = { color: "#e8e8ea", roughness: 0.5, metalness: 0.2 } as const;
const GREY = { color: "#9a9ca3", roughness: 0.45, metalness: 0.55 } as const;
const DARK = { color: "#1b1c20", roughness: 0.7, metalness: 0.3 } as const;
const FOIL = { color: "#c79a3c", roughness: 0.32, metalness: 0.92 } as const;

/** A cylinder along Z (three builds them along Y). */
function Tube({
  r0,
  r1,
  h,
  z,
  mat,
  open = false,
  seg = 40,
}: {
  r0: number;
  r1: number;
  h: number;
  z: number;
  mat: object;
  open?: boolean;
  seg?: number;
}) {
  // r0 is the radius at the front (+Z), r1 at the back.
  return (
    <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r0, r1, h, seg, 1, open]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  );
}

/* ---------------------------------------------------------------- flames */

const FLAME_CORE = new Color(5, 3, 1.1);
const FLAME_HALO = new Color(3.2, 1.2, 0.35);
const PALE = new Color(0.9, 1.3, 2.8);

/** An exhaust plume streaming out the back (-Z) of its parent, from z=0. */
function Plume({
  get,
  radius,
  length,
  core,
  halo,
}: {
  get: (t: number) => number;
  radius: number;
  length: number;
  core: Color;
  halo: Color;
}) {
  const inner = useRef<Mesh>(null);
  const outer = useRef<Mesh>(null);
  const innerMat = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const level = get(filmClock.t);
    const wob = 1 + Math.sin(clock.elapsedTime * 47) * 0.05 + Math.sin(clock.elapsedTime * 83) * 0.03;
    for (const [mesh, k] of [
      [inner.current, 0.8],
      [outer.current, 1],
    ] as const) {
      if (!mesh) continue;
      mesh.visible = level > 0.01;
      const l = length * level * wob * k;
      mesh.scale.set(radius * (0.6 + 0.4 * level) * k, Math.max(0.001, l), radius * (0.6 + 0.4 * level) * k);
      mesh.position.z = -l / 2;
    }
    if (innerMat.current) innerMat.current.opacity = 0.85 * level;
  });
  return (
    <>
      <mesh ref={outer} rotation={[-Math.PI / 2, 0, 0]}>
        {/* A unit cone along -Z: wide at the nozzle, tapering off. */}
        <coneGeometry args={[1, 1, 24, 1, true]} />
        <meshBasicMaterial color={halo} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[1, 1, 24, 1, true]} />
        <meshBasicMaterial ref={innerMat} color={core} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
    </>
  );
}

/* ---------------------------------------------------------------- the spent third stage */

/** The third stage with the adapter whose four petals open at separation. Origin: the adapter joint. */
export function Stage() {
  const group = useRef<Group>(null);
  const pivots = useRef<(Group | null)[]>([]);
  const stowed = useRef<Group>(null);
  useFrame(() => {
    const t = filmClock.t;
    const g = group.current;
    if (!g) return;
    g.visible = t < T.COAST + 8;
    if (!g.visible) return;
    // Eagle rides inside the adapter, nose toward the ship, until the ship has docked with it and drawn it out.
    if (stowed.current) stowed.current.visible = t < T.DOCK;
    orient(g, stagePose(t));
    const p = petals(t);
    pivots.current.forEach((pivot) => {
      if (!pivot) return;
      pivot.rotation.y = p.open * 1.05 + p.flown * 0.35;
      pivot.position.x = 0.33 + p.flown * 0.55;
      pivot.position.z = -0.35 - p.flown * 0.12;
    });
  });
  return (
    <group ref={group}>
      {/* S-IVB: white tank with black bands, dark thrust skirt, the J-2 bell. */}
      <Tube r0={0.33} r1={0.33} h={1.9} z={-1.3} mat={WHITE} />
      <Tube r0={0.334} r1={0.334} h={0.22} z={-0.62} mat={DARK} />
      <Tube r0={0.334} r1={0.334} h={0.22} z={-1.95} mat={DARK} />
      <Tube r0={0.3} r1={0.33} h={0.18} z={-2.34} mat={DARK} />
      <mesh position={[0, 0, -2.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.17, 0.26, 24, 1, true]} />
        <meshStandardMaterial {...GREY} side={DoubleSide} />
      </mesh>
      {/* Eagle, folded inside the adapter, its docking ring at the joint. */}
      <group ref={stowed} position={[0, 0, 1.1]} rotation={[0, Math.PI, 0]}>
        <ScaledEagle />
      </group>
      {/* The adapter petals, hinged at their aft edge. */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <group
            ref={(el) => {
              pivots.current[i] = el;
            }}
            position={[0.33, 0, -0.35]}
          >
            <mesh position={[-0.33, 0, 0.175]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.28, 0.33, 0.35, 12, 1, true, Math.PI / 4 + 0.03, Math.PI / 2 - 0.06]} />
              <meshStandardMaterial {...WHITE} side={DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
      <group position={[0, 0, -2.5]}>
        <Plume get={thrust} radius={0.17} length={3.2} core={FLAME_CORE} halo={FLAME_HALO} />
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- the ship itself */

const LM_SKIN = { color: "#d9dce1", roughness: 0.4, metalness: 0.5 } as const;

/**
 * The lunar module Eagle, docked nose to nose with the command module (the transposition and
 * docking were done in Earth orbit, before this film). Origin: the docking ring, +Z away from the CSM.
 */
function Eagle() {
  return (
    <group position={[0, 0, 1.08]}>
      {/* Docking collar */}
      <Tube r0={0.11} r1={0.12} h={0.07} z={0.02} mat={GREY} seg={16} />
      {/* Ascent stage: a faceted drum with the crew windows */}
      <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.3, 8]} />
        <meshStandardMaterial {...LM_SKIN} flatShading />
      </mesh>
      <mesh position={[0.1, 0.1, 0.27]} rotation={[0, 0, 0.78]}>
        <boxGeometry args={[0.06, 0.02, 0.05]} />
        <meshStandardMaterial color="#0b1118" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Descent stage wrapped in gold foil */}
      <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.26, 8]} />
        <meshStandardMaterial {...FOIL} flatShading />
      </mesh>
      {/* Four folded landing legs with their footpads, and the descent engine bell */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={i} rotation={[0, 0, a]}>
            <mesh position={[0.3, 0, 0.55]} rotation={[0, 0.3, 0]}>
              <boxGeometry args={[0.02, 0.02, 0.32]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
            <mesh position={[0.34, 0, 0.7]}>
              <cylinderGeometry args={[0.045, 0.045, 0.012, 12]} />
              <meshStandardMaterial {...GREY} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.1, 0.14, 16, 1, true]} />
        <meshStandardMaterial {...DARK} side={DoubleSide} />
      </mesh>
    </group>
  );
}

/** Eagle scaled to fit the adapter, keeping its docking ring where it is (at 1.1 along +Z). */
const EAGLE_SCALE = 0.6;
function ScaledEagle() {
  return (
    <group scale={EAGLE_SCALE} position={[0, 0, 1.1 * (1 - EAGLE_SCALE)]}>
      <Eagle />
    </group>
  );
}

/** The command and service module. Origin: the aft end of the service module; the nose is +Z. */
export function Ship() {
  const group = useRef<Group>(null);
  const eagle = useRef<Group>(null);
  useFrame(() => {
    const t = filmClock.t;
    const g = group.current;
    if (!g) return;
    g.visible = t < T.SM_SEP && viewKind(t) !== "cabin";
    if (g.visible) orient(g, shipPose(t));
    // Eagle rides on the nose from the docking until the descent (the way home is flown by the command module alone).
    if (eagle.current) eagle.current.visible = t >= T.DOCK && t < T.OUTBOUND_END;
  });
  return (
    <group ref={group}>
      <group ref={eagle}>
        <ScaledEagle />
      </group>
      <Tube r0={0.28} r1={0.28} h={0.62} z={0.31} mat={WHITE} />
      <Tube r0={0.283} r1={0.283} h={0.1} z={0.1} mat={DARK} />
      <Tube r0={0.283} r1={0.283} h={0.05} z={0.5} mat={GREY} />
      {/* Four RCS thruster quads */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2 + 0.78) * 0.285, Math.sin((i * Math.PI) / 2 + 0.78) * 0.285, 0.42]} rotation={[0, 0, (i * Math.PI) / 2 + 0.78]}>
          <boxGeometry args={[0.05, 0.1, 0.14]} />
          <meshStandardMaterial {...GREY} />
        </mesh>
      ))}
      {/* The service propulsion bell, and its blue-white flame */}
      <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.14, 0.26, 24, 1, true]} />
        <meshStandardMaterial {...FOIL} side={DoubleSide} />
      </mesh>
      {/* Command module: a cone with a dark heat-shield base */}
      <Tube r0={0.06} r1={0.28} h={0.4} z={0.82} mat={GREY} />
      <Tube r0={0.285} r1={0.285} h={0.06} z={0.64} mat={DARK} />
      <mesh position={[0, 0, 1.04]}>
        <sphereGeometry args={[0.065, 16, 12]} />
        <meshStandardMaterial {...FOIL} />
      </mesh>
      <mesh position={[0.17, 0.0, 0.84]} rotation={[0, 0.48, 0]}>
        <boxGeometry args={[0.02, 0.08, 0.1]} />
        <meshStandardMaterial color="#0b1118" roughness={0.1} metalness={0.8} />
      </mesh>
      <group position={[0, 0, -0.22]}>
        <Plume get={(t) => (t >= T.TLI_END ? thrust(t) : 0)} radius={0.11} length={1.7} core={PALE} halo={new Color(0.4, 0.6, 1.4)} />
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- reentry and splashdown */

const PLASMA_CORE = new Color(3.2, 1.8, 0.8);
const PLASMA_EDGE = new Color(2, 0.6, 0.25);

/** Height of the canopies above the point on the capsule where every shroud line ends (the chute group's origin). */
const CANOPY_HEIGHT = 9;

/** The tilt of the heat shield to the airflow in the entry, radians (about 17 degrees). */
const ANGLE_OF_ATTACK = -0.3;

function Canopy({ x, z }: { x: number; z: number; lean?: number }) {
  // Every line runs from the canopy's rim to the one point on the capsule, so the three chutes share it.
  const lines = useMemo(() => {
    const geo = new BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      pts.push(x + Math.cos(a) * 3.2, CANOPY_HEIGHT, z + Math.sin(a) * 3.2, 0, 0, 0);
    }
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return geo;
  }, [x, z]);
  return (
    <>
      <group position={[x, CANOPY_HEIGHT, z]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} scale={[3.2, 2.1, 3.2]}>
            <sphereGeometry args={[1, 8, 6, (i * Math.PI) / 4, Math.PI / 4, 0, Math.PI / 2]} />
            <meshStandardMaterial color={i % 2 ? "#f4f1ea" : "#e8561c"} roughness={0.7} side={DoubleSide} />
          </mesh>
        ))}
      </group>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color="#d8d3c8" />
      </lineSegments>
    </>
  );
}

function ExpandingRing() {
  const ring = useRef<Mesh>(null);
  useFrame(() => {
    const t = filmClock.t;
    const k = (t - (T.TOUCHDOWN - 0.1)) / 4;
    const m = ring.current;
    if (!m) return;
    m.visible = k > 0 && k < 1.4;
    m.scale.setScalar(1 + Math.max(0, k) * 7);
    (m.material as MeshBasicMaterial).opacity = Math.max(0, 0.5 * (1 - k / 1.4));
  });
  return (
    <mesh ref={ring} position={[SEA[0], 0.06, SEA[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.5, 2.1, 48]} />
      <meshBasicMaterial color="#e8f4ff" transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

/**
 * The command module alone: through the fire of reentry (heat shield first, a plasma wake behind),
 * then under three parachutes and down into the sea at the splashdown set.
 */
export function ReentryCapsule() {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const wake = useRef<Group>(null);
  const heat = useRef(0);
  const chutes = useRef<Group>(null);
  const sm = useRef<Group>(null);
  const drogues = useRef<Group>(null);
  const mains = useRef<Group>(null);
  const flow = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = filmClock.t;
    const g = group.current;
    if (!g) return;
    // From the service module's separation the command module flies alone, heat shield first, along the path home.
    const burning = t >= T.SM_SEP && t < SEA_ARRIVAL;
    const landing = t >= SEA_ARRIVAL;
    g.visible = burning || landing;
    const alt0 = landing ? capsuleAltitude(t) : 0;
    if (chutes.current) {
      chutes.current.visible = landing && t >= T.CHUTES && alt0 > 1.2;
      chutes.current.position.set(SEA[0], alt0 + 1.4, SEA[2]);
      // Two stages: the small drogues bloom at once, are cut away as the three big mains open (with a little
      // overshoot as each fills).
      const bloom = (x: number) => {
        const k = clamp01(x);
        return k * k * (3 - 2 * k);
      };
      const ds = bloom((t - T.CHUTES) / 1) * (1 - bloom((t - (T.CHUTES + MAIN_DELAY + 0.4)) / 0.6));
      const ms = bloom((t - (T.CHUTES + MAIN_DELAY)) / 1.8);
      if (drogues.current) {
        drogues.current.visible = ds > 0.01;
        drogues.current.scale.setScalar(0.3 * Math.max(0.01, ds));
      }
      if (mains.current) {
        mains.current.visible = ms > 0.01;
        mains.current.scale.setScalar(0.1 + 0.9 * ms * (1 + 0.1 * Math.sin(Math.PI * ms)));
      }
    }
    if (sm.current && !burning) sm.current.visible = false;
    if (!g.visible) return;
    if (burning) {
      const p = homePosition(t);
      const d = norm(sub(homePosition(t + 0.05), homePosition(t - 0.05)));
      // Heat shield (the -Z base of the cone) leads; the nose trails.
      // Right after the separation it still points its nose the way it is going; it then turns end for end
      // (about ten seconds on its thrusters) to put the heat shield first.
      const turn = Math.min(1, Math.max(0, (t - T.SM_SEP - 1.5) / 10));
      const k = turn * turn * (3 - 2 * turn);
      const ang = Math.PI * k;
      // The heading swings through a half circle in the horizontal plane: from the way it is going (nose first)
      // to the opposite (heat shield first, nose trailing).
      const side = norm([d[2], 0, -d[0]]);
      const fwd: Vec = [d[0] * Math.cos(ang) + side[0] * Math.sin(ang), d[1] * Math.cos(ang), d[2] * Math.cos(ang) + side[2] * Math.sin(ang)];
      orient(g, { pos: p, fwd: norm(fwd), up: [0, 1, 0] });
      // The command module flies its heat shield forward, tipped about 17 degrees to the airflow (its lift
      // attitude: the shield faces slightly down and the apex trails up and back). The wake follows the air,
      // not the capsule, so it is turned back by the same angle.
      const aoa = ANGLE_OF_ATTACK * Math.min(1, Math.max(0, (t - T.SM_SEP - 2) / 8));
      g.rotateX(aoa);
      if (flow.current) flow.current.rotation.x = -aoa;
      // The service module drifts back and tumbles; in the air it glows and burns away.
      const smNode = sm.current;
      if (smNode) {
        const q = t - T.SM_SEP;
        smNode.visible = t < T.REENTRY + 14;
        const dist = 3.2 + q * 0.35;
        smNode.position.set(p[0] - d[0] * dist, p[1] - d[1] * dist + Math.sin(q * 0.2) * 0.3, p[2] - d[2] * dist);
        smNode.rotation.set(q * 0.22, 0.4, q * 0.09);
        smNode.scale.setScalar(Math.max(0.01, t < T.REENTRY ? 1 : 1 - (t - T.REENTRY) / 14));
      }
      const hot = plasma(t);
      if (wake.current) {
        // From inside the cabin the fire is not a shape around you but light at the window (see the scene's overlay).
        wake.current.visible = hot > 0.02 && viewKind(t) !== "cabin";
      }
      heat.current = hot;
    } else {
      const alt = capsuleAltitude(t);
      const bob = alt < 1 ? Math.sin(clock.elapsedTime * 1.3) * 0.12 : 0;
      g.position.set(SEA[0], alt + bob, SEA[2]);
      g.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), landedTilt(t) + (alt < 1 ? Math.sin(clock.elapsedTime * 0.9) * 0.05 : 0.0));
      if (wake.current) wake.current.visible = false;
    }
  });
  return (
    <>
    <group ref={sm} visible={false}>
      <mesh>
        <cylinderGeometry args={[0.85, 0.85, 2.4, 24]} />
        <meshStandardMaterial color="#cfcfcf" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, -1.6, 0]}>
        <coneGeometry args={[0.7, 1.0, 20, 1, true]} />
        <meshStandardMaterial color="#2a2a2e" side={DoubleSide} />
      </mesh>
    </group>
    <group ref={chutes}>
      <group ref={drogues} visible={false}>
        <Canopy x={-3.4} z={0} lean={0.1} />
        <Canopy x={3.4} z={0} lean={-0.1} />
      </group>
      <group ref={mains} visible={false}>
        <Canopy x={-4.2} z={0} lean={0.12} />
        <Canopy x={4.2} z={0} lean={-0.12} />
        <Canopy x={0} z={-2.2} lean={0.05} />
      </group>
    </group>
    <group ref={group}>
      <group ref={body} scale={3}>
        <Tube r0={0.06} r1={0.28} h={0.4} z={0.2} mat={GREY} />
        <Tube r0={0.28} r1={0.27} h={0.08} z={-0.04} mat={DARK} />
        <mesh position={[0, 0, 0.42]}>
          <sphereGeometry args={[0.065, 16, 12]} />
          <meshStandardMaterial {...FOIL} />
        </mesh>
      </group>
      <group ref={wake}>
        <Plasma heat={heat} flowRef={flow} />
      </group>
    </group>
    <ExpandingRing />
    </>
  );
}
