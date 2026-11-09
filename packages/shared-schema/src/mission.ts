import { z } from "zod";
import { KeplerianElementsSchema, OrbitTypeEnum } from "./orbit.js";
import { SpacecraftBusSchema } from "./payload.js";

export const DifficultyLevelEnum = z.enum(["beginner", "intermediate", "advanced", "sandbox"]);
export type DifficultyLevel = z.infer<typeof DifficultyLevelEnum>;

export const MissionConstraintsSchema = z.object({
  maxBudgetMillions: z.number().positive(),
  maxTotalMassKg: z.number().positive(),
  minOperationalLifetimeDays: z.number().positive(),
  minScientificReturnScore: z.number().nonnegative(),
});
export type MissionConstraints = z.infer<typeof MissionConstraintsSchema>;

export const MissionDesignSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  objective: z.string(),
  difficulty: DifficultyLevelEnum,
  constraints: MissionConstraintsSchema,
  orbitType: OrbitTypeEnum,
  keplerianElements: KeplerianElementsSchema,
  launchVehicleId: z.string(),
  bus: SpacecraftBusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MissionDesign = z.infer<typeof MissionDesignSchema>;

export const FailureTraceStepSchema = z.object({
  timestampSec: z.number(),
  subsystem: z.string(),
  anomaly: z.string(),
  consequence: z.string(),
});
export type FailureTraceStep = z.infer<typeof FailureTraceStepSchema>;

export const SimulationResultSchema = z.object({
  isSuccess: z.boolean(),
  finalScore: z.number(),
  scientificScore: z.number(),
  budgetCostMillions: z.number(),
  riskFactor: z.number(),
  operationalLifetimeDaysAchieved: z.number(),
  failureTrace: z.array(FailureTraceStepSchema),
  resourceTimeSeries: z.record(z.string(), z.array(z.number())),
});
export type SimulationResult = z.infer<typeof SimulationResultSchema>;
