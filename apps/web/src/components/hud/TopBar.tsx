"use client";

import Link from "next/link";
import { House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useT } from "@/i18n/useT";
import { LocaleToggle } from "./LocaleToggle";

/** In-game bar: back to the title screen, demo label, language. Progress is kept for Continue. */
export function TopBar() {
  const t = useT();
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-3 py-3 sm:px-8 sm:py-4">
      <Button asChild variant="secondary" size="sm" className="pointer-events-auto bg-space-deep/80">
        <Link href="/">
          <House className="h-4 w-4" aria-hidden />
          {t.play.exitToTitle}
        </Link>
      </Button>
      <div className="pointer-events-auto flex items-center gap-2">
        <StatusBadge status="demo" className="bg-space-deep/80">
          {t.common.demoData}
        </StatusBadge>
        <LocaleToggle className="bg-space-deep/80" />
      </div>
    </header>
  );
}
