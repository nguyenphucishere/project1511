import express from "express";
import type {
  NasaHorizonsService,
  NasaDsnService,
  NasaSpaceWeatherService,
  NasaMdlService,
} from "../services/nasa/index.js";
import { runEngine } from "../services/simEngine.js";

export interface NasaRouterDeps {
  nasaHorizons: NasaHorizonsService;
  nasaDsn: NasaDsnService;
  nasaSpaceWeather: NasaSpaceWeatherService;
  nasaMdl: NasaMdlService;
}

export function createNasaRouter(deps: NasaRouterDeps): express.Router {
  const router = express.Router();

  // 1. GET /ephemeris
  router.get("/ephemeris", async (req, res, next) => {
    try {
      const forceFallback =
        req.query.force_fallback === "true" || req.query.fallback === "true";
      const epoch = typeof req.query.epoch === "string" ? req.query.epoch : undefined;
      const target = typeof req.query.target === "string" ? req.query.target : undefined;
      const data = await deps.nasaHorizons.getEphemeris({ epoch, target, forceFallback });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // 2. GET /dsn/status
  router.get("/dsn/status", async (req, res, next) => {
    try {
      const forceFallback =
        req.query.force_fallback === "true" || req.query.fallback === "true";
      const data = await deps.nasaDsn.getDsnStatus({ forceFallback });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // 2b. GET /dsn/link: engine link budget (calculate_dsn_telemetry) on the live Earth–Moon distance
  router.get("/dsn/link", async (req, res, next) => {
    try {
      const forceFallback =
        req.query.force_fallback === "true" || req.query.fallback === "true";
      const ephemeris = await deps.nasaHorizons.getEphemeris({ forceFallback });
      const anomaly = Number(req.query.true_anomaly_deg ?? 0);
      const link = await runEngine<{
        rtlt_seconds: number;
        path_loss_db: number;
        received_power_dbm: number;
        is_occulted: boolean;
      }>("calculate_dsn_telemetry", {
        distance_km: ephemeris.distance_km,
        true_anomaly_deg: Number.isFinite(anomaly) ? anomaly : 0,
      });
      res.json({
        ...link,
        distance_km: ephemeris.distance_km,
        epoch: ephemeris.epoch,
        distance_source: ephemeris.source,
        source: "engine",
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. GET /space-weather
  router.get("/space-weather", async (req, res, next) => {
    try {
      const forceFallback =
        req.query.force_fallback === "true" || req.query.fallback === "true";
      const data = await deps.nasaSpaceWeather.getSpaceWeather({ forceFallback });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // 4. GET /mission-design/easep
  router.get("/mission-design/easep", async (_req, res, next) => {
    try {
      const data = deps.nasaMdl.getEasepData();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // 5. GET /lunar-environment
  router.get("/lunar-environment", async (_req, res, next) => {
    try {
      const data = await deps.nasaMdl.getLunarEnvironment();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
