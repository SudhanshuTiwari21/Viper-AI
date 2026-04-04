/**
 * Backend API base URL. Browser code must use NEXT_PUBLIC_* only.
 */
export function getPublicBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
}

/** Server-side (Route Handlers, SSR). Prefer BACKEND_URL in Docker/internal networks. */
export function getServerBackendUrl(): string {
  return process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
}
