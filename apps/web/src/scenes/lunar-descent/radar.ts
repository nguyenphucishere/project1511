import type { LandingRadarInput } from "@/lib/simulation/nasa.types";
import { sampleAt } from "@/mocks/descent";

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
 * Landing-radar input at mission time `t` (seconds since PDI), from the engine's descent
 * profile. Early in the braking phase the LM flies nearly feet-first (pitched back past the
 * radar's 65° beam limit), so the radar only gets "data good" after the pitch-over.
 */
export function radarInputAt(t: number): LandingRadarInput {
  const s = sampleAt(t);
  const forward = Math.max(0, s.hsMs);
  const pitch = s.pitchDeg;
  return {
    inertial_alt_m: s.altM,
    vertical_vel_mps: s.vsMs,
    horizontal_vel_mps: forward,
    terrain_elevation_offset_m: terrainOffsetAt(s.altM),
    pitch_angle_deg: pitch,
  };
}
