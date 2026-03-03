import type { RequestHandler } from "express";
import type { AgentHub } from "../ws/agentHub.js";
import { toHttpError } from "../services/httpError.js";
import { createHost, listHostsView, rotateHostSecret, updateHost } from "../services/hosts.service.js";

export const listHostsHandler = (hub: AgentHub): RequestHandler => {
  return async (_req, res) => {
    const hosts = await listHostsView(hub);
    res.json(hosts);
  };
};

export const createHostHandler = (hub: AgentHub): RequestHandler => {
  return async (req, res) => {
    try {
      const { name } = req.body as { name?: string };
      const host = await createHost(hub, name);
      res.status(201).json(host);
    } catch (error) {
      const httpError = toHttpError(error, 400, "Failed to create host");
      res.status(httpError.status).json({ error: httpError.message });
    }
  };
};

export const updateHostHandler = (hub: AgentHub): RequestHandler => {
  return async (req, res) => {
    try {
      const { hostKey } = req.params;
      const { name, enabled } = req.body as { name?: string; enabled?: boolean };
      const host = await updateHost(hub, hostKey, { name, enabled });
      res.json(host);
    } catch (error) {
      const httpError = toHttpError(error, 404, "Failed to update host");
      res.status(httpError.status).json({ error: httpError.message });
    }
  };
};

export const rotateHostSecretHandler = (hub: AgentHub): RequestHandler => {
  return async (req, res) => {
    try {
      const { hostKey } = req.params;
      const host = await rotateHostSecret(hub, hostKey);
      res.json(host);
    } catch (error) {
      const httpError = toHttpError(error, 404, "Failed to rotate host secret");
      res.status(httpError.status).json({ error: httpError.message });
    }
  };
};
