/** Session flag: user started login/signup from the Viper desktop app (browser must return via viper://). */
const SESSION_KEY = "viper_desktop_auth_return";

export function setDesktopAuthReturnIntent(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function isDesktopAuthReturnIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearDesktopAuthReturnIntent(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
