"use client";

import { LOCALES, type Locale } from "@/i18n";
import { useT } from "@/i18n/useT";
import { useSettingsStore } from "@/game/settingsStore";
import { cn } from "@/lib/utils";

const LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  vi: { short: "VI", name: "Tiếng Việt" },
};

/** Two-state language switch. Each option carries its own language name for screen readers. */
export function LocaleToggle({ className }: { className?: string }) {
  const t = useT();
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  return (
    <div role="group" aria-label={t.common.language} className={cn("bezel bezel-sm inline-flex p-1", className)}>
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-label={LABELS[code].name}
            aria-pressed={active}
            onClick={() => setLocale(code)}
            className={cn(
              "h-7 min-w-10 px-2 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
              active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground",
            )}
          >
            {LABELS[code].short}
          </button>
        );
      })}
    </div>
  );
}
