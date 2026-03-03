import type { Role } from "@vm-manager/shared";
import { verifyPassword } from "../utils/auth.util.js";
import { createUserRecord, deleteUserRecord, findUserById, listUsers, updateUserRecord } from "../data/store.js";
import { HttpError } from "./httpError.js";
import { userView } from "../utils/views.js";
import type { UserView } from "../utils/views.js";

type UpdateUserInput = {
  role?: Role;
  password?: string;
};

const countAdmins = (users: { role: Role }[]): number => users.filter((user) => user.role === "admin").length;

export const listUsersView = async (): Promise<UserView[]> => {
  const users = await listUsers();
  return users.map((user) => userView(user));
};

export const changeCurrentUserPassword = async (userId: string, currentPassword?: string, newPassword?: string): Promise<void> => {
  if (!currentPassword || !newPassword) {
    throw new HttpError(400, "currentPassword and newPassword are required");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new HttpError(400, "Current password is incorrect");
  }

  const updated = await updateUserRecord(user.id, { password: newPassword });
  if (!updated) {
    throw new HttpError(404, "User not found");
  }
};

export const createUser = async (username?: string, password?: string, role?: Role): Promise<UserView> => {
  if (!username || !password) {
    throw new HttpError(400, "username and password are required");
  }

  const finalRole: Role = role === "admin" ? "admin" : "user";
  try {
    const user = await createUserRecord({ username, password, role: finalRole });
    return userView(user);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
};

export const updateUser = async (userId: string, input: UpdateUserInput): Promise<UserView> => {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (input.role && input.role !== user.role && user.role === "admin") {
    const users = await listUsers();
    if (countAdmins(users) <= 1) {
      throw new HttpError(400, "At least one admin must remain");
    }
  }

  const updated = await updateUserRecord(userId, input);
  if (!updated) {
    throw new HttpError(404, "User not found");
  }

  return userView(updated);
};

export const deleteUser = async (userId: string, authUserId?: string): Promise<void> => {
  if (authUserId === userId) {
    throw new HttpError(400, "Cannot delete current login user");
  }

  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (user.role === "admin") {
    const users = await listUsers();
    if (countAdmins(users) <= 1) {
      throw new HttpError(400, "At least one admin must remain");
    }
  }

  const ok = await deleteUserRecord(userId);
  if (!ok) {
    throw new HttpError(404, "User not found");
  }
};
