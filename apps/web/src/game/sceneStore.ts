import { useEffect } from "react";
import { create } from "zustand";
import type { LocalizedText } from "@/i18n";

export type Vec3 = [number, number, number];

/** Axis-aligned box on the floor plane (x, z), in metres. */
export interface FloorRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Where WASD may take the player from a viewpoint. Without `walk`, WASD turns the head like the
 * arrow keys do (seated viewpoints). `bounds` is the walkable floor, `blockers` are furniture the
 * player cannot enter, and `eyeHeight(x, z)` lets the floor rise (steps, platforms).
 */
export interface WalkArea {
  bounds: FloorRect;
  blockers?: FloorRect[];
  eyeHeight?: (x: number, z: number) => number;
  /** Metres per second; defaults to a relaxed walking pace. */
  speed?: number;
}

/** A fixed place the first-person camera can stand. Angles in radians. */
export interface Viewpoint {
  id: string;
  label: LocalizedText;
  position: Vec3;
  /** Resting direction when arriving here. yaw 0 looks down -Z; positive yaw turns left. */
  yaw: number;
  pitch: number;
  /** How far the player may look away from the resting yaw/pitch. */
  yawRange: number;
  pitchRange: number;
  /** When set, WASD walks around inside this area and the yaw limit is lifted. */
  walk?: WalkArea;
}

export type HotspotKind = "inspect" | "move";

export interface HotspotInfo {
  id: string;
  kind: HotspotKind;
  label: LocalizedText;
  /** World position the camera turns toward when the hotspot gets keyboard focus. */
  position: Vec3;
  done: boolean;
  activate: () => void;
}

interface SceneState {
  viewpoints: Record<string, Viewpoint>;
  viewpointId: string | null;
  hotspots: Record<string, HotspotInfo>;
  /** Hovered in 3D or focused in the hotspot list; both highlight the same object. */
  highlightedId: string | null;
  /** Bumped when the camera should turn toward highlightedId (keyboard focus). */
  lookAtRequest: number;

  setViewpoints: (list: Viewpoint[], startId: string) => void;
  goTo: (viewpointId: string) => void;
  register: (info: HotspotInfo) => void;
  unregister: (id: string) => void;
  highlight: (id: string | null, opts?: { lookAt?: boolean }) => void;
  reset: () => void;
}

/** Per-scene, non-persisted state shared by the 3D canvas and the DOM HUD. */
export const useSceneStore = create<SceneState>((set) => ({
  viewpoints: {},
  viewpointId: null,
  hotspots: {},
  highlightedId: null,
  lookAtRequest: 0,

  setViewpoints: (list, startId) =>
    set({ viewpoints: Object.fromEntries(list.map((v) => [v.id, v])), viewpointId: startId }),
  goTo: (viewpointId) => set({ viewpointId, highlightedId: null }),
  register: (info) => set((s) => ({ hotspots: { ...s.hotspots, [info.id]: info } })),
  unregister: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.hotspots;
      return { hotspots: rest, highlightedId: s.highlightedId === id ? null : s.highlightedId };
    }),
  highlight: (id, opts) =>
    set((s) => ({
      highlightedId: id,
      lookAtRequest: opts?.lookAt && id ? s.lookAtRequest + 1 : s.lookAtRequest,
    })),
  reset: () => set({ viewpoints: {}, viewpointId: null, hotspots: {}, highlightedId: null, lookAtRequest: 0 }),
}));

/** Installs a scene's viewpoints on mount and clears the scene state on unmount. */
export function useSceneViewpoints(list: Viewpoint[], startId: string) {
  const setViewpoints = useSceneStore((s) => s.setViewpoints);
  const reset = useSceneStore((s) => s.reset);
  useEffect(() => {
    setViewpoints(list, startId);
    return reset;
  }, [list, startId, setViewpoints, reset]);
}
