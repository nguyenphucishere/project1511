"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface BlastDoorProps {
  open: boolean;
  /** Fires once, when the panels have fully opened. */
  onOpened: () => void;
  /** Title and menu, mounted on the closed door. They fade out before the panels move. */
  children: React.ReactNode;
  label: string;
}

const OPEN_MS = 1400;
const DELAY_MS = 250;

/** Two hangar door panels that split from the centre seam. */
export function BlastDoor({ open, onOpened, children, label }: BlastDoorProps) {
  const reduced = useReducedMotion();
  const fired = useRef(false);

  useEffect(() => {
    if (!open || fired.current) return;
    const total = reduced ? 250 : OPEN_MS + DELAY_MS + 100;
    const id = window.setTimeout(() => {
      fired.current = true;
      onOpened();
    }, total);
    return () => window.clearTimeout(id);
  }, [open, reduced, onOpened]);

  const panel = cn(
    "absolute inset-y-0 w-1/2 bg-space-blue",
    // Structural ribs: one hairline every 56px.
    "bg-[repeating-linear-gradient(180deg,transparent_0,transparent_55px,rgb(var(--space-deep)/0.55)_55px,rgb(var(--space-deep)/0.55)_56px)]",
    reduced
      ? "transition-opacity duration-200"
      : "transition-transform [transition-timing-function:cubic-bezier(.7,0,.2,1)] [transition-duration:1400ms] [transition-delay:250ms]",
  );
  const hazard =
    "absolute inset-y-0 w-7 bg-[repeating-linear-gradient(135deg,rgb(var(--space-gold))_0,rgb(var(--space-gold))_14px,rgb(var(--space-deep))_14px,rgb(var(--space-deep))_28px)]";

  return (
    <div className="absolute inset-0 overflow-hidden" role="group" aria-label={label}>
      <div
        aria-hidden
        className={cn(panel, "left-0", open && (reduced ? "opacity-0" : "-translate-x-full"))}
      >
        <div className={cn(hazard, "right-0")} />
        <div className="absolute inset-y-0 right-7 w-px bg-space-mist/30" />
      </div>
      <div
        aria-hidden
        className={cn(panel, "right-0", open && (reduced ? "opacity-0" : "translate-x-full"))}
      >
        <div className={cn(hazard, "left-0")} />
        <div className="absolute inset-y-0 left-7 w-px bg-space-mist/30" />
      </div>

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center px-4 transition-opacity duration-200",
          open && "pointer-events-none opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
