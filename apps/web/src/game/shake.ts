/**
 * Screen-shake "trauma" (0..1). Anything can add to it; FirstPersonCamera, the one owner of the
 * camera's rotation, applies it. A plain mutable object, not React state: it changes every frame
 * and nothing re-renders on it. Shake = trauma², so small bumps barely move the view and big ones
 * punch, then decay to rest.
 */
export const shake = { trauma: 0 };

export function addTrauma(amount: number) {
  shake.trauma = Math.min(1, shake.trauma + amount);
}

export function clearTrauma() {
  shake.trauma = 0;
}

const DECAY = 0.9; // trauma lost per second
const MAX_PITCH = 0.018; // radians at full trauma
const MAX_YAW = 0.012;
const MAX_ROLL = 0.01;
const offset = { pitch: 0, yaw: 0, roll: 0 };

/**
 * Decays trauma by `dt` and returns this frame's rotation offset (reused object, no allocation).
 * Summed sines instead of Math.random(): random-per-frame buzzes like static. Zero offset under
 * reduced motion, though trauma still decays.
 */
export function stepShake(dt: number, time: number, reduced: boolean) {
  shake.trauma = Math.max(0, shake.trauma - DECAY * dt);
  const s = reduced ? 0 : shake.trauma * shake.trauma;
  const t = time * 28;
  offset.pitch = MAX_PITCH * s * Math.sin(t * 1.7 + 0.3);
  offset.yaw = MAX_YAW * s * Math.sin(t * 1.3 + 1.1);
  offset.roll = MAX_ROLL * s * Math.sin(t * 0.9 + 2.0);
  return offset;
}
