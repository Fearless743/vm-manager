import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { resolveWsBase } from "../../lib/http";
import { fetchHosts, fetchSiteConfig, fetchSystemOptions, fetchUsers, fetchVms } from "../../services/dashboardApi";
import type { HostRow, Session, SiteConfig, SystemRow, UserRow, VmRow } from "../../types";

type Headers = Record<string, string> | undefined;

type Args = {
  session: Session | null;
  authHeaders: Headers;
  selectedHostKey: string;
  selectedSystemId: string;
  setError: (value: string) => void;
  setVms: Dispatch<SetStateAction<VmRow[]>>;
  setHosts: Dispatch<SetStateAction<HostRow[]>>;
  setSystems: Dispatch<SetStateAction<SystemRow[]>>;
  setUsers: Dispatch<SetStateAction<UserRow[]>>;
  setSelectedHostKey: (value: string) => void;
  setSelectedSystemId: (value: string) => void;
  setUserRoleTargets: Dispatch<SetStateAction<Record<string, UserRow["role"]>>>;
  setSiteConfig: (value: SiteConfig) => void;
  setSiteTitleInput: (value: string) => void;
  setLoginSubtitleInput: (value: string) => void;
};

export function useDashboardQueriesModule(args: Args) {
  const refreshSiteConfig = async () => {
    const config = await fetchSiteConfig();
    args.setSiteConfig(config);
    args.setSiteTitleInput(config.siteTitle);
    args.setLoginSubtitleInput(config.loginSubtitle);
  };

  const refreshVms = async () => {
    if (!args.authHeaders) {
      return;
    }
    args.setVms(await fetchVms(args.authHeaders));
  };

  const refreshSystems = async () => {
    if (!args.authHeaders) {
      return;
    }
    const rows = await fetchSystemOptions(args.authHeaders);
    args.setSystems(rows);
    if (!args.selectedSystemId && rows.length > 0) {
      args.setSelectedSystemId(rows[0].id);
    }
  };

  const refreshHosts = async () => {
    if (!args.authHeaders || args.session?.user.role !== "admin") {
      return;
    }
    const rows = await fetchHosts(args.authHeaders);
    args.setHosts(rows);
    const firstEnabled = rows.find((item) => item.enabled)?.hostKey ?? "";
    if (!args.selectedHostKey || !rows.some((item) => item.hostKey === args.selectedHostKey && item.enabled)) {
      args.setSelectedHostKey(firstEnabled);
    }
  };

  const refreshUsers = async () => {
    if (!args.authHeaders || args.session?.user.role !== "admin") {
      return;
    }
    const rows = await fetchUsers(args.authHeaders);
    args.setUsers(rows);
    args.setUserRoleTargets((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        if (!next[row.id]) {
          next[row.id] = row.role;
        }
      });
      return next;
    });
  };

  useEffect(() => {
    refreshSiteConfig().catch((e: Error) => args.setError(e.message));
  }, []);

  useEffect(() => {
    if (!args.authHeaders || !args.session) {
      return;
    }
    refreshVms().catch((e: Error) => args.setError(e.message));
    refreshSystems().catch((e: Error) => args.setError(e.message));
    refreshHosts().catch((e: Error) => args.setError(e.message));
    refreshUsers().catch((e: Error) => args.setError(e.message));

    const timer = setInterval(() => {
      refreshVms().catch((e: Error) => args.setError(e.message));
      if (args.session?.user.role === "admin") {
        refreshHosts().catch((e: Error) => args.setError(e.message));
        refreshUsers().catch((e: Error) => args.setError(e.message));
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [args.authHeaders, args.session]);

  useEffect(() => {
    if (!args.session || args.session.user.role !== "admin") {
      return;
    }
    const ws = new WebSocket(`${resolveWsBase()}/ui-ws?token=${encodeURIComponent(args.session.token)}`);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as
          | { type: "host.snapshot"; hosts: HostRow[] }
          | { type: "host.update"; host: HostRow };

        if (message.type === "host.snapshot") {
          args.setHosts((prev) => {
            const byKey = new Map(prev.map((item) => [item.hostKey, item]));
            message.hosts.forEach((item) => {
              byKey.set(item.hostKey, { ...byKey.get(item.hostKey), ...item } as HostRow);
            });
            return [...byKey.values()];
          });
          return;
        }

        args.setHosts((prev) => {
          const index = prev.findIndex((item) => item.hostKey === message.host.hostKey);
          if (index < 0) {
            return [...prev, message.host];
          }
          const next = [...prev];
          next[index] = { ...next[index], ...message.host };
          return next;
        });
      } catch {
        return;
      }
    };

    return () => ws.close();
  }, [args.session]);

  return {
    refreshSiteConfig,
    refreshVms,
    refreshSystems,
    refreshHosts,
    refreshUsers,
  };
}
