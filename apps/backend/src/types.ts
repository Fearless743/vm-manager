import type { Role } from "@lxc-manager/shared";

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: Role;
}
