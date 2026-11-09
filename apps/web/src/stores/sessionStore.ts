import { create } from "zustand";
import type { Role } from "@space-sim/shared-schema";

export interface SessionState {
  roomId: string | null;
  assignedRole: Role | null;
  setRoomId: (id: string | null) => void;
  setAssignedRole: (role: Role | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  roomId: null,
  assignedRole: null,
  setRoomId: (id) => set({ roomId: id }),
  setAssignedRole: (role) => set({ assignedRole: role }),
}));
