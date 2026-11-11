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
export function ObjectivePanel({ items, className }: { items: Objective[]; className?: string }) {
  const t = useT();
  return (
    <section aria-label={t.objectives.title} className={cn("bezel w-full max-w-xs bg-space-deep/90 p-3", className)}>
      <h2 className="px-1 pb-2 text-sm font-medium text-foreground/75">{t.objectives.title}</h2>
      <ol className="flex flex-col gap-1.5">
        {items.map((o) => (
          <li key={o.id} className="flex items-start gap-2.5 px-1 text-sm">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
                o.done ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1.5px_rgb(var(--primary))]",
              )}
            >
              {o.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className={cn("flex-1", o.done && "text-foreground/60 line-through decoration-foreground/40")}>
              {o.label}
              {o.done && <span className="sr-only"> ({t.objectives.done})</span>}
            </span>
            {o.progress && !o.done && <span className="font-mono text-xs text-foreground/70">{o.progress}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
