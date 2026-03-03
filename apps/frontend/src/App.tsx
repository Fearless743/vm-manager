import { Alert, ConfigProvider } from "antd";
import { adminMenu, pageToPath, userMenu } from "./constants/navigation";
import { DashboardModals } from "./components/modals/DashboardModals";
import { AdminLayout } from "./layouts/AdminLayout";
import { LoginPage } from "./pages/auth/LoginPage";
import { AdminDashboardPage } from "./pages/dashboard/AdminDashboardPage";
import { UserDashboardPage } from "./pages/dashboard/UserDashboardPage";
import { useAppRouting } from "./router/useAppRouting";
import { useDashboardStore } from "./stores/useDashboardStore";

export function App(): JSX.Element {
  const store = useDashboardStore();
  const routing = useAppRouting(store.session);
  const menu = store.session?.user.role === "admin" ? adminMenu : userMenu;

  if (!store.session) {
    return (
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#1677ff",
            fontFamily: "\"Noto Sans SC\", \"IBM Plex Sans\", sans-serif",
          },
        }}
      >
        <LoginPage
          siteTitle={store.siteConfig.siteTitle}
          subtitle={store.siteConfig.loginSubtitle}
          error={store.error}
          onLogin={(username, password) => {
            void store.login(username, password).then((data) => {
              if (!data) {
                return;
              }
              routing.navigate(data.user.role === "admin" ? pageToPath.overview : pageToPath["my-vms"], { replace: true });
            });
          }}
        />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1462ff",
          colorSuccess: "#2e7d32",
          colorWarning: "#c17800",
          colorError: "#b42318",
          borderRadius: 10,
          fontFamily: "\"Noto Sans SC\", \"IBM Plex Sans\", sans-serif",
          fontFamilyCode: "\"IBM Plex Mono\", monospace",
        },
      }}
    >
      <AdminLayout
        siteConfig={store.siteConfig}
        session={store.session}
        selectedPage={routing.page}
        menuItems={menu}
        onNavigate={(key) => routing.navigate(pageToPath[key as keyof typeof pageToPath])}
        onOpenChangePassword={() => store.setModalKind("changeOwnPassword")}
        onLogout={() => {
          store.logout();
          routing.navigate("/login", { replace: true });
        }}
      >
        {store.error && <Alert showIcon type="error" message={store.error} style={{ marginBottom: 16 }} />}
        {store.session.user.role === "admin" ? (
          <AdminDashboardPage
            page={routing.page}
            currentUsername={store.session.user.username}
            vms={store.vms}
            hosts={store.hosts}
            users={store.users}
            assignTargets={store.assignTargets}
            siteTitleInput={store.siteTitleInput}
            loginSubtitleInput={store.loginSubtitleInput}
            onSiteTitleInputChange={store.setSiteTitleInput}
            onLoginSubtitleInputChange={store.setLoginSubtitleInput}
            onSaveSiteConfig={() => void store.saveSiteConfig()}
            onOpenCreateHost={() => store.setModalKind("createHost")}
            onOpenCreateVm={() => store.setModalKind("createVm")}
            onOpenCreateUser={() => store.setModalKind("createUser")}
            onOpenEditUser={store.openEditUserModal}
            onVmAction={(vmId, action) => void store.vmAction(vmId, action)}
            onAssignVm={(vmId) => void store.assignVm(vmId)}
            onAssignTargetChange={(vmId, value) =>
              store.setAssignTargets((prev) => ({
                ...prev,
                [vmId]: value,
              }))
            }
            onToggleHost={(hostKey, enabled) => void store.toggleHost(hostKey, enabled)}
            onResetHostSecret={(hostKey) => void store.resetHostSecret(hostKey)}
            onShowAgentInstallCommand={(host) => void store.showAgentInstallCommand(host)}
          />
        ) : (
          <UserDashboardPage
            vms={store.vms}
            username={store.session.user.username}
            onVmAction={(vmId, action) => void store.vmAction(vmId, action)}
          />
        )}
      </AdminLayout>

      <DashboardModals store={store} />
    </ConfigProvider>
  );
}
