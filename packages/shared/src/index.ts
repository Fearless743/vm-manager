export type Role = "user" | "admin";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
}

export type VmStatus = "creating" | "running" | "stopped" | "deleted" | "error";

export interface VmRecord {
  id: string;
  ownerId: string;
  ownerUsername: string;
  hostKey: string;
  systemId: string;
  image: string;
  diskSizeGb?: number;
  cpuCores?: number;
  memoryMb?: number;
  bandwidthMbps?: number;
  containerId?: string;
  status: VmStatus;
  sshPassword?: string;
  sshPort?: number;
  openPorts: number[];
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HostNodeRecord {
  hostKey: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemOption {
  id: string;
  name: string;
  image: string;
  description: string;
}

export interface DataStore {
  users: UserRecord[];
  vms: VmRecord[];
  hosts: HostNodeRecord[];
}

export interface AgentRegisterMessage {
  type: "agent.register";
  agentName: string;
  secret: string;
}

export interface AgentHeartbeatMessage {
  type: "agent.heartbeat";
  at: string;
}

export interface HostRuntimeStats {
  cpuCores: number;
  cpuUsagePercent: number;
  memoryTotalMb: number;
  memoryUsedMb: number;
  diskTotalGb: number;
  diskUsedGb: number;
  networkRxMbps: number;
  networkTxMbps: number;
}

export interface AgentStatusMessage {
  type: "agent.status";
  agentName: string;
  at: string;
  stats: HostRuntimeStats;
}

export interface AgentResultMessage {
  type: "agent.result";
  requestId: string;
  ok: boolean;
  vmId: string;
  payload?: Record<string, unknown>;
  error?: string;
}

export interface BackendCommandMessage {
  type: "backend.command";
  requestId: string;
  vmId: string;
  command: "create" | "start" | "stop" | "reboot" | "reinstall" | "resetPassword" | "delete";
  payload?: Record<string, unknown>;
}

export type AgentInboundMessage = AgentRegisterMessage | AgentHeartbeatMessage | AgentStatusMessage | AgentResultMessage;
export type AgentOutboundMessage = BackendCommandMessage;

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: Role;
  };
}
