import type { RequestHandler } from "express";
import type { AgentHub } from "../ws/agentHub.js";
import { toHttpError } from "../services/httpError.js";
import { assignVmOwner, createVm, listVmsView, runVmOperation } from "../services/vms.service.js";

type VmsControllerDeps = {
  hub: AgentHub;
  schedulePurgeUncreatedVms: () => void;
};

export const listVmsHandler = ({ schedulePurgeUncreatedVms }: VmsControllerDeps): RequestHandler => {
  return async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rows = await listVmsView(req.auth, schedulePurgeUncreatedVms);
    res.json(rows);
  };
};

export const createVmHandler = ({ hub }: VmsControllerDeps): RequestHandler => {
  return async (req, res) => {
    try {
      const vm = await createVm(hub, req.body as {
        hostKey?: string;
        systemId?: string;
        diskSizeGb?: number;
        cpuCores?: number;
        memoryMb?: number;
        bandwidthMbps?: number;
      });
      res.status(201).json(vm);
    } catch (error) {
      const httpError = toHttpError(error, 400, "Failed to create VM");
      res.status(httpError.status).json({ error: httpError.message });
    }
  };
};

export const assignVmOwnerHandler: RequestHandler = async (req, res) => {
  try {
    const { vmId } = req.params;
    const { ownerUsername } = req.body as { ownerUsername?: string };
    const vm = await assignVmOwner(vmId, ownerUsername);
    res.json(vm);
  } catch (error) {
    const httpError = toHttpError(error, 400, "Failed to assign VM owner");
    res.status(httpError.status).json({ error: httpError.message });
  }
};

export const runVmOperationHandler = ({ hub }: VmsControllerDeps): RequestHandler => {
  return async (req, res) => {
    if (!req.auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const { vmId } = req.params;
      const { action } = req.body as { action?: "start" | "stop" | "reboot" | "reinstall" | "resetPassword" | "delete" };
      const vm = await runVmOperation(hub, req.auth, vmId, action);
      res.json(vm);
    } catch (error) {
      const httpError = toHttpError(error, 400, "Failed to run VM operation");
      res.status(httpError.status).json({ error: httpError.message });
    }
  };
};
