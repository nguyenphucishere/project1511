import { nasaApiBase } from "./nasa.adapter";
import type {
  DsnLinkData,
  EngineApollo11Data,
  EngineStatusData,
  MissionDesignBudgetInput,
  MissionDesignBudgetResult,
} from "./nasa.types";

/**
 * Client for the server-side simulation engine (`/api/engine/*`, `/api/nasa/dsn/link`).
 * Every call resolves to null when the server or engine is unavailable, so callers keep their
 * in-browser WASM / TypeScript result.
 */

const TIMEOUT_MS = 6000;

async function request<T>(path: string, init?: RequestInit, baseUrl?: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${nasaApiBase(baseUrl)}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as T) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchEngineStatus = (baseUrl?: string) => request<EngineStatusData>("/api/engine/status", undefined, baseUrl);

export const fetchEngineApollo11 = (baseUrl?: string) =>
  request<EngineApollo11Data>("/api/engine/apollo11", undefined, baseUrl);

export const fetchDsnLink = (baseUrl?: string) => request<DsnLinkData>("/api/nasa/dsn/link", undefined, baseUrl);

/** POST a JSON body to one engine calculation, e.g. `postEngine("mission-design/budget", design)`. */
export function postEngine<T>(path: string, body: unknown, baseUrl?: string): Promise<T | null> {
  return request<T>(
    `/api/engine/${path.replace(/^\//, "")}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) },
    baseUrl,
  );
}

/** Mission design budget on the server engine, falling back to `local` (browser WASM / mirror). */
export function serverFirstBudget(
  local: (d: MissionDesignBudgetInput) => Promise<MissionDesignBudgetResult>,
  baseUrl?: string,
) {
  return async (design: MissionDesignBudgetInput): Promise<MissionDesignBudgetResult> =>
    (await postEngine<MissionDesignBudgetResult>("mission-design/budget", design, baseUrl)) ?? local(design);
}
