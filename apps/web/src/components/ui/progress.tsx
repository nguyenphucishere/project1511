"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** "warning" turns the fill orange; pair it with a text status, never colour alone. */
  tone?: "default" | "warning";
}

/**
 * Segmented gauge bar, read like a console level meter. Value is 0..max (default 100).
 * Callers render the numeric reading and status text next to it.
 */
const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, max = 100, tone = "default", ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100));
    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={value}
        max={max}
        className={cn("relative h-3 w-full overflow-hidden bg-space-blue/50", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full transition-[width] duration-300 ease-out",
            tone === "warning" ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Segment gaps drawn over the fill. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(10%-2px),rgb(var(--space-deep))_calc(10%-2px),rgb(var(--space-deep))_10%)]"
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
