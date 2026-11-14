import express from "express";
import type {
  NasaHorizonsService,
  NasaDsnService,
  NasaSpaceWeatherService,
  NasaMdlService,
} from "../services/nasa/index.js";

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
      const data = deps.nasaMdl.getLunarEnvironment();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
