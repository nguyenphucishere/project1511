"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import { actionFor, isTypingTarget, type Action } from "@/game/input";
import { useSceneStore } from "@/game/sceneStore";
import { clearTrauma, stepShake } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const DRAG_SENSITIVITY = 0.0042; // radians per CSS pixel
const KEY_TURN_RATE = 1.6; // radians per second while a look key is held
const LOOK_SMOOTHING = 14; // higher = snappier
const MOVE_SMOOTHING = 3.2;

/**
 * Seated/standing first-person view: the player looks around from the current viewpoint
 * (drag, or look keys) within that viewpoint's limits, and glides between viewpoints.
 * Smoothing is exponential (1 - e^(-rate·dt)), so it feels the same at any frame rate.
 */
export function FirstPersonCamera() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const reduced = useReducedMotion();

  const viewpoint = useSceneStore((s) => (s.viewpointId ? s.viewpoints[s.viewpointId] : undefined));
  const lookAtRequest = useSceneStore((s) => s.lookAtRequest);

  const target = useRef({ yaw: 0, pitch: 0 });
  const current = useRef({ yaw: 0, pitch: 0 });
  const held = useRef(new Set<Action>());
  const placed = useRef(false);
  const goal = useRef(new Vector3());
  const rigActive = useRef(false);

  // Arriving at a viewpoint: face its resting direction. The very first one is a hard cut.
  useEffect(() => {
    if (!viewpoint) return;
    target.current = { yaw: viewpoint.yaw, pitch: viewpoint.pitch };
    goal.current.set(...viewpoint.position);
    if (!placed.current || reduced) {
      camera.position.copy(goal.current);
      current.current = { ...target.current };
      placed.current = true;
    }
  }, [viewpoint, camera, reduced]);

  // Keyboard focus on a hotspot turns the head toward it.
  useEffect(() => {
    if (!lookAtRequest || !viewpoint) return;
    const { highlightedId, hotspots } = useSceneStore.getState();
    const spot = highlightedId ? hotspots[highlightedId] : undefined;
    if (!spot) return;
    const [x, y, z] = spot.position;
    const [cx, cy, cz] = viewpoint.position;
    const dx = x - cx;
    const dz = z - cz;
    target.current = clampLook(viewpoint, {
      yaw: Math.atan2(-dx, -dz),
      pitch: Math.atan2(y - cy, Math.hypot(dx, dz)),
    });
  }, [lookAtRequest, viewpoint]);

  // Drag to look. Pointer capture keeps the drag going outside the canvas.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const vp = useSceneStore.getState();
      const v = vp.viewpointId ? vp.viewpoints[vp.viewpointId] : undefined;
      if (!v) return;
      target.current = clampLook(v, {
        yaw: target.current.yaw + (e.clientX - lastX) * DRAG_SENSITIVITY,
        pitch: target.current.pitch + (e.clientY - lastY) * DRAG_SENSITIVITY,
      });
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  // Held look actions (level-triggered). Cleared on blur so a key can't get stuck.
  useEffect(() => {
    const keys = held.current;
    const onDown = (e: KeyboardEvent) => {
      const action = actionFor(e.code);
      if (!action || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      keys.add(action);
    };
    const onUp = (e: KeyboardEvent) => {
      const action = actionFor(e.code);
      if (action) keys.delete(action);
    };
    const clear = () => keys.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // Shake left over from one scene must not carry into the next.
  useEffect(() => clearTrauma, []);

  useFrame((state, rawDelta) => {
    if (!viewpoint) return;
    const dt = Math.min(Math.max(rawDelta, 0), 0.1);

    // A scripted move owns the camera; shake still rides on top of it.
    const rig = useSceneStore.getState().cameraRig;
    if (rig) {
      rig(camera, dt);
      const shake = stepShake(dt, state.clock.elapsedTime, reduced);
      camera.rotateY(shake.yaw);
      camera.rotateX(shake.pitch);
      camera.rotateZ(shake.roll);
      rigActive.current = true;
      return;
    }
    if (rigActive.current) {
      // Back from a scripted move: a clean cut to the viewpoint's resting view. Gliding back
      // from outside would fly the camera through the building.
      target.current = { yaw: viewpoint.yaw, pitch: viewpoint.pitch };
      current.current = { ...target.current };
      camera.position.copy(goal.current);
      rigActive.current = false;
    }

    const keys = held.current;
    if (keys.size) {
      const turn = KEY_TURN_RATE * dt;
      target.current = clampLook(viewpoint, {
        yaw: target.current.yaw + (keys.has("lookLeft") ? turn : 0) - (keys.has("lookRight") ? turn : 0),
        pitch: target.current.pitch + (keys.has("lookUp") ? turn : 0) - (keys.has("lookDown") ? turn : 0),
      });
    }

    const look = reduced ? 1 : 1 - Math.exp(-LOOK_SMOOTHING * dt);
    current.current.yaw = MathUtils.lerp(current.current.yaw, target.current.yaw, look);
    current.current.pitch = MathUtils.lerp(current.current.pitch, target.current.pitch, look);
    const shake = stepShake(dt, state.clock.elapsedTime, reduced);
    camera.rotation.set(current.current.pitch + shake.pitch, current.current.yaw + shake.yaw, shake.roll, "YXZ");

    const glide = reduced ? 1 : 1 - Math.exp(-MOVE_SMOOTHING * dt);
    camera.position.lerp(goal.current, glide);
  });

  return null;
}

function clampLook(
  v: { yaw: number; pitch: number; yawRange: number; pitchRange: number },
  look: { yaw: number; pitch: number },
) {
  return {
    yaw: MathUtils.clamp(look.yaw, v.yaw - v.yawRange, v.yaw + v.yawRange),
    // Never past ±80° even if a viewpoint allows more: looking straight up/down disorients.
    pitch: MathUtils.clamp(
      look.pitch,
      Math.max(v.pitch - v.pitchRange, -1.4),
      Math.min(v.pitch + v.pitchRange, 1.4),
    ),
  };
}
