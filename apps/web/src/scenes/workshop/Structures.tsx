"use client";

import { SCENE_COLORS } from "@/lib/palette";
import { EYE, STACK, VIEWPOINT_BY_LEVEL, towerCentre, type LiftStop } from "./layout";

export function LaunchMount() {
  const s = 3.3;
  return (
    <group>
      <mesh position={[0, STACK.mount.y1 - 0.15, 0]}>
        <boxGeometry args={[6, 0.3, 6]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} />
      </mesh>
      {[-2.5, 2.5].flatMap((x) =>
        [-2.5, 2.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (STACK.mount.y1 - 0.3) / 2, z]}>
            <boxGeometry args={[0.6, STACK.mount.y1 - 0.3, 0.6]} />
            <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.5} />
          </mesh>
        )),
      )}
      {/* Safety yellow keep-out perimeter on floor around the launch mount */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, a]} position={[Math.sin(a) * s, 0.015, Math.cos(a) * s]}>
            <planeGeometry args={[s * 2 + 0.3, 0.32]} />
            <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Lattice service tower with balcony */
export function Tower({ level }: { level: "level2" | "level3" }) {
  const v = VIEWPOINT_BY_LEVEL[level];
  const [tx, tz] = towerCentre(level);
  const deckY = v.position[1] - EYE;
  const height = deckY + 3.2;
  const half = 1.2;
  const braces = Array.from({ length: Math.floor(height / 3) }, (_, i) => (i + 1) * 3);

  return (
    <group>
      <group position={[tx, 0, tz]} rotation={[0, v.yaw, 0]}>
        {[-half, half].flatMap((x) =>
          [-half, half].map((z) => (
            <mesh key={`${x}${z}`} position={[x, height / 2, z]}>
              <boxGeometry args={[0.18, height, 0.18]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.45} metalness={0.3} />
            </mesh>
          )),
        )}
        {braces.flatMap((y) =>
          [0, 1, 2, 3].map((side) => {
            const a = (side * Math.PI) / 2;
            return (
              <mesh key={`${y}-${side}`} position={[Math.sin(a) * half, y, Math.cos(a) * half]} rotation={[0, a, 0]}>
                <boxGeometry args={[half * 2, 0.1, 0.1]} />
                <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.4} />
              </mesh>
            );
          }),
        )}
        <mesh position={[0, height + 0.1, 0]}>
          <boxGeometry args={[half * 2 + 0.3, 0.2, half * 2 + 0.3]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
      </group>

      {/* Balcony, in the viewpoint's own frame: local -Z faces the rocket */}
      <group position={[v.position[0], deckY, v.position[2]]} rotation={[0, v.yaw, 0]}>
        <mesh position={[0, -0.08, -0.4]}>
          <boxGeometry args={[3.2, 0.16, 3.2]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} />
        </mesh>
        {/* Safety railing: industrial vibrant yellow */}
        <mesh position={[0, 0.5, -2]}>
          <boxGeometry args={[3.2, 0.05, 0.05]} />
          <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
        <mesh position={[0, 0.08, -2]}>
          <boxGeometry args={[3.2, 0.16, 0.04]} />
          <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
        {[1.05, 0.5].map((y) => (
          <group key={y}>
            {[-1.6, 1.6].map((x) => (
              <mesh key={x} position={[x, y, -0.4]}>
                <boxGeometry args={[0.05, 0.05, 3.2]} />
                <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
              </mesh>
            ))}
          </group>
        ))}
        {[-1.6, 1.6].map((x) => (
          <mesh key={x} position={[x, 0.53, -2]}>
            <boxGeometry args={[0.05, 1.06, 0.05]} />
            <meshStandardMaterial color={SCENE_COLORS.safetyYellow} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function LiftPanel({ lift }: { lift: LiftStop }) {
  return (
    <group rotation={[0, lift.rotationY, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.12, 1, 0.12]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.46, 0.42, 0.12]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      <mesh position={[0, 1.2, 0.065]}>
        <planeGeometry args={[0.34, 0.3]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGlass} />
      </mesh>
      <mesh position={[0, 1.2, 0.07]} rotation={[0, 0, (lift.direction * Math.PI) / 2]}>
        <circleGeometry args={[0.1, 3]} />
        <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
      </mesh>
    </group>
  );
}
