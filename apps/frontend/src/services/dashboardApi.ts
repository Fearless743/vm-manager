import { resolveHttpBase } from "../lib/http";
import type { HostRow, Session, SiteConfig, SystemRow, UserRow, VmAction, VmRow } from "../types";

type Headers = Record<string, string>;

const api = (path: string): string => `${resolveHttpBase()}${path}`;

export const fetchSiteConfig = async (): Promise<SiteConfig> => {
  const response = await fetch(api("/api/site-configs/current"));
  if (!response.ok) {
    throw new Error(`加载网站配置失败: ${response.status}`);
  }
  return (await response.json()) as SiteConfig;
};

export const fetchVms = async (headers: Headers): Promise<VmRow[]> => {
  const response = await fetch(api("/api/vms"), { headers });
  if (!response.ok) {
    throw new Error(`加载虚拟机失败: ${response.status}`);
  }
  return (await response.json()) as VmRow[];
};

export const fetchSystemOptions = async (headers: Headers): Promise<SystemRow[]> => {
  const response = await fetch(api("/api/system-options"), { headers });
  if (!response.ok) {
    throw new Error(`加载系统选项失败: ${response.status}`);
  }
  return (await response.json()) as SystemRow[];
};

export const fetchHosts = async (headers: Headers): Promise<HostRow[]> => {
  const response = await fetch(api("/api/hosts"), { headers });
  if (!response.ok) {
    throw new Error(`加载宿主机失败: ${response.status}`);
  }
  return (await response.json()) as HostRow[];
};

export const fetchUsers = async (headers: Headers): Promise<UserRow[]> => {
  const response = await fetch(api("/api/users"), { headers });
  if (!response.ok) {
    throw new Error(`加载用户列表失败: ${response.status}`);
  }
  return (await response.json()) as UserRow[];
};

export const createSession = async (username: string, password: string): Promise<Session | null> => {
  const response = await fetch(api("/api/sessions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as Session;
};

export const createVmRequest = async (
  headers: Headers,
  body: {
    hostKey: string;
    systemId: string;
    diskSizeGb?: number;
    cpuCores?: number;
    memoryMb?: number;
    bandwidthMbps?: number;
  },
): Promise<Response> => {
  return fetch(api("/api/vms"), { method: "POST", headers, body: JSON.stringify(body) });
};

export const vmOperationRequest = async (headers: Headers, vmId: string, action: VmAction): Promise<Response> => {
  return fetch(api(`/api/vms/${vmId}/operations`), {
    method: "POST",
    headers,
    body: JSON.stringify({ action }),
  });
};

export const assignVmOwnerRequest = async (headers: Headers, vmId: string, ownerUsername: string): Promise<Response> => {
  return fetch(api(`/api/vms/${vmId}/owner`), {
    method: "POST",
    headers,
    body: JSON.stringify({ ownerUsername }),
  });
};

export const createHostRequest = async (headers: Headers, name: string): Promise<Response> => {
  return fetch(api("/api/hosts"), { method: "POST", headers, body: JSON.stringify({ name }) });
};

export const updateHostEnabledRequest = async (headers: Headers, hostKey: string, enabled: boolean): Promise<Response> => {
  return fetch(api(`/api/hosts/${hostKey}`), {
    method: "POST",
    headers,
    body: JSON.stringify({ enabled }),
  });
};

export const rotateHostSecretRequest = async (headers: Headers, hostKey: string): Promise<Response> => {
  return fetch(api(`/api/hosts/${hostKey}/secret-rotations`), { method: "POST", headers });
};

export const saveSiteConfigRequest = async (
  headers: Headers,
  body: { siteTitle: string; loginSubtitle: string; sidebarTitle: string },
): Promise<Response> => {
  return fetch(api("/api/site-configs/current"), { method: "POST", headers, body: JSON.stringify(body) });
};

export const changeMyPasswordRequest = async (
  headers: Headers,
  body: { currentPassword: string; newPassword: string },
): Promise<Response> => {
  return fetch(api("/api/users/me/password"), { method: "POST", headers, body: JSON.stringify(body) });
};

export const createUserRequest = async (
  headers: Headers,
  body: { username: string; password: string; role: UserRow["role"] },
): Promise<Response> => {
  return fetch(api("/api/users"), { method: "POST", headers, body: JSON.stringify(body) });
};

export const updateUserRequest = async (
  headers: Headers,
  userId: string,
  body: { role: UserRow["role"]; password?: string },
): Promise<Response> => {
  return fetch(api(`/api/users/${userId}`), { method: "POST", headers, body: JSON.stringify(body) });
};

export const deleteUserRequest = async (headers: Headers, userId: string): Promise<Response> => {
  return fetch(api(`/api/users/${userId}/deletions`), { method: "POST", headers });
};
