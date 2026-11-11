"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Eye, Footprints } from "lucide-react";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useSceneStore } from "@/game/sceneStore";
import { cn } from "@/lib/utils";

/**
 * DOM mirror of the 3D hotspots: every clickable thing in the scene is also a real button here,
 * so the scene can be played with Tab/Enter or a screen reader. Focusing an item turns the
 * camera toward it; hovering highlights it in 3D.
 */
export function HotspotList({ className }: { className?: string }) {
  const t = useT();
  const localize = useLocalized();
  const hotspots = useSceneStore((s) => s.hotspots);
  const highlightedId = useSceneStore((s) => s.highlightedId);
  const highlight = useSceneStore((s) => s.highlight);

  // Open by default on wide screens; collapsed on phones, where it would cover the view.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(window.matchMedia("(min-width: 640px)").matches);
  }, []);

  const items = Object.values(hotspots).sort((a, b) =>
    a.kind === b.kind ? 0 : a.kind === "inspect" ? -1 : 1,
  );
  if (items.length === 0) return null;

  return (
    <nav aria-label={t.hud.pointsOfInterest} className={cn("bezel w-full max-w-xs bg-space-deep/90 p-3", className)}>
      <h2 className="text-sm font-medium text-foreground/75">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="hotspot-list"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-1 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]"
        >
          <span>
            {t.hud.pointsOfInterest} <span className="font-mono text-xs text-foreground/60">({items.length})</span>
          </span>
          <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      {/* A `hidden` attribute would lose to Tailwind's `flex`; toggle the class instead. */}
      <ul id="hotspot-list" className={cn("mt-2 max-h-[32dvh] flex-col gap-1 overflow-y-auto", open ? "flex" : "hidden")}>
        {items.map((h) => {
          const name = localize(h.label);
          const Icon = h.kind === "move" ? Footprints : h.done ? Check : Eye;
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={h.activate}
                onFocus={() => highlight(h.id, { lookAt: true })}
                onBlur={() => highlight(null)}
                onMouseEnter={() => highlight(h.id)}
                onMouseLeave={() => highlight(null)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
                  highlightedId === h.id ? "bg-surface/70 text-foreground" : "text-foreground/85 hover:bg-surface/40",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("h-4 w-4 shrink-0", h.kind === "inspect" && !h.done ? "text-primary" : "text-foreground/60")}
                />
                <span className="flex-1">{h.kind === "move" ? format(t.hud.goTo, { place: name }) : name}</span>
                {h.kind === "inspect" && h.done && <span className="text-xs text-foreground/60">{t.hud.checked}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
