"use client";

import { useEffect } from "react";
import { TitleSplash } from "@/components/home/TitleSplash";
import { FIRST_STEP_ID } from "@/game/flow";
import { warmUpcoming } from "@/scenes/preload";

/** The title screen is also the menu: Continue, New game and the chapter list live on it. */
export default function StartScreen() {
  // Download the scenes' files in the background while the player is on the title. Code and textures
  // are evaluated later, once the game is running (see warmUpcoming).
  useEffect(() => {
    // Let the title draw and settle first; the heavy fetching and code evaluation starts a moment later.
    const id = window.setTimeout(() => warmUpcoming(FIRST_STEP_ID), 2500);
    return () => window.clearTimeout(id);
  }, []);

  return <TitleSplash />;
}
