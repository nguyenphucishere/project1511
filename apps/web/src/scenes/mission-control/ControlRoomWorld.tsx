"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Group } from "three";
import { LightingRig } from "@/components/viewport/LightingRig";
import { Starfield } from "@/components/viewport/Starfield";
import { seeded } from "@/lib/random";
import { addTrauma } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PALETTE } from "@/lib/palette";
import { GROUND_Y, PAD, ROCKET_HEIGHT, ROOM, TIER, WINDOW } from "./layout";

interface ControlRoomWorldProps {
  /** performance.now() at ignition (T-0), or null while the rocket waits on the pad. */
  ignitionAt: number | null;
}

/** Seconds of engine build-up before the clamps release. */
const HOLD_DOWN = 1.2;
/** Visual climb acceleration (m/s²): slow enough to read, fast enough to feel heavy. */
const CLIMB = 3.5;

/**
 * Scene 3 geometry: the control room's back tier and front row, the window, and outside the
 * rocket on its pad at dawn. The launch itself is DOM-driven; this only plays the liftoff.
 */
export function ControlRoomWorld({ ignitionAt }: ControlRoomWorldProps) {
  return (
    <>
      <LightingRig />
      <Room />
      <Consoles />
      <Outside />
      {/* Remount per launch so smoke and position reset for the replacement vehicle. */}
      <LaunchPad key={ignitionAt ?? "idle"} ignitionAt={ignitionAt} />
    </>
  );
}

/* ---------------------------------------------------------------- inside */

function Room() {
  const w = ROOM.maxX - ROOM.minX;
  const d = ROOM.maxZ - ROOM.minZ;
  const cz = (ROOM.minZ + ROOM.maxZ) / 2;
  const h = ROOM.height;
  const sideW = (w - (WINDOW.maxX - WINDOW.minX)) / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      {/* Raised back tier the director sits on. */}
      <mesh position={[0, TIER.y / 2, (TIER.frontZ + ROOM.maxZ) / 2]}>
        <boxGeometry args={[w, TIER.y, ROOM.maxZ - TIER.frontZ]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, TIER.y + 0.01, TIER.frontZ + 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 0.1]} />
        <meshBasicMaterial color={PALETTE.gold} />
      </mesh>
      {/* Front wall: frame around the window opening. */}
      <mesh position={[0, WINDOW.bottom / 2, ROOM.minZ]}>
        <boxGeometry args={[w, WINDOW.bottom, 0.2]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, (WINDOW.top + h) / 2, ROOM.minZ]}>
        <boxGeometry args={[w, h - WINDOW.top, 0.2]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WINDOW.maxX + sideW / 2), (WINDOW.bottom + WINDOW.top) / 2, ROOM.minZ]}>
          <boxGeometry args={[sideW, WINDOW.top - WINDOW.bottom, 0.2]} />
          <meshStandardMaterial color={PALETTE.blue} />
        </mesh>
      ))}
      {/* Mullions: two, placed well clear of the line of sight to the pad. */}
      {[-2.4, 2.6].map((x) => (
        <mesh key={x} position={[x, (WINDOW.bottom + WINDOW.top) / 2, ROOM.minZ]}>
          <boxGeometry args={[0.1, WINDOW.top - WINDOW.bottom, 0.12]} />
          <meshStandardMaterial color={PALETTE.deep} />
        </mesh>
      ))}
      {/* Side and back walls. */}
      {[ROOM.minX, ROOM.maxX].map((x) => (
        <mesh key={x} position={[x, h / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial color={PALETTE.deep} />
        </mesh>
      ))}
      <mesh position={[0, h / 2, ROOM.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
    </group>
  );
}

/** A console desk with angled screens. */
function Desk({ position, width, screens }: { position: [number, number, number]; width: number; screens: number }) {
  const slots = Array.from({ length: screens }, (_, i) => (i + 0.5) * (width / screens) - width / 2);
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[width, 0.8, 0.7]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.8]} />
        <meshStandardMaterial color={PALETTE.mist} />
      </mesh>
      {slots.map((x, i) => (
        <group key={x} position={[x, 1.1, -0.15]} rotation={[-0.2, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.62, 0.42, 0.05]} />
            <meshStandardMaterial color={PALETTE.deep} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.54, 0.34]} />
            <meshBasicMaterial color={PALETTE.blue} />
          </mesh>
          {/* A trace or a bar on each screen, so the room reads as live. */}
          <mesh position={[0, i % 2 ? -0.06 : 0.04, 0.035]}>
            <planeGeometry args={[i % 2 ? 0.36 : 0.44, 0.03]} />
            <meshBasicMaterial color={i % 3 === 0 ? PALETTE.gold : PALETTE.mist} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Consoles() {
  return (
    <group>
      {/* No desk is modelled under the director's eye line: the DOM console panel is that desk,
          and a 3D one this close filled the bottom of the frame. */}
      {/* Front row on the main floor. */}
      <Desk position={[-3.4, 0, -1.6]} width={2.8} screens={3} />
      <Desk position={[0, 0, -1.6]} width={2.8} screens={3} />
      <Desk position={[3.4, 0, -1.6]} width={2.8} screens={3} />
    </group>
  );
}

/* ---------------------------------------------------------------- outside */

function Outside() {
  const stars = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: 70 }, () => [(rand() - 0.5) * 360, 25 + rand() * 120, -175 - rand() * 10] as const);
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, -90]}>
        <planeGeometry args={[500, 220]} />
        <meshStandardMaterial color={PALETTE.blue} />
      </mesh>
      {/* Dawn: a blue band above the horizon and a thin gold line where the sun will rise. */}
      <mesh position={[0, GROUND_Y + 20, -190]}>
        <planeGeometry args={[600, 40]} />
        <meshBasicMaterial color={PALETTE.blue} />
      </mesh>
      <mesh position={[-60, GROUND_Y + 1, -189]}>
        <planeGeometry args={[140, 2]} />
        <meshBasicMaterial color={PALETTE.gold} />
      </mesh>
      <Starfield positions={stars} />
      {/* Access road to the pad. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3, GROUND_Y + 0.02, -70]}>
        <planeGeometry args={[3, 100]} />
        <meshBasicMaterial color={PALETTE.deep} />
      </mesh>
    </group>
  );
}

function LaunchPad({ ignitionAt }: { ignitionAt: number | null }) {
  const reduced = useReducedMotion();
  const rocket = useRef<Group>(null);
  const plume = useRef<Group>(null);
  const smoke = useRef<Group>(null);
  const flame = useRef<Group>(null);

  useFrame(() => {
    const t = ignitionAt === null ? -1 : (performance.now() - ignitionAt) / 1000;
    const lit = t >= 0;
    if (plume.current) plume.current.visible = lit;
    if (smoke.current) smoke.current.visible = lit;
    if (!lit) return;

    // Engines build up on the clamps, then the stack climbs with constant acceleration.
    const climbT = Math.max(0, t - HOLD_DOWN);
    const rise = 0.5 * CLIMB * climbT * climbT;
    if (rocket.current) {
      rocket.current.position.y = rise;
      rocket.current.visible = rise < 400;
    }
    if (flame.current) {
      const flicker = reduced ? 1 : 1 + Math.sin(t * 47) * 0.08 + Math.sin(t * 31) * 0.06;
      flame.current.scale.set(1, Math.min(1, t / 0.6) * (1 + Math.min(climbT, 3) * 0.4) * flicker, 1);
    }
    if (smoke.current) {
      // Exhaust cloud spreading out from the pad and drifting up, independent of the rocket.
      const grow = Math.min(1, t / 3.5);
      smoke.current.scale.set(0.3 + grow * 1.4, 0.3 + grow, 0.3 + grow * 1.4);
      smoke.current.position.y = Math.min(t, 8) * 0.25;
    }
    // Rumble while the vehicle is low and loud: keep the trauma topped up, it decays itself.
    if (t < HOLD_DOWN + 6) addTrauma(t < HOLD_DOWN ? 0.03 : 0.02);
  });

  return (
    <group position={PAD}>
      {/* Pad deck and the service tower beside it. */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[12, 2, 12]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      <group position={[-5.5, 0, 0]}>
        {[-0.9, 0.9].flatMap((x) =>
          [-0.9, 0.9].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 18, z]}>
              <boxGeometry args={[0.3, 36, 0.3]} />
              <meshStandardMaterial color={PALETTE.orange} />
            </mesh>
          )),
        )}
        {[6, 12, 18, 24, 30].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[2.1, 0.3, 2.1]} />
            <meshStandardMaterial color={PALETTE.orange} />
          </mesh>
        ))}
        <mesh position={[0, 36.4, 0]}>
          <boxGeometry args={[0.5, 0.8, 0.5]} />
          <meshBasicMaterial color={PALETTE.gold} />
        </mesh>
      </group>

      <group ref={rocket} position={[0, 0, 0]}>
        <MiniRocket />
        <group ref={plume} visible={false} position={[0, 2.2, 0]}>
          {/* Flame cone hangs below the engines; its scale stretches it downward. */}
          <group ref={flame}>
            <group position={[0, -3, 0]}>
              <mesh rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[1.5, 6, 10, 1, true]} />
                <meshBasicMaterial color={PALETTE.orange} side={DoubleSide} />
              </mesh>
              <mesh rotation={[Math.PI, 0, 0]} position={[0, 0.8, 0]}>
                <coneGeometry args={[0.9, 4.2, 10]} />
                <meshBasicMaterial color={PALETTE.gold} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      <group ref={smoke} visible={false} position={[0, 0, 0]}>
        {[
          [-6, 2, 1, 4],
          [6, 2.4, -1, 4.5],
          [-2.5, 3, 4, 3.5],
          [3, 2.6, 4.5, 3.8],
          [0, 4, -3, 4],
          [-9, 1.6, -2, 3],
          [9.5, 1.8, 2, 3.2],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]}>
            <icosahedronGeometry args={[r, 0]} />
            <meshStandardMaterial color={PALETTE.mist} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Low-detail version of the assembly-hall rocket, same proportions and colours. */
function MiniRocket() {
  const sections: [number, number, number, number, string][] = [
    // [y0, y1, rBottom, rTop, colour]
    [2.2, 3.3, 1.75, 1.6, PALETTE.deep],
    [3.3, 12, 1.6, 1.6, PALETTE.mist],
    [12, 13.6, 1.6, 1.3, PALETTE.blue],
    [13.6, 19.2, 1.3, 1.3, PALETTE.mist],
    [19.2, 22.2, 1.3, 1.0, PALETTE.mist],
    [22.2, 24.2, 1.0, 1.0, PALETTE.mist],
    [24.2, 25.6, 1.0, 0.3, PALETTE.mist],
    [25.6, 29.2, 0.22, 0.22, PALETTE.mist],
    [29.2, ROCKET_HEIGHT, 0.22, 0.01, PALETTE.orange],
  ];
  return (
    <group>
      {sections.map(([y0, y1, r0, r1, color]) => (
        <mesh key={y0} position={[0, (y0 + y1) / 2, 0]}>
          <cylinderGeometry args={[r1, r0, y1 - y0, 14]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {[[3.3, 4.2], [7.5, 7.9], [11.4, 12]].map(([y0, y1]) => (
        <mesh key={y0} position={[0, (y0 + y1) / 2, 0]}>
          <cylinderGeometry args={[1.62, 1.62, y1 - y0, 14]} />
          <meshStandardMaterial color={PALETTE.deep} />
        </mesh>
      ))}
    </group>
  );
}
