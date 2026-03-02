import { WebSocketServer, type WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { IncomingMessage } from "node:http";
import jwt from "jsonwebtoken";
import type {
  AgentInboundMessage,
  AgentOutboundMessage,
  AgentRegisterMessage,
  AgentStatusMessage,
  BackendCommandMessage,
  HostRuntimeStats,
  VmRecord
} from "@lxc-manager/shared";
import { config } from "./config.js";
import { updateVmRecord } from "./store.js";

type PendingRequest = {
  vmId: string;
  command: BackendCommandMessage["command"];
  ws: WebSocket;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class AgentHub {
  private readonly wss: WebSocketServer;
  private readonly uiWss: WebSocketServer;
  private readonly socketsByHost = new Map<string, WebSocket>();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly resolveHostBySecret: (secret: string) => Promise<string | null>;
  private readonly hostRuntimeByKey = new Map<
    string,
    {
      agentName: string;
      lastHeartbeatAt?: string;
      lastStatusAt?: string;
      stats?: HostRuntimeStats;
    }
  >();

  constructor(server: Server, resolveHostBySecret: (secret: string) => Promise<string | null>) {
    this.wss = new WebSocketServer({ noServer: true });
    this.uiWss = new WebSocketServer({ noServer: true });
    this.resolveHostBySecret = resolveHostBySecret;
    this.wss.on("connection", (ws) => this.onConnection(ws));
    this.uiWss.on("connection", (ws, req) => this.onUiConnection(ws, req));

    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/agent-ws") {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit("connection", ws, req);
        });
        return;
      }
      if (url.pathname === "/ui-ws") {
        this.uiWss.handleUpgrade(req, socket, head, (ws) => {
          this.uiWss.emit("connection", ws, req);
        });
        return;
      }
      socket.destroy();
    });
  }

  private uiAuthed(req: IncomingMessage): boolean {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        return false;
      }
      const payload = jwt.verify(token, config.jwtSecret) as { role?: string };
      return payload.role === "admin";
    } catch {
      return false;
    }
  }

  private onUiConnection(ws: WebSocket, req: IncomingMessage): void {
    if (!this.uiAuthed(req)) {
      ws.close(4003, "unauthorized");
      return;
    }
    this.sendUiSnapshot(ws);
  }

  private sendUiSnapshot(ws: WebSocket): void {
    const hosts = [...this.hostRuntimeByKey.entries()].map(([hostKey, runtime]) => ({
      hostKey,
      online: this.getOnlineHosts().includes(hostKey),
      ...runtime
    }));
    ws.send(JSON.stringify({ type: "host.snapshot", hosts }));
  }

  private broadcastUiHost(hostKey: string): void {
    const runtime = this.hostRuntimeByKey.get(hostKey) ?? { agentName: "unknown" };
    const payload = {
      type: "host.update",
      host: {
        hostKey,
        online: this.getOnlineHosts().includes(hostKey),
        ...runtime
      }
    };
    for (const client of this.uiWss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(payload));
      }
    }
  }

  private parseMessage(raw: WebSocket.RawData): AgentInboundMessage | null {
    try {
      return JSON.parse(raw.toString()) as AgentInboundMessage;
    } catch {
      return null;
    }
  }

  private onConnection(ws: WebSocket): void {
    let hostKey: string | null = null;

    ws.on("message", async (raw) => {
      const message = this.parseMessage(raw);
      if (!message) {
        return;
      }
      if (message.type === "agent.register") {
          const register = message as AgentRegisterMessage;
          const resolvedHostKey = await this.resolveHostBySecret(register.secret);
          if (!resolvedHostKey) {
            ws.close(4002, "hostKey not allowed");
            return;
          }
          hostKey = resolvedHostKey;
          this.socketsByHost.set(resolvedHostKey, ws);
          this.hostRuntimeByKey.set(resolvedHostKey, {
            ...(this.hostRuntimeByKey.get(resolvedHostKey) ?? {}),
            agentName: register.agentName,
            lastHeartbeatAt: new Date().toISOString()
          });
          this.broadcastUiHost(resolvedHostKey);
          return;
      }

      if (message.type === "agent.heartbeat") {
        if (!hostKey) {
          return;
        }
        const runtime = this.hostRuntimeByKey.get(hostKey) ?? { agentName: "unknown" };
        this.hostRuntimeByKey.set(hostKey, {
          ...runtime,
          lastHeartbeatAt: message.at
        });
        this.broadcastUiHost(hostKey);
        return;
      }

      if (message.type === "agent.status") {
        if (!hostKey) {
          return;
        }
        const status = message as AgentStatusMessage;
        const runtime = this.hostRuntimeByKey.get(hostKey) ?? { agentName: status.agentName };
        this.hostRuntimeByKey.set(hostKey, {
          ...runtime,
          agentName: status.agentName,
          lastStatusAt: status.at,
          stats: status.stats
        });
        this.broadcastUiHost(hostKey);
        return;
      }

      if (message.type === "agent.result") {
        if (!hostKey) {
          return;
        }
        const pending = this.pending.get(message.requestId);
        if (!pending) {
          return;
        }
        if (pending.ws !== ws) {
          return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(message.requestId);
        if (message.ok) {
          const payload = message.payload ?? {};
          const patch: Partial<VmRecord> = {};
          if (pending.command === "create") {
            patch.status = "running";
            patch.containerId = typeof payload.containerId === "string" ? payload.containerId : undefined;
            patch.sshPassword = typeof payload.sshPassword === "string" ? payload.sshPassword : undefined;
            patch.sshPort = typeof payload.sshPort === "number" ? payload.sshPort : undefined;
            patch.diskSizeGb = typeof payload.diskSizeGb === "number" ? payload.diskSizeGb : undefined;
            patch.cpuCores = typeof payload.cpuCores === "number" ? payload.cpuCores : undefined;
            patch.memoryMb = typeof payload.memoryMb === "number" ? payload.memoryMb : undefined;
            patch.bandwidthMbps = typeof payload.bandwidthMbps === "number" ? payload.bandwidthMbps : undefined;
            patch.openPorts = Array.isArray(payload.openPorts)
              ? payload.openPorts.filter((item): item is number => typeof item === "number")
              : [];
          }
          if (pending.command === "start") {
            patch.status = "running";
          }
          if (pending.command === "stop") {
            patch.status = "stopped";
          }
          if (pending.command === "reboot") {
            patch.status = "running";
          }
          if (pending.command === "reinstall") {
            patch.status = "running";
            patch.containerId = typeof payload.containerId === "string" ? payload.containerId : patch.containerId;
            patch.sshPassword = typeof payload.sshPassword === "string" ? payload.sshPassword : patch.sshPassword;
            patch.sshPort = typeof payload.sshPort === "number" ? payload.sshPort : patch.sshPort;
            patch.diskSizeGb = typeof payload.diskSizeGb === "number" ? payload.diskSizeGb : patch.diskSizeGb;
            patch.cpuCores = typeof payload.cpuCores === "number" ? payload.cpuCores : patch.cpuCores;
            patch.memoryMb = typeof payload.memoryMb === "number" ? payload.memoryMb : patch.memoryMb;
            patch.bandwidthMbps = typeof payload.bandwidthMbps === "number" ? payload.bandwidthMbps : patch.bandwidthMbps;
            patch.openPorts = Array.isArray(payload.openPorts)
              ? payload.openPorts.filter((item): item is number => typeof item === "number")
              : patch.openPorts ?? [];
          }
          if (pending.command === "resetPassword") {
            patch.sshPassword = typeof payload.sshPassword === "string" ? payload.sshPassword : patch.sshPassword;
          }
          if (pending.command === "delete") {
            patch.status = "deleted";
          }
          await updateVmRecord(pending.vmId, patch);
          pending.resolve();
          return;
        }

        await updateVmRecord(pending.vmId, { status: "error", lastError: message.error ?? "unknown agent error" });
        pending.reject(new Error(message.error ?? "Agent command failed"));
      }
    });

    ws.on("close", () => {
      if (hostKey && this.socketsByHost.get(hostKey) === ws) {
        this.socketsByHost.delete(hostKey);
        this.broadcastUiHost(hostKey);
      }
    });
  }

  public getOnlineHosts(): string[] {
    return [...this.socketsByHost.keys()];
  }

  public getHostRuntime(hostKey: string): {
    agentName?: string;
    lastHeartbeatAt?: string;
    lastStatusAt?: string;
    stats?: HostRuntimeStats;
  } | null {
    return this.hostRuntimeByKey.get(hostKey) ?? null;
  }

  public disconnectHost(hostKey: string): void {
    const ws = this.socketsByHost.get(hostKey);
    if (ws && ws.readyState === ws.OPEN) {
      ws.close(4004, "node secret rotated");
    }
    this.socketsByHost.delete(hostKey);
    this.hostRuntimeByKey.delete(hostKey);
    this.broadcastUiHost(hostKey);
  }

  public async sendCommand(input: {
    hostKey: string;
    vmId: string;
    command: BackendCommandMessage["command"];
    payload?: Record<string, unknown>;
  }): Promise<void> {
    const ws = this.socketsByHost.get(input.hostKey);
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new Error(`Host ${input.hostKey} is offline`);
    }

    const requestId = randomUUID();
    const message: AgentOutboundMessage = {
      type: "backend.command",
      requestId,
      vmId: input.vmId,
      command: input.command,
      payload: input.payload
    };

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        void updateVmRecord(input.vmId, { status: "error", lastError: `Command timeout: ${input.command}` });
        reject(new Error(`Command timeout: ${input.command}`));
      }, 45_000);

      this.pending.set(requestId, {
        vmId: input.vmId,
        command: input.command,
        ws,
        resolve,
        reject,
        timeout
      });

      ws.send(JSON.stringify(message), (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pending.delete(requestId);
          reject(error);
        }
      });
    });
  }
}
