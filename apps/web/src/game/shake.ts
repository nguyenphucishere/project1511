/**
 * Screen-shake "trauma" (0..1), shared by whatever triggers it and the CameraShake component.
 * A plain mutable object, not React state: it changes every frame and nothing re-renders on it.
 * Shake = trauma², so small bumps barely move the view and big ones punch, then decay to rest.
 */
export const shake = { trauma: 0 };

export function addTrauma(amount: number) {
  shake.trauma = Math.min(1, shake.trauma + amount);
}

export function clearTrauma() {
  shake.trauma = 0;
}
