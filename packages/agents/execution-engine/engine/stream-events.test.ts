import { describe, it, expect } from "vitest";
import type { StreamEvent } from "./stream-events";

describe("StreamEvent", () => {
  it("accepts retrieval:confidence variant", () => {
    const e: StreamEvent = {
      type: "retrieval:confidence",
      data: {
        schema_version: "1.0",
        overall: 0.42,
        counts: {
          candidatesConsidered: 2,
          filesSelected: 1,
          functionsSelected: 0,
          snippetsSelected: 1,
          estimatedTokens: 50,
        },
        signals: { maxScore: 0.5, meanScore: 0.5 },
        index_state: "ready",
      },
    };
    expect(e.type).toBe("retrieval:confidence");
  });

  it("accepts validation:* variants (B.8)", () => {
    const started: StreamEvent = {
      type: "validation:started",
      data: { command: "npm run check-types", tool: "edit_file" },
    };
    const passed: StreamEvent = {
      type: "validation:passed",
      data: { exitCode: 0, summary: "ok" },
    };
    const failed: StreamEvent = {
      type: "validation:failed",
      data: { exitCode: 1, error: "types" },
    };
    expect(started.type).toBe("validation:started");
    expect(passed.data.exitCode).toBe(0);
    expect(failed.data.exitCode).toBe(1);
  });

  it("accepts auto-repair:* variants (B.9)", () => {
    const attempt: StreamEvent = {
      type: "auto-repair:attempt",
      data: { cycle: 1, command: "npm run fix", tool: "edit_file" },
    };
    const result: StreamEvent = {
      type: "auto-repair:result",
      data: { cycle: 1, success: true, exitCode: 0, summary: "ok" },
    };
    expect(attempt.type).toBe("auto-repair:attempt");
    expect(result.data.success).toBe(true);
  });
});
