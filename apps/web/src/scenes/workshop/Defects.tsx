"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Vector3, type Group, type Mesh, type MeshBasicMaterial, type SpotLight } from "three";
import { playSfx } from "@/game/sfx";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { FAULTS, faultPosition, scannerSignal, type Fault, type FaultId } from "./faults";

/**
 * The hidden faults and the scanner that finds them. Without the scanner a fault is a small
 * detail you could walk past; with it, defects glow through the hull and the ping tells you
 * which way to look. All of the per-frame state lives in `scan`, a plain mutable object the
 * HUD polls (same idea as `shake` and `fx`).
 */
export const scan = {
  on: false,
  /** Strongest signal 0..1 over the faults not yet found. */
  signal: 0,
};

const HOT = new Color(3.2, 1.1, 0.35);
const FOUND = new Color(0.25, 2.4, 1.0);

interface DefectsProps {
  scanning: boolean;
  found: ReadonlySet<FaultId>;
  /** Reveal everything (time ran out). */
  revealAll: boolean;
  onFound: (id: FaultId) => void;
}

export function Defects({ scanning, found, revealAll, onFound }: DefectsProps) {
  return (
    <group>
      <ScannerProbe scanning={scanning} found={found} />
      {FAULTS.map((f) => (
        <DefectMarker key={f.id} fault={f} scanning={scanning || revealAll} found={found.has(f.id)} pickable={scanning} onFound={onFound} />
      ))}
    </group>
  );
}

/** Flashlight beam, signal strength and the ping that gets faster near a fault. */
function ScannerProbe({ scanning, found }: { scanning: boolean; found: ReadonlySet<FaultId> }) {
  const camera = useThree((s) => s.camera);
  const spot = useRef<SpotLight>(null);
  const targetRef = useRef<Group>(null);
  const forward = useMemo(() => new Vector3(), []);
  const timer = useRef(0);

  useFrame((_, dt) => {
    scan.on = scanning;
    const light = spot.current;
    if (!scanning) {
      scan.signal = 0;
      if (light) light.intensity = 0;
      return;
    }
    camera.getWorldDirection(forward);
    const cam: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];
    const dir: [number, number, number] = [forward.x, forward.y, forward.z];
    let best = 0;
    for (const f of FAULTS) {
      if (found.has(f.id)) continue;
      best = Math.max(best, scannerSignal(cam, dir, faultPosition(f)));
    }
    scan.signal += (best - scan.signal) * Math.min(1, dt * 10);

    if (light && targetRef.current) {
      light.intensity = 90;
      light.position.copy(camera.position).add(new Vector3(0.25, -0.25, 0));
      targetRef.current.position.copy(camera.position).addScaledVector(forward, 8);
    }

    // Geiger-style ping: slow at the edge of range, a stutter on target.
    timer.current -= dt;
    if (scan.signal > 0.04 && timer.current <= 0) {
      playSfx("tick");
      timer.current = 0.75 - scan.signal * 0.65;
    }
  });

  return (
    <>
      <spotLight ref={spot} color="#cfe9ff" intensity={0} angle={0.42} penumbra={0.65} distance={42} decay={1.4} />
      <group ref={targetRef} />
    </>
  );
}

function DefectMarker({
  fault,
  scanning,
  found,
  pickable,
  onFound,
}: {
  fault: Fault;
  scanning: boolean;
  found: boolean;
  pickable: boolean;
  onFound: (id: FaultId) => void;
}) {
  const reduced = useReducedMotion();
  const pos = faultPosition(fault);
  const ring = useRef<Mesh>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const halo = useRef<Mesh>(null);
  const haloMat = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const show = scanning || found;
    if (ring.current) ring.current.visible = show;
    if (halo.current) halo.current.visible = show;
    if (!show) return;
    const pulse = reduced ? 0.7 : 0.5 + Math.sin(t * 5 + fault.y) * 0.5;
    if (ring.current) ring.current.scale.setScalar(found ? 1 : 0.85 + pulse * 0.3);
    if (ringMat.current) {
      ringMat.current.color.copy(found ? FOUND : HOT);
      ringMat.current.opacity = found ? 0.8 : 0.35 + pulse * 0.5;
    }
    if (haloMat.current) {
      haloMat.current.color.copy(found ? FOUND : HOT);
      haloMat.current.opacity = found ? 0.18 : 0.1 + pulse * 0.16;
    }
  });

  return (
    <group position={pos} rotation={[0, fault.theta, 0]}>
      {/* The physical fault, always there. Subtle without the scanner. */}
      <group position={[0, 0, 0]}>
        <FaultModel id={fault.id} lit={scanning && !found} />
      </group>

      {/* Scanner glow: a ring that faces outward and a soft halo */}
      <mesh ref={ring} position={[0, 0, 0.06]} visible={false} renderOrder={7}>
        <ringGeometry args={[0.34, 0.4, 40]} />
        <meshBasicMaterial ref={ringMat} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh ref={halo} position={[0, 0, 0.05]} visible={false} renderOrder={7}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial ref={haloMat} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
      </mesh>

      {/* Generous invisible hit area, only live with the scanner on */}
      {pickable && !found && (
        <mesh
          position={[0, 0, 0.1]}
          onClick={(e) => {
            if (e.delta > 6) return;
            e.stopPropagation();
            onFound(fault.id);
          }}
          onPointerOver={() => (document.body.style.cursor = "crosshair")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <sphereGeometry args={[0.5, 12, 10]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ---------------------------------------------------------------- the faults themselves
   Each is modelled in the hull's local frame: +z points out of the hull, +y is up. */

function FaultModel({ id, lit }: { id: FaultId; lit: boolean }) {
  switch (id) {
    case "crack":
      return <Crack lit={lit} />;
    case "valve":
      return <LeakingValve lit={lit} />;
    case "bolt":
      return <LooseBolt lit={lit} />;
    case "heatshield":
      return <PeelingTile lit={lit} />;
  }
}

/** A jagged hairline crack with branches. */
function Crack({ lit }: { lit: boolean }) {
  const segs = useMemo(() => {
    const out: { x: number; y: number; len: number; rot: number; w: number }[] = [];
    let x = -0.1;
    let y = 0.62;
    const rand = (i: number) => Math.sin(i * 91.7) * 0.5 + 0.5;
    for (let i = 0; i < 9; i++) {
      const dx = (rand(i) - 0.45) * 0.16;
      const dy = -0.14 - rand(i + 4) * 0.06;
      out.push({ x: x + dx / 2, y: y + dy / 2, len: Math.hypot(dx, dy), rot: Math.atan2(dx, -dy), w: 0.014 - i * 0.0006 });
      x += dx;
      y += dy;
    }
    return out;
  }, []);
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, s.y - 0.3, 0.012]} rotation={[0, 0, s.rot]}>
          <boxGeometry args={[Math.max(s.w, 0.006), s.len, 0.012]} />
          <meshStandardMaterial color="#0b0d10" roughness={1} emissive={lit ? HOT : "#000000"} emissiveIntensity={lit ? 1 : 0} />
        </mesh>
      ))}
      {/* A branch and a faint stain either side */}
      <mesh position={[0.1, 0.1, 0.012]} rotation={[0, 0, 0.9]}>
        <boxGeometry args={[0.006, 0.2, 0.012]} />
        <meshStandardMaterial color="#0b0d10" roughness={1} emissive={lit ? HOT : "#000000"} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[0.34, 0.8]} />
        <meshBasicMaterial color="#5b4c3a" transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A valve on a feed line with frost on the pipe and drips falling from it. */
function LeakingValve({ lit }: { lit: boolean }) {
  const drips = useRef<(Mesh | null)[]>([]);
  const mist = useRef<MeshBasicMaterial>(null);
  const reduced = useReducedMotion();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    drips.current.forEach((m, i) => {
      if (!m) return;
      const k = reduced ? 0.4 : (t * 0.9 + i * 0.37) % 1;
      m.position.set(0.02 * (i - 1), -0.08 - k * k * 0.9, 0.2);
      m.scale.setScalar(1 - k * 0.5);
      (m.material as MeshBasicMaterial).opacity = 1 - k;
    });
    if (mist.current) mist.current.opacity = 0.12 + (reduced ? 0 : Math.sin(t * 2) * 0.04);
  });
  return (
    <group>
      {/* Valve body, handwheel and the frosted pipe */}
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.18, 20]} />
        <meshStandardMaterial color="#7d8793" metalness={0.9} roughness={0.28} emissive={lit ? HOT : "#000"} emissiveIntensity={lit ? 0.7 : 0} />
      </mesh>
      <mesh position={[0, 0.08, 0.1]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.2, 10]} />
        <meshStandardMaterial color="#9aa4b0" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.2, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.016, 8, 20]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.12, 0.1]}>
        <cylinderGeometry args={[0.075, 0.075, 0.2, 14]} />
        <meshStandardMaterial color="#e8f3ff" roughness={0.9} />
      </mesh>
      {/* Frost bloom */}
      <mesh position={[0, -0.08, 0.2]}>
        <circleGeometry args={[0.24, 24]} />
        <meshBasicMaterial ref={mist} color="#d8ecff" transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (drips.current[i] = m)}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color="#d6ecff" transparent />
        </mesh>
      ))}
    </group>
  );
}

/** One bolt sticking proud of the flange, with a scorch mark and the gap showing. */
function LooseBolt({ lit }: { lit: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.09, 6]} />
        <meshStandardMaterial color="#c7ccd4" metalness={0.95} roughness={0.2} emissive={lit ? HOT : "#000"} emissiveIntensity={lit ? 0.9 : 0} />
      </mesh>
      <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.045, 0.085, 20]} />
        <meshBasicMaterial color="#14110e" transparent opacity={0.6} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh position={[0.07, -0.02, 0.03]}>
        <boxGeometry args={[0.012, 0.012, 0.012]} />
        <meshStandardMaterial color="#c7ccd4" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** A heat-shield tile with one corner curled away from the capsule. */
function PeelingTile({ lit }: { lit: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[0.26, 0.22]} />
        <meshStandardMaterial color="#6e4a2c" roughness={1} emissive={lit ? HOT : "#000"} emissiveIntensity={lit ? 0.6 : 0} />
      </mesh>
      {/* The lifted corner */}
      <group position={[0.1, 0.08, 0.014]} rotation={[0, 0.55, -0.2]}>
        <mesh position={[0.03, 0.025, 0.03]}>
          <planeGeometry args={[0.12, 0.1]} />
          <meshStandardMaterial color="#8a5b34" roughness={1} side={DoubleSide} emissive={lit ? HOT : "#000"} emissiveIntensity={lit ? 0.9 : 0} />
        </mesh>
      </group>
      {[[-0.18, -0.06], [0.02, -0.14], [0.16, 0.12]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.02]} rotation={[0, 0, i]}>
          <planeGeometry args={[0.035, 0.025]} />
          <meshStandardMaterial color="#8a5b34" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
