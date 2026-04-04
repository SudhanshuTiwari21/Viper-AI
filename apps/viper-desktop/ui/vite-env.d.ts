/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_API_URL?: string;
  /** Marketing / auth web app origin for “Sign in in browser” (e.g. http://localhost:3000). */
  readonly VITE_WEB_APP_URL?: string;
  /**
   * When subscription URLs use `localhost` / `127.0.0.1`, rewrite to this origin for clients
   * that fetch subscriptions from another device (e.g. v2RayTun on Android). Example: `http://192.168.1.10:4000`
   */
  readonly VITE_SUBSCRIPTION_PUBLIC_ORIGIN?: string;
  /**
   * Full HTTPS/HTTP subscription URL for v2RayTun (same string you’d paste in the app).
   * Used by “Open in v2RayTun” when set. Still apply `VITE_SUBSCRIPTION_PUBLIC_ORIGIN` if the URL uses localhost.
   */
  readonly VITE_SUBSCRIPTION_IMPORT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
