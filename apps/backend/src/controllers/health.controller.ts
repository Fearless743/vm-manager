import type { RequestHandler } from "express";
import type { AgentHub } from "../ws/agentHub.js";

export const getHealthHandler = (hub: AgentHub): RequestHandler => {
  return (_req, res) => {
    res.json({ ok: true, onlineHosts: hub.getOnlineHosts() });
  };
};
