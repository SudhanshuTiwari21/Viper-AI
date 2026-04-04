import { describe, it, expect } from "vitest";
import { isUrlAllowed, parseAllowedOrigins } from "../url-allowlist.js";

// ---------------------------------------------------------------------------
// parseAllowedOrigins
// ---------------------------------------------------------------------------

describe("parseAllowedOrigins", () => {
  it("returns empty set for undefined", () => {
    expect(parseAllowedOrigins(undefined).size).toBe(0);
  });

  it("returns empty set for empty string", () => {
    expect(parseAllowedOrigins("").size).toBe(0);
  });

  it("parses a single origin", () => {
    const s = parseAllowedOrigins("https://staging.example.com");
    expect(s.has("https://staging.example.com")).toBe(true);
  });

  it("parses multiple origins", () => {
    const s = parseAllowedOrigins("https://a.com, http://b.local:8080");
    expect(s.has("https://a.com")).toBe(true);
    expect(s.has("http://b.local:8080")).toBe(true);
  });

  it("lowercases origin strings", () => {
    const s = parseAllowedOrigins("HTTPS://Staging.Example.COM");
    expect(s.has("https://staging.example.com")).toBe(true);
  });

  it("strips trailing slashes", () => {
    const s = parseAllowedOrigins("https://example.com/");
    expect(s.has("https://example.com")).toBe(true);
  });

  it("ignores blank entries", () => {
    const s = parseAllowedOrigins(",, ,");
    expect(s.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isUrlAllowed — default policy (no extra origins)
// ---------------------------------------------------------------------------

describe("isUrlAllowed — default policy", () => {
  it("allows http://localhost", () => {
    expect(isUrlAllowed("http://localhost")).toBe(true);
  });

  it("allows http://localhost with port", () => {
    expect(isUrlAllowed("http://localhost:3000")).toBe(true);
  });

  it("allows http://localhost with path", () => {
    expect(isUrlAllowed("http://localhost:3000/api/health")).toBe(true);
  });

  it("allows http://127.0.0.1", () => {
    expect(isUrlAllowed("http://127.0.0.1")).toBe(true);
  });

  it("allows http://127.0.0.1 with port", () => {
    expect(isUrlAllowed("http://127.0.0.1:8080")).toBe(true);
  });

  it("allows https://localhost", () => {
    expect(isUrlAllowed("https://localhost")).toBe(true);
  });

  it("allows https://127.0.0.1:4443", () => {
    expect(isUrlAllowed("https://127.0.0.1:4443")).toBe(true);
  });

  it("blocks file: URLs", () => {
    expect(isUrlAllowed("file:///etc/passwd")).toBe(false);
  });

  it("blocks data: URLs", () => {
    expect(isUrlAllowed("data:text/html,<h1>hi</h1>")).toBe(false);
  });

  it("blocks javascript: URLs", () => {
    expect(isUrlAllowed("javascript:alert(1)")).toBe(false);
  });

  it("blocks blob: URLs", () => {
    expect(isUrlAllowed("blob:http://localhost/123")).toBe(false);
  });

  it("blocks arbitrary https origin", () => {
    expect(isUrlAllowed("https://example.com")).toBe(false);
  });

  it("blocks arbitrary http origin", () => {
    expect(isUrlAllowed("http://192.168.1.1")).toBe(false);
  });

  it("blocks malformed URL", () => {
    expect(isUrlAllowed("not-a-url")).toBe(false);
  });

  it("blocks empty string", () => {
    expect(isUrlAllowed("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isUrlAllowed — with extra origins
// ---------------------------------------------------------------------------

describe("isUrlAllowed — with extra allowed origins", () => {
  const extra = parseAllowedOrigins("https://staging.example.com,http://dev.local:8080");

  it("still allows localhost when extra origins are set", () => {
    expect(isUrlAllowed("http://localhost:3000", extra)).toBe(true);
  });

  it("allows an explicitly permitted extra origin", () => {
    expect(isUrlAllowed("https://staging.example.com/api/test", extra)).toBe(true);
  });

  it("allows extra origin with port", () => {
    expect(isUrlAllowed("http://dev.local:8080/path", extra)).toBe(true);
  });

  it("still blocks file: even with extra origins", () => {
    expect(isUrlAllowed("file:///etc/passwd", extra)).toBe(false);
  });

  it("still blocks an unknown origin", () => {
    expect(isUrlAllowed("https://other.example.com", extra)).toBe(false);
  });
});
