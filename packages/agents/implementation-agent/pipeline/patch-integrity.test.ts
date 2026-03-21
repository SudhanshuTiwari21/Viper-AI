import { describe, it, expect, beforeEach } from "vitest";
import type { Patch } from "./implementation.types";
import {
  hashPatch,
  stableStringify,
  isSubsetPatch,
  registerPatchPreview,
  verifyPatchApplyOrThrow,
  __resetPatchPreviewStoreForTests,
} from "./patch-integrity";

describe("patch-integrity", () => {
  beforeEach(() => {
    __resetPatchPreviewStoreForTests();
  });

  const samplePatch: Patch = {
    changes: [{ file: "a.ts", content: "x" }],
    operations: [
      {
        file: "b.ts",
        type: "insert",
        startLine: 1,
        content: "y",
      },
    ],
  };

  it("hashPatch is stable for same patch", () => {
    expect(hashPatch(samplePatch)).toBe(hashPatch(structuredClone(samplePatch)));
  });

  it("stableStringify sorts object keys", () => {
    const a = stableStringify({ z: 1, a: 2 });
    const b = stableStringify({ a: 2, z: 1 });
    expect(a).toBe(b);
  });

  it("register + verify full patch", () => {
    const id = "p1";
    const h = registerPatchPreview(id, samplePatch, "/ws");
    verifyPatchApplyOrThrow(structuredClone(samplePatch), id, h, "/ws");
  });

  it("rejects wrong hash", () => {
    const id = "p2";
    registerPatchPreview(id, samplePatch, "/ws");
    expect(() =>
      verifyPatchApplyOrThrow(samplePatch, id, "0".repeat(64), "/ws"),
    ).toThrow(/Patch hash mismatch/);
  });

  it("rejects tampered patch (not subset)", () => {
    const id = "p3";
    const h = registerPatchPreview(id, samplePatch, "/ws");
    const bad: Patch = {
      changes: [{ file: "other.ts", content: "nope" }],
      operations: [],
    };
    expect(() => verifyPatchApplyOrThrow(bad, id, h, "/ws")).toThrow(/does not match/);
  });

  it("allows subset patch with same preview hash", () => {
    const id = "p4";
    const h = registerPatchPreview(id, samplePatch, "/ws");
    const partial: Patch = {
      changes: [{ file: "a.ts", content: "x" }],
      operations: [],
    };
    verifyPatchApplyOrThrow(partial, id, h, "/ws");
  });

  it("isSubsetPatch", () => {
    expect(isSubsetPatch(samplePatch, { changes: [], operations: [] })).toBe(true);
    expect(
      isSubsetPatch(samplePatch, {
        changes: [{ file: "a.ts", content: "x" }],
        operations: [],
      }),
    ).toBe(true);
    expect(
      isSubsetPatch(samplePatch, {
        changes: [{ file: "a.ts", content: "wrong" }],
        operations: [],
      }),
    ).toBe(false);
  });
});
