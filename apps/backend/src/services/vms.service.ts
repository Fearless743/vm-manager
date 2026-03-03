import type { AgentHub } from "../ws/agentHub.js";
import type { AuthenticatedUser } from "../types.js";
import { resolveUserByUsername } from "../utils/auth.util.js";
import { systemOptions } from "../constants/systemOptions.js";
import {
  createVmRecord,
  deleteVmRecord,
  findHostNodeByKey,
  findVmById,
  listVmRecords,
  updateVmRecord
} from "../data/store.js";
import { HttpError } from "./httpError.js";
import { vmView } from "../utils/views.js";

export type VmAction = "start" | "stop" | "reboot" | "reinstall" | "resetPassword" | "delete";

const allowedUserActions: VmAction[] = ["start", "stop", "reboot", "reinstall", "resetPassword"];
const allActions: VmAction[] = ["start", "stop", "reboot", "reinstall", "resetPassword", "delete"];

type CreateVmInput = {
  hostKey?: string;
  systemId?: string;
  diskSizeGb?: number;
  cpuCores?: number;
  memoryMb?: number;
  bandwidthMbps?: number;
};

export const listVmsView = async (auth: AuthenticatedUser, schedulePurgeUncreatedVms: () => void): Promise<Record<string, unknown>[]> => {
  schedulePurgeUncreatedVms();
  const ownerId = auth.role === "admin" ? undefined : auth.id;
  const rows = await listVmRecords(ownerId);
  return rows.map(vmView);
};

export const createVm = async (hub: AgentHub, input: CreateVmInput): Promise<Record<string, unknown>> => {
  const { hostKey, systemId, diskSizeGb, cpuCores, memoryMb, bandwidthMbps } = input;
  if (!hostKey || !systemId) {
    throw new HttpError(400, "hostKey and systemId are required");
  }

  const host = await findHostNodeByKey(hostKey);
  if (!host || !host.enabled) {
    throw new HttpError(400, "Host is not available");
  }

  const system = systemOptions.find((item) => item.id === systemId);
  if (!system) {
    throw new HttpError(400, "Invalid systemId");
  }

  const vm = await createVmRecord({
    hostKey,
    systemId,
    image: system.image,
    diskSizeGb: typeof diskSizeGb === "number" && diskSizeGb > 0 ? Math.floor(diskSizeGb) : undefined,
    cpuCores: typeof cpuCores === "number" && cpuCores > 0 ? Math.floor(cpuCores) : undefined,
    memoryMb: typeof memoryMb === "number" && memoryMb > 0 ? Math.floor(memoryMb) : undefined,
    bandwidthMbps: typeof bandwidthMbps === "number" && bandwidthMbps > 0 ? Math.floor(bandwidthMbps) : undefined
  });

  try {
    await hub.sendCommand({
      hostKey,
      vmId: vm.id,
      command: "create",
      payload: {
        image: vm.image,
        diskSizeGb: vm.diskSizeGb,
        cpuCores: vm.cpuCores,
        memoryMb: vm.memoryMb,
        bandwidthMbps: vm.bandwidthMbps
      }
    });
    const updated = await findVmById(vm.id);
    return vmView(updated ?? vm);
  } catch (error) {
    await deleteVmRecord(vm.id);
    throw new HttpError(502, (error as Error).message);
  }
};

export const assignVmOwner = async (vmId: string, ownerUsername?: string): Promise<Record<string, unknown>> => {
  if (!ownerUsername) {
    throw new HttpError(400, "ownerUsername is required");
  }
  const vm = await findVmById(vmId);
  if (!vm) {
    throw new HttpError(404, "VM not found");
  }
  const owner = await resolveUserByUsername(ownerUsername);
  if (!owner) {
    throw new HttpError(404, "Owner not found");
  }

  const updated = await updateVmRecord(vm.id, { ownerId: owner.id, ownerUsername: owner.username });
  if (!updated) {
    throw new HttpError(500, "Unable to update VM owner");
  }
  return vmView(updated);
};

export const runVmOperation = async (
  hub: AgentHub,
  auth: AuthenticatedUser,
  vmId: string,
  action?: VmAction
): Promise<Record<string, unknown>> => {
  if (!action) {
    throw new HttpError(400, "action is required");
  }
  if (!allActions.includes(action)) {
    throw new HttpError(400, "invalid action");
  }

  const vm = await findVmById(vmId);
  if (!vm) {
    throw new HttpError(404, "VM not found");
  }

  if (auth.role === "user") {
    if (vm.ownerId !== auth.id) {
      throw new HttpError(403, "You can only control your own VMs");
    }
    if (!allowedUserActions.includes(action)) {
      throw new HttpError(403, "Action not allowed for user");
    }
  }

  if (auth.role !== "admin" && action === "delete") {
    throw new HttpError(403, "Only admin can delete VM");
  }

  try {
    await hub.sendCommand({
      hostKey: vm.hostKey,
      vmId: vm.id,
      command: action,
      payload: {
        containerId: vm.containerId,
        image: vm.image,
        diskSizeGb: vm.diskSizeGb,
        cpuCores: vm.cpuCores,
        memoryMb: vm.memoryMb,
        bandwidthMbps: vm.bandwidthMbps,
        sshPort: vm.sshPort,
        openPorts: vm.openPorts
      }
    });
    const updated = await findVmById(vm.id);
    return vmView(updated ?? vm);
  } catch (error) {
    throw new HttpError(502, (error as Error).message);
  }
};
