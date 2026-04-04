import { clearDesktopAuthReturnIntent, isDesktopAuthReturnIntent } from "@/lib/desktop-auth-return";

const DESKTOP_PROTOCOL = "viper://auth/callback";

/**
 * If the user signed in from the Viper IDE, mint a one-time code and open the app via custom protocol.
 * Returns true if navigation was triggered (caller should not router.push).
 */
export async function redirectToDesktopIdeIfNeeded(accessToken: string): Promise<boolean> {
  if (!isDesktopAuthReturnIntent()) return false;
  try {
    const res = await fetch("/api/auth/desktop/handoff", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as { code?: string; error?: string };
    if (!res.ok || typeof data.code !== "string" || !data.code) {
      clearDesktopAuthReturnIntent();
      return false;
    }
    clearDesktopAuthReturnIntent();
    window.location.href = `${DESKTOP_PROTOCOL}?code=${encodeURIComponent(data.code)}`;
    return true;
  } catch {
    clearDesktopAuthReturnIntent();
    return false;
  }
}
