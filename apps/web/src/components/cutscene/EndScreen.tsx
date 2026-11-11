"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/useT";
import { useGameStore } from "@/game/gameStore";
import { ParallaxCanvas } from "./ParallaxCanvas";

/** Final screen after the epilogue. The mission summary is added in P6. */
export function EndScreen() {
  const t = useT();
  const newGame = useGameStore((s) => s.newGame);

  return (
    <section className="relative h-dvh w-full overflow-hidden" aria-labelledby="end-title">
      <ParallaxCanvas mode="drift" horizon className="absolute inset-0" />
      <div className="absolute inset-x-0 top-[22dvh] flex justify-center px-4">
        <div className="flex max-w-xl flex-col items-center gap-4 text-center">
          <h1 id="end-title" className="text-4xl font-semibold sm:text-5xl">
            {t.end.title}
          </h1>
          <p className="max-w-[44ch] text-lg text-foreground/85">{t.end.body}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={newGame}>
              {t.end.playAgain}
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/">{t.end.backToTitle}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
