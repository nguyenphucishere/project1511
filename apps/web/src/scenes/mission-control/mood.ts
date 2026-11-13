/**
 * Mood of the control room's staff, shared between the scene logic and the 3D people.
 * A plain mutable object (like the screen shake): it is read every frame and nothing re-renders.
 * 0 = business as usual; above 0 the controllers stop work, heads in hands.
 */
export const mood = { dismay: 0 };
