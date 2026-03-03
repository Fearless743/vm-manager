import { Router } from "express";
import type { AgentHub } from "../ws/agentHub.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { assignVmOwnerHandler, createVmHandler, listVmsHandler, runVmOperationHandler } from "../controllers/vms.controller.js";

type VmsRouteDeps = {
  hub: AgentHub;
  schedulePurgeUncreatedVms: () => void;
};

export const createVmsRouter = ({ hub, schedulePurgeUncreatedVms }: VmsRouteDeps): Router => {
  const router = Router();
  const deps = { hub, schedulePurgeUncreatedVms };

  router.get("/api/vms", authenticate, listVmsHandler(deps));

  router.post("/api/vms", authenticate, requireRole(["admin"]), createVmHandler(deps));

  router.post("/api/vms/:vmId/owner", authenticate, requireRole(["admin"]), assignVmOwnerHandler);

  router.post("/api/vms/:vmId/operations", authenticate, runVmOperationHandler(deps));

  return router;
};
