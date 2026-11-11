"use client";

import { useSyncExternalStore } from "react";
import { useSettingsStore } from "@/game/settingsStore";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** True when the OS asks for less motion or the player turned it on in settings. */
export function useReducedMotion(): boolean {
  const forced = useSettingsStore((s) => s.reduceMotion);
  const system = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
  return forced || system;
}
