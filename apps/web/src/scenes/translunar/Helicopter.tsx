"use client";

import { useMemo } from "react";
import { CapsuleGeometry, DoubleSide, type Group } from "three";

/**
 * A Sea King, the helicopter that recovered Apollo 11 (the Navy's SH-3D): a boat hull with sponsons and
 * wheels, a glazed nose, two engines on top, a five-blade main rotor, and a tail boom that rises to a
 * pylon with a stabilizer and a small tail rotor. About 7.5 units from nose to pylon (1 unit is a bit
 * over two metres). The nose points to +Z; `rotor` turns the main rotor and `tail` the tail rotor.
 */
export function Helicopter({ rotor, tail }: { rotor: React.RefObject<Group | null>; tail: React.RefObject<Group | null> }) {
  const hull = useMemo(() => new CapsuleGeometry(0.95, 3.2, 8, 20), []);
  const boom = useMemo(() => new CapsuleGeometry(0.3, 3.6, 6, 12), []);
  return (
    <group>
      {/* Hull: grey above, white below, like the Navy's Sea Kings of the time */}
      <mesh geometry={hull} position={[0, 0.1, 0.4]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.05]}>
        <meshStandardMaterial color="#aeb6bd" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, -0.62, 0.4]}>
        <boxGeometry args={[1.5, 0.42, 4.1]} />
        <meshStandardMaterial color="#eceff1" roughness={0.5} />
      </mesh>
      {/* The glazed nose and the cabin windows */}
      <mesh position={[0, 0.42, 2.45]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[1.45, 0.6, 0.08]} />
        <meshStandardMaterial color="#16212b" roughness={0.08} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.34, 2.15]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[1.8, 0.44, 0.9]} />
        <meshStandardMaterial color="#16212b" roughness={0.1} metalness={0.6} />
      </mesh>
      {[-1, 1].map((side) =>
        [0.9, 0.2, -0.5].map((z) => (
          <mesh key={`${side}${z}`} position={[side * 0.955, 0.35, z]}>
            <boxGeometry args={[0.05, 0.42, 0.5]} />
            <meshStandardMaterial color="#16212b" roughness={0.1} metalness={0.6} />
          </mesh>
        )),
      )}
      {/* The rescue hoist at the starboard door */}
      <mesh position={[1.15, 0.85, 0.7]}>
        <boxGeometry args={[0.28, 0.12, 0.9]} />
        <meshStandardMaterial color="#d8742a" roughness={0.6} />
      </mesh>
      {/* Two engines on the roof, the gearbox and the mast */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 1.1, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 1.9, 16]} />
          <meshStandardMaterial color="#8d959c" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.35, 0.1]}>
        <cylinderGeometry args={[0.45, 0.6, 0.45, 16]} />
        <meshStandardMaterial color="#9aa2a9" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* The main rotor: a hub, five blades, and a faint disc for the blur of their turning */}
      <group ref={rotor} position={[0, 1.7, 0.1]}>
        <mesh>
          <cylinderGeometry args={[0.28, 0.28, 0.3, 14]} />
          <meshStandardMaterial color="#2a2e33" roughness={0.5} metalness={0.4} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
            <mesh position={[2.2, 0, 0]}>
              <boxGeometry args={[3.9, 0.035, 0.34]} />
              <meshStandardMaterial color="#1b1e22" roughness={0.6} />
            </mesh>
            <mesh position={[4.1, 0, 0]}>
              <boxGeometry args={[0.18, 0.04, 0.34]} />
              <meshStandardMaterial color="#e8c44a" roughness={0.6} />
            </mesh>
          </group>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <circleGeometry args={[4.2, 40]} />
          <meshBasicMaterial color="#cfd6dc" transparent opacity={0.07} depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
      {/* The tail: a boom that rises to a pylon, a stabilizer and the tail rotor */}
      <mesh geometry={boom} position={[0, 0.55, -3.1]} rotation={[Math.PI / 2 + 0.1, 0, 0]} scale={[1, 1, 0.8]}>
        <meshStandardMaterial color="#aeb6bd" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, 1.35, -5.15]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.24, 1.7, 0.95]} />
        <meshStandardMaterial color="#aeb6bd" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.75, -4.7]}>
        <boxGeometry args={[1.7, 0.07, 0.5]} />
        <meshStandardMaterial color="#9aa2a9" roughness={0.5} />
      </mesh>
      <group ref={tail} position={[0.2, 1.85, -5.4]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[(i * Math.PI) / 2, 0, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[0.04, 1.0, 0.13]} />
            <meshStandardMaterial color="#1b1e22" roughness={0.6} />
          </mesh>
        ))}
      </group>
      {/* Sponsons, with their wheels and a tail wheel */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 1.05, -0.62, 0.3]}>
            <boxGeometry args={[0.55, 0.55, 2.2]} />
            <meshStandardMaterial color="#eceff1" roughness={0.5} />
          </mesh>
          <mesh position={[side * 1.05, -1.0, 0.75]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.24, 0.24, 0.18, 14]} />
            <meshStandardMaterial color="#1b1e22" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.7, -3.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.12, 12]} />
        <meshStandardMaterial color="#1b1e22" roughness={0.8} />
      </mesh>
      {/* Navigation lights */}
      <mesh position={[-1.0, -0.15, 1.2]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshBasicMaterial color="#ff3b30" toneMapped={false} />
      </mesh>
      <mesh position={[1.0, -0.15, 1.2]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshBasicMaterial color="#34d27b" toneMapped={false} />
      </mesh>
    </group>
  );
}
