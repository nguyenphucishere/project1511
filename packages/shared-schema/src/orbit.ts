import { z } from "zod";

export const OrbitTypeEnum = z.enum([
  "LEO", // Low Earth Orbit
  "SSO", // Sun-Synchronous Orbit
  "MEO", // Medium Earth Orbit
  "GEO", // Geostationary Orbit
  "HEO", // Highly Elliptical Orbit
]);
export type OrbitType = z.infer<typeof OrbitTypeEnum>;

export const KeplerianElementsSchema = z.object({
  semiMajorAxisKm: z.number().positive(),
  eccentricity: z.number().min(0).max(1),
  inclinationDeg: z.number().min(0).max(180),
  raanDeg: z.number().min(0).max(360), // Right Ascension of Ascending Node
  argPeriapsisDeg: z.number().min(0).max(360),
  trueAnomalyDeg: z.number().min(0).max(360),
});
export type KeplerianElements = z.infer<typeof KeplerianElementsSchema>;

export const LaunchVehicleTypeEnum = z.enum([
  "small_lift",
  "medium_lift",
  "heavy_lift",
  "super_heavy",
]);
export type LaunchVehicleType = z.infer<typeof LaunchVehicleTypeEnum>;

export const LaunchVehicleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: LaunchVehicleTypeEnum,
  maxPayloadMassLeoKg: z.number().positive(),
  maxPayloadMassSsoKg: z.number().positive(),
  maxPayloadMassGeoKg: z.number().positive(),
  fairingDiameterMeters: z.number().positive(),
  fairingHeightMeters: z.number().positive(),
  costMillions: z.number().nonnegative(),
  reliabilityRating: z.number().min(0).max(1),
});
export type LaunchVehicle = z.infer<typeof LaunchVehicleSchema>;
