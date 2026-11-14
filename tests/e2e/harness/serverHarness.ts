import { WebSocket } from "ws";
import { createAppServer, type AppServer, type ServerDeps } from "../../../apps/server/src/app.ts";
import type { Config } from "../../../apps/server/src/config.ts";
import { MemoryPresenceStore } from "../../../apps/server/src/handlers/presence.ts";
import { MemoryRoomStore } from "../../../apps/server/src/services/roomStore.ts";
import { TEST_SERVER_CONFIG, TIMEOUTS } from "./env.ts";

export interface TestServerContext {
  server: AppServer;
  port: number;
  baseUrl: string;
  wsUrl: string;
  store: MemoryRoomStore;
  presence: MemoryPresenceStore;
  issueToken(username?: string): { token: string; userId: string; username: string; session: { userId: string; username: string } };
  fetch(pathname: string, init?: RequestInit): Promise<Response>;
  connectWs(pathAndQuery: string): WebSocket;
  shutdown(): Promise<void>;
}

export interface StartServerOptions {
  config?: Partial<Config>;
  store?: MemoryRoomStore;
  presence?: MemoryPresenceStore;
  silent?: boolean;
}

/**
 * Starts an ephemeral in-process Express + WebSocket server on port 0.
 * Completely isolated, zero external network dependency, clean shutdown.
 */
export async function startTestServer(options: StartServerOptions = {}): Promise<TestServerContext> {
  const store = options.store ?? new MemoryRoomStore();
  const presence = options.presence ?? new MemoryPresenceStore();

  const config: Config = {
    ...TEST_SERVER_CONFIG,
    ...(options.config ?? {}),
  } as Config;

  const logger = options.silent === false
    ? {
        info: (msg: string) => console.log(`[TEST-SERVER INFO] ${msg}`),
        warn: (msg: string) => console.warn(`[TEST-SERVER WARN] ${msg}`),
        error: (msg: string) => console.error(`[TEST-SERVER ERROR] ${msg}`),
      }
    : {
        info: () => {},
        warn: () => {},
        error: () => {},
      };

  const appServer = createAppServer({
    config,
    store,
    presence,
    log: logger,
  });

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Server startup timed out after ${TIMEOUTS.SERVER_START}ms`));
    }, TIMEOUTS.SERVER_START);

    appServer.listen(0).then(
      (boundPort) => {
        clearTimeout(timer);
        resolve(boundPort);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}`;

  const activeWebSockets = new Set<WebSocket>();

  const context: TestServerContext = {
    server: appServer,
    port,
    baseUrl,
    wsUrl,
    store,
    presence,
    issueToken(username = "commander-armstrong") {
      const { token, session } = appServer.auth.issueGuestToken(username);
      return { token, userId: session.userId, username: session.username, session };
    },
    async fetch(pathname: string, init?: RequestInit) {
      const url = pathname.startsWith("http") ? pathname : `${baseUrl}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
      return globalThis.fetch(url, init);
    },
    connectWs(pathAndQuery: string) {
      const target = pathAndQuery.startsWith("ws")
        ? pathAndQuery
        : `${wsUrl}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
      const ws = new WebSocket(target);
      activeWebSockets.add(ws);
      ws.on("close", () => activeWebSockets.delete(ws));
      return ws;
    },
    async shutdown() {
      // Terminate any tracked test sockets first to avoid hanging shutdown
      for (const ws of activeWebSockets) {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
      }
      activeWebSockets.clear();

      await appServer.shutdown();
    },
  };

  return context;
}
