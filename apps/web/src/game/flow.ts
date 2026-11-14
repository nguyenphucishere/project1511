import type { LocalizedText } from "@/i18n";
import type { VideoId } from "@/lib/assets";
import type { BriefingId } from "./script";
import type { CharacterId } from "./characters";
import type { DecisionId } from "./decisions";
import type { EndingId } from "./endings";

export type ChapterId = "medical" | "workshop" | "mission-control" | "ascent" | "translunar" | "lunar-descent" | "return";
/** The return chapter plays two scenes: liftoff, then the flight home. */
export type SceneId = ChapterId | "liftoff";

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
 * Apollo 11 Mission Flow including 5 interactive decision nodes.
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
  { id: "weather-decision", kind: "decision", decision: "weather-decision", chapter: "mission-control", enter: "fade" },
  { id: "launch-video", kind: "cutscene", video: "launch", chapter: "mission-control", enter: "fade" },
  { id: "ascent-briefing", kind: "briefing", briefing: "ascent", chapter: "ascent", enter: "black-hold" },
  { id: "ascent-scene", kind: "scene", scene: "ascent", chapter: "ascent", enter: "fade" },
  { id: "trajectory-decision", kind: "decision", decision: "trajectory-decision", chapter: "ascent", enter: "fade" },
  { id: "translunar-briefing", kind: "briefing", briefing: "translunar", chapter: "translunar", enter: "black-hold" },
  { id: "translunar-scene", kind: "scene", scene: "translunar", chapter: "translunar", enter: "fade" },
  { id: "lunar-descent-briefing", kind: "briefing", briefing: "lunar-descent", chapter: "lunar-descent", enter: "black-hold" },
  { id: "agc-alarm-decision", kind: "decision", decision: "agc-alarm-decision", chapter: "lunar-descent", enter: "fade" },
  { id: "lunar-descent-scene", kind: "scene", scene: "lunar-descent", chapter: "lunar-descent", enter: "fade" },
  { id: "landing-decision", kind: "decision", decision: "landing-decision", chapter: "lunar-descent", enter: "fade" },
  { id: "flag-video", kind: "cutscene", video: "flagPlanting", chapter: "lunar-descent", enter: "fade" },
  { id: "epilogue", kind: "briefing", briefing: "epilogue", chapter: "epilogue", enter: "black-hold" },
  { id: "return-briefing", kind: "briefing", briefing: "return", chapter: "return", enter: "fade" },
  { id: "liftoff-scene", kind: "scene", scene: "liftoff", chapter: "return", enter: "fade" },
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
      // Launched outside the weather limits from the console: the vehicle is lost (ENDING-5).
      const weather = decisions.weather;
      if (weather === "severe_wind" || weather === "severe-wind") return "end";
      return "weather-decision";
    }
    case "weather-decision": {
      const weather = decisions.weather;
      if (weather === "severe_wind" || weather === "severe-wind") {
        return "end"; // Triggers ENDING-5
      }
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
    case "lunar-descent-briefing":
      return "agc-alarm-decision";
    case "agc-alarm-decision": {
      const agc = decisions.agc_alarm ?? decisions.agcAlarm;
      if (agc === "abort_stage" || agc === "abort") {
        return "end"; // Triggers ENDING-2
      }
      return "lunar-descent-scene";
    }
    case "lunar-descent-scene":
      return "landing-decision";
    case "landing-decision": {
      const landing = decisions.landing_approach ?? decisions.landing;
      // Earlier shortcuts can leave too little fuel for the P66 landing (see consequences.resolveLanding).
      if (state?.narrative?.ending === "ending-4") {
        return "end"; // Triggers ENDING-4
      }
      if (landing === "p66_redesignation" || landing === "p66-redesignate") {
        return "flag-video"; // Nominal touchdown -> Flag video -> Epilogue -> ENDING-1
      }
      if (landing === "boulder_field" || landing === "west-crater") {
        return "end"; // Triggers ENDING-3
      }
      if (landing === "bingo_abort" || landing === "bingo-abort") {
        return "end"; // Triggers ENDING-4
      }
      return "end";
    }
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
