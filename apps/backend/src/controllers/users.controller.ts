import type { RequestHandler } from "express";
import type { Role } from "@vm-manager/shared";
import { toHttpError } from "../services/httpError.js";
import { changeCurrentUserPassword, createUser, deleteUser, listUsersView, updateUser } from "../services/users.service.js";

export const getCurrentUserHandler: RequestHandler = (req, res) => {
  res.json(req.auth);
};

export const updateCurrentUserPasswordHandler: RequestHandler = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    await changeCurrentUserPassword(req.auth!.id, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (error) {
    const httpError = toHttpError(error, 400, "Failed to update password");
    res.status(httpError.status).json({ error: httpError.message });
  }
};

export const listUsersHandler: RequestHandler = async (_req, res) => {
  const users = await listUsersView();
  res.json(users);
};

export const createUserHandler: RequestHandler = async (req, res) => {
  try {
    const { username, password, role } = req.body as { username?: string; password?: string; role?: Role };
    const user = await createUser(username, password, role);
    res.status(201).json(user);
  } catch (error) {
    const httpError = toHttpError(error, 400, "Failed to create user");
    res.status(httpError.status).json({ error: httpError.message });
  }
};

export const updateUserHandler: RequestHandler = async (req, res) => {
  const { userId } = req.params;
  const { role, password } = req.body as { role?: Role; password?: string };
  try {
    const updated = await updateUser(userId, { role, password });
    res.json(updated);
  } catch (error) {
    const httpError = toHttpError(error, 400, "Failed to update user");
    res.status(httpError.status).json({ error: httpError.message });
  }
};

export const deleteUserHandler: RequestHandler = async (req, res) => {
  const { userId } = req.params;
  try {
    await deleteUser(userId, req.auth?.id);
    res.json({ ok: true });
  } catch (error) {
    const httpError = toHttpError(error, 400, "Failed to delete user");
    res.status(httpError.status).json({ error: httpError.message });
  }
};
