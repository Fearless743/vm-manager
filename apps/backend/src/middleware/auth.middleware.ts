import type { NextFunction, Request, Response } from "express";
import type { Role } from "@vm-manager/shared";
import { verifyAccessToken } from "../utils/auth.util.js";

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.header("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = auth.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      id: payload.sub,
      username: payload.username,
      role: payload.role
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

export const requireRole = (roles: Role[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!roles.includes(req.auth.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
