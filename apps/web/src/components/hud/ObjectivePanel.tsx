"use client";

import { Check } from "lucide-react";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/utils";

export interface Objective {
  id: string;
  label: string;
  done: boolean;
  /** Optional progress shown after the label, e.g. "1/3". */
  progress?: string;
}

/** The scene's task list. Order is the intended sequence, so it is a numbered (ordered) list. */
export function ObjectivePanel({ items, className, compact = false }: { items: Objective[]; className?: string; compact?: boolean }) {
  const t = useT();
  // Compact mode (long task lists): just the current objective and how far along the player is.
  const current = items.findIndex((o) => !o.done);
  const shown = compact ? items.filter((_, i) => i === current) : items;
  const finished = items.filter((o) => o.done).length;
  return (
    <section aria-label={t.objectives.title} className={cn("bezel w-full max-w-xs bg-space-deep/85 backdrop-blur-md p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]", className)}>
      <h2 className="flex items-baseline justify-between px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-space-cyan">
        {t.objectives.title}
        {compact && <span className="font-mono normal-case tracking-normal text-space-gold">{finished}/{items.length}</span>}
      </h2>
      <ol className="flex flex-col gap-1.5">
        {shown.map((o) => (
          <li key={o.id} className="flex items-start gap-2.5 px-1 text-sm">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm",
                o.done ? "bg-space-emerald text-white" : "shadow-[inset_0_0_0_1.5px_rgb(var(--primary))]",
              )}
            >
              {o.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className={cn("flex-1", o.done ? "text-foreground/60 line-through decoration-foreground/40" : "text-white")}>
              {o.label}
              {o.done && <span className="sr-only"> ({t.objectives.done})</span>}
            </span>
            {o.progress && !o.done && <span className="font-mono text-xs text-space-gold">{o.progress}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
