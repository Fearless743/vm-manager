import type { RequestHandler } from "express";
import { createSession } from "../services/sessions.service.js";
import { toHttpError } from "../services/httpError.js";

export const createSessionHandler: RequestHandler = async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    const session = await createSession({ username, password });
    res.json(session);
  } catch (error) {
    const httpError = toHttpError(error, 401, "Invalid credentials");
    res.status(httpError.status).json({ error: httpError.message });
  }
};
