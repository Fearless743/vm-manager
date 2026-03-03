import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminMenu, pageToPath, pathToPage, userMenu } from "../constants/navigation";
import type { PageKey, Session } from "../types";

export function useAppRouting(session: Session | null) {
  const location = useLocation();
  const navigate = useNavigate();

  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const routePage = pathToPage[normalizedPath];
  const fallbackPage: PageKey = session?.user.role === "admin" ? "overview" : "my-vms";
  const page = routePage ?? fallbackPage;

  useEffect(() => {
    if (!session) {
      if (normalizedPath !== "/login") {
        navigate("/login", { replace: true });
      }
      return;
    }

    const allowed = new Set((session.user.role === "admin" ? adminMenu : userMenu).map((item) => item.key));
    const defaultPath = pageToPath[session.user.role === "admin" ? "overview" : "my-vms"];

    if (normalizedPath === "/login") {
      navigate(defaultPath, { replace: true });
      return;
    }

    if (!routePage || !allowed.has(routePage)) {
      navigate(defaultPath, { replace: true });
    }
  }, [navigate, normalizedPath, routePage, session]);

  return {
    navigate,
    page,
  };
}
