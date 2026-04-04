import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "viper_auth_session";
const IDE_ACCESS_KEY = "viper_ide_access_token";
const IDE_REFRESH_KEY = "viper_ide_refresh_token";

/** Persist tokens after desktop browser handoff (local app storage only). */
export function storeIdeAuthTokens(accessToken: string, refreshToken: string): void {
  try {
    window.localStorage.setItem(IDE_ACCESS_KEY, accessToken);
    window.localStorage.setItem(IDE_REFRESH_KEY, refreshToken);
  } catch {
    /* ignore */
  }
}

export function getIdeRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(IDE_REFRESH_KEY);
  } catch {
    return null;
  }
}

export function getIdeAccessToken(): string | null {
  try {
    return window.localStorage.getItem(IDE_ACCESS_KEY);
  } catch {
    return null;
  }
}

export interface AuthUser {
  email: string;
  /** Display label for billing / product tier (e.g. Free, Pro). */
  plan: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Replace session after real OAuth/email login (or demo). */
  setUser: (user: AuthUser | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "email" in parsed &&
      "plan" in parsed &&
      typeof (parsed as AuthUser).email === "string" &&
      typeof (parsed as AuthUser).plan === "string"
    ) {
      return { email: (parsed as AuthUser).email, plan: (parsed as AuthUser).plan };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() =>
    typeof window !== "undefined" ? readStoredUser() : null,
  );

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(IDE_ACCESS_KEY);
        window.localStorage.removeItem(IDE_REFRESH_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const signOut = useCallback(() => setUser(null), [setUser]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      signOut,
    }),
    [user, setUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Initials for avatar (1–2 chars). */
export function emailToInitials(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "?";
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}
