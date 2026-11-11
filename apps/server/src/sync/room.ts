import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import type { WebSocket } from "ws";
import type { Role } from "@space-sim/shared-schema";
import type { AuthSession } from "../services/authService.js";
import type { RoomRecord, RoomStore } from "../services/roomStore.js";
import { allowedKeysFor, authorizeUpdate, holdsAllRoles } from "./roleLocks.js";

/** Wire message types. 0 and 1 are the standard y-websocket ones. */
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
/** Custom: server tells a client that an update was rejected. Stock clients ignore it. */
export const MESSAGE_DENIED = 100;

/** WebSocket close codes (application range 4000-4999). */
export const CLOSE_REPLACED = 4001;
export const CLOSE_FORBIDDEN_EDIT = 4003;
export const CLOSE_SHUTDOWN = 1001;

export interface RoomLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface RoomOptions {
  snapshotDebounceMs: number;
  log: RoomLogger;
}

interface Connection {
  socket: WebSocket;
  session: AuthSession;
  roles: readonly Role[];
  allowedKeys: ReadonlySet<string>;
  /** Fast path: a holder of every role may write anything, so no scratch-doc check is needed. */
  unrestricted: boolean;
  controlledAwarenessIds: Set<number>;
}

/**
 * One collaborative mission document plus its (at most one) live connection.
 * Owns the Yjs doc, awareness state, role enforcement and debounced persistence.
 */
export class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  private connection: Connection | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private saving: Promise<void> = Promise.resolve();
  private dirty = false;
  private destroyed = false;

  constructor(
    readonly record: RoomRecord,
    private readonly store: RoomStore,
    private readonly options: RoomOptions,
  ) {
    if (record.snapshot) Y.applyUpdate(this.doc, record.snapshot);
    // Server-side awareness is only a relay: no local state of its own.
    this.awareness.setLocalState(null);

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      this.broadcast(encodeUpdate(update), origin);
      this.scheduleSave();
    });
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  get roomCode(): string {
    return this.record.roomCode;
  }

  get hasConnection(): boolean {
    return this.connection !== null;
  }

  get activeConnection(): { session: AuthSession; roles: readonly Role[] } | null {
    return this.connection && { session: this.connection.session, roles: this.connection.roles };
  }

  /**
   * Attaches a socket. Any existing connection is replaced: the single-user lobby rule means
   * a reconnect or second tab takes over rather than being rejected.
   */
  attach(socket: WebSocket, session: AuthSession, roles: readonly Role[]): void {
    if (this.connection) {
      this.options.log.info(`room ${this.roomCode}: replacing existing connection`);
      this.detach(this.connection, CLOSE_REPLACED, "replaced by a newer connection");
    }

    const connection: Connection = {
      socket,
      session,
      roles,
      allowedKeys: allowedKeysFor(roles),
      unrestricted: holdsAllRoles(roles),
      controlledAwarenessIds: new Set(),
    };
    this.connection = connection;

    socket.binaryType = "nodebuffer";
    socket.on("message", (data: Buffer) => this.onMessage(connection, new Uint8Array(data)));
    socket.on("close", () => this.onClose(connection));
    socket.on("error", (error) => {
      this.options.log.warn(`room ${this.roomCode}: socket error: ${error.message}`);
    });

    // Standard handshake: send our SyncStep1 and current awareness; the client replies with step 2.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.send(connection, encoding.toUint8Array(encoder));

    const states = this.awareness.getStates();
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...states.keys()]),
      );
      this.send(connection, encoding.toUint8Array(awarenessEncoder));
    }
  }

  /** Writes any pending changes now. Resolves once the snapshot is stored. */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) this.queueSave();
    await this.saving;
  }

  async destroy(closeCode = CLOSE_SHUTDOWN, reason = "room closed"): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.connection) this.detach(this.connection, closeCode, reason);
    await this.flush();
    this.awareness.destroy();
    this.doc.destroy();
  }

  private onMessage(connection: Connection, data: Uint8Array): void {
    // Ignore stragglers from a connection that has since been replaced.
    if (this.connection !== connection) return;
    try {
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        this.onSyncMessage(connection, decoder);
      } else if (messageType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          connection,
        );
      }
      // Other message types (auth, query-awareness) are not used by this server.
    } catch (error) {
      this.options.log.warn(`room ${this.roomCode}: dropped malformed message: ${(error as Error).message}`);
    }
  }

  private onSyncMessage(connection: Connection, decoder: decoding.Decoder): void {
    const syncType = decoding.readVarUint(decoder);

    if (syncType === syncProtocol.messageYjsSyncStep1) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncStep1(decoder, encoder, this.doc);
      this.send(connection, encoding.toUint8Array(encoder));
      return;
    }

    // SyncStep2 and incremental updates share the same payload: a Yjs update.
    const update = decoding.readVarUint8Array(decoder);
    if (!connection.unrestricted) {
      const verdict = authorizeUpdate(this.doc, update, connection.allowedKeys);
      if (!verdict.allowed) {
        this.options.log.warn(
          `room ${this.roomCode}: denied update touching [${verdict.deniedKeys.join(", ")}] ` +
            `for roles [${connection.roles.join(", ")}]`,
        );
        this.sendDenied(connection, verdict.deniedKeys);
        // Yjs updates are causally ordered per client: once one is dropped, every later update
        // from that client is stuck as "missing dependencies". The client's document is now
        // irrecoverably out of step, so end the session; it must reconnect with a fresh Y.Doc.
        this.detach(connection, CLOSE_FORBIDDEN_EDIT, "edit outside permitted roles");
        return;
      }
    }
    Y.applyUpdate(this.doc, update, connection);
  }

  private onAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    const connection = origin as Connection | null;
    if (connection && connection === this.connection) {
      for (const id of changes.added) connection.controlledAwarenessIds.add(id);
      for (const id of changes.removed) connection.controlledAwarenessIds.delete(id);
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
        ...changes.added,
        ...changes.updated,
        ...changes.removed,
      ]),
    );
    this.broadcast(encoding.toUint8Array(encoder), origin);
  };

  private onClose(connection: Connection): void {
    if (this.connection !== connection) return;
    this.detach(connection);
  }

  private detach(connection: Connection, closeCode?: number, reason?: string): void {
    if (this.connection === connection) this.connection = null;
    awarenessProtocol.removeAwarenessStates(this.awareness, [...connection.controlledAwarenessIds], null);
    connection.controlledAwarenessIds.clear();
    connection.socket.removeAllListeners("message");
    if (closeCode !== undefined && connection.socket.readyState <= 1) {
      connection.socket.close(closeCode, reason);
    }
    // A disconnect is a natural checkpoint: persist right away rather than waiting for the debounce.
    void this.flush().catch(() => undefined);
  }

  /** Sends to the live connection unless it is the origin of the change. */
  private broadcast(message: Uint8Array, origin: unknown): void {
    if (this.connection && this.connection !== origin) this.send(this.connection, message);
  }

  private send(connection: Connection, message: Uint8Array): void {
    if (connection.socket.readyState !== 1) return;
    connection.socket.send(message, (error) => {
      if (error) this.options.log.warn(`room ${this.roomCode}: send failed: ${error.message}`);
    });
  }

  private sendDenied(connection: Connection, deniedKeys: string[]): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_DENIED);
    encoding.writeVarString(encoder, JSON.stringify({ deniedKeys }));
    this.send(connection, encoding.toUint8Array(encoder));
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer || this.destroyed) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.queueSave();
    }, this.options.snapshotDebounceMs);
    this.saveTimer.unref();
  }

  /** Saves are chained so snapshots are written in order and never overlap. */
  private queueSave(): void {
    this.saving = this.saving.then(async () => {
      if (!this.dirty) return;
      this.dirty = false;
      try {
        await this.store.saveSnapshot(this.roomCode, Y.encodeStateAsUpdate(this.doc));
      } catch (error) {
        // Keep the data marked dirty so the next change (or flush) retries.
        this.dirty = true;
        this.options.log.error(`room ${this.roomCode}: snapshot failed: ${(error as Error).message}`);
      }
    });
  }
}

function encodeUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}
