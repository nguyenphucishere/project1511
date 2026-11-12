"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";
import { BINDINGS, MOVE_KEYS, actionFor, isTypingTarget, type Action } from "@/game/input";
import { useSceneStore, type FloorRect, type Viewpoint, type WalkArea } from "@/game/sceneStore";
import { clearTrauma, stepShake } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const DRAG_SENSITIVITY = 0.0042; // radians per CSS pixel
const KEY_TURN_RATE = 1.6; // radians per second while a look key is held
const LOOK_SMOOTHING = 14; // higher = snappier
const MOVE_SMOOTHING = 3.2; // gliding between viewpoints
const WALK_SMOOTHING = 14; // following the walker while WASD is held
const WALK_SPEED = 2.4; // metres per second
const SPRINT = 1.7;
const PLAYER_RADIUS = 0.28;
const WALK_PITCH = 1.2; // looking further up/down is allowed when walking

/**
 * First-person view. Two ways to be somewhere:
 * - Seated/fixed viewpoints: look around within the viewpoint's limits and glide between them.
 * - Viewpoints with a `walk` area: WASD walks freely (arrow keys and drag still look), with
 *   collision against the room bounds and furniture.
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
  const heldCodes = useRef(new Set<string>());
  const placed = useRef(false);
  const goal = useRef(new Vector3());

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
    const [cx, cy, cz] = [goal.current.x, goal.current.y, goal.current.z];
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

  // Held keys (level-triggered, by physical key code). Cleared on blur so a key can't get stuck.
  useEffect(() => {
    const keys = heldCodes.current;
    const handled = (code: string) => !!actionFor(code) || code === MOVE_KEYS.sprint;
    const onDown = (e: KeyboardEvent) => {
      if (!handled(e.code) || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      keys.add(e.code);
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
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
    const keys = heldCodes.current;
    const walk = viewpoint.walk;

    // A look action is held if one of its keys is down. While walking, WASD means move, not look.
    const lookHeld = (a: Action) => BINDINGS[a].some((c) => keys.has(c) && !(walk && c.startsWith("Key")));
    const turn = KEY_TURN_RATE * dt;
    const dYaw = (lookHeld("lookLeft") ? turn : 0) - (lookHeld("lookRight") ? turn : 0);
    const dPitch = (lookHeld("lookUp") ? turn : 0) - (lookHeld("lookDown") ? turn : 0);
    if (dYaw || dPitch) {
      target.current = clampLook(viewpoint, {
        yaw: target.current.yaw + dYaw,
        pitch: target.current.pitch + dPitch,
      });
    }

    const look = reduced ? 1 : 1 - Math.exp(-LOOK_SMOOTHING * dt);
    current.current.yaw = MathUtils.lerp(current.current.yaw, target.current.yaw, look);
    current.current.pitch = MathUtils.lerp(current.current.pitch, target.current.pitch, look);
    const shake = stepShake(dt, state.clock.elapsedTime, reduced);
    camera.rotation.set(current.current.pitch + shake.pitch, current.current.yaw + shake.yaw, shake.roll, "YXZ");

    let walking = false;
    if (walk) {
      const fwd = (keys.has(MOVE_KEYS.forward) ? 1 : 0) - (keys.has(MOVE_KEYS.back) ? 1 : 0);
      const side = (keys.has(MOVE_KEYS.right) ? 1 : 0) - (keys.has(MOVE_KEYS.left) ? 1 : 0);
      if (fwd || side) {
        walking = true;
        const yaw = current.current.yaw;
        // yaw 0 looks down -Z and positive yaw turns left: forward = (-sin, -cos), right = (cos, -sin).
        let mx = -Math.sin(yaw) * fwd + Math.cos(yaw) * side;
        let mz = -Math.cos(yaw) * fwd - Math.sin(yaw) * side;
        const len = Math.hypot(mx, mz) || 1;
        const step = (walk.speed ?? WALK_SPEED) * (keys.has(MOVE_KEYS.sprint) ? SPRINT : 1) * dt;
        mx = (mx / len) * step;
        mz = (mz / len) * step;
        const g = goal.current;
        // Axis-separated so the player slides along walls and furniture instead of sticking.
        if (!blocked(walk, g.x + mx, g.z)) g.x += mx;
        if (!blocked(walk, g.x, g.z + mz)) g.z += mz;
      }
      goal.current.y = walk.eyeHeight ? walk.eyeHeight(goal.current.x, goal.current.z) : viewpoint.position[1];
    }

    const rate = walking ? WALK_SMOOTHING : walk ? WALK_SMOOTHING * 0.5 : MOVE_SMOOTHING;
    const glide = reduced ? 1 : 1 - Math.exp(-rate * dt);
    camera.position.lerp(goal.current, glide);
  });

  return null;
}

function inside(r: FloorRect, x: number, z: number, pad: number) {
  return x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad;
}

/** True when standing at (x, z) would put the player outside the floor or inside furniture. */
function blocked(walk: WalkArea, x: number, z: number) {
  const b = walk.bounds;
  if (x < b.minX + PLAYER_RADIUS || x > b.maxX - PLAYER_RADIUS || z < b.minZ + PLAYER_RADIUS || z > b.maxZ - PLAYER_RADIUS)
    return true;
  return !!walk.blockers?.some((r) => inside(r, x, z, PLAYER_RADIUS));
}

function clampLook(v: Viewpoint, look: { yaw: number; pitch: number }) {
  // Walking viewpoints turn freely; seated ones stay within their range.
  const yaw = v.walk ? look.yaw : MathUtils.clamp(look.yaw, v.yaw - v.yawRange, v.yaw + v.yawRange);
  // Never past ±80° even if a viewpoint allows more: looking straight up/down disorients.
  const pitch = v.walk
    ? MathUtils.clamp(look.pitch, -WALK_PITCH, WALK_PITCH)
    : MathUtils.clamp(look.pitch, Math.max(v.pitch - v.pitchRange, -1.4), Math.min(v.pitch + v.pitchRange, 1.4));
  return { yaw, pitch };
}
