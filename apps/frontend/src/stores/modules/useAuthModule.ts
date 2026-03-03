import { useState } from "react";
import { createSession } from "../../services/dashboardApi";
import type { Session } from "../../types";

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

type Args = {
  setError: (value: string) => void;
  onLogoutCleanup: () => void;
};

export function useAuthModule(args: Args) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const login = async (username: string, password: string): Promise<Session | null> => {
    args.setError("");
    const data = await createSession(username, password);
    if (!data) {
      args.setError("登录失败");
      return null;
    }
    setSession(data);
    saveSession(data);
    return data;
  };

  const logout = () => {
    setSession(null);
    saveSession(null);
    args.onLogoutCleanup();
  };

  return {
    session,
    setSession,
    login,
    logout,
  };
}
