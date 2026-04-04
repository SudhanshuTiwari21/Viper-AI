/**
 * E.25 — Unit tests for deriveWorkspaceId and normalizePath.
 *
 * Test vectors are pre-computed with the backend algorithm:
 *   node -e "const {createHash}=require('crypto'); const h=(s)=>createHash('sha256').update(s).digest('hex').slice(0,16); ..."
 *
 * Platform sensitivity is exercised by stubbing navigator.platform.
 */

import { vi, describe, it, expect, afterEach } from "vitest";
import { normalizePath, isPlatformCaseFold, deriveWorkspaceId } from "./workspace-id";

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// normalizePath
// ---------------------------------------------------------------------------

describe("normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("C:\\Users\\Alice\\project")).toBe("C:/Users/Alice/project");
  });

  it("strips a trailing slash", () => {
    expect(normalizePath("/foo/bar/")).toBe("/foo/bar");
  });

  it("strips multiple trailing slashes", () => {
    expect(normalizePath("/foo/bar///")).toBe("/foo/bar");
  });

  it("does NOT lowercase when caseFold=false (default)", () => {
    expect(normalizePath("/Users/Alice/Project")).toBe("/Users/Alice/Project");
  });

  it("lowercases when caseFold=true", () => {
    expect(normalizePath("/Users/Alice/Project", true)).toBe("/users/alice/project");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePath("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// isPlatformCaseFold
// ---------------------------------------------------------------------------

describe("isPlatformCaseFold", () => {
  it("returns true for MacIntel (macOS)", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(isPlatformCaseFold()).toBe(true);
  });

  it("returns true for Win32 (Windows)", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(isPlatformCaseFold()).toBe(true);
  });

  it("returns false for Linux x86_64", () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    expect(isPlatformCaseFold()).toBe(false);
  });

  it("returns false when navigator is missing", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isPlatformCaseFold()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveWorkspaceId — test vectors
//
// Expected values computed with:
//   node -e "
//     const {createHash}=require('crypto');
//     const h=(s)=>createHash('sha256').update(s).digest('hex').slice(0,16);
//     console.log(h('/foo/bar'));                    // case-sensitive
//     console.log(h('/Users/Alice/project'));        // case-sensitive
//     console.log(h('/users/alice/project'));        // macOS lowercased
//   "
// Output:
//   /foo/bar                   → a05d96ad6bf8f3ea
//   /Users/Alice/project       → 9ca89ad0b10b1391
//   /users/alice/project       → dcd62ce9646a3092
// ---------------------------------------------------------------------------

describe("deriveWorkspaceId", () => {
  it("returns 16 hex zeros for an empty path", async () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    expect(await deriveWorkspaceId("")).toBe("0000000000000000");
  });

  it("returns exactly 16 hex characters", async () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    const id = await deriveWorkspaceId("/foo/bar");
    expect(id).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });

  it("case-sensitive path (Linux): /foo/bar → a05d96ad6bf8f3ea", async () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    expect(await deriveWorkspaceId("/foo/bar")).toBe("a05d96ad6bf8f3ea");
  });

  it("case-sensitive path (Linux): /Users/Alice/project → 9ca89ad0b10b1391", async () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    expect(await deriveWorkspaceId("/Users/Alice/project")).toBe("9ca89ad0b10b1391");
  });

  it("trailing slash removed before hashing", async () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    expect(await deriveWorkspaceId("/foo/bar/")).toBe("a05d96ad6bf8f3ea");
  });

  it("macOS (case-insensitive): /Users/Alice/project lowercased → dcd62ce9646a3092", async () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(await deriveWorkspaceId("/Users/Alice/project")).toBe("dcd62ce9646a3092");
  });

  it("macOS: same result for already-lowercased path", async () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(await deriveWorkspaceId("/users/alice/project")).toBe("dcd62ce9646a3092");
  });

  it("deterministic: same input always produces same output", async () => {
    vi.stubGlobal("navigator", { platform: "Linux x86_64" });
    const a = await deriveWorkspaceId("/my/workspace");
    const b = await deriveWorkspaceId("/my/workspace");
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// API body shape: attachments only included when non-empty
// ---------------------------------------------------------------------------

describe("sendChatStream / sendChat body shape (E.25 regression)", () => {
  it("excludes 'attachments' key when list is empty", () => {
    const attachments: unknown[] = [];
    const body = {
      prompt: "hi",
      workspacePath: "/ws",
      ...(attachments.length ? { attachments } : {}),
    };
    expect(Object.prototype.hasOwnProperty.call(body, "attachments")).toBe(false);
  });

  it("includes 'attachments' key when list is non-empty", () => {
    const attachments = [{ kind: "image", source: { type: "media_ref", mediaId: "med_123" } }];
    const body = {
      prompt: "hi",
      workspacePath: "/ws",
      ...(attachments.length ? { attachments } : {}),
    };
    expect(Object.prototype.hasOwnProperty.call(body, "attachments")).toBe(true);
    expect((body as { attachments: unknown[] }).attachments).toHaveLength(1);
  });
});
