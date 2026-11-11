"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocaleToggle } from "@/components/hud/LocaleToggle";
import { useT } from "@/i18n/useT";

// Temporary P0 page. The real start screen replaces it in P1.
export default function HomePage() {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col px-4 py-6 sm:px-10">
      <header className="flex items-center justify-between gap-4">
        <StatusBadge status="demo">{t.common.demoData}</StatusBadge>
        <LocaleToggle />
      </header>

      <section className="flex flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">{t.home.title}</h1>
        <p className="max-w-[46ch] text-lg text-foreground/85 sm:text-xl">{t.home.subtitle}</p>
        <p className="max-w-[60ch] text-sm text-foreground/65">{t.home.comingSoon}</p>
        <div>
          <Button asChild variant="secondary">
            <Link href="/dev/ui">{t.home.openUiKit}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
