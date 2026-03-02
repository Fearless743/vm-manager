import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import type { HostNodeRecord, Role, SystemOption, UserRecord, VmRecord } from "@lxc-manager/shared";
import { config } from "./config.js";
import { authenticate, createToken, requireRole, resolveUserByUsername, verifyPassword } from "./auth.js";
import { AgentHub } from "./agentHub.js";
import {
  createHostNode,
  createUserRecord,
  deleteVmRecord,
  deleteUserRecord,
  createVmRecord,
  findHostNodeByKey,
  findUserById,
  findVmById,
  getStore,
  listHostNodes,
  listUsers,
  purgeUncreatedVms,
  rotateHostNodeSecret,
  updateUserRecord,
  updateHostNode,
  updateVmRecord
} from "./store.js";

type VmAction = "start" | "stop" | "reboot" | "reinstall" | "resetPassword" | "delete";

const allowedUserActions: VmAction[] = ["start", "stop", "reboot", "reinstall", "resetPassword"];
const allActions: VmAction[] = ["start", "stop", "reboot", "reinstall", "resetPassword", "delete"];

const systemOptions: SystemOption[] = [
  {
    id: "ubuntu-24-ssh",
    name: "Ubuntu 24.04 + SSH",
    image: "lscr.io/linuxserver/openssh-server:latest",
    description: "General Linux environment with SSH access"
  },
  {
    id: "debian-ssh",
    name: "Debian + SSH",
    image: "lscr.io/linuxserver/openssh-server:latest",
    description: "Debian-compatible SSH environment"
  },
  {
    id: "alpine-ssh",
    name: "Alpine + SSH",
    image: "lscr.io/linuxserver/openssh-server:latest",
    description: "Lightweight Linux environment with SSH"
  }
];

const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

const server = createServer(app);
const hub = new AgentHub(server, async (secret) => {
  const host = await findHostNodeByKey(secret);
  if (!host?.enabled) {
    return null;
  }
  return host.hostKey;
});

void purgeUncreatedVms();

const vmView = (vm: VmRecord): Record<string, unknown> => ({
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

const hostView = (host: HostNodeRecord): Record<string, unknown> => ({
  ...(hub.getHostRuntime(host.hostKey) ?? {}),
  hostKey: host.hostKey,
  name: host.name,
  enabled: host.enabled,
  online: hub.getOnlineHosts().includes(host.hostKey),
  createdAt: host.createdAt,
  updatedAt: host.updatedAt
});

const userView = (user: UserRecord): Record<string, unknown> => ({
  id: user.id,
  username: user.username,
  role: user.role
});

const countAdmins = (users: UserRecord[]): number => users.filter((item) => item.role === "admin").length;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, onlineHosts: hub.getOnlineHosts() });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  const user = await resolveUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  res.json({
    token: createToken(user),
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

app.get("/api/me", authenticate, (req, res) => {
  res.json(req.auth);
});

app.get("/api/vms", authenticate, async (req, res) => {
  await purgeUncreatedVms();
  const store = await getStore();
  const rows = req.auth?.role === "admin" ? store.vms : store.vms.filter((vm) => vm.ownerId === req.auth?.id);
  res.json(rows.map(vmView));
});

app.get("/api/users", authenticate, requireRole(["admin"]), async (_req, res) => {
  const users = await listUsers();
  res.json(users.map(userView));
});

app.post("/api/users", authenticate, requireRole(["admin"]), async (req, res) => {
  const { username, password, role } = req.body as { username?: string; password?: string; role?: Role };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  const finalRole: Role = role === "admin" ? "admin" : "user";
  try {
    const user = await createUserRecord({ username, password, role: finalRole });
    res.status(201).json(userView(user));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.patch("/api/users/:userId", authenticate, requireRole(["admin"]), async (req, res) => {
  const { userId } = req.params;
  const { password, role } = req.body as { password?: string; role?: Role };
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (role && role !== user.role && user.role === "admin") {
    const users = await listUsers();
    if (countAdmins(users) <= 1) {
      res.status(400).json({ error: "At least one admin must remain" });
      return;
    }
  }

  const updated = await updateUserRecord(userId, {
    password,
    role
  });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(userView(updated));
});

app.delete("/api/users/:userId", authenticate, requireRole(["admin"]), async (req, res) => {
  const { userId } = req.params;
  if (req.auth?.id === userId) {
    res.status(400).json({ error: "Cannot delete current login user" });
    return;
  }
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.role === "admin") {
    const users = await listUsers();
    if (countAdmins(users) <= 1) {
      res.status(400).json({ error: "At least one admin must remain" });
      return;
    }
  }
  const ok = await deleteUserRecord(userId);
  if (!ok) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/systems", authenticate, (_req, res) => {
  res.json(systemOptions);
});

app.get("/api/hosts", authenticate, requireRole(["admin"]), async (_req, res) => {
  const hosts = await listHostNodes();
  res.json(hosts.map(hostView));
});

app.post("/api/hosts", authenticate, requireRole(["admin"]), async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const host = await createHostNode({ name });
  res.status(201).json(hostView(host));
});

app.patch("/api/hosts/:hostKey", authenticate, requireRole(["admin"]), async (req, res) => {
  const { hostKey } = req.params;
  const { name, enabled } = req.body as { name?: string; enabled?: boolean };
  const host = await updateHostNode(hostKey, { name, enabled });
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }
  res.json(hostView(host));
});

app.post("/api/hosts/:hostKey/reset-secret", authenticate, requireRole(["admin"]), async (req, res) => {
  const { hostKey } = req.params;
  hub.disconnectHost(hostKey);
  const host = await rotateHostNodeSecret(hostKey);
  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }
  res.json(hostView(host));
});

app.post("/api/vms", authenticate, requireRole(["admin"]), async (req, res) => {
  const { hostKey, systemId, diskSizeGb, cpuCores, memoryMb, bandwidthMbps } = req.body as {
    hostKey?: string;
    systemId?: string;
    diskSizeGb?: number;
    cpuCores?: number;
    memoryMb?: number;
    bandwidthMbps?: number;
  };
  if (!hostKey || !systemId) {
    res.status(400).json({ error: "hostKey and systemId are required" });
    return;
  }
  const host = await findHostNodeByKey(hostKey);
  if (!host || !host.enabled) {
    res.status(400).json({ error: "Host is not available" });
    return;
  }
  const system = systemOptions.find((item) => item.id === systemId);
  if (!system) {
    res.status(400).json({ error: "Invalid systemId" });
    return;
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
    res.status(201).json(updated ? vmView(updated) : vmView(vm));
  } catch (error) {
    await deleteVmRecord(vm.id);
    res.status(502).json({ error: (error as Error).message });
  }
});

app.post("/api/vms/:vmId/assign", authenticate, requireRole(["admin"]), async (req, res) => {
  const { vmId } = req.params;
  const { ownerUsername } = req.body as { ownerUsername?: string };
  if (!ownerUsername) {
    res.status(400).json({ error: "ownerUsername is required" });
    return;
  }
  const vm = await findVmById(vmId);
  if (!vm) {
    res.status(404).json({ error: "VM not found" });
    return;
  }
  const owner = await resolveUserByUsername(ownerUsername);
  if (!owner) {
    res.status(404).json({ error: "Owner not found" });
    return;
  }
  const updated = await updateVmRecord(vm.id, { ownerId: owner.id, ownerUsername: owner.username });
  if (!updated) {
    res.status(500).json({ error: "Unable to update VM owner" });
    return;
  }
  res.json(vmView(updated));
});

app.post("/api/vms/:vmId/action", authenticate, async (req, res) => {
  const { vmId } = req.params;
  const { action } = req.body as { action?: VmAction };
  if (!action) {
    res.status(400).json({ error: "action is required" });
    return;
  }
  if (!allActions.includes(action)) {
    res.status(400).json({ error: "invalid action" });
    return;
  }
  const vm = await findVmById(vmId);
  if (!vm) {
    res.status(404).json({ error: "VM not found" });
    return;
  }

  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.auth.role === "user") {
    if (vm.ownerId !== req.auth.id) {
      res.status(403).json({ error: "You can only control your own VMs" });
      return;
    }
    if (!allowedUserActions.includes(action)) {
      res.status(403).json({ error: "Action not allowed for user" });
      return;
    }
  }

  if (req.auth.role !== "admin" && action === "delete") {
    res.status(403).json({ error: "Only admin can delete VM" });
    return;
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
    res.json(updated ? vmView(updated) : vmView(vm));
  } catch (error) {
    res.status(502).json({ error: (error as Error).message });
  }
});

server.listen(config.port, () => {
  console.log(`backend running on http://localhost:${config.port}`);
});
