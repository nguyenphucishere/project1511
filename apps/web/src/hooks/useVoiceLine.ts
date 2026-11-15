"use client";

import { useEffect, useRef } from "react";
import { speak, stopSpeaking } from "@/game/sfx";
import { useSettingsStore } from "@/game/settingsStore";

export interface VoiceLineOptions {
  /**
   * What the recording says, when it differs from what is on screen (a line with a live number on
   * screen has a recording without it). Defaults to the displayed text.
   */
  as?: string;
  /** Wait for the line that is playing instead of cutting it off. */
  queue?: boolean;
  /** Force the radio filter on or off; by default it follows the speaker. */
  radio?: boolean;
  /** Start after this many milliseconds (e.g. to let a screen settle). */
  delayMs?: number;
}

/**
 * Reads a line aloud in the player's language while it is on screen: the recorded voice for that
 * speaker when there is one, the browser's voice otherwise. Says it again when the text changes,
 * and stops it (only if it is still this line) when the line goes away. A null/empty text is silent.
 *
 * A queued line (queue: true) is the exception: when its text changes the line already playing is
 * left to finish, so a sequence of captions is heard in full. Every voice from this hook still stops
 * when the component unmounts.
 */
export function useVoiceLine(text: string | null | undefined, options: VoiceLineOptions = {}) {
  const locale = useSettingsStore((s) => s.locale);
  const { as, queue, radio, delayMs } = options;
  const lastId = useRef(0);

  useEffect(() => {
    if (!text) return;
    let id = 0;
    const start = () => {
      id = speak(as ?? text, locale, { queue, radio });
      lastId.current = id;
    };
    const timer = delayMs ? window.setTimeout(start, delayMs) : undefined;
    if (!delayMs) start();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (id && !queue) stopSpeaking(id);
    };
  }, [text, as, locale, queue, radio, delayMs]);

  // Leaving the screen silences whatever this hook last said (only if nothing newer is speaking).
  useEffect(
    () => () => {
      if (lastId.current) stopSpeaking(lastId.current);
    },
    [],
  );
}
