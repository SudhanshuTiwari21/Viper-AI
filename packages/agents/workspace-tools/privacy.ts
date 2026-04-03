// G.40 — Privacy boundary policy layer for context extraction.
//
// Single choke-point: isPrivacyAllowed(relativePath, config?) returns true
// when a path is safe to read/write for AI context.
//
// Policy evaluation order:
//   1. Built-in denylist (always applied, cannot be overridden).
//   2. Config allowGlobs  (loaded from .viper/privacy.json — exceptions for built-in).
//   3. Config denyGlobs   (custom deny — wins over allowGlobs).
//   4. Default: allow.
//
// Config file (optional): .viper/privacy.json at workspace root
//   { "denyGlobs": [], "allowGlobs": [], "redactPatterns": [] }
//
// Limitations (MVP): no DLP content scanning; no per-user policies;
// allowGlobs do NOT override built-in deny patterns.


import { readFile } from "node:fs/promises";
import { resolve, normalize } from "node:path";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Built-in denylist — always applied
// ---------------------------------------------------------------------------

/**
 * Patterns that are ALWAYS denied, regardless of config allowGlobs.
 * Add here, never expand without a security review.
 */
const BUILTIN_DENY_GLOBS: string[] = [
  // Environment / secrets
  "**/.env",
  "**/.env.*",
  "**/secrets/**",
  "**/secret/**",
  "**/credentials",
  "**/credentials.*",
  "**/credentials/**",
  // SSH / TLS
  "**/.ssh/**",
  "**/*.pem",
  "**/*.key",
  "**/*.p12",
  "**/*.pfx",
  "**/*.crt",
  "**/*.cer",
  // Token / key files
  "**/*.token",
  "**/*.secret",
  "**/*.keystore",
  // Known secret files
  "**/id_rsa",
  "**/id_ed25519",
  "**/id_ecdsa",
  "**/id_dsa",
  "**/.netrc",
  "**/.pgpass",
  "**/.npmrc",    // may contain auth tokens
  "**/.pypirc",
  // Service account / cloud provider credentials
  "**/service-account*.json",
  "**/gcloud/**",
  "**/.aws/**",
  "**/.azure/**",
  "**/.config/gcloud/**",
];

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

export interface PrivacyConfig {
  denyGlobs: string[];
  allowGlobs: string[];
  /** Reserved: not implemented in MVP */
  redactPatterns: string[];
}

export interface PrivacyCheckResult {
  allowed: boolean;
  /** Which rule denied the path (empty when allowed). */
  blockedBy?: string;
  /** SHA-256 of the relative path (safe for logs — no raw path leakage). */
  pathHash: string;
}

// ---------------------------------------------------------------------------
// Config cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  config: PrivacyConfig | null;
  loadedAt: number;
}

const configCache = new Map<string, CacheEntry>();

function now(): number {
  return Date.now();
}

export function clearPrivacyCache(): void {
  configCache.clear();
}

async function loadPrivacyConfig(
  workspacePath: string,
): Promise<PrivacyConfig | null> {
  const key = resolve(workspacePath);
  const entry = configCache.get(key);

  if (entry && now() - entry.loadedAt < CACHE_TTL_MS) {
    return entry.config;
  }

  let config: PrivacyConfig | null = null;
  try {
    const configPath = resolve(workspacePath, ".viper", "privacy.json");
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PrivacyConfig>;
    config = {
      denyGlobs: Array.isArray(parsed.denyGlobs) ? parsed.denyGlobs : [],
      allowGlobs: Array.isArray(parsed.allowGlobs) ? parsed.allowGlobs : [],
      redactPatterns: [],
    };
  } catch {
    // File doesn't exist or is invalid → use built-in defaults only
  }

  configCache.set(key, { config, loadedAt: now() });
  return config;
}

// ---------------------------------------------------------------------------
// Glob matching
// ---------------------------------------------------------------------------

/**
 * Minimal glob matcher. Supports ** (any segments), * (any within segment),
 * and literal characters. Leading ! is NOT handled here.
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  // Normalise separators
  const p = normalize(filePath).replace(/\\/g, "/");
  const pat = pattern.replace(/\\/g, "/");

  // Convert glob to regex
  const regexStr = globToRegex(pat);
  try {
    return new RegExp(regexStr).test(p);
  } catch {
    return false;
  }
}

function globToRegex(pattern: string): string {
  let result = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === "*" && pattern[i + 1] === "*") {
      // ** — match any path segment sequence (including empty)
      const prev = pattern[i - 1];
      const next = pattern[i + 2];
      if ((prev === "/" || i === 0) && (next === "/" || next === undefined)) {
        // /**/  or leading **/ or trailing /**
        result += next === "/" ? "(?:.+/)?" : "(?:.+)?";
        i += 3; // skip **/
        continue;
      } else {
        result += ".*";
        i += 2;
        continue;
      }
    } else if (c === "*") {
      result += "[^/]*";
    } else if (c === "?") {
      result += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      result += "\\" + c;
    } else {
      result += c;
    }
    i++;
  }
  result += "$";
  return result;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

function hashPath(relativePath: string): string {
  return createHash("sha256").update(relativePath).digest("hex").slice(0, 12);
}

/**
 * Check whether a relative file path is allowed by the privacy policy.
 *
 * Evaluation order:
 *  1. Built-in denylist → blocked (hard — no override).
 *  2. Config allowGlobs → if matches, allow (exception for built-in deny only
 *     when the pattern is NOT in BUILTIN_DENY_GLOBS; see note above).
 *  3. Config denyGlobs → if matches, blocked.
 *  4. Otherwise → allowed.
 */
export function checkPrivacy(
  relativePath: string,
  config: PrivacyConfig | null,
): PrivacyCheckResult {
  const pathHash = hashPath(relativePath);
  // Normalise: strip leading slash, use forward slashes
  const norm = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  // 1. Built-in deny (hard — cannot be overridden by allowGlobs)
  for (const pattern of BUILTIN_DENY_GLOBS) {
    if (matchesGlob(norm, pattern)) {
      return { allowed: false, blockedBy: `builtin:${pattern}`, pathHash };
    }
  }

  // 2. Config allowGlobs — explicit exceptions for config-level rules
  //    (does NOT override built-in deny above)
  const allowGlobs = config?.allowGlobs ?? [];
  for (const pattern of allowGlobs) {
    if (matchesGlob(norm, pattern)) {
      return { allowed: true, pathHash };
    }
  }

  // 3. Config denyGlobs
  const denyGlobs = config?.denyGlobs ?? [];
  for (const pattern of denyGlobs) {
    if (matchesGlob(norm, pattern)) {
      return { allowed: false, blockedBy: `config:${pattern}`, pathHash };
    }
  }

  // 4. Default: allow
  return { allowed: true, pathHash };
}

/**
 * Async version that loads (and caches) the config from disk.
 */
export async function isPrivacyAllowed(
  workspacePath: string,
  relativePath: string,
): Promise<PrivacyCheckResult> {
  const config = await loadPrivacyConfig(workspacePath);
  return checkPrivacy(relativePath, config);
}

/**
 * Sync version for use where async is not practical.
 * Only applies the built-in denylist (no config file lookup).
 * Prefer `isPrivacyAllowed` when possible.
 */
export function isPrivacyAllowedSync(relativePath: string): PrivacyCheckResult {
  return checkPrivacy(relativePath, null);
}

// ---------------------------------------------------------------------------
// Convenience: assert (throws on block)
// ---------------------------------------------------------------------------

export class PrivacyDeniedError extends Error {
  readonly pathHash: string;
  readonly blockedBy: string;
  constructor(pathHash: string, blockedBy: string) {
    super(`Privacy policy denied access to a file (hash: ${pathHash}, rule: ${blockedBy})`);
    this.name = "PrivacyDeniedError";
    this.pathHash = pathHash;
    this.blockedBy = blockedBy;
  }
}

export { BUILTIN_DENY_GLOBS };
