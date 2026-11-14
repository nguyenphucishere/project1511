"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, MathUtils, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial, type PointLight } from "three";
import { inputLock } from "@/game/input";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";
import { CRANE, createCrane, loadOffset, stepCrane, type CraneEvent, type CraneInput, type CraneState, type LiftSpec } from "./crane";
import { CRANE_LIFTS, HALL, type CraneLift } from "./layout";
import { useHallTextures } from "./textures";

/**
 * The gantry crane and its minigame. `CraneRig` is a plain mutable object shared with the HUD
 * (like `shake` and `fx`): the simulation writes it every frame and nothing re-renders on it.
 */
export interface CraneRigState {
  /** True while the player is driving the crane. */
  active: boolean;
  lift: number;
  state: CraneState;
  input: CraneInput;
  /** Rough landings so far, over all lifts. */
  bumps: number;
  /** 1 right after a section seats, decays to 0; drives the shockwave ring and the light. */
  pulse: number;
  pulseY: number;
  /** Mirror of CraneState.blocked, for the HUD. */
  blocked: boolean;
}

export const toSpec = (l: CraneLift): LiftSpec => ({ id: String(l.index), seatY: l.seatY, start: l.start });

export function createRig(): CraneRigState {
  return {
    active: false,
    lift: 0,
    state: createCrane(toSpec(CRANE_LIFTS[0])),
    input: { moveX: 0, moveZ: 0, hoist: 0 },
    bumps: 0,
    pulse: 0,
    pulseY: 0,
    blocked: false,
  };
}

export function startLift(rig: CraneRigState, index: number) {
  rig.lift = index;
  rig.state = createCrane(toSpec(CRANE_LIFTS[index]));
  rig.input = { moveX: 0, moveZ: 0, hoist: 0 };
  rig.blocked = false;
  rig.active = true;
}

/** One physics step plus what it means for the rig (rough landings, the seat pulse). Also used by the dev hook. */
export function advanceCrane(rig: CraneRigState, input: CraneInput, dt: number, onEvent: (e: CraneEvent, lift: number) => void) {
  if (!rig.active) return;
  const spec = toSpec(CRANE_LIFTS[rig.lift]);
  const events = stepCrane(rig.state, input, dt, spec);
  rig.blocked = rig.state.blocked;
  for (const ev of events) {
    if (ev === "hard-landing") rig.bumps += 1;
    if (ev === "seated") {
      rig.pulse = 1;
      rig.pulseY = spec.seatY;
      rig.active = false;
      inputLock.keys = false;
    }
    onEvent(ev, rig.lift);
  }
}

/** Reads the keyboard into rig.input and runs the physics. Mount once, inside the canvas. */
export function CraneController({ rig, onEvent }: { rig: CraneRigState; onEvent: (e: CraneEvent, lift: number) => void }) {
  const held = useRef(new Set<string>());
  const callback = useRef(onEvent);
  callback.current = onEvent;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!rig.active) return;
      if (["KeyA", "KeyD", "KeyW", "KeyS", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyE", "ShiftLeft"].includes(e.code)) {
        e.preventDefault();
        held.current.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.code);
    const clear = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      inputLock.keys = false;
    };
  }, [rig]);

  useFrame((_, rawDt) => {
    inputLock.keys = rig.active;
    rig.pulse = Math.max(0, rig.pulse - rawDt * 1.4);
    if (!rig.active) return;
    const k = held.current;
    const dt = Math.min(rawDt, 0.05);
    const pad = rig.input;
    // Keyboard and on-screen buttons both feed the same input; whichever is held wins.
    const moveX = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) || pad.moveX;
    const moveZ = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) || pad.moveZ;
    const hoist = (k.has("KeyE") ? 1 : 0) - (k.has("Space") ? 1 : 0) || pad.hoist;
    advanceCrane(rig, { moveX, moveZ, hoist }, dt, (e, l) => callback.current(e, l));
  });
  return null;
}

/* ---------------------------------------------------------------- visuals */

const CRANE_Y = HALL.height - 1.8;
const HOOK_GAP = 1.7;
const up = new Vector3(0, 1, 0);

/** A cylinder stretched between two moving points. */
function Strut({ from, to, radius = 0.025, color = "#c9d1d9", metal = 0.9 }: { from: () => Vector3; to: () => Vector3; radius?: number; color?: string; metal?: number }) {
  const ref = useRef<Mesh>(null);
  const a = useMemo(() => new Vector3(), []);
  const b = useMemo(() => new Vector3(), []);
  const q = useMemo(() => new Quaternion(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    a.copy(from());
    b.copy(to());
    const len = a.distanceTo(b);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(1, Math.max(len, 0.001), 1);
    m.quaternion.copy(q.setFromUnitVectors(up, b.sub(a).normalize()));
  });
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[radius, radius, 1, 8]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={0.35} />
    </mesh>
  );
}

/** The overhead crane: bridge, trolley, cables, hook block and slings. Follows the rig while it is active. */
export function OverheadCrane({ rig, carrying }: { rig: CraneRigState; carrying: number | null }) {
  const reduced = useReducedMotion();
  const tex = useHallTextures();
  const bridge = useRef<Group>(null);
  const trolley = useRef<Group>(null);
  const hook = useRef<Group>(null);
  const strobe = useRef<MeshBasicMaterial>(null);
  const hookPos = useMemo(() => new Vector3(), []);
  const trolleyPos = useMemo(() => new Vector3(), []);
  const w = HALL.maxX - HALL.minX;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const driving = carrying !== null;
    const s = rig.state;
    // Parked: drift gently when nobody is driving, hook held high.
    const tx = driving ? s.x : reduced ? 0 : Math.sin(t * 0.12) * 8.5;
    const tz = driving ? s.z : 0;
    const hy = driving ? s.y + CRANE_LIFTS[carrying].height + HOOK_GAP : CRANE_Y - 7;
    const hx = driving ? s.x + s.sx : tx;
    const hz = driving ? s.z + s.sz : tz;
    if (bridge.current) bridge.current.position.z = tz;
    if (trolley.current) trolley.current.position.x = tx;
    trolleyPos.set(tx, CRANE_Y - 1.1, tz);
    hookPos.set(hx, hy, hz);
    if (hook.current) hook.current.position.copy(hookPos);
    if (strobe.current) strobe.current.color.set(Math.sin(t * 8) > 0.3 ? SCENE_COLORS.solarGold : "#451A03");
  });

  const slingAnchors = useMemo(() => [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4), []);
  const slingTop = (i: number) => () => {
    if (carrying === null) return hookPos.clone().add(new Vector3(0, -2, 0));
    const lift = CRANE_LIFTS[carrying];
    const s = rig.state;
    const r = lift.index === 0 ? 1.45 : lift.index === 1 ? 1.15 : 0.7;
    const a = slingAnchors[i];
    return new Vector3(s.x + s.sx + Math.sin(a) * r, s.y + lift.height, s.z + s.sz + Math.cos(a) * r);
  };
  const hookBottom = (i: number) => () => hookPos.clone().add(new Vector3(Math.sin(slingAnchors[i]) * 0.5, -0.35, Math.cos(slingAnchors[i]) * 0.5));

  return (
    <group>
      <group ref={bridge} position={[0, CRANE_Y, 0]}>
        {/* Two yellow box girders spanning the hall */}
        {[-1.1, 1.1].map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh>
              <boxGeometry args={[w - 0.6, 1.4, 0.9]} />
              <meshStandardMaterial {...tex.metalGirder} color="#e6b800" metalness={0.45} roughness={0.5} />
            </mesh>
            {[-14, -7, 0, 7, 14].map((x) => (
              <mesh key={x} position={[x, 0, z > 0 ? 0.46 : -0.46]}>
                <planeGeometry args={[1.3, 1.3]} />
                <meshStandardMaterial color="#141a22" roughness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
        {/* End trucks riding the runway rails */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (w / 2 - 0.5), -0.1, 0]}>
            <boxGeometry args={[1.4, 1.2, 3.4]} />
            <meshStandardMaterial color="#3a424d" metalness={0.8} roughness={0.5} />
          </mesh>
        ))}
        <group ref={trolley}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[3.0, 1.0, 2.9]} />
            <meshPhysicalMaterial color={SCENE_COLORS.nasaBlue} roughness={0.45} metalness={0.3} clearcoat={0.4} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.28, 14]} />
            <meshBasicMaterial ref={strobe} color={SCENE_COLORS.solarGold} />
          </mesh>
          <mesh position={[0, -0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.45, 0.45, 1.8, 24]} />
            <meshStandardMaterial color="#232a33" metalness={0.9} roughness={0.35} />
          </mesh>
        </group>
      </group>

      {/* Hoist cables from the drum to the hook block */}
      {[-0.55, 0.55].map((dx) => (
        <Strut key={dx} radius={0.03} from={() => trolleyPos.clone().add(new Vector3(dx, 0, 0))} to={() => hookPos.clone().add(new Vector3(dx, 0.5, 0))} />
      ))}

      <group ref={hook}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.5, 0.9, 0.8]} />
          <meshPhysicalMaterial color="#e6b800" roughness={0.4} metalness={0.5} clearcoat={0.3} />
        </mesh>
        <mesh position={[0, -0.45, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.32, 0.1, 12, 24, Math.PI * 1.5]} />
          <meshStandardMaterial color="#262c34" metalness={0.9} roughness={0.35} />
        </mesh>
      </group>

      {carrying !== null &&
        [0, 1, 2, 3].map((i) => <Strut key={i} radius={0.02} color="#9aa4b0" from={hookBottom(i)} to={slingTop(i)} />)}
    </group>
  );
}

/** Wraps the parts being lifted: follows the rig's load position and tilts with the swing. */
export function CarriedLoad({ rig, lift, children }: { rig: CraneRigState; lift: CraneLift; children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = rig.state;
    g.position.set(s.x + s.sx, s.y - lift.seatY, s.z + s.sz);
    // Tilt about the hook: a swing of 1 m on a 9 m cable is about 6 degrees.
    g.rotation.set(MathUtils.clamp(s.sz / CRANE.cable, -0.2, 0.2), 0, MathUtils.clamp(-s.sx / CRANE.cable, -0.2, 0.2));
  });
  return <group ref={ref}>{children}</group>;
}

const GREEN = new Color("#34d399");
const AMBER = new Color("#fbbf24");
const RED = new Color("#f87171");

/** Landing ring on the stack and a plumb line from the load: green when lined up, red when not. */
export function PlacementGuide({ rig, lift }: { rig: CraneRigState; lift: CraneLift }) {
  const ring = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const color = useMemo(() => new Color(), []);
  const radius = lift.index === 0 ? 1.62 : lift.index === 1 ? 1.32 : 1.02;

  useFrame(({ clock }) => {
    const s = rig.state;
    const off = loadOffset(s);
    const ok = off <= CRANE.tolerance;
    const near = off <= CRANE.tolerance * 2.2;
    color.copy(ok ? GREEN : near ? AMBER : RED);
    for (const m of mats.current) m?.color.copy(color);
    if (ring.current) {
      ring.current.visible = rig.active || rig.pulse > 0;
      ring.current.position.set(0, lift.seatY + 0.02, 0);
      const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.015;
      ring.current.scale.setScalar(pulse);
    }
    if (beam.current) {
      beam.current.visible = rig.active;
      const x = s.x + s.sx;
      const z = s.z + s.sz;
      const len = Math.max(s.y - lift.seatY, 0.01);
      beam.current.position.set(x, lift.seatY + len / 2, z);
      beam.current.scale.set(1, len, 1);
    }
    if (light.current) light.current.intensity = rig.pulse * 18;
  });

  return (
    <group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <ringGeometry args={[radius - 0.05, radius + 0.05, 64]} />
        <meshBasicMaterial ref={(m) => void (mats.current[0] = m)} transparent opacity={0.95} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh ref={beam} renderOrder={4}>
        <cylinderGeometry args={[0.025, 0.025, 1, 8]} />
        <meshBasicMaterial ref={(m) => void (mats.current[1] = m)} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, lift.seatY + 0.5, 0]} color="#bfe3ff" intensity={0} distance={14} />
    </group>
  );
}

/** Shockwave ring and dust when a section clamps onto the stack. */
export function SeatPulse({ rig }: { rig: CraneRigState }) {
  const ring = useRef<Mesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (!ring.current || !mat.current) return;
    const k = 1 - rig.pulse;
    ring.current.visible = rig.pulse > 0.001;
    ring.current.position.set(0, rig.pulseY + 0.05, 0);
    ring.current.scale.setScalar(1 + k * 5);
    mat.current.opacity = rig.pulse * 0.7;
  });
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={5}>
      <ringGeometry args={[1.0, 1.25, 64]} />
      <meshBasicMaterial ref={mat} color="#cfe8ff" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}
