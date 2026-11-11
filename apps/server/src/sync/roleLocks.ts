import * as Y from "yjs";
import { RoleEnum, type Role } from "@space-sim/shared-schema";

/**
 * Top-level Yjs shared types and the role that owns each (spec section 4.3):
 *   Y.Map("orbit")      -> commander
 *   Y.Map("spacecraft") -> systems
 *   Y.Array("payload")  -> science
 *   Y.Map("comms")      -> comms
 */
export const ROLE_OWNED_KEYS: Readonly<Record<Role, readonly string[]>> = {
  commander: ["orbit"],
  systems: ["spacecraft"],
  science: ["payload"],
  comms: ["comms"],
};

export const ALL_ROLES: readonly Role[] = RoleEnum.options;

/** Parses `?role=commander,systems`. Empty/missing means "all roles" (single-user lobby). */
export function parseRequestedRoles(raw: string | null): Role[] | null {
  if (raw === null || raw.trim() === "") return [...ALL_ROLES];
  const roles = new Set<Role>();
  for (const part of raw.split(",")) {
    const parsed = RoleEnum.safeParse(part.trim());
    if (!parsed.success) return null;
    roles.add(parsed.data);
  }
  return [...roles];
}

export function allowedKeysFor(roles: readonly Role[]): Set<string> {
  return new Set(roles.flatMap((role) => ROLE_OWNED_KEYS[role]));
}

export function holdsAllRoles(roles: readonly Role[]): boolean {
  return ALL_ROLES.every((role) => roles.includes(role));
}

export type UpdateVerdict = { allowed: true } | { allowed: false; deniedKeys: string[] };

/**
 * Decides whether `update` only touches top-level types in `allowedKeys`.
 *
 * Yjs offers no rollback, so the update is applied to a scratch copy of the current state
 * and the changed top-level types are inspected. Deletions are covered because deleting an
 * item also registers its parent type as changed.
 */
export function authorizeUpdate(
  doc: Y.Doc,
  update: Uint8Array,
  allowedKeys: ReadonlySet<string>,
): UpdateVerdict {
  const scratch = new Y.Doc();
  try {
    Y.applyUpdate(scratch, Y.encodeStateAsUpdate(doc));

    const touched = new Set<string>();
    scratch.on("afterTransaction", (transaction: Y.Transaction) => {
      for (const type of transaction.changed.keys()) {
        const root = rootKeyOf(scratch, type);
        if (root !== null) touched.add(root);
      }
    });
    Y.applyUpdate(scratch, update);

    const deniedKeys = [...touched].filter((key) => !allowedKeys.has(key));
    return deniedKeys.length === 0 ? { allowed: true } : { allowed: false, deniedKeys };
  } finally {
    scratch.destroy();
  }
}

function rootKeyOf(doc: Y.Doc, type: Y.AbstractType<any>): string | null {
  let current: Y.AbstractType<any> = type;
  while (current._item !== null) {
    current = current._item.parent as Y.AbstractType<any>;
  }
  for (const [name, shared] of doc.share) {
    if (shared === current) return name;
  }
  return null;
}
