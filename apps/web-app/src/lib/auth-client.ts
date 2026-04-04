/** SessionStorage key for short-lived access JWT (mitigate XSS vs localStorage patterns). */
export const ACCESS_TOKEN_KEY = "viper_access_token";

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
