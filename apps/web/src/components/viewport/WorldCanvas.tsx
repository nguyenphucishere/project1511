"use client";

import dynamic from "next/dynamic";
import type { WorldCanvasInnerProps } from "./WorldCanvasInner";

// WebGL must never run during server rendering. In Next 15, `ssr: false` is only allowed
// inside a client component, which is why this wrapper exists.
const Inner = dynamic(() => import("./WorldCanvasInner"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-space-deep" aria-hidden />,
});

/** Client-only 3D viewport. Children are R3F scene content (meshes, lights, hotspots). */
export function WorldCanvas(props: WorldCanvasInnerProps) {
  return (
    <div className="absolute inset-0">
      <Inner {...props} />
    </div>
  );
}
