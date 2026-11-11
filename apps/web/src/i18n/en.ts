/**
 * English UI strings. This file defines the dictionary shape; vi.ts must match it.
 * Story text (briefings, part descriptions) lives with its data as LocalizedText, not here.
 * "{name}" placeholders are filled with format() from ./index.
 */
export const en = {
  meta: {
    title: "Moonbound: Mission Control",
    description: "Prepare, launch, and land a crewed mission on the Moon.",
  },
  common: {
    close: "Close",
    next: "Next",
    skip: "Skip",
    back: "Back",
    demoData: "Demo data",
    language: "Language",
  },
  settings: {
    pixelEffect: "Pixel effect",
    reducedMotion: "Reduce motion",
    on: "On",
    off: "Off",
  },
  home: {
    title: "Moonbound",
    subtitle: "Four crew members, one rocket, and the long way to the Moon.",
    start: "Start mission",
    continue: "Continue",
    resumeAt: "Resume at {chapter}",
    newGame: "New game",
    chapterSelect: "Jump to a chapter",
    chapterSelectHint: "For demos: start any chapter directly.",
    doorLabel: "Hangar door",
  },
  play: {
    exitToTitle: "Title screen",
    chapterOf: "Chapter {n} of {total}",
    youAre: "You are {name}, {role}",
    epilogue: "Epilogue",
    tasks: "Your tasks",
    continueLine: "Continue",
    previousLine: "Previous line",
    skipBriefing: "Skip briefing",
    begin: "Begin",
    finish: "Finish",
    loading: "Loading mission",
  },
  cutscene: {
    videoSlot: "Video slot",
    skip: "Skip video",
    unmute: "Turn sound on",
    mute: "Turn sound off",
    failed: "This video could not play. Skip to continue.",
    videos: {
      intro: "Opening cinematic: the crew walks to the launch complex.",
      launch: "Liftoff: the rocket clears the tower and climbs toward orbit.",
      flagPlanting: "Touchdown: the astronaut plants the US flag on the Moon.",
    },
  },
  scenePlaceholder: {
    title: "This 3D scene is still being built",
    body: "In the finished demo you play this part in first person. For now, mark it done to keep going.",
    complete: "Mark scene complete",
  },
  end: {
    title: "Mission complete",
    body: "The crew is on the Moon. The trip home is a story for another day.",
    playAgain: "Play again",
    backToTitle: "Back to title",
  },
  hud: {
    pointsOfInterest: "Points of interest",
    goTo: "Go to {place}",
    checked: "Checked",
    lookHint: "Drag or use the arrow keys to look around.",
    progress: "{done} of {total} checked",
  },
  objectives: {
    title: "Objectives",
    done: "Done",
  },
  medical: {
    start: "Start measurement",
    measuring: "Measuring",
    withinRange: "Within range",
    normal: "Normal: {range}",
    finish: "Done",
    doctorSays: "{name} explains",
    clearedTitle: "Cleared for flight",
    clearedBody: "All three checks are within range. {name} has signed your flight card.",
    continue: "Continue to the assembly hall",
    sceneLabel: "Medical bay seen through the astronaut's eyes",
  },
  portrait: {
    placeholderAlt: "Portrait of {name} (placeholder art)",
  },
} as const;

type Widen<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dictionary = Widen<typeof en>;
