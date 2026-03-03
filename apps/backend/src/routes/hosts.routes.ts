import { Router } from "express";
import type { AgentHub } from "../ws/agentHub.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { createHostHandler, listHostsHandler, rotateHostSecretHandler, updateHostHandler } from "../controllers/hosts.controller.js";

export const createHostsRouter = (hub: AgentHub): Router => {
  const router = Router();

  router.get("/api/hosts", authenticate, requireRole(["admin"]), listHostsHandler(hub));

  router.post("/api/hosts", authenticate, requireRole(["admin"]), createHostHandler(hub));

  router.post("/api/hosts/:hostKey", authenticate, requireRole(["admin"]), updateHostHandler(hub));

  router.post("/api/hosts/:hostKey/secret-rotations", authenticate, requireRole(["admin"]), rotateHostSecretHandler(hub));

  return router;
};
