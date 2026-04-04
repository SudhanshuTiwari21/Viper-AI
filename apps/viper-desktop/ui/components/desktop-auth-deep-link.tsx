import { useEffect } from "react";
import { useAuth, storeIdeAuthTokens } from "../contexts/auth-context";
import { useAppRoute } from "../contexts/app-route-context";
import { BACKEND_URL } from "../services/agent-api";

/**
 * Completes sign-in when the browser redirects to viper://auth/callback?code=… after web auth.
 */
export function DesktopAuthDeepLinkListener() {
  const { setUser } = useAuth();
  const { navigate } = useAppRoute();

  useEffect(() => {
    const subscribe = window.viper?.auth?.onAuthCallback;
    if (!subscribe) return;
    const unsub = subscribe(async ({ code }) => {
      try {
        const res = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/auth/oauth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as {
          error?: string;
          user?: { email?: string; plan?: string };
          accessToken?: string;
          refreshToken?: string;
        };
        if (!res.ok) {
          console.error("[viper] Desktop auth exchange failed:", data.error ?? res.status);
          return;
        }
        const email = typeof data.user?.email === "string" ? data.user.email : "";
        const plan = typeof data.user?.plan === "string" ? data.user.plan : "Free";
        if (!email || !data.accessToken || !data.refreshToken) {
          console.error("[viper] Desktop auth exchange: missing session fields");
          return;
        }
        storeIdeAuthTokens(data.accessToken, data.refreshToken);
        setUser({ email, plan });
        navigate("/");
      } catch (e) {
        console.error("[viper] Desktop auth exchange:", e);
      }
    });
    return unsub;
  }, [setUser, navigate]);

  return null;
}
