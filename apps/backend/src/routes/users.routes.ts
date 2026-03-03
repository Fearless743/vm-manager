import { Router } from "express";
import {
  createUserHandler,
  deleteUserHandler,
  getCurrentUserHandler,
  listUsersHandler,
  updateCurrentUserPasswordHandler,
  updateUserHandler
} from "../controllers/users.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";

export const createUsersRouter = (): Router => {
  const router = Router();

  router.get("/api/users/me", authenticate, getCurrentUserHandler);

  router.post("/api/users/me/password", authenticate, updateCurrentUserPasswordHandler);

  router.get("/api/users", authenticate, requireRole(["admin"]), listUsersHandler);

  router.post("/api/users", authenticate, requireRole(["admin"]), createUserHandler);

  router.post("/api/users/:userId", authenticate, requireRole(["admin"]), updateUserHandler);

  router.post("/api/users/:userId/deletions", authenticate, requireRole(["admin"]), deleteUserHandler);

  return router;
};
