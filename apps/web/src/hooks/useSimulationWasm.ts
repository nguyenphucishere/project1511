"use client";

export function useSimulationWasm() {
  // TODO: Implement WebAssembly worker simulation bridge
  return {
    isReady: false,
    runSimulation: (_config: unknown) => {
      // TODO: Post message to simulation worker
    },
  };
}
