"use client";

import { useState } from "react";
import { LandingFilm } from "@/scenes/lunar-descent/film/LandingFilm";
import type { FilmPart } from "@/scenes/lunar-descent/film/script";

/** Dev preview of the two landing films (approach and touchdown). Not linked from the game. */
export default function DevLandingPage() {
  const [part, setPart] = useState<FilmPart | null>(null);
  const [run, setRun] = useState(0);

  if (part) {
    return (
      <div className="fixed inset-0 bg-black">
        <LandingFilm key={`${part}-${run}`} part={part} onComplete={() => setPart(null)} />
      </div>
    );
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-space-deep p-6 text-foreground">
      <h1 className="text-2xl font-bold">Landing films</h1>
      {(["approach", "touchdown"] as const).map((p) => (
        <button
          key={p}
          type="button"
          className="rounded border border-space-blue bg-space-blue/30 px-5 py-3 font-mono text-sm uppercase tracking-widest hover:bg-space-blue/50"
          onClick={() => {
            setRun((n) => n + 1);
            setPart(p);
          }}
        >
          {p}
        </button>
      ))}
    </main>
  );
}
