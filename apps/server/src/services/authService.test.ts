import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthService, GuestLoginSchema } from "./authService.js";

describe("AuthService", () => {
  it("round-trips a guest token", () => {
    const auth = new AuthService("a-long-enough-test-secret", 60);
    const { token, session } = auth.issueGuestToken("Commander Alex");
    assert.deepEqual(auth.validateToken(token), session);
  });

  it("rejects tampered, foreign-secret and malformed tokens", () => {
    const auth = new AuthService("a-long-enough-test-secret", 60);
    const { token } = auth.issueGuestToken("alex");
    const [h, p, s] = token.split(".") as [string, string, string];
    const forged = Buffer.from(JSON.stringify({ sub: "x", name: "evil", iat: 0, exp: 9e12 })).toString("base64url");

    assert.equal(auth.validateToken(`${h}.${forged}.${s}`), null);
    assert.equal(new AuthService("another-secret-another-secret", 60).validateToken(token), null);
    assert.equal(auth.validateToken(`${h}.${p}`), null);
    assert.equal(auth.validateToken(""), null);
    assert.equal(auth.validateToken(null), null);
  });

  it("rejects expired tokens", () => {
    let now = 1_000_000;
    const auth = new AuthService("a-long-enough-test-secret", 60, () => now);
    const { token } = auth.issueGuestToken("alex");
    now += 61_000;
    assert.equal(auth.validateToken(token), null);
  });
});

describe("GuestLoginSchema", () => {
  it("validates callsigns", () => {
    assert.equal(GuestLoginSchema.safeParse({ username: "  alex  " }).data?.username, "alex");
    assert.equal(GuestLoginSchema.safeParse({ username: "" }).success, false);
    assert.equal(GuestLoginSchema.safeParse({ username: "<script>" }).success, false);
    assert.equal(GuestLoginSchema.safeParse({}).success, false);
  });
});
