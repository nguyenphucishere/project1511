import type { AuthSession } from "../services/authService.js";
import type { RoomStore } from "../services/roomStore.js";
import { Room, type RoomLogger } from "./room.js";

export class RoomOwnershipError extends Error {
  constructor(roomCode: string) {
    super(`room ${roomCode} belongs to another user`);
    this.name = "RoomOwnershipError";
  }
}

export interface RoomManagerOptions {
  snapshotDebounceMs: number;
  idleTtlMs: number;
  log: RoomLogger;
}

/**
 * Registry of live rooms. A room is loaded from the store on first use (and created if
 * unknown), then evicted `idleTtlMs` after its last connection leaves.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** De-duplicates concurrent first connects to the same room code. */
  private readonly loading = new Map<string, Promise<Room>>();
  private readonly idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly store: RoomStore,
    private readonly options: RoomManagerOptions,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  get(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  /** Returns the room for `session`, creating it on first use. Throws RoomOwnershipError for other users. */
  async acquire(roomCode: string, session: AuthSession): Promise<Room> {
    this.cancelIdleEviction(roomCode);

    let room = this.rooms.get(roomCode);
    if (!room) {
      let pending = this.loading.get(roomCode);
      if (!pending) {
        pending = this.load(roomCode, session).finally(() => this.loading.delete(roomCode));
        this.loading.set(roomCode, pending);
      }
      room = await pending;
    }

    if (room.record.ownerId !== session.userId) throw new RoomOwnershipError(roomCode);
    return room;
  }

  /** Call after a socket attached to `room` closes so empty rooms are eventually released. */
  scheduleIdleEviction(room: Room): void {
    if (room.hasConnection || this.idleTimers.has(room.roomCode)) return;
    const timer = setTimeout(() => {
      this.idleTimers.delete(room.roomCode);
      if (room.hasConnection) return;
      this.rooms.delete(room.roomCode);
      this.options.log.info(`room ${room.roomCode}: evicted after idle`);
      void room.destroy().catch((error: Error) => {
        this.options.log.error(`room ${room.roomCode}: destroy failed: ${error.message}`);
      });
    }, this.options.idleTtlMs);
    timer.unref();
    this.idleTimers.set(room.roomCode, timer);
  }

  /** Closes every room, flushing pending snapshots. Used on shutdown. */
  async shutdown(): Promise<void> {
    for (const timer of this.idleTimers.values()) clearTimeout(timer);
    this.idleTimers.clear();
    const rooms = [...this.rooms.values()];
    this.rooms.clear();
    await Promise.all(rooms.map((room) => room.destroy()));
  }

  private async load(roomCode: string, session: AuthSession): Promise<Room> {
    const record = await this.store.getOrCreate(roomCode, {
      ownerId: session.userId,
      ownerName: session.username,
    });
    const room = new Room(record, this.store, {
      snapshotDebounceMs: this.options.snapshotDebounceMs,
      log: this.options.log,
    });
    this.rooms.set(roomCode, room);
    this.options.log.info(
      `room ${roomCode}: loaded (${record.snapshot ? "restored from snapshot" : "new"})`,
    );
    return room;
  }

  private cancelIdleEviction(roomCode: string): void {
    const timer = this.idleTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(roomCode);
    }
  }
}
