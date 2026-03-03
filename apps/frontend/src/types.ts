import type { Role } from "@vm-manager/shared";

export type Session = {
  token: string;
  user: {
    id: string;
    username: string;
    role: Role;
  };
};

export type VmAction = "start" | "stop" | "reboot" | "reinstall" | "resetPassword" | "delete";
export type PageKey = "overview" | "hosts" | "vms" | "users" | "settings" | "my-vms";
export type ModalKind =
  | "createHost"
  | "createVm"
  | "createUser"
  | "editUser"
  | "showHostSecret"
  | "showAgentInstallCommand"
  | "changeOwnPassword"
  | null;

export type SiteConfig = {
  siteTitle: string;
  loginSubtitle: string;
  sidebarTitle: string;
};

export type VmRow = {
  id: string;
  ownerUsername: string;
  hostKey: string;
  systemId: string;
  image: string;
  diskSizeGb?: number;
  cpuCores?: number;
  memoryMb?: number;
  bandwidthMbps?: number;
  status: string;
  containerId?: string;
  sshPassword?: string;
  sshPort?: number;
  openPorts: number[];
  lastError?: string;
};

export type HostRow = {
  hostKey: string;
  name: string;
  enabled: boolean;
  online: boolean;
  agentName?: string;
  lastHeartbeatAt?: string;
  lastStatusAt?: string;
  stats?: {
    cpuCores: number;
    cpuUsagePercent: number;
    memoryTotalMb: number;
    memoryUsedMb: number;
    diskTotalGb: number;
    diskUsedGb: number;
    networkRxMbps: number;
    networkTxMbps: number;
  };
};

export type SystemRow = {
  id: string;
  name: string;
  image: string;
  description: string;
};

export type UserRow = {
  id: string;
  username: string;
  role: Role;
};

export type MenuItem = {
  key: PageKey;
  label: string;
};

export type DashboardViewStore = {
  vms: VmRow[];
  hosts: HostRow[];
  users: UserRow[];
};
