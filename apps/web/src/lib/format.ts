/** Shared display formatting for mission readouts. */

/** "T+08:21" / "T−00:10". */
export function formatMissionTime(sec: number): string {
  const sign = sec < 0 ? "−" : "+";
  const s = Math.floor(Math.abs(sec));
  return `T${sign}${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
