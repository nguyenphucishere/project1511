import express from "express";
import {
  APOLLO_11_ENGINE_INPUTS,
  ENGINE_CALCULATIONS,
  engineLunarConstants,
  engineRejected,
  engineStatus,
  runEngine,
  type EngineCalculation,
} from "../services/simEngine.js";

/**
 * `/api/engine/*`: every calculation of the Rust simulation engine (crates/sim-core via
 * sim-wasm), run on the server. POST a JSON body to compute; GET `.../apollo11` returns the
 * engine's answer for the flown Apollo 11 mission. Results carry `source: "engine"`.
 */

const PATHS: Record<EngineCalculation, string> = {
  validate_launch: "launch/validate",
  run_descent_step: "descent/step",
  calculate_score: "score",
  calculate_landing_radar: "landing-radar",
  evaluate_mission_design_budget: "mission-design/budget",
  calculate_dsn_telemetry: "dsn/telemetry",
};

export function createEngineRouter(): express.Router {
  const router = express.Router();

  router.get("/status", async (_req, res, next) => {
    try {
      const status = await engineStatus();
      res.status(status.loaded ? 200 : 503).json({
        ...status,
        endpoints: Object.fromEntries(
          ENGINE_CALCULATIONS.map((n) => [n, `/api/engine/${PATHS[n]}`]),
        ),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/lunar-environment", async (_req, res, next) => {
    try {
      const c = await engineLunarConstants();
      if (!c) {
        res.status(503).json({ error: "Simulation engine unavailable (get_lunar_environment_constants)" });
        return;
      }
      res.json({ ...c, source: "engine" });
    } catch (err) {
      next(err);
    }
  });

  /** Every calculation run on the Apollo 11 baseline, in one call (used by the UI). */
  router.get("/apollo11", async (_req, res, next) => {
    try {
      const entries = await Promise.all(
        ENGINE_CALCULATIONS.map(async (n) => [
          n,
          { input: APOLLO_11_ENGINE_INPUTS[n], result: await runEngine(n, APOLLO_11_ENGINE_INPUTS[n]) },
        ]),
      );
      res.json({ ...Object.fromEntries(entries), source: "engine" });
    } catch (err) {
      next(err);
    }
  });

  for (const name of ENGINE_CALCULATIONS) {
    const path = `/${PATHS[name]}`;

    router.get(`${path}/apollo11`, async (_req, res, next) => {
      try {
        const result = await runEngine(name, APOLLO_11_ENGINE_INPUTS[name]);
        res.json({ ...result, input: APOLLO_11_ENGINE_INPUTS[name], source: "engine" });
      } catch (err) {
        next(err);
      }
    });

    router.post(path, async (req, res, next) => {
      try {
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
          res.status(400).json({ error: "Request body must be a JSON object" });
          return;
        }
        const result = await runEngine(name, req.body);
        const rejected = engineRejected(result);
        res.status(rejected ? 400 : 200).json({ ...result, source: "engine" });
      } catch (err) {
        next(err);
      }
    });
  }

  return router;
}
