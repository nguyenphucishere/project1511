"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CatmullRomCurve3, Color, DoubleSide, Vector3, type MeshBasicMaterial } from "three";
import { Hotspot } from "@/components/viewport/Hotspot";
import { SCENE_COLORS } from "@/lib/palette";
import type { StationId } from "./checks";
import { STATION_NAME } from "./content";
import { STATIONS, type StationSpot } from "./layout";
import { makeLettering } from "./textures";

type Status = "idle" | "busy" | "done";

const AMBER = new Color(2.6, 1.5, 0.2);
const CYAN = new Color(0.2, 2.2, 3.0);
const GREEN = new Color(0.25, 2.4, 0.9);

const SIGN: Record<StationId, string> = { fuel: "FUEL", electrical: "POWER", pressure: "PRESS" };
const signs: Partial<Record<StationId, ReturnType<typeof makeLettering>>> = {};
function sign(id: StationId) {
  return (signs[id] ??= makeLettering(SIGN[id], { color: "#0b192c", font: "800 54px Arial, sans-serif", w: 256, h: 80 }));
}

interface StationsProps {
  /** Hotspots exist only while the checklist is running. */
  interactive: boolean;
  done: readonly StationId[];
  busy: StationId | null;
  onPress: (id: StationId) => void;
}

export function Stations({ interactive, done, busy, onPress }: StationsProps) {
  return (
    <group>
      {STATIONS.map((s) => {
        const status: Status = done.includes(s.id) ? "done" : busy === s.id ? "busy" : "idle";
        const body = <Kiosk spot={s} status={status} />;
        return interactive ? (
          <Hotspot
            key={s.id}
            id={`station-${s.id}`}
            label={STATION_NAME[s.id]}
            position={s.position}
            markerHeight={2.15}
            done={status === "done"}
            onActivate={() => onPress(s.id)}
          >
            {body}
          </Hotspot>
        ) : (
          <group key={s.id} position={s.position}>
            {body}
          </group>
        );
      })}
      <Umbilical show={done.includes("fuel") || busy === "fuel"} />
    </group>
  );
}

function Kiosk({ spot, status }: { spot: StationSpot; status: Status }) {
  const screen = useRef<MeshBasicMaterial>(null);
  const beacon = useRef<MeshBasicMaterial>(null);
  const tmp = useMemo(() => new Color(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const base = status === "done" ? GREEN : status === "busy" ? CYAN : AMBER;
    const k = status === "idle" ? 0.65 + Math.sin(t * 3) * 0.35 : status === "busy" ? 0.7 + Math.sin(t * 14) * 0.3 : 1;
    tmp.copy(base).multiplyScalar(k);
    screen.current?.color.copy(tmp);
    beacon.current?.color.copy(tmp);
  });

  return (
    <group rotation={[0, spot.rotationY, 0]}>
      {/* Plinth, cabinet and sloped console */}
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.15, 0.14, 0.85]} />
        <meshStandardMaterial color="#232a33" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.95, 1.1, 0.65]} />
        <meshPhysicalMaterial color={SCENE_COLORS.nasaBlue} metalness={0.4} roughness={0.38} clearcoat={0.5} />
      </mesh>
      <group position={[0, 1.34, 0.02]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.0, 0.5, 0.08]} />
          <meshStandardMaterial color="#1b222b" metalness={0.7} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[0.86, 0.36]} />
          <meshBasicMaterial ref={screen} color={AMBER} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[0.5, 0.15]} />
          <meshBasicMaterial map={sign(spot.id)} transparent depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
      {/* Beacon on a mast */}
      <mesh position={[0, 1.85, -0.18]}>
        <cylinderGeometry args={[0.018, 0.018, 0.5, 6]} />
        <meshStandardMaterial color="#59616b" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.12, -0.18]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshBasicMaterial ref={beacon} color={AMBER} toneMapped={false} />
      </mesh>
      {/* Hazard stripe on the plinth */}
      <mesh position={[0, 0.15, 0.43]}>
        <planeGeometry args={[1.15, 0.05]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.6} />
      </mesh>
      {spot.id === "fuel" && <FuelFittings />}
      {spot.id === "pressure" && <Gauge status={status} />}
      {spot.id === "electrical" && <Breakers status={status} />}
    </group>
  );
}

function FuelFittings() {
  return (
    <group position={[0.7, 0, 0]}>
      {[0.25, 0.55, 0.85].map((y, i) => (
        <group key={y}>
          <mesh position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.5, 12]} />
            <meshStandardMaterial color={i === 1 ? "#c9d1d9" : "#8a94a0"} metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0.12, y + 0.08, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
            <meshStandardMaterial color="#b91c1c" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Gauge({ status }: { status: Status }) {
  return (
    <group position={[-0.6, 0.95, 0.1]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.09, 28]} />
        <meshStandardMaterial color="#c9d1d9" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <circleGeometry args={[0.19, 28]} />
        <meshBasicMaterial color={status === "done" ? "#c9f7dd" : "#f5f1e6"} />
      </mesh>
      <mesh position={[0.02, 0.03, 0.056]} rotation={[0, 0, status === "done" ? -0.4 : 1.1]}>
        <boxGeometry args={[0.012, 0.15, 0.006]} />
        <meshBasicMaterial color="#b91c1c" />
      </mesh>
    </group>
  );
}

function Breakers({ status }: { status: Status }) {
  return (
    <group position={[0.2, 0.75, 0.34]}>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[-0.3 + i * 0.12, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.07, 0.16, 0.03]} />
            <meshStandardMaterial color="#10151b" roughness={0.6} />
          </mesh>
          <mesh position={[0, status === "done" ? 0.04 : -0.04, 0.025]}>
            <boxGeometry args={[0.05, 0.06, 0.03]} />
            <meshStandardMaterial color={status === "done" ? "#34d399" : "#ef4444"} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Braided umbilical hose from the cryo skid, via the fuel panel, to the rocket's base. */
function Umbilical({ show }: { show: boolean }) {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(8.2, 0.35, -4.2),
        new Vector3(7.4, 0.12, -2.8),
        new Vector3(6.1, 0.1, -1.2),
        new Vector3(4.5, 0.08, -0.2),
        new Vector3(3.0, 0.5, 0.2),
        new Vector3(1.9, 1.5, 0.15),
      ]),
    [],
  );
  if (!show) return null;
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 48, 0.07, 10, false]} />
        <meshStandardMaterial color="#aab3be" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[1.9, 1.5, 0.15]}>
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshStandardMaterial color="#1b222b" metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  );
}
