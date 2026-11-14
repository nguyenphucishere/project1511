/**
 * Mood of the people watching, shared between the scene logic and the 3D figures.
 * A plain mutable object (like the screen shake): it is read every frame and nothing re-renders.
 *  - dismay: above 0 the controllers stop work, heads in hands (the vehicle was lost).
 *  - hush:   above 0 the room goes still, hands at the mouth, eyes on the window (the launch).
 *  - joy:    above 0 the room erupts, arms in the air (the vehicle reached orbit).
 */
export const mood = { dismay: 0, hush: 0, joy: 0 };
