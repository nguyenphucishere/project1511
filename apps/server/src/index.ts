import path from "node:path";
import dotenv from "dotenv";
import { createAppServer } from "./app.js";
import { loadConfig } from "./config.js";
import { createRoomStore } from "./services/roomStore.js";

// Load package-level .env first, then fallback to monorepo root .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const log = {
  info: (message: string) => console.log(`[info] ${message}`),
  warn: (message: string) => console.warn(`[warn] ${message}`),
  error: (message: string) => console.error(`[error] ${message}`),
};

async function main(): Promise<void> {
  const config = loadConfig();
  const store = await createRoomStore(config.DATABASE_URL, log);
  const app = createAppServer({ config, store, log });

  const port = await app.listen();
  log.info(`HTTP on http://localhost:${port}, WebSocket on ws://localhost:${port}/sync/<roomCode>?token=...`);

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info(`${signal} received, flushing rooms and shutting down`);
    app.shutdown().then(
      () => process.exit(0),
      (error: Error) => {
        log.error(`shutdown failed: ${error.message}`);
        process.exit(1);
      },
    );
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}

main().catch((error: Error) => {
  console.error(`[error] failed to start: ${error.message}`);
  process.exit(1);
});
