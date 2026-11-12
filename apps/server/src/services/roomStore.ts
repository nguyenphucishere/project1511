import type { PrismaClient } from "@prisma/client";

export interface RoomRecord {
  roomCode: string;
  ownerId: string;
  ownerName: string;
  /** Full Yjs document state (`Y.encodeStateAsUpdate`), or null for a brand-new room. */
  snapshot: Uint8Array | null;
}

export interface RoomOwner {
  ownerId: string;
  ownerName: string;
}

/** Persistence boundary for rooms. Implementations must be safe to call concurrently. */
export interface RoomStore {
  /** Returns the room, creating it for `owner` if it does not exist yet. */
  getOrCreate(roomCode: string, owner: RoomOwner): Promise<RoomRecord>;
  saveSnapshot(roomCode: string, snapshot: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, RoomRecord>();

  async getOrCreate(roomCode: string, owner: RoomOwner): Promise<RoomRecord> {
    let record = this.rooms.get(roomCode);
    if (!record) {
      record = { roomCode, ...owner, snapshot: null };
      this.rooms.set(roomCode, record);
    }
    return { ...record };
  }

  async saveSnapshot(roomCode: string, snapshot: Uint8Array): Promise<void> {
    const record = this.rooms.get(roomCode);
    if (record) record.snapshot = snapshot;
  }

  async close(): Promise<void> {}
}

export class PrismaRoomStore implements RoomStore {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreate(roomCode: string, owner: RoomOwner): Promise<RoomRecord> {
    // upsert with an empty update makes concurrent first-connects race-safe on the unique roomCode.
    const row = await this.prisma.missionSession.upsert({
      where: { roomCode },
      create: { roomCode, ownerId: owner.ownerId, ownerName: owner.ownerName },
      update: {},
    });
    return {
      roomCode: row.roomCode,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      snapshot: row.crdtDocSnapshot ? new Uint8Array(row.crdtDocSnapshot) : null,
    };
  }

  async saveSnapshot(roomCode: string, snapshot: Uint8Array): Promise<void> {
    await this.prisma.missionSession.update({
      where: { roomCode },
      data: { crdtDocSnapshot: Buffer.from(snapshot) },
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export interface RoomStoreLogger {
  info(message: string): void;
  warn(message: string): void;
}

/**
 * Picks Postgres when DATABASE_URL is set and reachable, otherwise falls back to memory
 * so local development works without Docker.
 */
export async function createRoomStore(
  databaseUrl: string | undefined,
  log: RoomStoreLogger,
): Promise<RoomStore> {
  if (!databaseUrl) {
    log.warn("DATABASE_URL not set: rooms are kept in memory and lost on restart");
    return new MemoryRoomStore();
  }
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    log.info("Persisting rooms to PostgreSQL");
    return new PrismaRoomStore(prisma);
  } catch (error) {
    log.warn(`PostgreSQL unavailable (${(error as Error).message.split("\n")[0]}): using in-memory rooms`);
    return new MemoryRoomStore();
  }
}
