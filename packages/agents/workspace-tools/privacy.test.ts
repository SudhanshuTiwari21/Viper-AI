/**
 * G.40 — Privacy policy layer unit tests.
 *
 * All tests are pure (no file system, no network).
 * Config loading is tested by passing explicit PrivacyConfig objects to
 * checkPrivacy() directly.
 */

import { describe, it, expect } from "vitest";
import {
  matchesGlob,
  checkPrivacy,
  BUILTIN_DENY_GLOBS,
  PrivacyDeniedError,
  type PrivacyConfig,
} from "./privacy.js";

// ---------------------------------------------------------------------------
// matchesGlob
// ---------------------------------------------------------------------------

describe("matchesGlob", () => {
  describe("**/ prefix matching", () => {
    it("**/.env matches top-level .env", () => {
      expect(matchesGlob(".env", "**/.env")).toBe(true);
    });
    it("**/.env matches nested .env", () => {
      expect(matchesGlob("sub/.env", "**/.env")).toBe(true);
    });
    it("**/.env matches deeply nested .env", () => {
      expect(matchesGlob("a/b/c/.env", "**/.env")).toBe(true);
    });
    it("**/.env does NOT match .env.example", () => {
      expect(matchesGlob(".env.example", "**/.env")).toBe(false);
    });
  });

  describe("**/*.ext wildcard", () => {
    it("**/*.pem matches root cert.pem", () => {
      expect(matchesGlob("cert.pem", "**/*.pem")).toBe(true);
    });
    it("**/*.pem matches nested cert.pem", () => {
      expect(matchesGlob("certs/ca.pem", "**/*.pem")).toBe(true);
    });
    it("**/*.pem does NOT match cert.pemx", () => {
      expect(matchesGlob("cert.pemx", "**/*.pem")).toBe(false);
    });
  });

  describe("**/.env.* wildcard (dot-env variants)", () => {
    it("matches .env.local", () => {
      expect(matchesGlob(".env.local", "**/.env.*")).toBe(true);
    });
    it("matches nested .env.production", () => {
      expect(matchesGlob("config/.env.production", "**/.env.*")).toBe(true);
    });
    it("does NOT match .envrc", () => {
      // .envrc doesn't match .env.* (dot required after env)
      expect(matchesGlob(".envrc", "**/.env.*")).toBe(false);
    });
  });

  describe("**/.ssh/** directory", () => {
    it("matches .ssh/id_rsa", () => {
      expect(matchesGlob(".ssh/id_rsa", "**/.ssh/**")).toBe(true);
    });
    it("matches home/.ssh/config", () => {
      expect(matchesGlob("home/.ssh/config", "**/.ssh/**")).toBe(true);
    });
    it("does NOT match .sshrc", () => {
      expect(matchesGlob(".sshrc", "**/.ssh/**")).toBe(false);
    });
  });

  describe("literal filename", () => {
    it("exact match", () => {
      expect(matchesGlob(".env.example", ".env.example")).toBe(true);
    });
    it("does not match partial", () => {
      expect(matchesGlob("sub/.env.example", ".env.example")).toBe(false);
    });
  });

  describe("**/secrets/** directory", () => {
    it("matches secrets/db.json", () => {
      expect(matchesGlob("secrets/db.json", "**/secrets/**")).toBe(true);
    });
    it("matches nested a/secrets/b", () => {
      expect(matchesGlob("a/secrets/b", "**/secrets/**")).toBe(true);
    });
    it("does NOT match secrets-manager/config", () => {
      expect(matchesGlob("secrets-manager/config", "**/secrets/**")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// checkPrivacy — built-in denylist
// ---------------------------------------------------------------------------

describe("checkPrivacy — built-in deny", () => {
  it("blocks .env", () => {
    const r = checkPrivacy(".env", null);
    expect(r.allowed).toBe(false);
    expect(r.blockedBy).toMatch(/builtin/);
  });

  it("blocks sub/dir/.env", () => {
    expect(checkPrivacy("sub/dir/.env", null).allowed).toBe(false);
  });

  it("blocks .env.local", () => {
    expect(checkPrivacy(".env.local", null).allowed).toBe(false);
  });

  it("blocks .env.production", () => {
    expect(checkPrivacy("apps/.env.production", null).allowed).toBe(false);
  });

  it("blocks cert.pem", () => {
    expect(checkPrivacy("cert.pem", null).allowed).toBe(false);
  });

  it("blocks nested key.pem", () => {
    expect(checkPrivacy("certs/key.pem", null).allowed).toBe(false);
  });

  it("blocks .ssh/id_rsa", () => {
    expect(checkPrivacy(".ssh/id_rsa", null).allowed).toBe(false);
  });

  it("blocks nested home/.ssh/config", () => {
    expect(checkPrivacy("home/.ssh/config", null).allowed).toBe(false);
  });

  it("blocks secrets/db.json", () => {
    expect(checkPrivacy("secrets/db.json", null).allowed).toBe(false);
  });

  it("blocks credentials.json", () => {
    expect(checkPrivacy("credentials.json", null).allowed).toBe(false);
  });

  it("blocks .npmrc (may contain auth token)", () => {
    expect(checkPrivacy(".npmrc", null).allowed).toBe(false);
  });

  it("blocks service-account.json", () => {
    expect(checkPrivacy("service-account.json", null).allowed).toBe(false);
  });

  it("blocks .aws/credentials", () => {
    expect(checkPrivacy(".aws/credentials", null).allowed).toBe(false);
  });

  it("allows src/index.ts", () => {
    const r = checkPrivacy("src/index.ts", null);
    expect(r.allowed).toBe(true);
  });

  it("allows README.md", () => {
    expect(checkPrivacy("README.md", null).allowed).toBe(true);
  });

  it("blocks .env.example (matches **/.env.*)", () => {
    // .env.example matches **/.env.* → blocked by default.
    // Users who need it can add ".env.example" to allowGlobs in .viper/privacy.json.
    expect(checkPrivacy(".env.example", null).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkPrivacy — config denyGlobs
// ---------------------------------------------------------------------------

describe("checkPrivacy — config denyGlobs", () => {
  const config: PrivacyConfig = {
    denyGlobs: ["**/internal/**", "**/*.private.ts"],
    allowGlobs: [],
    redactPatterns: [],
  };

  it("blocks internal/data.json via config deny", () => {
    const r = checkPrivacy("internal/data.json", config);
    expect(r.allowed).toBe(false);
    expect(r.blockedBy).toMatch(/config:/);
  });

  it("blocks foo.private.ts via config deny", () => {
    expect(checkPrivacy("src/foo.private.ts", config).allowed).toBe(false);
  });

  it("still allows src/index.ts", () => {
    expect(checkPrivacy("src/index.ts", config).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkPrivacy — config allowGlobs (override config deny)
// ---------------------------------------------------------------------------

describe("checkPrivacy — config allowGlobs", () => {
  const config: PrivacyConfig = {
    denyGlobs: ["**/internal/**"],
    allowGlobs: ["internal/public.json"],
    redactPatterns: [],
  };

  it("allowGlobs can override config denyGlobs", () => {
    // internal/public.json matches allowGlobs → checked before denyGlobs
    expect(checkPrivacy("internal/public.json", config).allowed).toBe(true);
  });

  it("allowGlobs do NOT override built-in deny (.env)", () => {
    const configWithAllow: PrivacyConfig = {
      denyGlobs: [],
      allowGlobs: ["**/.env"],   // trying to whitelist .env
      redactPatterns: [],
    };
    // Built-in deny is checked first — .env still blocked
    expect(checkPrivacy(".env", configWithAllow).allowed).toBe(false);
  });

  it("non-matching path still blocked by denyGlobs", () => {
    expect(checkPrivacy("internal/secret.json", config).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pathHash
// ---------------------------------------------------------------------------

describe("path hash in result", () => {
  it("returns a 12-char hex hash", () => {
    const r = checkPrivacy("src/index.ts", null);
    expect(r.pathHash).toMatch(/^[0-9a-f]{12}$/);
  });

  it("same path produces same hash", () => {
    const r1 = checkPrivacy("src/foo.ts", null);
    const r2 = checkPrivacy("src/foo.ts", null);
    expect(r1.pathHash).toBe(r2.pathHash);
  });

  it("different paths produce different hashes", () => {
    const r1 = checkPrivacy("src/foo.ts", null);
    const r2 = checkPrivacy("src/bar.ts", null);
    expect(r1.pathHash).not.toBe(r2.pathHash);
  });
});

// ---------------------------------------------------------------------------
// BUILTIN_DENY_GLOBS export
// ---------------------------------------------------------------------------

describe("BUILTIN_DENY_GLOBS", () => {
  it("includes .env pattern", () => {
    expect(BUILTIN_DENY_GLOBS).toContain("**/.env");
  });
  it("includes .pem pattern", () => {
    expect(BUILTIN_DENY_GLOBS).toContain("**/*.pem");
  });
  it("includes .ssh pattern", () => {
    expect(BUILTIN_DENY_GLOBS).toContain("**/.ssh/**");
  });
});

// ---------------------------------------------------------------------------
// PrivacyDeniedError
// ---------------------------------------------------------------------------

describe("PrivacyDeniedError", () => {
  it("includes pathHash and blockedBy", () => {
    const err = new PrivacyDeniedError("abc123", "builtin:**/.env");
    expect(err.pathHash).toBe("abc123");
    expect(err.blockedBy).toBe("builtin:**/.env");
    expect(err.message).toContain("abc123");
    expect(err.name).toBe("PrivacyDeniedError");
  });
});
