import type { LocalizedText } from "@/i18n";
import type { VideoId } from "@/lib/assets";
import type { BriefingId } from "./script";
import type { CharacterId } from "./characters";

export type ChapterId = "medical" | "workshop" | "mission-control" | "ascent" | "translunar" | "lunar-descent" | "return";
export type SceneId = ChapterId;

/** How the screen changes when this step starts. */
export type Transition = "fade" | "black-hold" | "none";

export type Step =
  | { id: string; kind: "cutscene"; video: VideoId; chapter: ChapterId; enter: Transition }
  | { id: string; kind: "briefing"; briefing: BriefingId; chapter: ChapterId | "epilogue"; enter: Transition }
  | { id: string; kind: "scene"; scene: SceneId; chapter: ChapterId; enter: Transition }
  | { id: string; kind: "end"; enter: Transition };

export interface Chapter {
  id: ChapterId;
  title: LocalizedText;
  pov: CharacterId;
}

export const CHAPTERS: Chapter[] = [
  { id: "medical", title: { en: "Medical check", vi: "Khám sức khoẻ" }, pov: "astronaut" },
  { id: "workshop", title: { en: "Assembly hall", vi: "Xưởng lắp ráp" }, pov: "engineer" },
  { id: "mission-control", title: { en: "Mission Control", vi: "Trung tâm điều khiển" }, pov: "flight-director" },
  { id: "ascent", title: { en: "Ascent to orbit", vi: "Bay lên quỹ đạo" }, pov: "astronaut" },
  { id: "translunar", title: { en: "The road to the Moon", vi: "Đường tới Mặt Trăng" }, pov: "astronaut" },
  { id: "lunar-descent", title: { en: "Lunar descent", vi: "Hạ cánh Mặt Trăng" }, pov: "astronaut" },
  { id: "return", title: { en: "Homeward", vi: "Trở về Trái Đất" }, pov: "astronaut" },
];

/**
 * The whole game in order. The start screen's door animation runs before the first step.
 * "black-hold" is the story's "screen goes dark" beat after a video.
 */
export const FLOW: Step[] = [
  { id: "intro-video", kind: "cutscene", video: "intro", chapter: "medical", enter: "none" },
  { id: "medical-briefing", kind: "briefing", briefing: "medical", chapter: "medical", enter: "black-hold" },
  { id: "medical-scene", kind: "scene", scene: "medical", chapter: "medical", enter: "fade" },
  { id: "workshop-briefing", kind: "briefing", briefing: "workshop", chapter: "workshop", enter: "fade" },
  { id: "workshop-scene", kind: "scene", scene: "workshop", chapter: "workshop", enter: "fade" },
  { id: "mission-control-briefing", kind: "briefing", briefing: "mission-control", chapter: "mission-control", enter: "fade" },
  { id: "mission-control-scene", kind: "scene", scene: "mission-control", chapter: "mission-control", enter: "fade" },
  { id: "launch-video", kind: "cutscene", video: "launch", chapter: "mission-control", enter: "fade" },
  { id: "ascent-briefing", kind: "briefing", briefing: "ascent", chapter: "ascent", enter: "black-hold" },
  { id: "ascent-scene", kind: "scene", scene: "ascent", chapter: "ascent", enter: "fade" },
  { id: "translunar-briefing", kind: "briefing", briefing: "translunar", chapter: "translunar", enter: "black-hold" },
  { id: "translunar-scene", kind: "scene", scene: "translunar", chapter: "translunar", enter: "fade" },
  { id: "lunar-descent-briefing", kind: "briefing", briefing: "lunar-descent", chapter: "lunar-descent", enter: "black-hold" },
  { id: "lunar-descent-scene", kind: "scene", scene: "lunar-descent", chapter: "lunar-descent", enter: "fade" },
  { id: "flag-video", kind: "cutscene", video: "flagPlanting", chapter: "lunar-descent", enter: "fade" },
  { id: "epilogue", kind: "briefing", briefing: "epilogue", chapter: "epilogue", enter: "black-hold" },
  { id: "return-briefing", kind: "briefing", briefing: "return", chapter: "return", enter: "fade" },
  { id: "return-scene", kind: "scene", scene: "return", chapter: "return", enter: "fade" },
  { id: "end", kind: "end", enter: "fade" },
];

export const FIRST_STEP_ID = FLOW[0].id;

export function stepIndex(id: string): number {
  return FLOW.findIndex((s) => s.id === id);
}

export function getStep(id: string): Step | undefined {
  return FLOW.find((s) => s.id === id);
}

/** First step of a chapter (its briefing), used by chapter select. */
export function chapterStartId(chapter: ChapterId): string {
  const step = FLOW.find((s) => s.kind === "briefing" && s.chapter === chapter);
  if (!step) throw new Error(`No briefing for chapter ${chapter}`);
  return step.id;
}

export function chapterNumber(chapter: ChapterId): number {
  return CHAPTERS.findIndex((c) => c.id === chapter) + 1;
}
