import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Role, UserRecord } from "@vm-manager/shared";
import { config } from "./config.js";
import { getStore } from "./store.js";

const tokenPayload = (user: UserRecord) => ({
  sub: user.id,
  username: user.username,
  role: user.role
});

export const createToken = (user: UserRecord): string => jwt.sign(tokenPayload(user), config.jwtSecret, { expiresIn: "12h" });

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.header("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = auth.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; username: string; role: Role };
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

export const resolveUserByUsername = async (username: string): Promise<UserRecord | undefined> => {
  const store = await getStore();
  return store.users.find((item) => item.username === username);
};
