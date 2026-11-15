"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { useEffect } from "react";
import { useVoiceLine } from "@/hooks/useVoiceLine";
import { playSfx } from "@/game/sfx";
import type { CharacterId } from "@/game/characters";
import { cn } from "@/lib/utils";

interface SignOffDialogProps {
  open: boolean;
  /** Who signs the chapter off; their portrait heads the dialog. */
  character: CharacterId;
  badge: string;
  title: string;
  description: string;
  continueLabel: string;
  onContinue: () => void;
  /** Show the DEMO badge (the details are mocked values). */
  demo?: boolean;
  /** Tone of the badge. "fault" is for a failed attempt: no fanfare, and the button retries. */
  status?: Status;
  /** Optional details between the text and the button, e.g. a results list. */
  children?: React.ReactNode;
}

/** End of a scene: a character signs off on what the player did, then the story moves on. */
export function SignOffDialog({
  open,
  character,
  badge,
  title,
  description,
  continueLabel,
  onContinue,
  status = "go",
  children,
}: SignOffDialogProps) {
  // The narrator reads the result as the card opens.
  useVoiceLine(open ? description : null);
  useEffect(() => {
    if (open && status === "go") playSfx("success");
  }, [open, status]);
  return (
    <Dialog open={open}>
      <DialogContent locked>
        <DialogHeader>
          <div className="mb-2 flex items-end gap-4">
            <div className="h-20 w-16 shrink-0">
              <CharacterPortrait character={character} avatar />
            </div>
            <StatusBadge status={status} className="mb-1">
              {badge}
            </StatusBadge>
          </div>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button size="lg" onClick={onContinue}>
            {continueLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The two-column results list used inside sign-off dialogs. */
export function SignOffDetails({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <dl className={cn("grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 bg-space-blue/35 px-4 py-3 text-sm", className)}>{children}</dl>
  );
}
