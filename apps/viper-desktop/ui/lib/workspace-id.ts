/**
 * E.25 — Client-side workspace ID derivation.
 *
 * Must produce the same value as the backend:
 *   apps/backend/src/types/request-identity.ts → deriveWorkspaceId()
 *
 * Algorithm:
 *   1. Normalise: forward slashes, strip trailing slash, lowercase on
 *      case-insensitive platforms (macOS, Windows).
 *   2. SHA-256 the UTF-8 encoded normalised string.
 *   3. Return the first 16 hex characters.
 *
 * Uses Web Crypto (crypto.subtle) which is available in both Electron's
 * Chromium renderer and modern browsers (HTTPS contexts).
 */

/**
 * Normalise a filesystem path to the same canonical form used by the backend.
 *
 * @param workspacePath  Raw path, may use backslashes and/or trailing slash.
 * @param caseFold       When true, lowercase the normalised path.
 *                       Set to true on macOS / Windows to match the backend.
 */
export function normalizePath(workspacePath: string, caseFold = false): string {
  let p = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (caseFold) p = p.toLowerCase();
  return p;
}

/**
 * Returns true on platforms where the filesystem is case-insensitive.
 * Falls back to false (case-sensitive, i.e. Linux) when the platform cannot
 * be detected (e.g. during unit tests with a mocked navigator).
 */
export function isPlatformCaseFold(): boolean {
  try {
    const p = (typeof navigator !== "undefined" ? navigator.platform : "").toLowerCase();
    return p.startsWith("mac") || p.startsWith("win");
  } catch {
    return false;
  }
}

/** SHA-256 of a UTF-8 string → lowercase hex. */
async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive the deterministic, log-safe workspace ID for the given path.
 * Returns the first 16 hex characters of SHA-256(normalised path).
 *
 * This MUST be used wherever workspace_id is sent to the backend
 * (e.g. POST /media/upload) so media_ref resolution in E.24 succeeds.
 */
export async function deriveWorkspaceId(workspacePath: string): Promise<string> {
  const normalized = normalizePath(workspacePath, isPlatformCaseFold());
  if (!normalized) return "0".repeat(16);
  const hex = await sha256Hex(normalized);
  return hex.slice(0, 16);
}
