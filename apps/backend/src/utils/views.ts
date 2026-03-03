import type { HostNodeRecord, HostRuntimeStats, Role, VmRecord } from "@vm-manager/shared";
import type { AgentHub } from "../ws/agentHub.js";

export type UserView = {
  id: string;
  username: string;
  role: Role;
};

export type HostView = {
  hostKey: string;
  name: string;
  enabled: boolean;
  online: boolean;
  stats?: HostRuntimeStats;
  agentName?: string;
  heartbeatAt?: string;
  createdAt: string;
  updatedAt: string;
};

export const userView = (user: UserView): UserView => ({
  id: user.id,
  username: user.username,
  role: user.role
});

export const hostView = (host: HostNodeRecord, hub: AgentHub): HostView => {
  const runtime = hub.getHostRuntime(host.hostKey);
  return {
    hostKey: host.hostKey,
    name: host.name,
    enabled: host.enabled,
    online: hub.getOnlineHosts().includes(host.hostKey),
    stats: runtime?.stats as HostRuntimeStats | undefined,
    agentName: runtime?.agentName,
    heartbeatAt: runtime?.lastHeartbeatAt,
    createdAt: host.createdAt,
    updatedAt: host.updatedAt
  };
};

export const vmView = (vm: VmRecord): Record<string, unknown> => ({
  id: vm.id,
  ownerId: vm.ownerId,
  ownerUsername: vm.ownerUsername,
  hostKey: vm.hostKey,
  systemId: vm.systemId,
  image: vm.image,
  diskSizeGb: vm.diskSizeGb,
  cpuCores: vm.cpuCores,
  memoryMb: vm.memoryMb,
  bandwidthMbps: vm.bandwidthMbps,
  status: vm.status,
  containerId: vm.containerId,
  sshPassword: vm.sshPassword,
  sshPort: vm.sshPort,
  openPorts: vm.openPorts,
  lastError: vm.lastError,
  createdAt: vm.createdAt,
  updatedAt: vm.updatedAt
});
