"use client";

import { Grid2x2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/i18n/useT";
import { useSettingsStore } from "@/game/settingsStore";
import { cn } from "@/lib/utils";

/** Turns the 3D pixel/palette pass on or off. Only the 3D view changes; the HUD stays sharp. */
export function PixelToggle({ className }: { className?: string }) {
  const t = useT();
  const pixelFX = useSettingsStore((s) => s.pixelFX);
  const toggle = useSettingsStore((s) => s.togglePixelFX);
  const label = `${t.settings.pixelEffect}: ${pixelFX ? t.settings.on : t.settings.off}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-pressed={pixelFX}
          aria-label={label}
          onClick={toggle}
          className={cn("h-8 w-8 bg-space-deep/80", pixelFX && "text-primary", className)}
        >
          <Grid2x2 className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
