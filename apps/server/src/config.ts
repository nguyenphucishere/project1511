import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Postgres connection. When unset the server persists to memory only. */
  DATABASE_URL: z.string().optional(),
  /** HMAC secret for guest JWTs. Required in production. */
  JWT_SECRET: z.string().min(16).optional(),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24),
  /** Quiet period after the last document change before a snapshot is written. */
  SNAPSHOT_DEBOUNCE_MS: z.coerce.number().int().nonnegative().default(2000),
  /** How long a room stays loaded after its last connection closes. */
  ROOM_IDLE_TTL_MS: z.coerce.number().int().nonnegative().default(60_000),
  /** Largest accepted WebSocket frame (Yjs updates included). */
  WS_MAX_PAYLOAD_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
});

export type Config = Omit<z.infer<typeof EnvSchema>, "JWT_SECRET"> & { JWT_SECRET: string };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  if (parsed.NODE_ENV === "production" && !parsed.JWT_SECRET) {
    throw new Error("JWT_SECRET must be set in production");
  }
  // A throwaway secret in dev/test means tokens are invalidated on restart.
  const JWT_SECRET = parsed.JWT_SECRET ?? "dev-only-insecure-secret-change-me";
  return { ...parsed, JWT_SECRET };
}
