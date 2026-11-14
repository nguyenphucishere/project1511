import express from "express";
import type { LaunchSiteService } from "../services/launchSiteService.js";

/** `/api/launch/sites` and `/api/launch/sites/:id/windows` (launch windows with real weather). */
export function createLaunchSiteRouter(sites: LaunchSiteService): express.Router {
  const router = express.Router();

  router.get("/sites", (_req, res) => {
    res.json({ sites: sites.getSites() });
  });

  router.get("/sites/:id/windows", async (req, res, next) => {
    try {
      const forceFallback = req.query.force_fallback === "true" || req.query.fallback === "true";
      const data = await sites.getWindows(req.params.id, { forceFallback });
      if (!data) {
        res.status(404).json({ error: "unknown_site", sites: sites.getSites().map((s) => s.id) });
        return;
      }
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
