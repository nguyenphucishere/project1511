import { useEffect } from "react";
import { create } from "zustand";
import type { Camera } from "three";
import type { LocalizedText } from "@/i18n";

export type Vec3 = [number, number, number];

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
}

/**
 * A scripted camera move that temporarily replaces first-person look (e.g. the launch view).
 * Called every frame with the camera and a clamped delta; it sets position and orientation.
 * Screen shake is still added on top. When it is cleared, the player's view eases back.
 */
export type CameraRig = (camera: Camera, dt: number) => void;

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
  cameraRig: CameraRig | null;

  setViewpoints: (list: Viewpoint[], startId: string) => void;
  goTo: (viewpointId: string) => void;
  register: (info: HotspotInfo) => void;
  unregister: (id: string) => void;
  highlight: (id: string | null, opts?: { lookAt?: boolean }) => void;
  setCameraRig: (rig: CameraRig | null) => void;
  reset: () => void;
}

/** Per-scene, non-persisted state shared by the 3D canvas and the DOM HUD. */
export const useSceneStore = create<SceneState>((set) => ({
  viewpoints: {},
  viewpointId: null,
  hotspots: {},
  highlightedId: null,
  lookAtRequest: 0,
  cameraRig: null,

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
  setCameraRig: (cameraRig) => set({ cameraRig }),
  reset: () =>
    set({ viewpoints: {}, viewpointId: null, hotspots: {}, highlightedId: null, lookAtRequest: 0, cameraRig: null }),
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
