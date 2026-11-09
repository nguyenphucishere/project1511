import * as Y from "yjs";
import type { Role } from "@space-sim/shared-schema";

export class SyncDocumentManager {
  getOrCreateDocument(_roomCode: string): Y.Doc {
    throw new Error("TODO: Implement getOrCreateDocument");
  }

  canRoleEditField(_role: Role, _field: string): boolean {
    throw new Error("TODO: Implement canRoleEditField");
  }
}
