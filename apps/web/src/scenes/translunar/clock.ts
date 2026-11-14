/**
 * The film clock, shared by the camera and every moving object. `FilmClock` (in the world) writes
 * it once per frame, before everything else runs, so all of them agree on the same instant.
 */
export const filmClock = { t: 0 };
