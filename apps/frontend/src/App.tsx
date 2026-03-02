import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "@vm-manager/shared";
import { HostsRoute } from "./routes/HostsRoute";
import { LoginRoute } from "./routes/LoginRoute";
import { MyVmsRoute } from "./routes/MyVmsRoute";
import { OverviewRoute } from "./routes/OverviewRoute";
import { SettingsRoute } from "./routes/SettingsRoute";
import { UsersRoute } from "./routes/UsersRoute";
import { VmsRoute } from "./routes/VmsRoute";
import type { HostRow, MenuItem, ModalKind, PageKey, Session, SiteConfig, SystemRow, UserRow, VmAction, VmRow } from "./types";

const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "").trim();
const resolveHttpBase = (): string => {
  if (API_BASE) {
    return API_BASE;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
};
const resolveWsBase = (): string => {
  const base = resolveHttpBase();
  return base.startsWith("https://") ? base.replace("https://", "wss://") : base.replace("http://", "ws://");
};

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`;

const buildAgentInstallCommand = (hostKey: string): string => {
  const backendWsUrl = `${resolveWsBase()}/agent-ws`;
  return [
    "curl -fsSL https://raw.githubusercontent.com/Fearless743/vm-manager/main/scripts/install-agent.sh | sudo bash -s --",
    "  --version latest",
    `  --backend-ws-url ${shellQuote(backendWsUrl)}`,
    `  --agent-shared-secret ${shellQuote(hostKey)}`
  ].join(" \\\n");
};

const loadSession = (): Session | null => {
  const raw = localStorage.getItem("lxc.session");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

const saveSession = (session: Session | null): void => {
  if (!session) {
    localStorage.removeItem("lxc.session");
    return;
  }
  localStorage.setItem("lxc.session", JSON.stringify(session));
};

const adminMenu: MenuItem[] = [
  { key: "overview", label: "总览" },
  { key: "hosts", label: "宿主机节点" },
  { key: "vms", label: "虚拟机" },
  { key: "users", label: "用户管理" },
  { key: "settings", label: "网站配置" }
];

const userMenu: MenuItem[] = [{ key: "my-vms", label: "我的虚拟机" }];

const pageToPath: Record<PageKey, string> = {
  overview: "/overview",
  hosts: "/hosts",
  vms: "/vms",
  users: "/users",
  settings: "/settings",
  "my-vms": "/my-vms"
};

const pathToPage: Record<string, PageKey> = {
  "/overview": "overview",
  "/hosts": "hosts",
  "/vms": "vms",
  "/users": "users",
  "/settings": "settings",
  "/my-vms": "my-vms"
};

const defaultSiteConfig: SiteConfig = {
  siteTitle: "LXC 管理平台",
  loginSubtitle: "请使用管理员或普通用户登录。",
  sidebarTitle: "LXC 管理平台"
};

const statusLabel = (status: string): string => {
  if (status === "running") return "运行中";
  if (status === "stopped") return "已关机";
  if (status === "creating") return "创建中";
  if (status === "deleted") return "已删除";
  if (status === "error") return "异常";
  return status;
};

const actionButtonClass = (action: VmAction): string => {
  if (action === "delete") {
    return "btn btn-danger";
  }
  if (action === "reinstall") {
    return "btn btn-warning";
  }
  if (action === "resetPassword") {
    return "btn btn-secondary";
  }
  if (action === "stop") {
    return "btn btn-muted";
  }
  return "btn btn-primary";
};

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [vms, setVms] = useState<VmRow[]>([]);
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [assignTargets, setAssignTargets] = useState<Record<string, string>>({});
  const [userRoleTargets, setUserRoleTargets] = useState<Record<string, Role>>({});
  const [userPasswordTargets, setUserPasswordTargets] = useState<Record<string, string>>({});
  const [selectedHostKey, setSelectedHostKey] = useState("");
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [newHostName, setNewHostName] = useState("新宿主机");
  const [newUserName, setNewUserName] = useState("user2");
  const [newUserPassword, setNewUserPassword] = useState("user123");
  const [newUserRole, setNewUserRole] = useState<Role>("user");
  const [diskSizeGbInput, setDiskSizeGbInput] = useState("");
  const [cpuCoresInput, setCpuCoresInput] = useState("");
  const [memoryMbInput, setMemoryMbInput] = useState("");
  const [bandwidthMbpsInput, setBandwidthMbpsInput] = useState("");
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [rotatedHostSecret, setRotatedHostSecret] = useState<string>("");
  const [agentInstallCommand, setAgentInstallCommand] = useState<string>("");
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [siteTitleInput, setSiteTitleInput] = useState(defaultSiteConfig.siteTitle);
  const [loginSubtitleInput, setLoginSubtitleInput] = useState(defaultSiteConfig.loginSubtitle);
  const [error, setError] = useState("");
  const [modalKind, setModalKind] = useState<ModalKind>(null);

  const authHeaders = useMemo(
    () =>
      session
        ? {
            Authorization: `Bearer ${session.token}`,
            "Content-Type": "application/json"
          }
        : undefined,
    [session]
  );

  const menu = session?.user.role === "admin" ? adminMenu : userMenu;
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const routePage = pathToPage[normalizedPath];
  const fallbackPage: PageKey = session?.user.role === "admin" ? "overview" : "my-vms";
  const page = routePage ?? fallbackPage;

  const refreshSiteConfig = async () => {
    const response = await fetch(`${resolveHttpBase()}/api/site-config`);
    if (!response.ok) {
      throw new Error(`加载网站配置失败: ${response.status}`);
    }
    const config = (await response.json()) as SiteConfig;
    setSiteConfig(config);
    setSiteTitleInput(config.siteTitle);
    setLoginSubtitleInput(config.loginSubtitle);
  };

  const refreshVms = async () => {
    if (!authHeaders) {
      return;
    }
    const response = await fetch(`${resolveHttpBase()}/api/vms`, { headers: authHeaders });
    if (!response.ok) {
      throw new Error(`加载虚拟机失败: ${response.status}`);
    }
    const rows = (await response.json()) as VmRow[];
    setVms(rows);
  };

  const refreshSystems = async () => {
    if (!authHeaders) {
      return;
    }
    const response = await fetch(`${resolveHttpBase()}/api/systems`, { headers: authHeaders });
    if (!response.ok) {
      throw new Error(`加载系统选项失败: ${response.status}`);
    }
    const rows = (await response.json()) as SystemRow[];
    setSystems(rows);
    if (!selectedSystemId && rows.length > 0) {
      setSelectedSystemId(rows[0].id);
    }
  };

  const refreshHosts = async () => {
    if (!authHeaders || session?.user.role !== "admin") {
      return;
    }
    const response = await fetch(`${resolveHttpBase()}/api/hosts`, { headers: authHeaders });
    if (!response.ok) {
      throw new Error(`加载宿主机失败: ${response.status}`);
    }
    const rows = (await response.json()) as HostRow[];
    setHosts(rows);
    const firstEnabled = rows.find((item) => item.enabled)?.hostKey ?? "";
    if (!selectedHostKey || !rows.some((item) => item.hostKey === selectedHostKey && item.enabled)) {
      setSelectedHostKey(firstEnabled);
    }
  };

  const refreshUsers = async () => {
    if (!authHeaders || session?.user.role !== "admin") {
      return;
    }
    const response = await fetch(`${resolveHttpBase()}/api/users`, { headers: authHeaders });
    if (!response.ok) {
      throw new Error(`加载用户列表失败: ${response.status}`);
    }
    const rows = (await response.json()) as UserRow[];
    setUsers(rows);
    setUserRoleTargets((prev) => {
      const next: Record<string, Role> = { ...prev };
      rows.forEach((item) => {
        if (!next[item.id]) {
          next[item.id] = item.role;
        }
      });
      return next;
    });
  };

  useEffect(() => {
    refreshSiteConfig().catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    document.title = siteConfig.siteTitle;
  }, [siteConfig.siteTitle]);

  useEffect(() => {
    if (!authHeaders || !session) {
      return;
    }
    refreshVms().catch((e: Error) => setError(e.message));
    refreshSystems().catch((e: Error) => setError(e.message));
    refreshHosts().catch((e: Error) => setError(e.message));
    refreshUsers().catch((e: Error) => setError(e.message));
    const timer = setInterval(() => {
      refreshVms().catch((e: Error) => setError(e.message));
      if (session.user.role === "admin") {
        refreshHosts().catch((e: Error) => setError(e.message));
        refreshUsers().catch((e: Error) => setError(e.message));
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [authHeaders, session]);

  useEffect(() => {
    if (!session || session.user.role !== "admin") {
      return;
    }
    const ws = new WebSocket(`${resolveWsBase()}/ui-ws?token=${encodeURIComponent(session.token)}`);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as
          | { type: "host.snapshot"; hosts: HostRow[] }
          | { type: "host.update"; host: HostRow };
        if (message.type === "host.snapshot") {
          setHosts((prev) => {
            const byKey = new Map(prev.map((item) => [item.hostKey, item]));
            message.hosts.forEach((item) => {
              const current = byKey.get(item.hostKey);
              byKey.set(item.hostKey, current ? { ...current, ...item } : item);
            });
            return [...byKey.values()];
          });
          return;
        }
        if (message.type === "host.update") {
          setHosts((prev) => {
            const index = prev.findIndex((item) => item.hostKey === message.host.hostKey);
            if (index < 0) {
              return [...prev, message.host];
            }
            const next = [...prev];
            next[index] = { ...next[index], ...message.host };
            return next;
          });
        }
      } catch {
        return;
      }
    };
    return () => {
      ws.close();
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      if (normalizedPath !== "/login") {
        navigate("/login", { replace: true });
      }
      return;
    }

    const allowedPages = new Set((session.user.role === "admin" ? adminMenu : userMenu).map((item) => item.key));
    const defaultPath = pageToPath[session.user.role === "admin" ? "overview" : "my-vms"];

    if (normalizedPath === "/login") {
      navigate(defaultPath, { replace: true });
      return;
    }

    if (!routePage || !allowedPages.has(routePage)) {
      navigate(defaultPath, { replace: true });
    }
  }, [navigate, normalizedPath, routePage, session]);

  const login = async () => {
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      setError("登录失败");
      return;
    }
    const data = (await response.json()) as Session;
    setSession(data);
    saveSession(data);
    navigate(data.user.role === "admin" ? pageToPath.overview : pageToPath["my-vms"], { replace: true });
  };

  const logout = () => {
    setSession(null);
    saveSession(null);
    setVms([]);
    setHosts([]);
    setSystems([]);
    navigate("/login", { replace: true });
  };

  const createVm = async () => {
    if (!authHeaders) {
      return;
    }
    if (!selectedHostKey || !selectedSystemId) {
      setError("必须选择宿主机和系统选项");
      return;
    }
    const diskSizeGb = Number(diskSizeGbInput);
    const cpuCores = Number(cpuCoresInput);
    const memoryMb = Number(memoryMbInput);
    const bandwidthMbps = Number(bandwidthMbpsInput);

    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/vms`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        hostKey: selectedHostKey,
        systemId: selectedSystemId,
        diskSizeGb: Number.isFinite(diskSizeGb) && diskSizeGb > 0 ? Math.floor(diskSizeGb) : undefined,
        cpuCores: Number.isFinite(cpuCores) && cpuCores > 0 ? Math.floor(cpuCores) : undefined,
        memoryMb: Number.isFinite(memoryMb) && memoryMb > 0 ? Math.floor(memoryMb) : undefined,
        bandwidthMbps: Number.isFinite(bandwidthMbps) && bandwidthMbps > 0 ? Math.floor(bandwidthMbps) : undefined
      })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "创建虚拟机失败");
      return;
    }
    await refreshVms();
    navigate(pageToPath.vms);
    setModalKind(null);
  };

  const vmAction = async (vmId: string, action: VmAction) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/vms/${vmId}/action`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ action })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? `${action} failed`);
      return;
    }
    await refreshVms();
  };

  const assignVm = async (vmId: string) => {
    if (!authHeaders) {
      return;
    }
    const target = assignTargets[vmId]?.trim();
    if (!target) {
      setError("请输入要分配的用户名");
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/vms/${vmId}/assign`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ ownerUsername: target })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "分配虚拟机失败");
      return;
    }
    await refreshVms();
  };

  const createHost = async () => {
    if (!authHeaders) {
      return;
    }
    if (!newHostName.trim()) {
      setError("宿主机名称不能为空");
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/hosts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: newHostName.trim() })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "添加宿主机失败");
      return;
    }
    await refreshHosts();
    setModalKind(null);
  };

  const toggleHost = async (hostKey: string, enabled: boolean) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/hosts/${hostKey}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ enabled })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "更新宿主机状态失败");
      return;
    }
    await refreshHosts();
  };

  const resetHostSecret = async (hostKey: string) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/hosts/${hostKey}/reset-secret`, {
      method: "POST",
      headers: authHeaders
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "重置节点密钥失败");
      return;
    }
    const host = (await response.json()) as HostRow;
    setRotatedHostSecret(host.hostKey);
    await refreshHosts();
    setModalKind("showHostSecret");
  };

  const showAgentInstallCommand = async (host: HostRow) => {
    const command = buildAgentInstallCommand(host.hostKey);
    setAgentInstallCommand(command);
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      setError("复制安装命令失败，请手动复制弹窗中的命令");
    }
    setModalKind("showAgentInstallCommand");
  };

  const saveSiteConfig = async () => {
    if (!authHeaders || session?.user.role !== "admin") {
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/site-config`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        siteTitle: siteTitleInput,
        loginSubtitle: loginSubtitleInput,
        sidebarTitle: siteTitleInput
      })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "保存网站配置失败");
      return;
    }
    const updated = (await response.json()) as SiteConfig;
    setSiteConfig(updated);
    setSiteTitleInput(updated.siteTitle);
    setLoginSubtitleInput(updated.loginSubtitle);
  };

  const createUser = async () => {
    if (!authHeaders) {
      return;
    }
    if (!newUserName.trim() || !newUserPassword.trim()) {
      setError("用户名和密码不能为空");
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/users`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ username: newUserName.trim(), password: newUserPassword.trim(), role: newUserRole })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "创建用户失败");
      return;
    }
    await refreshUsers();
    setModalKind(null);
  };

  const updateUser = async (userId: string) => {
    if (!authHeaders) {
      return;
    }
    const role = userRoleTargets[userId];
    const password = userPasswordTargets[userId]?.trim();
    if (!role && !password) {
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/users/${userId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ role, password: password || undefined })
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "更新用户失败");
      return;
    }
    setUserPasswordTargets((prev) => ({ ...prev, [userId]: "" }));
    await refreshUsers();
    setModalKind(null);
  };

  const deleteUser = async (userId: string) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await fetch(`${resolveHttpBase()}/api/users/${userId}`, {
      method: "DELETE",
      headers: authHeaders
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "删除用户失败");
      return;
    }
    await refreshUsers();
    setModalKind(null);
  };

  const openEditUserModal = (user: UserRow) => {
    setActiveUserId(user.id);
    setUserRoleTargets((prev) => ({
      ...prev,
      [user.id]: prev[user.id] ?? user.role
    }));
    setUserPasswordTargets((prev) => ({
      ...prev,
      [user.id]: prev[user.id] ?? ""
    }));
    setModalKind("editUser");
  };

  const renderVmCards = (adminMode: boolean) => (
    <div className="vm-list">
      {vms.map((vm) => (
        <article className="vm-item" key={vm.id}>
          <div className="vm-head">
            <h3>{vm.id.slice(0, 8)}</h3>
            <span className={`status status-${vm.status}`}>{statusLabel(vm.status)}</span>
          </div>
          <p>归属用户: {vm.ownerUsername}</p>
          <p>宿主机: {vm.hostKey}</p>
          <p>系统: {vm.systemId}</p>
          <p>虚拟机配置:</p>
          <p>硬盘: {vm.diskSizeGb ? `${vm.diskSizeGb} GB` : "默认"}</p>
          <p>CPU 核心: {vm.cpuCores ?? "默认"}</p>
          <p>内存: {vm.memoryMb ? `${vm.memoryMb} MB` : "默认"}</p>
          <p>带宽: {vm.bandwidthMbps ? `${vm.bandwidthMbps} Mbps` : "默认"}</p>
          <p>SSH 端口: {vm.sshPort ?? "-"}</p>
          <p>SSH 密码: {vm.sshPassword ?? "-"}</p>
          <p>开放端口: {vm.openPorts.length ? vm.openPorts.join(", ") : "-"}</p>
          {vm.lastError && <p className="error">{vm.lastError}</p>}
          {adminMode ? (
            <>
              <div className="actions">
                <button className={actionButtonClass("start")} onClick={() => vmAction(vm.id, "start")}>开机</button>
                <button className={actionButtonClass("stop")} onClick={() => vmAction(vm.id, "stop")}>关机</button>
                <button className={actionButtonClass("reboot")} onClick={() => vmAction(vm.id, "reboot")}>重启</button>
                <button className={actionButtonClass("reinstall")} onClick={() => vmAction(vm.id, "reinstall")}>重装系统</button>
                <button className={actionButtonClass("resetPassword")} onClick={() => vmAction(vm.id, "resetPassword")}>重置密码</button>
                <button className={actionButtonClass("delete")} onClick={() => vmAction(vm.id, "delete")}>删除</button>
              </div>
              <div className="assign-row">
                <input
                  placeholder="分配给用户名"
                  value={assignTargets[vm.id] ?? (vm.ownerUsername === "unassigned" ? "" : vm.ownerUsername)}
                  onChange={(event) =>
                    setAssignTargets((prev) => ({
                      ...prev,
                      [vm.id]: event.target.value
                    }))
                  }
                />
                <button className="btn btn-secondary" onClick={() => assignVm(vm.id)}>分配</button>
              </div>
            </>
          ) : (
            <div className="actions">
              <button className={actionButtonClass("start")} onClick={() => vmAction(vm.id, "start")}>开机</button>
              <button className={actionButtonClass("stop")} onClick={() => vmAction(vm.id, "stop")}>关机</button>
              <button className={actionButtonClass("reboot")} onClick={() => vmAction(vm.id, "reboot")}>重启</button>
              <button className={actionButtonClass("reinstall")} onClick={() => vmAction(vm.id, "reinstall")}>重装系统</button>
              <button className={actionButtonClass("resetPassword")} onClick={() => vmAction(vm.id, "resetPassword")}>重置密码</button>
            </div>
          )}
        </article>
      ))}
    </div>
  );

  const renderAdminPage = () => {
    if (page === "overview") {
      return <OverviewRoute vms={vms} hosts={hosts} />;
    }

    if (page === "hosts") {
      return (
        <HostsRoute
          hosts={hosts}
          onCreateHost={() => setModalKind("createHost")}
          onToggleHost={toggleHost}
          onResetHostSecret={resetHostSecret}
          onShowAgentInstallCommand={(host) => {
            void showAgentInstallCommand(host);
          }}
        />
      );
    }

    if (page === "users") {
      return <UsersRoute users={users} onCreateUser={() => setModalKind("createUser")} onEditUser={openEditUserModal} />;
    }

    if (page === "settings") {
      return (
        <SettingsRoute
          siteTitleInput={siteTitleInput}
          loginSubtitleInput={loginSubtitleInput}
          onSiteTitleChange={setSiteTitleInput}
          onLoginSubtitleChange={setLoginSubtitleInput}
          onSave={() => {
            void saveSiteConfig();
          }}
        />
      );
    }

    return (
      <VmsRoute
        onCreateVm={() => setModalKind("createVm")}
        vmCards={renderVmCards(true)}
      />
    );
  };

  if (!session) {
    return (
      <LoginRoute
        siteTitle={siteConfig.siteTitle}
        loginSubtitle={siteConfig.loginSubtitle}
        username={username}
        password={password}
        error={error}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onLogin={() => {
          void login();
        }}
      />
    );
  }

  const renderModal = () => {
    if (!modalKind) {
      return null;
    }

    let title = "";
    let content: ReactNode = null;
    let confirmText = "确认";
    let onConfirm: (() => Promise<void>) | null = null;

    if (modalKind === "createHost") {
      title = "新增宿主机";
      confirmText = "创建宿主机";
      onConfirm = createHost;
      content = (
        <div className="modal-form">
          <label>
            宿主机名称
            <input value={newHostName} onChange={(event) => setNewHostName(event.target.value)} />
          </label>
          <label>
            节点密钥
            <input value="系统自动随机生成" disabled />
          </label>
        </div>
      );
    }

    if (modalKind === "createVm") {
      title = "创建虚拟机";
      confirmText = "创建虚拟机";
      onConfirm = createVm;
      content = (
        <div className="modal-form">
          <label>
            宿主机节点
            <select value={selectedHostKey} onChange={(event) => setSelectedHostKey(event.target.value)}>
              <option value="">请选择宿主机</option>
              {hosts
                .filter((host) => host.enabled)
                .map((host) => (
                  <option key={host.hostKey} value={host.hostKey}>
                    {host.name} ({host.hostKey})
                  </option>
                ))}
            </select>
          </label>
          <label>
            系统选项
            <select value={selectedSystemId} onChange={(event) => setSelectedSystemId(event.target.value)}>
              <option value="">请选择系统</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            硬盘大小（GB，可选）
            <input value={diskSizeGbInput} onChange={(event) => setDiskSizeGbInput(event.target.value)} placeholder="例如 40" />
          </label>
          <label>
            CPU 核心数（可选）
            <input value={cpuCoresInput} onChange={(event) => setCpuCoresInput(event.target.value)} placeholder="例如 2" />
          </label>
          <label>
            内存（MB，可选）
            <input value={memoryMbInput} onChange={(event) => setMemoryMbInput(event.target.value)} placeholder="例如 2048" />
          </label>
          <label>
            带宽（Mbps，可选）
            <input value={bandwidthMbpsInput} onChange={(event) => setBandwidthMbpsInput(event.target.value)} placeholder="例如 20" />
          </label>
        </div>
      );
    }

    if (modalKind === "createUser") {
      title = "新增用户";
      confirmText = "创建用户";
      onConfirm = createUser;
      content = (
        <div className="modal-form">
          <label>
            用户名
            <input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} />
          </label>
          <label>
            初始密码
            <input value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
          </label>
          <label>
            角色
            <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as Role)}>
              <option value="user">用户</option>
              <option value="admin">管理员</option>
            </select>
          </label>
        </div>
      );
    }

    if (modalKind === "editUser") {
      const user = users.find((item) => item.id === activeUserId);
      if (!user) {
        return null;
      }
      title = `编辑用户：${user.username}`;
      confirmText = "保存变更";
      onConfirm = async () => updateUser(user.id);
      content = (
        <div className="modal-form">
          <label>
            角色
            <select
              value={userRoleTargets[user.id] ?? user.role}
              onChange={(event) =>
                setUserRoleTargets((prev) => ({
                  ...prev,
                  [user.id]: event.target.value as Role
                }))
              }
            >
              <option value="user">用户</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <label>
            新密码（留空则不修改）
            <input
              value={userPasswordTargets[user.id] ?? ""}
              onChange={(event) =>
                setUserPasswordTargets((prev) => ({
                  ...prev,
                  [user.id]: event.target.value
                }))
              }
            />
          </label>
          <div className="actions">
            <button className="btn btn-danger" onClick={() => void deleteUser(user.id)}>删除用户</button>
          </div>
        </div>
      );
    }

    if (modalKind === "showHostSecret") {
      title = "节点密钥已重置";
      confirmText = "我已保存";
      onConfirm = async () => {
        setModalKind(null);
      };
      content = (
        <div className="modal-form">
          <p>请立即保存新的节点密钥，并更新宿主机 Agent 的 `AGENT_SHARED_SECRET` 后重启 Agent。</p>
          <label>
            新节点密钥
            <input value={rotatedHostSecret} readOnly />
          </label>
        </div>
      );
    }

    if (modalKind === "showAgentInstallCommand") {
      title = "Agent 一键安装命令";
      confirmText = "关闭";
      onConfirm = async () => {
        setModalKind(null);
      };
      content = (
        <div className="modal-form">
          <p>已自动填入当前面板域名与该宿主机节点密钥，可直接在目标宿主机执行。</p>
          <label>
            安装命令
            <textarea value={agentInstallCommand} readOnly rows={6} />
          </label>
          <div className="actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                void navigator.clipboard.writeText(agentInstallCommand);
              }}
            >
              复制命令
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="modal-overlay" onClick={() => setModalKind(null)}>
        <section className="modal card" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="btn btn-muted" onClick={() => setModalKind(null)}>关闭</button>
          </div>
          {content}
          <div className="modal-actions">
            <button className="btn btn-ghost-dark" onClick={() => setModalKind(null)}>取消</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (onConfirm) {
                  void onConfirm();
                }
              }}
            >
              {confirmText}
            </button>
          </div>
        </section>
      </div>
    );
  };

  return (
    <>
      <main className="layout">
        <aside className="sidebar card">
        <h2 className="sidebar-brand">{siteConfig.siteTitle}</h2>
        <p className="sidebar-user">
          {session.user.username} ({session.user.role})
        </p>
        <div className="menu">
          {menu.map((item) => (
            <button key={item.key} className={page === item.key ? "menu-btn menu-btn-active" : "menu-btn"} onClick={() => navigate(pageToPath[item.key])}>
              {item.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={logout}>退出登录</button>
        </aside>

        <section className="content">
          {error && <p className="error">{error}</p>}
          {session.user.role === "admin" ? (
            renderAdminPage()
          ) : (
            <MyVmsRoute vmCards={renderVmCards(false)} />
          )}
        </section>
      </main>
      {renderModal()}
    </>
  );
}
