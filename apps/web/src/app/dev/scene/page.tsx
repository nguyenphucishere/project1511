"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TopBar } from "@/components/hud/TopBar";
import { HotspotList } from "@/components/hud/HotspotList";
import { WorldCanvas } from "@/components/viewport/WorldCanvas";
import { useSceneStore } from "@/game/sceneStore";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { TEST_ITEMS, TEST_VIEWPOINTS, TestRoom } from "./TestRoom";

/** Developer page: the P2 first-person foundation in an empty test room. Not part of the game. */
export default function DevScenePage() {
  const t = useT();
  const localize = useLocalized();
  const setViewpoints = useSceneStore((s) => s.setViewpoints);
  const reset = useSceneStore((s) => s.reset);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setViewpoints(TEST_VIEWPOINTS, "door");
    return reset;
  }, [setViewpoints, reset]);

  const inspect = (id: string) => {
    setChecked((prev) => new Set(prev).add(id));
    setOpen(id);
  };
  const item = TEST_ITEMS.find((i) => i.id === open);

  return (
    <main className="relative h-dvh overflow-hidden bg-space-deep">
      <WorldCanvas label="Test room with a console, a crate, and a globe">
        <TestRoom checked={checked} onInspect={inspect} />
      </WorldCanvas>
      <TopBar />

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-col items-start gap-3 sm:inset-x-8 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="pointer-events-auto flex w-full max-w-xs flex-col gap-2">
          <StatusBadge status={checked.size === TEST_ITEMS.length ? "go" : "pending"} className="w-fit bg-space-deep/90">
            {format(t.hud.progress, { done: checked.size, total: TEST_ITEMS.length })}
          </StatusBadge>
          <HotspotList />
          <p className="text-xs text-foreground/70">{t.hud.lookHint}</p>
        </div>

        {item && (
          <section
            aria-live="polite"
            className="bezel bezel-gold pointer-events-auto w-full max-w-md animate-fade-in bg-space-deep/95 p-5"
          >
            <h2 className="text-lg font-semibold">{localize(item.label)}</h2>
            <p className="mt-1 text-sm text-foreground/85">{localize(item.body)}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setOpen(null)}>
              {t.common.close}
            </Button>
          </section>
        )}
      </div>
    </main>
  );
}
