import type { AgentHub } from "../ws/agentHub.js";
import { createHostNode, listHostNodes, rotateHostNodeSecret, updateHostNode } from "../data/store.js";
import type { HostView } from "../utils/views.js";
import { HttpError } from "./httpError.js";
import { hostView } from "../utils/views.js";

type UpdateHostInput = {
  name?: string;
  enabled?: boolean;
};

export const listHostsView = async (hub: AgentHub): Promise<HostView[]> => {
  const hosts = await listHostNodes();
  return hosts.map((host) => hostView(host, hub));
};

export const createHost = async (hub: AgentHub, name?: string): Promise<HostView> => {
  if (!name) {
    throw new HttpError(400, "name is required");
  }

  const host = await createHostNode({ name });
  return hostView(host, hub);
};

export const updateHost = async (hub: AgentHub, hostKey: string, input: UpdateHostInput): Promise<HostView> => {
  const host = await updateHostNode(hostKey, input);
  if (!host) {
    throw new HttpError(404, "Host not found");
  }
  if (!input.enabled) {
    hub.disconnectHost(hostKey);
  }
  return hostView(host, hub);
};

export const rotateHostSecret = async (hub: AgentHub, hostKey: string): Promise<HostView> => {
  hub.disconnectHost(hostKey);
  const host = await rotateHostNodeSecret(hostKey);
  if (!host) {
    throw new HttpError(404, "Host not found");
  }
  return hostView(host, hub);
};
