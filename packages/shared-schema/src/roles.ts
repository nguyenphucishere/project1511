import { z } from "zod";

export const RoleEnum = z.enum([
  "commander",
  "systems",
  "science",
  "comms",
]);
export type Role = z.infer<typeof RoleEnum>;

export const RolePermissionsSchema = z.object({
  role: RoleEnum,
  allowedSections: z.array(z.string()),
  canEditOrbit: z.boolean(),
  canEditBus: z.boolean(),
  canEditPayload: z.boolean(),
  canEditComms: z.boolean(),
  canCommitMission: z.boolean(),
});
export type RolePermissions = z.infer<typeof RolePermissionsSchema>;

export const ROLE_DEFINITIONS: Record<Role, RolePermissions> = {
  commander: {
    role: "commander",
    allowedSections: ["mission", "orbit", "launch"],
    canEditOrbit: true,
    canEditBus: false,
    canEditPayload: false,
    canEditComms: false,
    canCommitMission: true,
  },
  systems: {
    role: "systems",
    allowedSections: ["bus", "power", "thermal"],
    canEditOrbit: false,
    canEditBus: true,
    canEditPayload: false,
    canEditComms: false,
    canCommitMission: false,
  },
  science: {
    role: "science",
    allowedSections: ["payload", "instruments", "schedule"],
    canEditOrbit: false,
    canEditBus: false,
    canEditPayload: true,
    canEditComms: false,
    canCommitMission: false,
  },
  comms: {
    role: "comms",
    allowedSections: ["comms", "antennas", "downlink"],
    canEditOrbit: false,
    canEditBus: false,
    canEditPayload: false,
    canEditComms: true,
    canCommitMission: false,
  },
};
