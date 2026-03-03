import { createToken, resolveUserByUsername, verifyPassword } from "../utils/auth.util.js";
import { HttpError } from "./httpError.js";

type CreateSessionInput = {
  username?: string;
  password?: string;
};

export const createSession = async ({ username, password }: CreateSessionInput): Promise<Record<string, unknown>> => {
  if (!username || !password) {
    throw new HttpError(400, "username and password are required");
  }

  const user = await resolveUserByUsername(username);
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new HttpError(401, "Invalid credentials");
  }

  return {
    token: createToken(user),
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  };
};
