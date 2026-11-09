import type { Role } from "@space-sim/shared-schema";

export interface UserPresence {
  userId: string;
  username: string;
  role: Role | null;
  activeField: string | null;
  cursorPos?: { x: number; y: number };
  lastActive: number;
}

export class PresenceManager {
  joinRoom(_roomId: string, _user: UserPresence): void {
    throw new Error("TODO: Implement joinRoom");
  }

  leaveRoom(_roomId: string, _userId: string): void {
    throw new Error("TODO: Implement leaveRoom");
  }

  getRoomPresence(_roomId: string): UserPresence[] {
    throw new Error("TODO: Implement getRoomPresence");
  }
}
