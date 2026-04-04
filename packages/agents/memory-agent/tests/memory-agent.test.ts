import { describe, it, expect, beforeEach } from "vitest";
import type { SessionKey, MemoryEntry } from "../memory/memory.types";
import { sessionKeyString } from "../memory/memory.types";
import {
  addMemoryEntry,
  getMemoryEntries,
  clearMemory,
  __resetMemoryStoreForTests,
} from "../memory/memory-store";
import { retrieveMemory, buildMemorySnapshot } from "../memory/memory-retriever";
import {
  recordIntent,
  recordPatch,
  recordDecision,
  recordError,
  recordExecutionStep,
  recordReflectionIteration,
} from "../memory/memory-updater";
import {
  buildMemoryContext,
  injectMemoryIntoPrompt,
} from "../context/build-memory-context";

const key: SessionKey = {
  workspacePath: "/workspace/test",
  conversationId: "conv-1",
};

function makeEntry(
  type: MemoryEntry["type"],
  content: string,
  timestamp: number,
  weight = 5,
): MemoryEntry {
  return {
    id: `e-${timestamp}`,
    type,
    content,
    timestamp,
    meta: { _kind: "context" as const },
    weight,
  };
}

describe("memory-agent", () => {
  beforeEach(() => {
    __resetMemoryStoreForTests();
  });

  describe("sessionKeyString", () => {
    it("normalises paths", () => {
      expect(
        sessionKeyString({ workspacePath: "C:\\Users\\foo\\", conversationId: "c" }),
      ).toBe("C:/Users/foo::c");
    });
  });

  describe("memory-store", () => {
    it("stores and retrieves entries", () => {
      addMemoryEntry(key, makeEntry("intent", "fix login", 100));
      expect(getMemoryEntries(key)).toHaveLength(1);
      expect(getMemoryEntries(key)[0]!.content).toBe("fix login");
    });

    it("caps at 30 entries with weighted eviction", () => {
      for (let i = 0; i < 35; i++) {
        addMemoryEntry(key, makeEntry("context", `entry ${i}`, i, 1));
      }
      expect(getMemoryEntries(key).length).toBeLessThanOrEqual(30);
    });

    it("protects latest entry of each type during eviction", () => {
      for (let i = 0; i < 29; i++) {
        addMemoryEntry(key, makeEntry("context", `filler ${i}`, i, 1));
      }
      addMemoryEntry(key, makeEntry("error", "important error", 100, 2));
      addMemoryEntry(key, makeEntry("context", "overflow", 200, 1));

      const entries = getMemoryEntries(key);
      const hasError = entries.some((e) => e.type === "error");
      expect(hasError).toBe(true);
    });

    it("clearMemory removes all entries", () => {
      addMemoryEntry(key, makeEntry("intent", "test", 0));
      clearMemory(key);
      expect(getMemoryEntries(key)).toHaveLength(0);
    });
  });

  describe("memory-retriever", () => {
    it("returns entries sorted by most recent first", () => {
      addMemoryEntry(key, makeEntry("intent", "first", 1));
      addMemoryEntry(key, makeEntry("patch", "second", 2));
      const result = retrieveMemory(key);
      expect(result[0]!.timestamp).toBe(2);
      expect(result[1]!.timestamp).toBe(1);
    });

    it("filters by type", () => {
      addMemoryEntry(key, makeEntry("intent", "x", 1));
      addMemoryEntry(key, makeEntry("error", "y", 2));
      const result = retrieveMemory(key, { types: ["error"] });
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("error");
    });

    it("respects limit", () => {
      for (let i = 0; i < 5; i++) {
        addMemoryEntry(key, makeEntry("intent", `c${i}`, i));
      }
      expect(retrieveMemory(key, { limit: 2 })).toHaveLength(2);
    });
  });

  describe("buildMemorySnapshot", () => {
    it("returns empty snapshot for empty memory", () => {
      const snap = buildMemorySnapshot(key);
      expect(snap.lastIntent).toBeUndefined();
      expect(snap.lastPatch).toBeUndefined();
      expect(snap.lastLoopReflection).toBeUndefined();
      expect(snap.recentFiles).toEqual([]);
      expect(snap.narrative).toBe("");
    });

    it("captures lastIntent from structured meta", () => {
      recordIntent(key, "CODE_FIX", "fix the login API", ["login.ts"]);
      const snap = buildMemorySnapshot(key);
      expect(snap.lastIntent).toEqual({
        intent: "CODE_FIX",
        summary: "fix the login API",
        entities: ["login.ts"],
      });
    });

    it("captures lastPatch with files", () => {
      recordPatch(key, ["auth/login.ts", "utils.ts"], true, 3);
      const snap = buildMemorySnapshot(key);
      expect(snap.lastPatch).toEqual({ files: ["auth/login.ts", "utils.ts"], success: true });
      expect(snap.recentFiles).toContain("auth/login.ts");
    });

    it("captures lastError", () => {
      recordError(key, "openai rate limit", "llm");
      const snap = buildMemorySnapshot(key);
      expect(snap.lastError).toBe("openai rate limit");
    });

    it("includes execution step failures in narrative", () => {
      recordExecutionStep(key, "s1", "SEARCH_SYMBOL", "failed", 100, "timeout");
      const snap = buildMemorySnapshot(key);
      expect(snap.narrative).toContain("SEARCH_SYMBOL failed");
      expect(snap.narrative).toContain("timeout");
    });

    it("captures lastLoopReflection from recordReflectionIteration", () => {
      recordReflectionIteration(key, 1, "widen search", "patch failed", true);
      const snap = buildMemorySnapshot(key);
      expect(snap.lastLoopReflection).toEqual({
        iteration: 1,
        strategy: "widen search",
        failureSummary: "patch failed",
        shouldRetry: true,
      });
      expect(snap.narrative).toContain("Loop reflection");
    });
  });

  describe("memory-updater — structured entries", () => {
    it("recordIntent stores typed metadata", () => {
      recordIntent(key, "FIX_BUG", "fix the login API", ["login.ts"]);
      const e = getMemoryEntries(key)[0]!;
      expect(e.type).toBe("intent");
      expect(e.meta._kind).toBe("intent");
      if (e.meta._kind === "intent") {
        expect(e.meta.intent).toBe("FIX_BUG");
        expect(e.meta.entities).toEqual(["login.ts"]);
      }
    });

    it("recordPatch stores files and success", () => {
      recordPatch(key, ["a.ts", "b.ts"], false, 2);
      const e = getMemoryEntries(key)[0]!;
      expect(e.meta._kind).toBe("patch");
      if (e.meta._kind === "patch") {
        expect(e.meta.files).toEqual(["a.ts", "b.ts"]);
        expect(e.meta.success).toBe(false);
        expect(e.meta.operationCount).toBe(2);
      }
    });

    it("recordExecutionStep stores step lifecycle", () => {
      recordExecutionStep(key, "s1", "ANALYZE_CODE", "completed", 450);
      const e = getMemoryEntries(key)[0]!;
      expect(e.type).toBe("execution-step");
      if (e.meta._kind === "execution-step") {
        expect(e.meta.stepId).toBe("s1");
        expect(e.meta.status).toBe("completed");
        expect(e.meta.durationMs).toBe(450);
      }
    });

    it("recordDecision stores rationale", () => {
      recordDecision(key, "using JWT", "simpler than sessions");
      const e = getMemoryEntries(key)[0]!;
      if (e.meta._kind === "decision") {
        expect(e.meta.rationale).toBe("simpler than sessions");
      }
    });

    it("recordError stores source", () => {
      recordError(key, "disk full", "file-manager", "step-3");
      const e = getMemoryEntries(key)[0]!;
      if (e.meta._kind === "error") {
        expect(e.meta.source).toBe("file-manager");
        expect(e.meta.stepId).toBe("step-3");
      }
    });
  });

  describe("build-memory-context", () => {
    it("returns empty string with no memory", () => {
      expect(buildMemoryContext(key)).toBe("");
    });

    it("returns rich context with structured data", () => {
      recordIntent(key, "FIX", "fix login", ["auth.ts"]);
      recordPatch(key, ["auth.ts"], true);
      const ctx = buildMemoryContext(key);
      expect(ctx).toContain("PREVIOUS CONTEXT");
      expect(ctx).toContain("INTENT");
      expect(ctx).toContain("PATCH");
      expect(ctx).toContain("auth.ts");
    });

    it("injectMemoryIntoPrompt prepends context", () => {
      recordIntent(key, "FIX", "fix login");
      const result = injectMemoryIntoPrompt("optimize it", key);
      expect(result).toContain("PREVIOUS CONTEXT");
      expect(result).toContain("optimize it");
    });

    it("injectMemoryIntoPrompt is passthrough with no memory", () => {
      expect(injectMemoryIntoPrompt("optimize it", key)).toBe("optimize it");
    });
  });

  describe("weighted eviction priority", () => {
    it("high-weight entries survive over low-weight entries", () => {
      for (let i = 0; i < 28; i++) {
        addMemoryEntry(key, makeEntry("context", `low ${i}`, i, 1));
      }
      recordPatch(key, ["important.ts"], true);
      recordIntent(key, "CRITICAL", "critical fix");

      for (let i = 0; i < 5; i++) {
        addMemoryEntry(key, makeEntry("context", `overflow ${i}`, 200 + i, 1));
      }

      const entries = getMemoryEntries(key);
      const hasPatch = entries.some((e) => e.type === "patch");
      const hasIntent = entries.some((e) => e.type === "intent");
      expect(hasPatch).toBe(true);
      expect(hasIntent).toBe(true);
    });
  });
});
