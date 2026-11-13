"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CharacterPortrait } from "@/components/cutscene/CharacterPortrait";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { useSettingsStore } from "@/game/settingsStore";
import { CHARACTERS } from "@/game/characters";
import type { RocketPart } from "@/mocks/rocket-parts";

interface PartPanelProps {
  part: RocketPart;
  /** The next part on this level still to inspect, if any. */
  next: RocketPart | null;
  onNext: () => void;
  onClose: () => void;
}

/** Chief Bao's explanation of one part: what it does, plus two DEMO facts. */
export function PartPanel({ part, next, onNext, onClose }: PartPanelProps) {
  const t = useT();
  const localize = useLocalized();
  const locale = useSettingsStore((s) => s.locale);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [part.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mass = format(t.workshop.massValue, { value: new Intl.NumberFormat(locale).format(part.massT) });

  return (
    <section
      aria-labelledby={`part-${part.id}`}
      className="bezel bezel-gold pointer-events-auto relative w-full max-w-md animate-fade-in bg-space-deep/95 p-5"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="h-12 w-10 shrink-0">
          <CharacterPortrait character="workshop-chief" />
        </div>
        <div>
          <p className="text-xs text-foreground/65">{localize(part.section)}</p>
          <h2 id={`part-${part.id}`} className="text-lg font-semibold leading-snug">
            {localize(part.name)}
          </h2>
        </div>
      </div>

      <p className="mt-3 max-w-prose text-sm text-foreground/85">
        <span className="sr-only">{format(t.workshop.chiefSays, { name: localize(CHARACTERS["workshop-chief"].name) })}: </span>
        {localize(part.role)}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-px bg-space-blue/60 text-sm">
        <div className="bg-space-deep/80 px-3 py-2">
          <dt className="text-xs text-foreground/65">{t.workshop.mass}</dt>
          <dd className="font-mono text-base">{mass}</dd>
        </div>
        <div className="bg-space-deep/80 px-3 py-2">
          <dt className="text-xs text-foreground/65">{localize(part.fact.label)}</dt>
          <dd>{localize(part.fact.value)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status="demo">{t.common.demoData}</StatusBadge>
        <div className="flex flex-wrap justify-end gap-2">
          {next ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                {t.common.close}
              </Button>
              <Button ref={primary} onClick={onNext}>
                {format(t.workshop.next, { name: localize(next.name) })}
              </Button>
            </>
          ) : (
            <Button ref={primary} onClick={onClose}>
              {t.common.close}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
