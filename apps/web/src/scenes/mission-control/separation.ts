import type { SfxId } from "@/game/sfx";

/**
 * Everything that happens in the twenty operations of a stage separation, in order from the
 * inside of the stage outward: the gear train in the sequencer, the ring structure, the outer
 * hardware, then the cut itself. Times are seconds relative to the cut (T = 0). Pure data, so the
 * rig that animates them, the sounds and the camera cuts all agree.
 */

export type SepZone = "gears" | "ring" | "outer" | "cut";

export interface SepOp {
  id: string;
  /** Seconds relative to the cut. */
  t: number;
  zone: SepZone;
  /** What the hardware does, for the film's own captions. */
  label: string;
  /** Sound played at that moment (some operations get theirs from the effect itself). */
  sfx?: [SfxId, number?];
}

export const SEP_OPS: SepOp[] = [
  { id: "sequencer-arm", t: -7.0, zone: "gears", label: "Sequencer arms, status lamps amber", sfx: ["relay"] },
  { id: "pump-spin", t: -6.6, zone: "gears", label: "Hydraulic pump spins up", sfx: ["hydraulic"] },
  { id: "pinion-mesh", t: -6.2, zone: "gears", label: "Pinion meshes the reduction gears", sfx: ["ratchet"] },
  { id: "cam-drum", t: -5.8, zone: "gears", label: "Cam drum turns, followers rise", sfx: ["ratchet"] },
  { id: "pawl-lift", t: -5.4, zone: "gears", label: "Safety pawl lifts off the ratchet", sfx: ["clank"] },
  { id: "lockwire", t: -5.0, zone: "gears", label: "Guillotine cuts the lockwire", sfx: ["clank", 0.08] },
  { id: "arm-lamps", t: -4.6, zone: "ring", label: "Arming lamps run round the ring", sfx: ["relay"] },
  { id: "frangible-bolts", t: -4.2, zone: "ring", label: "Frangible bolts fire in turn", sfx: ["pyro", 0.2] },
  { id: "umbilicals", t: -3.8, zone: "ring", label: "Electrical umbilicals unmate", sfx: ["clank"] },
  { id: "quick-disconnect", t: -3.4, zone: "ring", label: "Propellant quick-disconnects decouple", sfx: ["gas"] },
  { id: "hooks", t: -3.0, zone: "outer", label: "Retention hooks swing open", sfx: ["clank", 0.1] },
  { id: "shear-pins", t: -2.6, zone: "outer", label: "Shear pins snap", sfx: ["pyro", 0.12] },
  { id: "guide-pins", t: -2.2, zone: "outer", label: "Guide pins draw back", sfx: ["ratchet"] },
  { id: "pushers", t: -1.8, zone: "outer", label: "Spring pushers extend", sfx: ["hydraulic"] },
  { id: "inboard-cutoff", t: -1.4, zone: "outer", label: "Centre engine cut off", sfx: ["sputter"] },
  { id: "outboard-cutoff", t: -0.6, zone: "outer", label: "Outboard engines cut off", sfx: ["sputter", 0.2] },
  { id: "ullage", t: -0.1, zone: "cut", label: "Ullage motors ignite" },
  { id: "shaped-charge", t: 0, zone: "cut", label: "Shaped charge cuts the skin" },
  { id: "retros", t: 0.1, zone: "cut", label: "Retrorockets push the stage back" },
  { id: "skin-panels", t: 0.5, zone: "cut", label: "Skin panels peel away" },
];

/** When the first and last operations happen, relative to the cut. */
export const SEP_FIRST = SEP_OPS[0]!.t;
export const SEP_LAST = SEP_OPS[SEP_OPS.length - 1]!.t;
/** Seconds before the cut the whole sequence begins. */
export const SEP_LEAD = -SEP_FIRST;

/** Time of an operation by id, relative to the cut. */
export function opTime(id: string): number {
  const op = SEP_OPS.find((o) => o.id === id);
  if (!op) throw new Error(`unknown separation operation ${id}`);
  return op.t;
}

/**
 * Where the hardware stands round the ring, as angles (radians, 0 = +z, turning toward +x).
 * The gear drives are inside the wall at four stations; everything else is on the outside.
 */
export const GEAR_STATIONS = [0.5, 0.5 + Math.PI / 2, 0.5 + Math.PI, 0.5 + (3 * Math.PI) / 2];
export const STATION = {
  hook: [0.5 + 0.55, 0.5 + 0.55 + Math.PI / 2, 0.5 + 0.55 + Math.PI, 0.5 + 0.55 + (3 * Math.PI) / 2],
  pusher: [0.5 + 1.05, 0.5 + 1.05 + Math.PI / 2, 0.5 + 1.05 + Math.PI, 0.5 + 1.05 + (3 * Math.PI) / 2],
  umbilical: [0.5 + 0.28, 0.5 + 0.28 + Math.PI],
  valve: [0.5 + 1.35, 0.5 + 1.35 + Math.PI],
  guidePin: [0.5 + 0.8, 0.5 + 0.8 + Math.PI / 2, 0.5 + 0.8 + Math.PI, 0.5 + 0.8 + (3 * Math.PI) / 2],
} as const;

/** Angle of the i-th of `n` evenly spaced stations, starting at `a0`. */
export const around = (i: number, n: number, a0 = 0) => a0 + (i / n) * Math.PI * 2;

/** Gears of the sequencer drive, each defined once so the rig and the camera share the layout. */
export interface GearSpec {
  /** Centre in the cluster's plane (metres): x along the wall, y up. */
  x: number;
  y: number;
  radius: number;
  teeth: number;
  /** Depth in front of the back plate. */
  z: number;
}

/** Drive pinion, compound pair, big gear and its output gear, meshing in a chain. */
export const GEARS: GearSpec[] = [
  { x: -0.22, y: -0.1, radius: 0.035, teeth: 9, z: 0.09 },
  { x: -0.12, y: -0.01, radius: 0.1, teeth: 24, z: 0.07 },
  { x: -0.12, y: -0.01, radius: 0.05, teeth: 12, z: 0.13 },
  { x: 0.04, y: 0.09, radius: 0.14, teeth: 32, z: 0.13 },
  { x: 0.23, y: 0.0, radius: 0.07, teeth: 16, z: 0.13 },
];

/** Angle of gear i for a drive angle `theta` of the first gear (meshed gears turn opposite ways). */
export function gearAngle(i: number, theta: number): number {
  let a = theta;
  let sign = 1;
  for (let k = 1; k <= i; k++) {
    const prev = GEARS[k - 1]!;
    const g = GEARS[k]!;
    // Coaxial gears (same centre) turn together; meshed ones reverse and scale by the tooth ratio.
    if (prev.x === g.x && prev.y === g.y) continue;
    a *= prev.teeth / g.teeth;
    sign *= -1;
  }
  return a * sign;
}

/**
 * The drive angle of the first gear at `t` seconds (relative to the cut): the motor spins up over
 * 0.7 s from the pump operation and runs until just before the cut.
 */
export function driveAngle(t: number): number {
  // The train never stands still while it is in view: it idles at 2 rad/s from the start, the pump
  // spins it up to 22 rad/s over 0.9 s, and it runs flat out until just after the cut.
  const t0 = opTime("pump-spin");
  const clamped = Math.min(Math.max(t, -9.5), 0.4);
  const idle = 2 * (Math.min(clamped, t0) + 9.5);
  const y = Math.max(0, clamped - t0);
  const ramp = 0.9;
  const spun = y < ramp ? 2 * y + (20 * y * y) / (2 * ramp) : 2 * ramp + 10 * ramp + 22 * (y - ramp);
  return idle + spun;
}
