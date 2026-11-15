import type { LocalizedText } from "@/i18n";
import type { VideoId } from "@/lib/assets";
import type { BriefingId } from "./script";
import type { CharacterId } from "./characters";
import type { DecisionId } from "./decisions";
import type { EndingId } from "./endings";

export type ChapterId = "medical" | "workshop" | "mission-control" | "ascent" | "translunar" | "lunar-descent" | "return";
export type SceneId = ChapterId;

/** How the screen changes when this step starts. */
export type Transition = "fade" | "black-hold" | "none";

export type Step =
  | { id: string; kind: "cutscene"; video: VideoId; chapter: ChapterId; enter: Transition }
  | { id: string; kind: "briefing"; briefing: BriefingId; chapter: ChapterId | "epilogue"; enter: Transition }
  | { id: string; kind: "decision"; decision: DecisionId; chapter: ChapterId; enter: Transition }
  | { id: string; kind: "scene"; scene: SceneId; chapter: ChapterId; enter: Transition }
  | { id: string; kind: "end"; endingId?: EndingId; enter: Transition };

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
 * Apollo 11 Mission Flow. Five calls shape the ending: the LOX check and the trajectory are steps of their own;
 * the weather call is made at the launch console, the 1202 alarm and the landing site inside the landing scene.
 */
export const FLOW: Step[] = [
  { id: "intro-video", kind: "cutscene", video: "intro", chapter: "medical", enter: "none" },
  { id: "medical-briefing", kind: "briefing", briefing: "medical", chapter: "medical", enter: "black-hold" },
  { id: "medical-scene", kind: "scene", scene: "medical", chapter: "medical", enter: "fade" },
  { id: "workshop-briefing", kind: "briefing", briefing: "workshop", chapter: "workshop", enter: "fade" },
  { id: "workshop-scene", kind: "scene", scene: "workshop", chapter: "workshop", enter: "fade" },
  { id: "workshop-decision", kind: "decision", decision: "workshop-decision", chapter: "workshop", enter: "fade" },
  { id: "mission-control-briefing", kind: "briefing", briefing: "mission-control", chapter: "mission-control", enter: "fade" },
  { id: "mission-control-scene", kind: "scene", scene: "mission-control", chapter: "mission-control", enter: "fade" },
  { id: "launch-video", kind: "cutscene", video: "launch", chapter: "mission-control", enter: "fade" },
  { id: "ascent-briefing", kind: "briefing", briefing: "ascent", chapter: "ascent", enter: "black-hold" },
  { id: "ascent-scene", kind: "scene", scene: "ascent", chapter: "ascent", enter: "fade" },
  { id: "trajectory-decision", kind: "decision", decision: "trajectory-decision", chapter: "ascent", enter: "fade" },
  { id: "translunar-briefing", kind: "briefing", briefing: "translunar", chapter: "translunar", enter: "black-hold" },
  { id: "translunar-scene", kind: "scene", scene: "translunar", chapter: "translunar", enter: "fade" },
  { id: "lunar-descent-briefing", kind: "briefing", briefing: "lunar-descent", chapter: "lunar-descent", enter: "black-hold" },
  { id: "lunar-descent-scene", kind: "scene", scene: "lunar-descent", chapter: "lunar-descent", enter: "fade" },
  { id: "touchdown-film", kind: "scene", scene: "lunar-descent", chapter: "lunar-descent", enter: "fade" },
  { id: "flag-video", kind: "cutscene", video: "flagPlanting", chapter: "lunar-descent", enter: "fade" },
  { id: "epilogue", kind: "briefing", briefing: "epilogue", chapter: "epilogue", enter: "black-hold" },
  { id: "return-briefing", kind: "briefing", briefing: "return", chapter: "return", enter: "fade" },
  { id: "return-scene", kind: "scene", scene: "return", chapter: "return", enter: "fade" },
  { id: "end", kind: "end", enter: "black-hold" },
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

/**
 * Dynamic state machine transition function.
 * Evaluates player narrative decisions to branch the flow toward nominal progression or terminal endings.
 */
export function getNextStepId(currentStepId: string, state?: any): string | null {
  const decisions = state?.narrative?.decisions ?? state?.decisions ?? {};

  switch (currentStepId) {
    case "intro-video":
      return "medical-briefing";
    case "medical-briefing":
      return "medical-scene";
    case "medical-scene":
      return "workshop-briefing";
    case "workshop-briefing":
      return "workshop-scene";
    case "workshop-scene":
      return "workshop-decision";
    case "workshop-decision":
      return "mission-control-briefing";
    case "mission-control-briefing":
      return "mission-control-scene";
    case "mission-control-scene": {
      // The weather call is made at the console (the launch window and the pad weather): a vehicle
      // lost to the weather there ends the mission (ENDING-5); a launch goes on to the capsule.
      const weather = decisions.weather;
      if (weather === "severe_wind" || weather === "severe-wind") return "end";
      return "launch-video";
    }
    case "launch-video":
      return "ascent-briefing";
    case "ascent-briefing":
      return "ascent-scene";
    case "ascent-scene":
      return "trajectory-decision";
    case "trajectory-decision":
      return "translunar-briefing";
    // The ship reaches lunar orbit and the landing chapter starts at once.
    case "translunar-scene":
      return "lunar-descent-scene";
    case "lunar-descent-briefing":
      return "lunar-descent-scene";
    case "lunar-descent-scene":
      // The 1202 call and the landing call are made inside the scene: abort, a landing in the boulders
      // or a wave-off (ENDING-2, 3, 4) all leave an ending behind; a safe landing goes on to the film.
      return state?.narrative?.ending ? "end" : "touchdown-film";
    case "touchdown-film":
      return "flag-video";
    case "flag-video":
      return "epilogue";
    case "epilogue":
      return "return-briefing"; // then the flight home, and the ending
    case "end":
      return null;
    default: {
      const idx = stepIndex(currentStepId);
      return idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1].id : null;
    }
  }
}
