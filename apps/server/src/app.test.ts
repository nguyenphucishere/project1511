import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createAppServer, type AppServer } from "./app.js";
import { loadConfig } from "./config.js";
import { MemoryRoomStore } from "./services/roomStore.js";
import { CLOSE_FORBIDDEN_EDIT, CLOSE_REPLACED, MESSAGE_SYNC } from "./sync/room.js";

const silent = { info() {}, warn() {}, error() {} };
const config = loadConfig({
  NODE_ENV: "test",
  JWT_SECRET: "integration-test-secret-123",
  SNAPSHOT_DEBOUNCE_MS: "20",
  ROOM_IDLE_TTL_MS: "50",
});

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}


describe("multiplayer sync server", () => {
  const store = new MemoryRoomStore();
  let app: AppServer;
  let port: number;
  const providers: WebsocketProvider[] = [];

  before(async () => {
    app = createAppServer({ config, store, log: silent });
    port = await app.listen(0);
  });

  after(async () => {
    for (const provider of providers) {
      provider.destroy();
      // y-websocket leaves the Awareness check interval running after destroy().
      provider.awareness.destroy();
    }
    await app.shutdown();
  });

  const guest = (username = "tester") => app.auth.issueGuestToken(username);

  function connect(room: string, token: string, role?: string) {
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(`ws://127.0.0.1:${port}/sync`, room, doc, {
      WebSocketPolyfill: WebSocket as never,
      params: { token, ...(role ? { role } : {}) },
      disableBc: true,
    });
    providers.push(provider);
    return { doc, provider };
  }

  const serverDoc = (room: string) => app.rooms.get(room)!.doc;

  it("issues guest tokens over HTTP", async () => {
    const ok = await fetch(`http://127.0.0.1:${port}/auth/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Alex" }),
    });
    assert.equal(ok.status, 201);
    assert.ok(app.auth.validateToken(((await ok.json()) as { token: string }).token));

    const bad = await fetch(`http://127.0.0.1:${port}/auth/guest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    assert.equal(bad.status, 400);
  });

  it("rejects missing tokens, unknown paths and bad roles during the upgrade", async () => {
    const status = (path: string) =>
      new Promise<number>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
        ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
        ws.on("open", () => resolve(101));
        ws.on("error", () => undefined);
      });
    const { token } = guest();
    assert.equal(await status("/sync/room-noauth"), 401);
    assert.equal(await status("/nope"), 404);
    assert.equal(await status(`/sync/room-badrole?token=${token}&role=admin`), 400);
  });

  it("syncs a full-role user's edits to the server document", async () => {
    const { token } = guest();
    const { doc } = connect("room-full", token);
    await waitFor(() => app.rooms.get("room-full")?.hasConnection === true, "connection");

    doc.getMap("orbit").set("altitudeKm", 550);
    doc.getMap("spacecraft").set("name", "Sentinel");
    doc.getArray("payload").push(["camera"]);
    doc.getMap("comms").set("band", "X");

    await waitFor(() => serverDoc("room-full").getMap("comms").get("band") === "X", "server to receive edits");
    assert.equal(serverDoc("room-full").getMap("orbit").get("altitudeKm"), 550);
    assert.deepEqual(serverDoc("room-full").getArray("payload").toArray(), ["camera"]);
  });

  it("blocks writes outside the connection's roles and ends that session", async () => {
    const { token } = guest();
    const bad = new WebSocket(`ws://127.0.0.1:${port}/sync/room-science?token=${token}&role=science`);
    const closed = new Promise<number>((resolve) => bad.on("close", (code) => resolve(code)));
    await new Promise((resolve) => bad.on("open", resolve));

    // Handcraft an update that writes to the commander-owned "orbit" map.
    const rogue = new Y.Doc();
    rogue.getMap("orbit").set("altitudeKm", 9999);
    const frame = encoding.createEncoder();
    encoding.writeVarUint(frame, MESSAGE_SYNC);
    syncProtocol.writeUpdate(frame, Y.encodeStateAsUpdate(rogue));
    bad.send(encoding.toUint8Array(frame));

    assert.equal(await closed, CLOSE_FORBIDDEN_EDIT);
    assert.equal(serverDoc("room-science").getMap("orbit").get("altitudeKm"), undefined);

    // A fresh, well-behaved session with the same roles can still edit what it owns.
    const { doc } = connect("room-science", token, "science");
    await waitFor(() => app.rooms.get("room-science")?.hasConnection === true, "reconnection");
    doc.getArray("payload").push(["spectrometer"]);
    await waitFor(() => serverDoc("room-science").getArray("payload").length === 1, "allowed write");
  });

  it("replaces the old connection when the same user reconnects", async () => {
    const { token } = guest();
    const first = new WebSocket(`ws://127.0.0.1:${port}/sync/room-takeover?token=${token}`);
    const closed = new Promise<number>((resolve) => first.on("close", (code) => resolve(code)));
    await new Promise((resolve) => first.on("open", resolve));

    const { provider } = connect("room-takeover", token);
    assert.equal(await closed, CLOSE_REPLACED);
    await waitFor(() => provider.synced, "second connection to sync");
    assert.equal(app.rooms.get("room-takeover")?.hasConnection, true);
  });

  it("refuses a different user for an existing room", async () => {
    const owner = guest("owner");
    connect("room-owned", owner.token);
    await waitFor(() => app.rooms.get("room-owned")?.hasConnection === true, "owner connection");

    const intruder = guest("intruder");
    const code = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/sync/room-owned?token=${intruder.token}`);
      ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
      ws.on("open", () => resolve(101));
      ws.on("error", () => undefined);
    });
    assert.equal(code, 403);
  });

  it("persists snapshots and restores them after the room is evicted", async () => {
    const { token } = guest();
    const first = connect("room-persist", token);
    await waitFor(() => app.rooms.get("room-persist")?.hasConnection === true, "connection");
    first.doc.getMap("orbit").set("inclinationDeg", 97.4);
    await waitFor(() => serverDoc("room-persist").getMap("orbit").get("inclinationDeg") === 97.4, "edit");

    first.provider.destroy();
    await waitFor(() => app.rooms.get("room-persist") === undefined, "idle eviction");

    const second = connect("room-persist", token);
    await waitFor(() => second.doc.getMap("orbit").get("inclinationDeg") === 97.4, "restored state");
  });
});
