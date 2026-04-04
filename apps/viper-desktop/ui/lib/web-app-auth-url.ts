/**
 * Marketing / auth web app (Next). Used to open login & signup in the system browser from the IDE.
 */
export function getWebAppBaseUrl(): string {
  const fromEnv = (import.meta as { env?: { VITE_WEB_APP_URL?: string } }).env?.VITE_WEB_APP_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export function getWebAppLoginUrl(): string {
  return `${getWebAppBaseUrl()}/login?source=desktop`;
}

export function getWebAppSignupUrl(): string {
  return `${getWebAppBaseUrl()}/signup?source=desktop`;
}
