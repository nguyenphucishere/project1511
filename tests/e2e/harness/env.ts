import path from "node:path";
import { fileURLToPath } from "node:url";
import Module from "node:module";

// Determine canonical root paths
const currentDir = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(currentDir, "../../..");
export const APPS_DIR = path.join(ROOT_DIR, "apps");
export const SERVER_DIR = path.join(APPS_DIR, "server");
export const WEB_DIR = path.join(APPS_DIR, "web");
export const PACKAGES_DIR = path.join(ROOT_DIR, "packages");
export const SHARED_SCHEMA_DIR = path.join(PACKAGES_DIR, "shared-schema");

export const WASM_DIR = path.join(WEB_DIR, "public", "wasm");
export const WASM_BG_PATH = path.join(WASM_DIR, "sim_wasm_bg.wasm");
export const WASM_JS_PATH = path.join(WASM_DIR, "sim_wasm.js");

export const PORTS = {
  EPHEMERAL: 0,
  DEFAULT_SERVER: 4000,
  DEFAULT_WEB: 3000,
};

export const TIMEOUTS = {
  SERVER_START: 5000,
  SERVER_SHUTDOWN: 5000,
  WS_CONNECT: 3000,
  WS_MESSAGE: 3000,
  STEP_PROPAGATION: 5000,
  E2E_SUITE: 30000,
};

export const TEST_SERVER_CONFIG = {
  NODE_ENV: "test" as const,
  PORT: 0,
  JWT_SECRET: "test-e2e-secret-key-apollo11-super-secret",
  JWT_TTL_SECONDS: 3600,
  SNAPSHOT_DEBOUNCE_MS: 50,
  ROOM_IDLE_TTL_MS: 100,
  WS_MAX_PAYLOAD_BYTES: 64 * 1024,
};

/**
 * Installs module resolution hooks for the `@/` path alias pointing to `apps/web/src`
 * so that headless Node.js / tsx execution can load web components and stores without bundler.
 */
export function installModulePathAliases(): void {
  const modAny = Module as any;
  if (modAny.__apollo11_resolver_hooked) return;

  const origResolve = modAny._resolveFilename;
  modAny._resolveFilename = function (
    request: string,
    parent: any,
    isMain: boolean,
    options: any
  ) {
    if (request.startsWith("@/")) {
      const target = path.resolve(WEB_DIR, "src", request.slice(2));
      return origResolve.call(this, target, parent, isMain, options);
    }
    return origResolve.call(this, request, parent, isMain, options);
  };
  modAny.__apollo11_resolver_hooked = true;
}

// Automatically install path aliases when env.ts is imported
installModulePathAliases();
