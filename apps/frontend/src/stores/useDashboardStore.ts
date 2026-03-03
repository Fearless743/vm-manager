import { useEffect, useMemo, useState } from "react";
import type { Role } from "@vm-manager/shared";
import { buildAgentInstallCommand, parseErrorText } from "../lib/http";
import {
  assignVmOwnerRequest,
  changeMyPasswordRequest,
  createHostRequest,
  createUserRequest,
  createVmRequest,
  deleteUserRequest,
  rotateHostSecretRequest,
  saveSiteConfigRequest,
  updateHostEnabledRequest,
  updateUserRequest,
  vmOperationRequest,
} from "../services/dashboardApi";
import { useAuthModule } from "./modules/useAuthModule";
import { useDashboardQueriesModule } from "./modules/useDashboardQueriesModule";
import type { HostRow, ModalKind, SiteConfig, UserRow, VmAction, VmRow } from "../types";

const defaultSiteConfig: SiteConfig = {
  siteTitle: "LXC 管理平台",
  loginSubtitle: "请使用管理员或普通用户登录。",
  sidebarTitle: "LXC 管理平台",
};

export function useDashboardStore() {
  const [vms, setVms] = useState<VmRow[]>([]);
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [systems, setSystems] = useState([] as { id: string; name: string; image: string; description: string }[]);
  const [users, setUsers] = useState<UserRow[]>([]);
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
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [error, setError] = useState("");
  const [modalKind, setModalKind] = useState<ModalKind>(null);

  const auth = useAuthModule({
    setError,
    onLogoutCleanup: () => {
      setVms([]);
      setHosts([]);
      setSystems([]);
      setUsers([]);
    },
  });

  const authHeaders = useMemo(
    () =>
      auth.session
        ? {
            Authorization: `Bearer ${auth.session.token}`,
            "Content-Type": "application/json",
          }
        : undefined,
    [auth.session],
  );

  const queries = useDashboardQueriesModule({
    session: auth.session,
    authHeaders,
    selectedHostKey,
    selectedSystemId,
    setError,
    setVms,
    setHosts,
    setSystems,
    setUsers,
    setSelectedHostKey,
    setSelectedSystemId,
    setUserRoleTargets,
    setSiteConfig,
    setSiteTitleInput,
    setLoginSubtitleInput,
  });

  useEffect(() => {
    document.title = siteConfig.siteTitle;
  }, [siteConfig.siteTitle]);

  const createVm = async () => {
    if (!authHeaders || !selectedHostKey || !selectedSystemId) {
      setError("必须选择宿主机和系统选项");
      return false;
    }
    const diskSizeGb = Number(diskSizeGbInput);
    const cpuCores = Number(cpuCoresInput);
    const memoryMb = Number(memoryMbInput);
    const bandwidthMbps = Number(bandwidthMbpsInput);

    setError("");
    const response = await createVmRequest(authHeaders, {
      hostKey: selectedHostKey,
      systemId: selectedSystemId,
      diskSizeGb: Number.isFinite(diskSizeGb) && diskSizeGb > 0 ? Math.floor(diskSizeGb) : undefined,
      cpuCores: Number.isFinite(cpuCores) && cpuCores > 0 ? Math.floor(cpuCores) : undefined,
      memoryMb: Number.isFinite(memoryMb) && memoryMb > 0 ? Math.floor(memoryMb) : undefined,
      bandwidthMbps: Number.isFinite(bandwidthMbps) && bandwidthMbps > 0 ? Math.floor(bandwidthMbps) : undefined,
    });

    if (!response.ok) {
      setError(await parseErrorText(response, "创建虚拟机失败"));
      return false;
    }
    await queries.refreshVms();
    setModalKind(null);
    return true;
  };

  const vmAction = async (vmId: string, action: VmAction) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await vmOperationRequest(authHeaders, vmId, action);
    if (!response.ok) {
      setError(await parseErrorText(response, `${action} failed`));
      return;
    }
    await queries.refreshVms();
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
    const response = await assignVmOwnerRequest(authHeaders, vmId, target);
    if (!response.ok) {
      setError(await parseErrorText(response, "分配虚拟机失败"));
      return;
    }
    await queries.refreshVms();
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
    const response = await createHostRequest(authHeaders, newHostName.trim());
    if (!response.ok) {
      setError(await parseErrorText(response, "添加宿主机失败"));
      return;
    }
    await queries.refreshHosts();
    setModalKind(null);
  };

  const toggleHost = async (hostKey: string, enabled: boolean) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await updateHostEnabledRequest(authHeaders, hostKey, enabled);
    if (!response.ok) {
      setError(await parseErrorText(response, "更新宿主机状态失败"));
      return;
    }
    await queries.refreshHosts();
  };

  const resetHostSecret = async (hostKey: string) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await rotateHostSecretRequest(authHeaders, hostKey);
    if (!response.ok) {
      setError(await parseErrorText(response, "重置节点密钥失败"));
      return;
    }
    const host = (await response.json()) as HostRow;
    setRotatedHostSecret(host.hostKey);
    await queries.refreshHosts();
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
    if (!authHeaders || auth.session?.user.role !== "admin") {
      return;
    }
    setError("");
    const response = await saveSiteConfigRequest(authHeaders, {
      siteTitle: siteTitleInput,
      loginSubtitle: loginSubtitleInput,
      sidebarTitle: siteTitleInput,
    });
    if (!response.ok) {
      setError(await parseErrorText(response, "保存网站配置失败"));
      return;
    }
    const updated = (await response.json()) as SiteConfig;
    setSiteConfig(updated);
    setSiteTitleInput(updated.siteTitle);
    setLoginSubtitleInput(updated.loginSubtitle);
  };

  const changeOwnPassword = async () => {
    if (!authHeaders) {
      return;
    }
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setError("请填写完整的密码信息");
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setError("两次输入的新密码不一致");
      return;
    }

    setError("");
    const response = await changeMyPasswordRequest(authHeaders, {
      currentPassword: currentPasswordInput,
      newPassword: newPasswordInput,
    });
    if (!response.ok) {
      setError(await parseErrorText(response, "修改密码失败"));
      return;
    }
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setModalKind(null);
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
    const response = await createUserRequest(authHeaders, {
      username: newUserName.trim(),
      password: newUserPassword.trim(),
      role: newUserRole,
    });
    if (!response.ok) {
      setError(await parseErrorText(response, "创建用户失败"));
      return;
    }
    await queries.refreshUsers();
    setModalKind(null);
  };

  const updateUser = async (userId: string) => {
    if (!authHeaders) {
      return;
    }
    const role = userRoleTargets[userId];
    const userPassword = userPasswordTargets[userId]?.trim();
    if (!role && !userPassword) {
      return;
    }

    setError("");
    const response = await updateUserRequest(authHeaders, userId, { role, password: userPassword || undefined });
    if (!response.ok) {
      setError(await parseErrorText(response, "更新用户失败"));
      return;
    }

    setUserPasswordTargets((prev) => ({ ...prev, [userId]: "" }));
    await queries.refreshUsers();
    setModalKind(null);
  };

  const deleteUser = async (userId: string) => {
    if (!authHeaders) {
      return;
    }
    setError("");
    const response = await deleteUserRequest(authHeaders, userId);
    if (!response.ok) {
      setError(await parseErrorText(response, "删除用户失败"));
      return;
    }
    await queries.refreshUsers();
    setModalKind(null);
  };

  const openEditUserModal = (user: UserRow) => {
    setActiveUserId(user.id);
    setUserRoleTargets((prev) => ({ ...prev, [user.id]: prev[user.id] ?? user.role }));
    setUserPasswordTargets((prev) => ({ ...prev, [user.id]: prev[user.id] ?? "" }));
    setModalKind("editUser");
  };

  return {
    session: auth.session,
    setSession: auth.setSession,
    vms,
    hosts,
    systems,
    users,
    assignTargets,
    setAssignTargets,
    userRoleTargets,
    setUserRoleTargets,
    userPasswordTargets,
    setUserPasswordTargets,
    selectedHostKey,
    setSelectedHostKey,
    selectedSystemId,
    setSelectedSystemId,
    newHostName,
    setNewHostName,
    newUserName,
    setNewUserName,
    newUserPassword,
    setNewUserPassword,
    newUserRole,
    setNewUserRole,
    diskSizeGbInput,
    setDiskSizeGbInput,
    cpuCoresInput,
    setCpuCoresInput,
    memoryMbInput,
    setMemoryMbInput,
    bandwidthMbpsInput,
    setBandwidthMbpsInput,
    activeUserId,
    setActiveUserId,
    rotatedHostSecret,
    setRotatedHostSecret,
    agentInstallCommand,
    setAgentInstallCommand,
    siteConfig,
    siteTitleInput,
    setSiteTitleInput,
    loginSubtitleInput,
    setLoginSubtitleInput,
    currentPasswordInput,
    setCurrentPasswordInput,
    newPasswordInput,
    setNewPasswordInput,
    confirmPasswordInput,
    setConfirmPasswordInput,
    error,
    setError,
    modalKind,
    setModalKind,
    refreshSiteConfig: queries.refreshSiteConfig,
    refreshVms: queries.refreshVms,
    refreshSystems: queries.refreshSystems,
    refreshHosts: queries.refreshHosts,
    refreshUsers: queries.refreshUsers,
    login: auth.login,
    logout: auth.logout,
    createVm,
    vmAction,
    assignVm,
    createHost,
    toggleHost,
    resetHostSecret,
    showAgentInstallCommand,
    saveSiteConfig,
    changeOwnPassword,
    createUser,
    updateUser,
    deleteUser,
    openEditUserModal,
  };
}

export type DashboardStore = ReturnType<typeof useDashboardStore>;
