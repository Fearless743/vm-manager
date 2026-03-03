import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { getSiteConfigHandler, updateSiteConfigHandler } from "../controllers/site-config.controller.js";

export const createSiteConfigRouter = (): Router => {
  const router = Router();

  router.get("/api/site-configs/current", getSiteConfigHandler);

  router.post("/api/site-configs/current", authenticate, requireRole(["admin"]), updateSiteConfigHandler);

  return router;
};
