"use client";

import type { Role } from "@space-sim/shared-schema";

export function useMultiplayerRoom(_roomCode: string, _userRole: Role) {
  // TODO: Implement Yjs room connection and CRDT synchronization
  return {
    connected: false,
    doc: null,
  };
}
