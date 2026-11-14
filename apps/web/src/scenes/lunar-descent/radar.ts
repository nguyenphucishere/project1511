import type { LandingRadarInput } from "@/lib/simulation/nasa.types";
import { sampleAt, TOUCHDOWN } from "@/mocks/descent";

/** Forward velocity at powered descent initiation (historical ≈ 1,695 m/s). */
const PDI_FORWARD_MPS = 1_695;

/**
 * Terrain under the ground track, relative to the AGC's reference sphere (+ = higher). Mare
 * Tranquillitatis is gently rolling; on the final approach Eagle crosses West Crater's rim and
 * the boulder field, so the delta swings faster and further there.
 */
export function terrainOffsetAt(altM: number): number {
  if (altM > 3000) return 18 * Math.sin(altM / 1400);
  if (altM > 150) return 12 * Math.sin(altM / 260) + 6;
  return -9 * Math.sin(altM / 25); // crater rim / boulders right before touchdown
}

/**
 * Landing-radar input at mission time `t` (seconds since PDI), built from the scripted descent
 * profile. Early in the braking phase the LM flies nearly feet-first (pitched back past the
 * radar's 65° beam limit), so the radar only gets "data good" after the pitch-over.
 */
export function radarInputAt(t: number): LandingRadarInput {
  const s = sampleAt(t);
  const progress = Math.min(1, Math.max(0, t / TOUCHDOWN.t));
  const forward = Math.max(0, PDI_FORWARD_MPS * (1 - progress) ** 1.6);
  const pitch = s.altM > 12_000 ? 72 : s.altM > 2_300 ? 55 : 12;
  return {
    inertial_alt_m: s.altM,
    vertical_vel_mps: s.vsMs,
    horizontal_vel_mps: forward,
    terrain_elevation_offset_m: terrainOffsetAt(s.altM),
    pitch_angle_deg: pitch,
  };
}
