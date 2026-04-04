import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppRoute = "ide" | "login" | "register";

function routeFromHash(): AppRoute {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  if (raw === "/login" || raw.startsWith("/login?")) return "login";
  if (raw === "/register" || raw.startsWith("/register?")) return "register";
  return "ide";
}

function hashForRoute(route: AppRoute): string {
  if (route === "login") return "#/login";
  if (route === "register") return "#/register";
  return "#/";
}

interface AppRouteContextValue {
  route: AppRoute;
  /** Use paths like `/login`, `/register`, or `/` for the IDE. */
  navigate: (path: "/" | "/login" | "/register") => void;
}

const AppRouteContext = createContext<AppRouteContextValue | null>(null);

export function AppRouteProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== "undefined" ? routeFromHash() : "ide",
  );

  useEffect(() => {
    const sync = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((path: "/" | "/login" | "/register") => {
    const next: AppRoute =
      path === "/login" ? "login" : path === "/register" ? "register" : "ide";
    const h = hashForRoute(next);
    if (window.location.hash !== h) window.location.hash = h;
    else setRoute(next);
  }, []);

  const value = useMemo(() => ({ route, navigate }), [route, navigate]);

  return <AppRouteContext.Provider value={value}>{children}</AppRouteContext.Provider>;
}

export function useAppRoute(): AppRouteContextValue {
  const ctx = useContext(AppRouteContext);
  if (!ctx) throw new Error("useAppRoute must be used within AppRouteProvider");
  return ctx;
}
