import type { Role } from "@space-sim/shared-schema";

export interface UserPresence {
  userId: string;
  username: string;
  roles: Role[];
  connectedAt: number;
}

/**
 * Who is currently connected to a room. Memory-backed today; the interface is the seam
 * for a Redis implementation once rooms are served by more than one process.
 */
export interface PresenceStore {
  join(roomCode: string, presence: UserPresence): void;
  leave(roomCode: string, userId: string): void;
  list(roomCode: string): UserPresence[];
}

export class MemoryPresenceStore implements PresenceStore {
  private readonly rooms = new Map<string, Map<string, UserPresence>>();

  join(roomCode: string, presence: UserPresence): void {
    let room = this.rooms.get(roomCode);
    if (!room) {
      room = new Map();
      this.rooms.set(roomCode, room);
    }
    room.set(presence.userId, presence);
  }

  leave(roomCode: string, userId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.delete(userId);
    if (room.size === 0) this.rooms.delete(roomCode);
  }

  list(roomCode: string): UserPresence[] {
    return [...(this.rooms.get(roomCode)?.values() ?? [])];
  }
}
