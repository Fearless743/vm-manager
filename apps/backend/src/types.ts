import type { Role } from "@vm-manager/shared";

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: Role;
}
