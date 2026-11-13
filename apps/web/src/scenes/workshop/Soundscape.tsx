"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { startHallAmbience, type HallAmbience } from "@/game/hallAudio";
import { CRANE } from "./crane";
import type { CraneRigState } from "./CraneRig";
import { forkliftAudio } from "./Living";

type Source = readonly [number, number, number];

/** Welding stations: the welder kneeling by the pad, and the technician on gantry level 2. */
const WELDS: Source[] = [
  [2.55, 0.4, 1.95],
  [-5.3, 12.6, 2.2],
];
/** Where people stand and talk. */
const TALKERS: Source[] = [
  [4, 1.5, -8],
  [-9.5, 1.5, -2],
  [13.4, 1.5, 4],
  [-4, 1.5, 9.5],
];

const falloff = (d: number, range: number) => Math.pow(Math.max(0, 1 - d / range), 2);

/**
 * Plays the hall's sounds and feeds them what the player is near: distance sets loudness and the
 * direction sets the stereo position. The crane is the exception: its sound is always heard.
 */
export function HallSoundscape({ rig }: { rig: CraneRigState }) {
  const camera = useThree((s) => s.camera);
  const audio = useRef<HallAmbience | null>(null);
  const clock = useRef(0);

  useEffect(() => {
    audio.current = startHallAmbience();
    return () => {
      audio.current?.stop();
      audio.current = null;
    };
  }, []);

  useFrame((_, dt) => {
    clock.current += dt;
    if (clock.current < 0.1 || !audio.current) return;
    clock.current = 0;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const e = camera.matrixWorld.elements;
    const pan = (x: number, z: number) => {
      const dx = x - cx;
      const dz = z - cz;
      const n = Math.hypot(dx, dz) || 1;
      return Math.max(-1, Math.min(1, ((dx * e[0] + dz * e[2]) / n) * 0.9));
    };
    const nearest = (list: readonly Source[], range: number) => {
      let best = 0;
      let bp = 0;
      for (const [x, y, z] of list) {
        const l = falloff(Math.hypot(x - cx, y - cy, z - cz), range);
        if (l > best) {
          best = l;
          bp = pan(x, z);
        }
      }
      return { level: best, pan: bp };
    };

    const weld = nearest(WELDS, 22);
    const talk = nearest(TALKERS, 20);
    const fork = falloff(Math.hypot(forkliftAudio.x - cx, 1 - cy, forkliftAudio.z - cz), 24);
    const s = rig.state;
    const moving = rig.active ? Math.min(1, Math.hypot(s.vx, s.vz) / CRANE.maxSpeed) : 0;
    const hoisting = rig.active ? Math.min(1, Math.abs(s.vy) / CRANE.lowerMax + Math.abs(rig.input.hoist) * 0.4) : 0;

    audio.current.set({
      crane: moving * 0.9,
      hoist: hoisting,
      weld: weld.level,
      weldPan: weld.pan,
      fork,
      forkPan: pan(forkliftAudio.x, forkliftAudio.z),
      beep: forkliftAudio.turning,
      voice: 0.35 + talk.level * 0.65,
      voicePan: talk.pan,
    });
  });
  return null;
}
