"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSettingsStore } from "@/game/settingsStore";
import { useGameStore } from "@/game/gameStore";

/** Client-side app shell: restores saved settings and mirrors them onto <html>. */
export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useSettingsStore((s) => s.locale);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
    void useGameStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) root.dataset.motion = "reduce";
    else delete root.dataset.motion;
  }, [reduceMotion]);

  return <TooltipProvider delayDuration={250}>{children}</TooltipProvider>;
}
