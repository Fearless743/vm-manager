import { Router } from "express";
import type { AgentHub } from "../ws/agentHub.js";
import { getHealthHandler } from "../controllers/health.controller.js";

export const createHealthRouter = (hub: AgentHub): Router => {
  const router = Router();

  router.get("/api/health", getHealthHandler(hub));

  return router;
};
