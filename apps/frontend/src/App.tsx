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
            colorPrimary: "#1dd6b3",
            colorSuccess: "#32d296",
            colorWarning: "#f2b84b",
            colorError: "#ff6f7d",
            colorBgBase: "#050b15",
            colorBgLayout: "#050b15",
            colorBgContainer: "#0e1a2d",
            colorBgElevated: "#132237",
            colorText: "#e8f2ff",
            colorTextSecondary: "#9cb0cb",
            colorBorder: "#2a3854",
            colorSplit: "#1f2b42",
            boxShadow: "0 18px 40px rgba(4, 9, 18, 0.45)",
            borderRadius: 12,
            borderRadiusLG: 16,
            fontFamily: "\"Noto Sans SC\", \"IBM Plex Sans\", sans-serif",
            fontFamilyCode: "\"IBM Plex Mono\", monospace",
          },
          components: {
            Button: {
              borderRadius: 10,
              defaultBg: "#121f34",
              defaultColor: "#dce7fa",
              defaultBorderColor: "#2c3b5a",
              primaryShadow: "0 0 0 1px rgba(29, 214, 179, 0.28), 0 8px 20px rgba(10, 178, 148, 0.28)",
            },
            Input: {
              activeBorderColor: "#1dd6b3",
              hoverBorderColor: "#22c9aa",
              activeShadow: "0 0 0 2px rgba(29, 214, 179, 0.18)",
            },
            Card: {
              colorBgContainer: "#101e33",
            },
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
          colorPrimary: "#1dd6b3",
          colorSuccess: "#32d296",
          colorWarning: "#f2b84b",
          colorError: "#ff6f7d",
          colorBgBase: "#050b15",
          colorBgLayout: "#050b15",
          colorBgContainer: "#0e1a2d",
          colorBgElevated: "#122038",
          colorText: "#e8f2ff",
          colorTextSecondary: "#9cb0cb",
          colorBorder: "#2a3854",
          colorSplit: "#1f2b42",
          boxShadow: "0 18px 40px rgba(4, 9, 18, 0.45)",
          borderRadius: 12,
          borderRadiusLG: 16,
          fontFamily: "\"Noto Sans SC\", \"IBM Plex Sans\", sans-serif",
          fontFamilyCode: "\"IBM Plex Mono\", monospace",
        },
        components: {
          Layout: {
            bodyBg: "#050b15",
            headerBg: "#091426",
            siderBg: "#070f1d",
            triggerBg: "#0f1b2f",
            triggerColor: "#c2d5ee",
            headerPadding: "0 16px",
          },
          Menu: {
            darkItemBg: "transparent",
            darkSubMenuItemBg: "transparent",
            darkItemColor: "#8ea6c9",
            darkItemHoverColor: "#d7e6ff",
            darkItemSelectedColor: "#dcfff7",
            darkItemSelectedBg: "rgba(29, 214, 179, 0.2)",
            itemBorderRadius: 10,
          },
          Button: {
            borderRadius: 10,
            defaultBg: "#121f34",
            defaultColor: "#dce7fa",
            defaultBorderColor: "#2c3b5a",
            primaryShadow: "0 0 0 1px rgba(29, 214, 179, 0.3), 0 8px 20px rgba(10, 178, 148, 0.3)",
          },
          Card: {
            colorBgContainer: "#101e33",
            headerBg: "rgba(255, 255, 255, 0.02)",
          },
          Table: {
            headerBg: "#0f2036",
            headerColor: "#dce7fa",
            rowHoverBg: "rgba(29, 214, 179, 0.08)",
            borderColor: "#22324c",
          },
          Input: {
            activeBorderColor: "#1dd6b3",
            hoverBorderColor: "#22c9aa",
            activeShadow: "0 0 0 2px rgba(29, 214, 179, 0.2)",
          },
          Tag: {
            defaultBg: "#152640",
            defaultColor: "#d5e5ff",
          },
          Alert: {
            colorErrorBg: "rgba(255, 111, 125, 0.12)",
            colorErrorBorder: "rgba(255, 111, 125, 0.4)",
          },
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
