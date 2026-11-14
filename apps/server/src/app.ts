import cors from "cors";
import express from "express";
import http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import type { Config } from "./config.js";
import { MemoryPresenceStore, type PresenceStore } from "./handlers/presence.js";
import { AuthService, GuestLoginSchema } from "./services/authService.js";
import { LaunchDataService } from "./services/launchDataService.js";
import {
  NasaHorizonsService,
  NasaDsnService,
  NasaSpaceWeatherService,
  NasaMdlService,
} from "./services/nasa/index.js";
import { createNasaRouter } from "./routes/nasaRoutes.js";
import type { RoomStore } from "./services/roomStore.js";
import { parseRequestedRoles } from "./sync/roleLocks.js";
import type { RoomLogger } from "./sync/room.js";
import { RoomManager, RoomOwnershipError } from "./sync/roomManager.js";
import { SimulationValidatorBridge } from "./validator/simBridge.js";

const SYNC_PATH = /^\/sync\/([A-Za-z0-9_-]{3,64})$/;

export interface ServerDeps {
  config: Config;
  store: RoomStore;
  log: RoomLogger;
  presence?: PresenceStore;
  launchData?: LaunchDataService;
  simBridge?: SimulationValidatorBridge;
  nasaHorizons?: NasaHorizonsService;
  nasaDsn?: NasaDsnService;
  nasaSpaceWeather?: NasaSpaceWeatherService;
  nasaMdl?: NasaMdlService;
}

export interface AppServer {
  server: http.Server;
  rooms: RoomManager;
  auth: AuthService;
  launchData: LaunchDataService;
  simBridge: SimulationValidatorBridge;
  nasaHorizons: NasaHorizonsService;
  nasaDsn: NasaDsnService;
  nasaSpaceWeather: NasaSpaceWeatherService;
  nasaMdl: NasaMdlService;
  listen(port?: number): Promise<number>;
  shutdown(): Promise<void>;
}

export function createAppServer(deps: ServerDeps): AppServer {
  const { config, store, log } = deps;
  const presence = deps.presence ?? new MemoryPresenceStore();
  const auth = new AuthService(config.JWT_SECRET, config.JWT_TTL_SECONDS);
  const launchData = deps.launchData ?? new LaunchDataService();
  const simBridge = deps.simBridge ?? new SimulationValidatorBridge();
  const nasaHorizons = deps.nasaHorizons ?? new NasaHorizonsService();
  const nasaDsn = deps.nasaDsn ?? new NasaDsnService();
  const nasaSpaceWeather = deps.nasaSpaceWeather ?? new NasaSpaceWeatherService();
  const nasaMdl = deps.nasaMdl ?? new NasaMdlService();
  const rooms = new RoomManager(store, {
    snapshotDebounceMs: config.SNAPSHOT_DEBOUNCE_MS,
    idleTtlMs: config.ROOM_IDLE_TTL_MS,
    log,
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", rooms: rooms.size });
  });

  app.post("/auth/guest", (req, res) => {
    const parsed = GuestLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_username", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { token, session } = auth.issueGuestToken(parsed.data.username);
    res.status(201).json({ token, userId: session.userId, username: session.username });
  });

  app.get("/api/weather/ksc", async (req, res, next) => {
    try {
      const forceFallback =
        req.query.force_fallback === "true" || req.query.fallback === "true";
      const weather = await launchData.getKscWeather({ forceFallback });
      res.json(weather);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/launch/telemetry", async (req, res, next) => {
    try {
      const forceFallback =
        req.query.force_fallback === "true" || req.query.fallback === "true";
      const telemetry = await launchData.getLaunchTelemetry({ forceFallback });
      res.json(telemetry);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/simulation/validate", async (req, res, next) => {
    try {
      const result = await simBridge.validateSimulation(req.body ?? {});
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.use(
    "/api/nasa",
    createNasaRouter({
      nasaHorizons,
      nasaDsn,
      nasaSpaceWeather,
      nasaMdl,
    })
  );

  // Malformed JSON bodies and similar: report as 400 rather than leaking a stack trace.
  app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({ error: error.status && error.status < 500 ? "bad_request" : "internal_error" });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.WS_MAX_PAYLOAD_BYTES });

  server.on("upgrade", (req, socket, head) => {
    void handleUpgrade(req, socket, head).catch((error: Error) => {
      log.error(`upgrade failed: ${error.message}`);
      reject(socket, 500, "Internal Server Error");
    });
  });

  async function handleUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const match = SYNC_PATH.exec(url.pathname);
    if (!match) return reject(socket, 404, "Not Found");
    const roomCode = match[1] as string;

    const session = auth.validateToken(url.searchParams.get("token"));
    if (!session) return reject(socket, 401, "Unauthorized");

    const roles = parseRequestedRoles(url.searchParams.get("role"));
    if (!roles) return reject(socket, 400, "Bad Request");

    let room;
    try {
      room = await rooms.acquire(roomCode, session);
    } catch (error) {
      if (error instanceof RoomOwnershipError) return reject(socket, 403, "Forbidden");
      throw error;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      room.attach(ws, session, roles);
      presence.join(roomCode, {
        userId: session.userId,
        username: session.username,
        roles,
        connectedAt: Date.now(),
      });
      log.info(`room ${roomCode}: ${session.username} connected as [${roles.join(", ")}]`);

      ws.on("close", () => {
        // A takeover closes the old socket after the new one attached; only the last one out cleans up.
        if (room.hasConnection) return;
        presence.leave(roomCode, session.userId);
        rooms.scheduleIdleEviction(room);
        log.info(`room ${roomCode}: ${session.username} disconnected`);
      });
    });
  }

  return {
    server,
    rooms,
    auth,
    launchData,
    simBridge,
    nasaHorizons,
    nasaDsn,
    nasaSpaceWeather,
    nasaMdl,
    listen: (port = config.PORT) =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, () => {
          const address = server.address();
          resolve(typeof address === "object" && address ? address.port : port);
        });
      }),
    async shutdown() {
      // Rooms close their own sockets (code 1001) and flush pending snapshots first.
      await rooms.shutdown();
      // Upgraded sockets are not tracked by closeAllConnections(); drop any that did not finish
      // the close handshake so server.close() cannot hang.
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await store.close();
    },
  };
}

function reject(socket: Duplex, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}
