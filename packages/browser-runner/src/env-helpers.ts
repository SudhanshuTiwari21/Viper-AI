/**
 * Shared env-var utilities for the browser-runner package.
 */

/** Parse a positive integer from an env var, falling back to `fallback`. */
export function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
