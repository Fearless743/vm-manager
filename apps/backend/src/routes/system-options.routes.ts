import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { listSystemOptionsHandler } from "../controllers/system-options.controller.js";

export const createSystemOptionsRouter = (): Router => {
  const router = Router();

  router.get("/api/system-options", authenticate, listSystemOptionsHandler);

  return router;
};
