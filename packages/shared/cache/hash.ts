import crypto from "crypto";

/**
 * Deterministic SHA256 hash for cache keys.
 */
export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
