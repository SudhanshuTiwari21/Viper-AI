/**
 * E.26 — URL allowlist for the browser runner.
 *
 * Policy (default, hard):
 *   ✓ http://localhost[:port][/path]
 *   ✓ http://127.0.0.1[:port][/path]
 *   ✓ https://localhost[:port][/path]
 *   ✓ https://127.0.0.1[:port][/path]
 *   ✗ file: (always blocked)
 *   ✗ data: (always blocked)
 *   ✗ any other origin unless listed in VIPER_BROWSER_ALLOWED_ORIGINS
 *
 * Extension:
 *   VIPER_BROWSER_ALLOWED_ORIGINS = comma-separated list of extra allowed origins.
 *   Origin format: scheme://host[:port]  (no trailing slash, no path).
 *   Example: https://staging.example.com,http://dev.local:8080
 */

/** Protocols that are unconditionally blocked. */
const BLOCKED_PROTOCOLS = new Set(["file:", "data:", "javascript:", "blob:"]);

/** Default-allowed localhost-equivalent hostnames. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Parse VIPER_BROWSER_ALLOWED_ORIGINS into a set of lowercase origins.
 * Each entry is a full origin string, e.g. "https://staging.example.com".
 */
export function parseAllowedOrigins(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

/**
 * Returns true when `url` is allowed by the browser runner policy.
 *
 * @param url            The URL string to validate.
 * @param extraOrigins   Caller-supplied extra allowed origins (from env).
 */
export function isUrlAllowed(url: string, extraOrigins?: Set<string>): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // unparseable — reject
  }

  const protocol = parsed.protocol; // e.g. "https:"
  if (BLOCKED_PROTOCOLS.has(protocol)) return false;

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  const isAllowedProtocol = protocol === "http:" || protocol === "https:";

  if (isLoopback && isAllowedProtocol) return true;

  // Check extra origins if provided
  if (extraOrigins?.size) {
    const origin = parsed.origin.toLowerCase();
    if (extraOrigins.has(origin)) return true;
  }

  return false;
}

/**
 * Read allowed origins from the environment.
 * Call this once at tool-registration time to avoid repeated env reads.
 */
export function getAllowedOriginsFromEnv(): Set<string> {
  return parseAllowedOrigins(process.env["VIPER_BROWSER_ALLOWED_ORIGINS"]);
}
