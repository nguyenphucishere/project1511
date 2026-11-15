"use client";

import Link from "next/link";
import { House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useT } from "@/i18n/useT";
import { useGameStore } from "@/game/gameStore";
import { LocaleToggle } from "./LocaleToggle";
import { PixelToggle } from "./PixelToggle";
import { SoundToggle } from "./SoundToggle";

/** Scenes whose numbers come from the simulation engine (launch console and film, ascent, powered descent). */
const CALCULATED_STEPS = new Set(["mission-control-scene", "ascent-scene", "lunar-descent-scene"]);

/** In-game bar: back to the title screen, data label, language. Progress is kept for Continue. */
export function TopBar() {
  const t = useT();
  const calculated = useGameStore((s) => (s.stepId ? CALCULATED_STEPS.has(s.stepId) : false));
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-3 py-3 sm:px-8 sm:py-4">
      <Button asChild variant="secondary" size="sm" className="pointer-events-auto bg-space-deep/80">
        <Link href="/" aria-label={t.play.exitToTitle}>
          <House className="h-4 w-4" aria-hidden />
          <span className="hidden whitespace-nowrap sm:inline">{t.play.exitToTitle}</span>
        </Link>
      </Button>
      <div className="pointer-events-auto flex items-center gap-2">
        {calculated && (
          <StatusBadge status="calculated" className="whitespace-nowrap bg-space-deep/80">
            {t.common.calculatedData}
          </StatusBadge>
        )}
        <SoundToggle />
        <PixelToggle />
        <LocaleToggle className="bg-space-deep/80" />
      </div>
    </header>
  );
}
