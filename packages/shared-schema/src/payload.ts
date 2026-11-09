import { z } from "zod";

export const ComponentCategoryEnum = z.enum([
  "structure",
  "power_generation",
  "power_storage",
  "communications",
  "attitude_control",
  "computing",
  "thermal",
  "science_payload",
]);
export type ComponentCategory = z.infer<typeof ComponentCategoryEnum>;

export const SpacecraftComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: ComponentCategoryEnum,
  massKg: z.number().nonnegative(),
  powerDrawWatts: z.number(), // positive for consumer, negative for producer
  costMillions: z.number().nonnegative(),
  dataRateMbps: z.number().default(0), // positive for producer, negative for downlink
  storageCapacityMb: z.number().default(0),
  batteryCapacityWattHours: z.number().default(0),
  thermalDissipationWatts: z.number().default(0),
  scientificValue: z.number().default(0),
  dimensions: z.object({
    x: z.number().positive(),
    y: z.number().positive(),
    z: z.number().positive(),
  }),
});
export type SpacecraftComponent = z.infer<typeof SpacecraftComponentSchema>;

export const SpacecraftBusSchema = z.object({
  id: z.string(),
  name: z.string(),
  structureMassKg: z.number().positive(),
  maxSlots: z.number().int().positive(),
  installedComponents: z.array(
    z.object({
      slotIndex: z.number().int().nonnegative(),
      componentId: z.string(),
    })
  ),
});
export type SpacecraftBus = z.infer<typeof SpacecraftBusSchema>;
