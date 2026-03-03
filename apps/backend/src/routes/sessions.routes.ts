import { Router } from "express";
import { createSessionHandler } from "../controllers/sessions.controller.js";

export const createSessionsRouter = (): Router => {
  const router = Router();

  router.post("/api/sessions", createSessionHandler);

  return router;
};
