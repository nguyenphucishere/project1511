import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertKscWeatherSchema,
  assertLaunchTelemetrySchema,
} from "../harness/assertions.ts";
import {
  startTestServer,
  type TestServerContext,
} from "../harness/serverHarness.ts";

describe("Tier 2 Boundary Suite: Network Degradation, Timeouts & Error Boundaries", () => {
  it("1. validates HTTP 500 from upstream weather API triggers clean offline fallback without server error", async () => {
    const server = await startTestServer({ silent: true });
    const originalFetch = globalThis.fetch;

    // Clear launch data cache to force network call
    server.server.launchData.clearCache();

    // Mock upstream API failure: Open-Meteo returns HTTP 500
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("open-meteo.com")) {
        return new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      // 1a. Weather endpoint fallback
      const weatherRes = await server.fetch("/api/weather/ksc");
      assert.equal(weatherRes.status, 200, "Weather endpoint must return 200 OK despite upstream 500");

      const weatherJson = await weatherRes.json();
      assertKscWeatherSchema(weatherJson);
      assert.equal(
        weatherJson.source,
        "offline_fallback",
        "Source must fall back to 'offline_fallback'"
      );
      assert.equal(weatherJson.status, "GO");
      assert.equal(weatherJson.temperature_c, 29.4);
      assert.equal(weatherJson.pressure_kpa, 101.4);
      assert.equal(weatherJson.wind_speed_kmh, 18.5);

      // 1b. Launch telemetry endpoint fallback
      const telemetryRes = await server.fetch("/api/launch/telemetry");
      assert.equal(telemetryRes.status, 200, "Launch telemetry endpoint must return 200 OK");

      const telemetryJson = await telemetryRes.json();
      assert.equal(telemetryJson.mission_id, "AS-506");
      assert.equal(telemetryJson.source, "offline_fallback");
      assert.equal(telemetryJson.weather.source, "offline_fallback");
      assert.equal(telemetryJson.weather.status, "GO");
      assert.equal(telemetryJson.site.name, "Kennedy Space Center LC-39A");
      assert.equal(telemetryJson.site.lat, 28.5721);
      assert.equal(telemetryJson.lunar_target.name, "Mare Tranquillitatis");
      assert.equal(telemetryJson.lunar_target.lat, 0.67408);
    } finally {
      globalThis.fetch = originalFetch;
      await server.shutdown();
    }
  });

  it("2. validates upstream socket timeout triggers clean offline fallback", async () => {
    const server = await startTestServer({ silent: true });
    const originalFetch = globalThis.fetch;

    server.server.launchData.clearCache();

    // Mock upstream timeout / abort exception
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes("open-meteo.com")) {
        const timeoutError = new Error("The operation was aborted due to timeout");
        timeoutError.name = "TimeoutError";
        throw timeoutError;
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const res = await server.fetch("/api/weather/ksc");
      assert.equal(res.status, 200, "Must return HTTP 200 on upstream network timeout");

      const json = await res.json();
      assertKscWeatherSchema(json);
      assert.equal(json.source, "offline_fallback");
      assert.equal(json.temperature_c, 29.4);
    } finally {
      globalThis.fetch = originalFetch;
      await server.shutdown();
    }
  });

  it("3. validates malformed JSON body returns HTTP 400 Bad Request rather than uncaught error", async () => {
    const server = await startTestServer({ silent: true });

    try {
      const res = await server.fetch("/api/simulation/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{unquoted_key: invalid_json_syntax,,}",
      });

      assert.equal(res.status, 400, "Malformed JSON must return HTTP 400 Bad Request");

      const json = await res.json();
      assert.equal(json.error, "bad_request", "Error response body must identify 'bad_request'");

      // Verify server is still alive and healthy after malformed payload
      const healthRes = await server.fetch("/health");
      assert.equal(healthRes.status, 200);
      const healthJson = await healthRes.json();
      assert.equal(healthJson.status, "ok");
    } finally {
      await server.shutdown();
    }
  });

  it("4. rejects WebSocket upgrade with HTTP 401 Unauthorized when token is invalid or expired", async () => {
    const server = await startTestServer({ silent: true });

    try {
      const statusCode = await new Promise<number>((resolve, reject) => {
        const ws = server.connectWs("/sync/test-security-room?token=invalid.jwt.token");

        ws.on("unexpected-response", (_req, res) => {
          resolve(res.statusCode ?? 0);
        });

        ws.on("open", () => {
          reject(new Error("WebSocket unexpectedly opened with invalid token!"));
        });

        ws.on("error", () => {
          // Error event is expected on upgrade rejection; handled via unexpected-response
        });

        setTimeout(() => {
          reject(new Error("WebSocket connection attempt timed out"));
        }, 3000);
      });

      assert.equal(statusCode, 401, "Expected HTTP 401 Unauthorized status on invalid token upgrade");
    } finally {
      await server.shutdown();
    }
  });

  it("5. validates WebSocket reconnection takeover detaches existing socket with code 4001 without leaking connection", async () => {
    const server = await startTestServer({ silent: true });

    try {
      const { token } = server.issueToken("commander-armstrong");
      const roomCode = "reconnect-room-11";

      // 5a. First client connects
      const ws1 = server.connectWs(`/sync/${roomCode}?token=${token}`);
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => resolve());
        ws1.on("error", (err) => reject(err));
        setTimeout(() => reject(new Error("ws1 connection timeout")), 3000);
      });

      // Verify room has 1 active connection in store/manager
      const room = server.server.rooms.get(roomCode);
      assert.ok(room, "Room must be initialized in RoomManager");
      assert.ok(room.activeConnection, "Room must have active connection attached");
      assert.equal(room.activeConnection?.session.username, "commander-armstrong");

      // Set up close listener on ws1 to detect takeover detachment
      const ws1ClosedPromise = new Promise<{ code: number; reason: string }>((resolve) => {
        ws1.on("close", (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
      });

      // 5b. Second client connects with the same user token (reconnection takeover)
      const ws2 = server.connectWs(`/sync/${roomCode}?token=${token}`);
      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => resolve());
        ws2.on("error", (err) => reject(err));
        setTimeout(() => reject(new Error("ws2 connection timeout")), 3000);
      });

      // ws1 must be detached with code 4001 (CLOSE_REPLACED)
      const ws1Close = await ws1ClosedPromise;
      assert.equal(
        ws1Close.code,
        4001,
        "Original socket must receive WebSocket close code 4001 (CLOSE_REPLACED)"
      );
      assert.ok(
        ws1Close.reason.includes("replaced"),
        `Close reason must indicate replacement, got: '${ws1Close.reason}'`
      );

      // ws2 is now the active connection in the room
      assert.ok(room.activeConnection, "Room must still have active connection (ws2)");

      // 5c. Close ws2 and ensure clean detachment and room idle state
      await new Promise<void>((resolve) => {
        ws2.on("close", () => resolve());
        ws2.close();
      });

      assert.equal(room.activeConnection, null, "Active connection must be null after clean close");
    } finally {
      await server.shutdown();
    }
  });
});
