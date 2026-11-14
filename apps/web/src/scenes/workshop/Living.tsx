"use client";

import { useRef } from "react";
import { WeldSparks } from "./Workers";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, MathUtils, type Group, type MeshBasicMaterial, type PointLight } from "three";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SCENE_COLORS } from "@/lib/palette";

/** Where the forklift is and whether it is manoeuvring, for the hall soundscape. */
export const forkliftAudio = { x: -12.2, z: 8.5, turning: false };

/** Heavy industrial forklift shuttling along the west aisle: drives, turns around, drives back. */
export function IndustrialForklift() {
  const root = useRef<Group>(null);
  const strobe = useRef<MeshBasicMaterial>(null);
  const reduced = useReducedMotion();
  const AISLE_X = -12.2;
  const Z_A = 8.5;
  const Z_B = -5.5;
  const LEG = 7;
  const TURN = 2.4;

  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const cycle = 2 * (LEG + TURN);
    const t = reduced ? 0 : clock.elapsedTime % cycle;
    let z: number;
    let yaw: number;
    // Forks point to -z at yaw 0.
    if (t < LEG) {
      z = MathUtils.lerp(Z_A, Z_B, MathUtils.smootherstep(t / LEG, 0, 1));
      yaw = 0;
    } else if (t < LEG + TURN) {
      z = Z_B;
      yaw = Math.PI * MathUtils.smootherstep((t - LEG) / TURN, 0, 1);
    } else if (t < 2 * LEG + TURN) {
      z = MathUtils.lerp(Z_B, Z_A, MathUtils.smootherstep((t - LEG - TURN) / LEG, 0, 1));
      yaw = Math.PI;
    } else {
      z = Z_A;
      yaw = Math.PI + Math.PI * MathUtils.smootherstep((t - 2 * LEG - TURN) / TURN, 0, 1);
    }
    g.position.set(AISLE_X, 0, z);
    forkliftAudio.x = AISLE_X;
    forkliftAudio.z = z;
    forkliftAudio.turning = (t >= LEG && t < LEG + TURN) || t >= 2 * LEG + TURN;
    g.rotation.y = yaw;
    if (strobe.current) strobe.current.color.set(Math.sin(clock.elapsedTime * 9) > 0 ? "#fbbf24" : "#3a2a08");
  });

  return (
    <group ref={root} position={[-12.2, 0, 8.5]}>
      <mesh position={[0, 2.22, 0]}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshBasicMaterial ref={strobe} color="#fbbf24" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.34, -1.9]}>
        <boxGeometry args={[0.8, 0.5, 0.9]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.6} />
      </mesh>
      {/* Heavy yellow chassis */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.5, 0.7, 2.4]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.4} />
      </mesh>
      {/* Black rear counterweight */}
      <mesh position={[0, 0.65, 1.0]}>
        <boxGeometry args={[1.48, 0.8, 0.6]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} />
      </mesh>
      {/* 4 Solid rubber industrial tires */}
      {[
        [-0.8, 0.35, 0.7],
        [0.8, 0.35, 0.7],
        [-0.8, 0.35, -0.7],
        [0.8, 0.35, -0.7],
      ].map(([x, y, z]) => (
        <mesh key={`${x}${z}`} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
          <meshStandardMaterial color="#111827" roughness={0.8} />
        </mesh>
      ))}
      {/* Overhead Operator Protection Cage */}
      {[-0.65, 0.65].flatMap((x) =>
        [-0.4, 0.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 1.5, z]}>
            <boxGeometry args={[0.08, 1.2, 0.08]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} />
          </mesh>
        )),
      )}
      <mesh position={[0, 2.1, 0]}>
        <boxGeometry args={[1.4, 0.06, 1.0]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      {/* Driver seat and steering wheel */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.5, 0.35, 0.5]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
      {/* Mast & Lifting Forks */}
      <mesh position={[0, 1.4, -1.25]}>
        <boxGeometry args={[0.9, 2.2, 0.12]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
      </mesh>
      {/* 2 Steel Forks extending forward */}
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, 0.08, -1.9]}>
          <boxGeometry args={[0.12, 0.05, 1.2]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Cryogenic Ground Support Equipment: high-pressure helium and nitrogen tanks */
export function CryoSupplyTanks() {
  return (
    <group position={[9.0, 0, -4.5]} rotation={[0, -0.4, 0]}>
      {/* Heavy support skid */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.2, 0.2, 1.4]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} />
      </mesh>
      {/* 3 High-pressure cryogenic vessels */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <group key={x} position={[x, 1.1, 0]}>
          <mesh>
            <cylinderGeometry args={[0.26, 0.26, 1.8, 16]} />
            <meshStandardMaterial
              color={i === 1 ? SCENE_COLORS.spaceWhite : SCENE_COLORS.nasaBlue}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.26, 16, 12]} />
            <meshStandardMaterial color={i === 1 ? SCENE_COLORS.spaceWhite : SCENE_COLORS.nasaBlue} />
          </mesh>
          {/* Pressure gauge & brass regulator valve */}
          <mesh position={[0, 1.2, 0.15]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
            <meshStandardMaterial color={SCENE_COLORS.solarGold} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Stainless braided flexible umbilical hose leading toward rocket */}
      <mesh position={[-1.2, 0.15, -0.4]} rotation={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Set dressing on the hall floor: spare engine on cart, tool chests, workbench */
export function Props() {
  return (
    <group>
      {/* Spare rocket engine on maintenance stand */}
      <group position={[8.5, 0, 7]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[2.2, 0.3, 1.5]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <cylinderGeometry args={[0.22, 0.58, 1.4, 16, 1, true]} />
          <meshStandardMaterial color={SCENE_COLORS.titanium} metalness={0.8} roughness={0.25} side={DoubleSide} />
        </mesh>
      </group>

      {/* Crates and shipping containers with NASA markings */}
      {[
        [-13, -9, 1.6, SCENE_COLORS.nasaBlue],
        [-11.4, -9.6, 1.2, SCENE_COLORS.nasaRed],
        [14, 9, 1.4, SCENE_COLORS.steelMid],
        [12.6, 10.4, 1, SCENE_COLORS.spaceWhite],
      ].map(([x, z, size, color]) => (
        <group key={`${x}${z}`} position={[x as number, (size as number) / 2, z as number]}>
          <mesh>
            <boxGeometry args={[size as number, size as number, size as number]} />
            <meshStandardMaterial color={color as string} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, (size as number) / 2 + 0.01]}>
            <planeGeometry args={[(size as number) * 0.4, (size as number) * 0.2]} />
            <meshBasicMaterial color={SCENE_COLORS.solarGold} />
          </mesh>
        </group>
      ))}

      {/* Workbench with computer terminal & red tool chest */}
      <group position={[-3.8, 0, 9.6]} rotation={[0, 0.35, 0]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[2.2, 0.08, 0.9]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} />
        </mesh>
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} position={[x, 0.45, 0]}>
            <boxGeometry args={[0.08, 0.9, 0.8]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} />
          </mesh>
        ))}
        {/* Rolling tool chest */}
        <mesh position={[0.4, 1.15, 0]}>
          <boxGeometry args={[0.65, 0.4, 0.35]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.4} />
        </mesh>
        {/* Computer monitor */}
        <mesh position={[-0.4, 1.22, 0]}>
          <boxGeometry args={[0.5, 0.38, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        <mesh position={[-0.4, 1.22, 0.045]}>
          <planeGeometry args={[0.44, 0.32]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- lively personnel */

/** Floor Level: Lead Propulsion Engineer patrolling with tablet */
export function FloorEngineer() {
  const root = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime * 0.35;
    const x = Math.sin(t) * 3.5;
    const moving = Math.cos(t);
    if (root.current) {
      root.current.position.set(x, 0, 5.5);
      root.current.rotation.y = moving >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const stride = Math.sin(clock.elapsedTime * 3) * 0.35;
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride;
  });

  return (
    <group ref={root} position={[0, 0, 5.5]}>
      {/* Boots */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]}>
          <boxGeometry args={[0.13, 0.12, 0.26]} />
          <meshStandardMaterial color="#1F2937" />
        </mesh>
      ))}
      {/* Trousers */}
      <group ref={leftLeg} position={[-0.1, 0.48, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.72, 0.18]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.1, 0.48, 0]}>
        <mesh>
          <boxGeometry args={[0.14, 0.72, 0.18]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>
      {/* High-visibility orange safety vest over white shirt */}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.42, 0.62, 0.26]} />
        <meshStandardMaterial color="#EA580C" roughness={0.5} />
      </mesh>
      {/* Silver reflective vest stripes */}
      <mesh position={[0, 1.15, 0.132]}>
        <planeGeometry args={[0.38, 0.08]} />
        <meshBasicMaterial color="#E0F2FE" />
      </mesh>
      {/* Head with white NASA hardhat */}
      <mesh position={[0, 1.58, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <sphereGeometry args={[0.15, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.64, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Holding Ruggedized Inspection Tablet */}
      <group position={[0, 1.05, 0.28]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.28, 0.38, 0.03]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        <mesh position={[0, 0, 0.018]}>
          <planeGeometry args={[0.24, 0.32]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
      </group>
    </group>
  );
}

/** Floor Level: Quality Inspector checking the stage 1 engine bells */
export function FloorInspector() {
  const headRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (headRef.current) {
      headRef.current.rotation.x = -0.3 + Math.sin(clock.elapsedTime * 1.5) * 0.15;
    }
  });

  return (
    <group position={[-2.4, 0, 3.2]} rotation={[0, Math.PI / 4, 0]}>
      {/* Trousers & Boots */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.32, 0.75, 0.22]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
      {/* Safety Yellow High-Vis Jacket */}
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.26]} />
        <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>
      {/* Head with White Hardhat */}
      <group ref={headRef} position={[0, 1.56, 0]}>
        <mesh>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial color="#FCD34D" />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.15, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>
      {/* Holding clipboard */}
      <mesh position={[0, 1.05, 0.22]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.2, 0.28, 0.02]} />
        <meshStandardMaterial color="#B45309" />
      </mesh>
    </group>
  );
}

/** Level 2: Technician with animated welding sparks inspecting the interstage */
export function Level2Technician() {
  const sparkLight = useRef<PointLight>(null);
  const sparkMesh = useRef<MeshBasicMaterial>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (reduced) return;
    const flicker = Math.random() > 0.4 && Math.sin(clock.elapsedTime * 4) > -0.1;
    if (sparkLight.current) {
      sparkLight.current.intensity = flicker ? 2.5 + Math.random() * 2 : 0;
    }
    if (sparkMesh.current) {
      sparkMesh.current.color.set(flicker ? "#E0F2FE" : "#1E293B");
    }
  });

  return (
    <group position={[-5.32, 12.3, 2.24]} rotation={[0, 1.97, 0]}>
      {/* Technician in work coveralls */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.34, 0.75, 0.22]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.26]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.7} />
      </mesh>
      {/* Dark Welding Helmet with glowing visor */}
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[0.24, 0.26, 0.24]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 1.55, 0.125]}>
        <planeGeometry args={[0.12, 0.08]} />
        <meshBasicMaterial color={SCENE_COLORS.solarGold} />
      </mesh>

      {/* Welding Torch extending toward interstage */}
      <group position={[0.2, 1.05, 0.35]} rotation={[0.2, 0.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.8} />
        </mesh>
        {/* Arc Flash & Sparks */}
        <mesh position={[0, 0.24, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial ref={sparkMesh} color="#E0F2FE" />
        </mesh>
        <group position={[0, 0.26, 0.02]}>
          <WeldSparks count={40} floorY={-12.1} intensity={0.4} />
        </group>
      </group>
    </group>
  );
}

/** Level 3: Cleanroom Technician in white bunny suit inspecting the crew capsule */
export function Level3Technician() {
  const root = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (root.current) {
      root.current.position.y = 21.25 + Math.sin(clock.elapsedTime * 1.5) * 0.01;
    }
  });

  return (
    <group ref={root} position={[4.6, 21.25, 3.2]} rotation={[0, -0.9, 0]}>
      {/* Pristine White Cleanroom "Bunny Suit" */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.34, 0.75, 0.22]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <boxGeometry args={[0.42, 0.6, 0.26]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
      </mesh>
      {/* Cleanroom Hood & Goggles */}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.14, 14, 14]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.56, 0.12]}>
        <boxGeometry args={[0.18, 0.06, 0.04]} />
        <meshStandardMaterial color="#0284C7" metalness={0.7} />
      </mesh>
      {/* Blue Nitrile Gloves */}
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, 0.95, 0.15]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#0284C7" />
        </mesh>
      ))}
      {/* Telemetry data pad */}
      <mesh position={[0, 1.05, 0.25]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.22, 0.32, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 1.05, 0.262]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[0.18, 0.26]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGreen} />
      </mesh>
    </group>
  );
}
