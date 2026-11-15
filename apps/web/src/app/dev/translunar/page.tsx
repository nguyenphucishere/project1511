"use client";

import { TranslunarScene } from "@/scenes/translunar/TranslunarScene";

/** Dev preview of the flight to the Moon. In the console, window.__tl.seek(t) jumps the film to t seconds. */
export default function DevTranslunarPage() {
  return (
    <div className="fixed inset-0 bg-black">
      <TranslunarScene onComplete={() => {}} />
    </div>
  );
}
