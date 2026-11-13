import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as Y from "yjs";
import { allowedKeysFor, authorizeUpdate, holdsAllRoles, parseRequestedRoles } from "./roleLocks.js";

/** Runs `mutate` on a clone of `base` and returns just the resulting update. */
function updateFrom(base: Y.Doc, mutate: (doc: Y.Doc) => void): Uint8Array {
  const clone = new Y.Doc();
  Y.applyUpdate(clone, Y.encodeStateAsUpdate(base));
  const before = Y.encodeStateVector(clone);
  mutate(clone);
  return Y.encodeStateAsUpdate(clone, before);
}

describe("parseRequestedRoles", () => {
  it("defaults to all roles", () => {
    assert.deepEqual(parseRequestedRoles(null)?.sort(), ["commander", "comms", "science", "systems"]);
    assert.equal(holdsAllRoles(parseRequestedRoles("")!), true);
  });

  it("parses a subset and rejects unknown roles", () => {
    assert.deepEqual(parseRequestedRoles("science,comms"), ["science", "comms"]);
    assert.equal(parseRequestedRoles("admin"), null);
  });
});

describe("authorizeUpdate", () => {
  const server = new Y.Doc();
  server.getMap("orbit").set("altitudeKm", 500);
  server.getArray("payload").push(["camera"]);

  it("allows writes to owned keys", () => {
    const update = updateFrom(server, (d) => d.getArray("payload").push(["spectrometer"]));
    assert.deepEqual(authorizeUpdate(server, update, allowedKeysFor(["science"])), { allowed: true });
  });

  it("denies writes to keys owned by another role", () => {
    const update = updateFrom(server, (d) => d.getMap("orbit").set("altitudeKm", 800));
    const verdict = authorizeUpdate(server, update, allowedKeysFor(["science"]));
    assert.deepEqual(verdict, { allowed: false, deniedKeys: ["orbit"] });
  });

  it("denies deletions inside owned-by-others types", () => {
    const update = updateFrom(server, (d) => d.getArray("payload").delete(0, 1));
    assert.equal(authorizeUpdate(server, update, allowedKeysFor(["commander"])).allowed, false);
  });

  it("denies nested edits and unknown top-level keys", () => {
    const withNested = new Y.Doc();
    Y.applyUpdate(withNested, Y.encodeStateAsUpdate(server));
    withNested.getMap("spacecraft").set("bus", new Y.Map());
    const nested = updateFrom(withNested, (d) => (d.getMap("spacecraft").get("bus") as Y.Map<number>).set("mass", 5));
    assert.equal(authorizeUpdate(withNested, nested, allowedKeysFor(["science"])).allowed, false);

    const unknown = updateFrom(server, (d) => d.getMap("secrets").set("x", 1));
    assert.deepEqual(authorizeUpdate(server, unknown, allowedKeysFor(["commander"])), {
      allowed: false,
      deniedKeys: ["secrets"],
    });
  });

  it("does not mutate the live document", () => {
    const update = updateFrom(server, (d) => d.getMap("orbit").set("altitudeKm", 999));
    authorizeUpdate(server, update, allowedKeysFor(["commander"]));
    assert.equal(server.getMap("orbit").get("altitudeKm"), 500);
  });
});
