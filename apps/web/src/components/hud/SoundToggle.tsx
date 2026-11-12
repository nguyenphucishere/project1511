"use client";

import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/i18n/useT";
import { useSettingsStore } from "@/game/settingsStore";
import { cn } from "@/lib/utils";

/** Turns the game's sound effects on or off. */
export function SoundToggle({ className }: { className?: string }) {
  const t = useT();
  const sound = useSettingsStore((s) => s.sound);
  const toggle = useSettingsStore((s) => s.toggleSound);
  const label = `${t.settings.soundEffects}: ${sound ? t.settings.on : t.settings.off}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-pressed={sound}
          aria-label={label}
          onClick={toggle}
          className={cn("h-8 w-8 bg-space-deep/80", sound && "text-primary", className)}
        >
          {sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
