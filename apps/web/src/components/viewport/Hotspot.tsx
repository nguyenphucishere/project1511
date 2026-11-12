"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { format, type LocalizedText } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useSceneStore, type HotspotKind, type Vec3 } from "@/game/sceneStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PALETTE } from "@/lib/palette";
import { cn } from "@/lib/utils";

interface HotspotProps {
  id: string;
  kind?: HotspotKind;
  label: LocalizedText;
  position: Vec3;
  /** Height of the floating marker above the hotspot origin. */
  markerHeight?: number;
  /**
   * Full marker offset from the origin, for objects whose top is not a good spot (e.g. a rocket
   * stage, where straight above the origin is inside the hull). Overrides markerHeight.
   */
  markerOffset?: Vec3;
  /** Marker size multiplier, for hotspots seen from arm's length (e.g. console switches). */
  markerScale?: number;
  done?: boolean;
  onActivate: () => void;
  children?: React.ReactNode;
}

/** Pointer travel (px) above which a press counts as a look-drag, not a click. */
const CLICK_SLOP = 6;

/**
 * Something the player can click in 3D. It also registers itself with the scene store so the
 * DOM HotspotList can offer the same action to keyboard and screen-reader users.
 */
export function Hotspot({
  id,
  kind = "inspect",
  label,
  position,
  markerHeight = 0.6,
  markerOffset,
  markerScale = 1,
  done = false,
  onActivate,
  children,
}: HotspotProps) {
  const t = useT();
  const localize = useLocalized();
  const reduced = useReducedMotion();
  const register = useSceneStore((s) => s.register);
  const unregister = useSceneStore((s) => s.unregister);
  const highlight = useSceneStore((s) => s.highlight);
  const highlighted = useSceneStore((s) => s.highlightedId === id);
  const marker = useRef<Group>(null);
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;
  const [x, y, z] = position;
  const [ox, oy, oz] = markerOffset ?? [0, markerHeight, 0];
  const hasOffset = markerOffset !== undefined;

  useEffect(() => {
    // Without an explicit offset, aim at the object's middle rather than the marker.
    const look: Vec3 = hasOffset ? [x + ox, y + oy, z + oz] : [x, y + oy * 0.5, z];
    register({ id, kind, label, position: look, done, activate: () => activateRef.current() });
  }, [id, kind, label, x, y, z, ox, oy, oz, hasOffset, done, register]);

  useEffect(() => () => unregister(id), [id, unregister]);

  useFrame((state) => {
    if (!marker.current) return;
    const t = state.clock.elapsedTime;
    marker.current.rotation.y = reduced ? 0.785 : t * 1.2;
    marker.current.position.y = oy + (reduced ? 0 : Math.sin(t * 2 + x) * 0.04);
    const s = highlighted ? 1.5 : done ? 0.7 : 1;
    marker.current.scale.setScalar(s * markerScale);
  });

  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    document.body.style.cursor = hovering ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovering]);

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovering(true);
    highlight(id);
  };
  const out = () => {
    setHovering(false);
    if (useSceneStore.getState().highlightedId === id) highlight(null);
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > CLICK_SLOP) return;
    activateRef.current();
  };

  const markerColor = done ? PALETTE.mist : kind === "move" ? PALETTE.mist : PALETTE.gold;

  return (
    <group position={position} onPointerOver={over} onPointerOut={out} onClick={click}>
      {children}
      <group ref={marker} position={[ox, oy, oz]}>
        {kind === "move" ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -oy + 0.02, 0]}>
            <ringGeometry args={[0.28, 0.4, 4]} />
            <meshBasicMaterial color={markerColor} />
          </mesh>
        ) : (
          <mesh>
            <octahedronGeometry args={[0.09, 0]} />
            <meshBasicMaterial color={markerColor} />
          </mesh>
        )}
      </group>
      {highlighted && (
        <Html position={[ox, oy + 0.25, oz]} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
          <span
            className={cn(
              "bezel bezel-sm whitespace-nowrap bg-space-deep px-3 py-1 text-sm font-medium text-foreground",
              !done && "bezel-gold",
            )}
          >
            {kind === "move" ? format(t.hud.goTo, { place: localize(label) }) : localize(label)}
          </span>
        </Html>
      )}
    </group>
  );
}
