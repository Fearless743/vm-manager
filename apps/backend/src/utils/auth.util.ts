import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Role, UserRecord } from "@vm-manager/shared";
import { config } from "../config.js";
import { getStore } from "../data/store.js";

const tokenPayload = (user: UserRecord) => ({
  sub: user.id,
  username: user.username,
  role: user.role
});

export const createToken = (user: UserRecord): string => jwt.sign(tokenPayload(user), config.jwtSecret, { expiresIn: "12h" });

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export const resolveUserByUsername = async (username: string): Promise<UserRecord | undefined> => {
  const store = await getStore();
  return store.users.find((item) => item.username === username);
};

export const verifyAccessToken = (token: string): { sub: string; username: string; role: Role } => {
  return jwt.verify(token, config.jwtSecret) as { sub: string; username: string; role: Role };
};
