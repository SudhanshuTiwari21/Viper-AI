/** SessionStorage key for short-lived access JWT (mitigate XSS vs localStorage patterns). */
export const ACCESS_TOKEN_KEY = "viper_access_token";

/** Read the current access token (browser only). */
export function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function persistAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    /* quota / private mode */
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
