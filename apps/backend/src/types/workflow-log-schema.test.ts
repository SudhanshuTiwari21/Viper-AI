import { describe, it, expect } from "vitest";
import { VALID_WORKFLOW_STAGES, validateWorkflowLog } from "./workflow-log-schema.js";

function identityOverrides(overrides: Partial<{
  request_id: string;
  workspace_id: string;
  conversation_id: string | null;
}> = {}) {
  return {
    request_id: "req-1",
    workspace_id: "ws-1",
    conversation_id: "conv-1",
    ...overrides,
  };
}

describe("workflow-log-schema", () => {
  it("valid request:complete requires latency_ms", () => {
    const res = validateWorkflowLog("request:complete", {
      ...identityOverrides(),
      latency_ms: 123,
    });
    expect(res).toEqual({ valid: true });
  });

  it("rejects request:complete without latency_ms", () => {
    const res = validateWorkflowLog("request:complete", identityOverrides());
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.issues.join("; ")).toContain("latency_ms is required for request:complete");
    }
  });

  it("rejects latency_ms on non-request:complete stages", () => {
    const res = validateWorkflowLog("request:start", {
      ...identityOverrides(),
      latency_ms: 1,
    });
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.issues.join("; ")).toContain("latency_ms is only allowed for request:complete");
    }
  });

  it("rejects unknown workflow stages", () => {
    const res = validateWorkflowLog("unknown:stage", identityOverrides());
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.issues.join("; ")).toContain("workflow_stage");
    }
  });

  it("rejects missing request_id", () => {
    const res = validateWorkflowLog("request:start", {
      // request_id omitted
      workspace_id: "ws-1",
      conversation_id: null,
    });
    expect(res.valid).toBe(false);
  });

  it("allows null conversation_id", () => {
    const res = validateWorkflowLog("request:start", {
      ...identityOverrides({ conversation_id: null }),
    });
    expect(res).toEqual({ valid: true });
  });

  it("requires intent for route:* stages", () => {
    const res = validateWorkflowLog("route:direct-llm", {
      ...identityOverrides(),
      // intent omitted
    });
    expect(res.valid).toBe(false);
  });

  it("passes intent for route:* stages and ignores extra fields", () => {
    const res = validateWorkflowLog("route:direct-llm", {
      ...identityOverrides(),
      intent: "CODE_FIX",
      toolName: "read_file", // passthrough
      filesRead: 3, // passthrough
    });
    expect(res).toEqual({ valid: true });
  });

  it("sweeps every VALID_WORKFLOW_STAGES entry", () => {
    for (const stage of VALID_WORKFLOW_STAGES) {
      const payload: Record<string, unknown> = {
        ...identityOverrides(),
      };

      // Minimal conditional payload fields required by the schema
      if (stage === "request:complete") {
        payload.latency_ms = 50;
      }
      if (stage === "intent:complete") {
        payload.intent = "CODE_FIX";
      }
      if (stage === "route:direct-llm" || stage === "route:agentic") {
        payload.intent = "CODE_FIX";
      }

      const res = validateWorkflowLog(stage, payload);
      expect(res).toEqual({ valid: true });
    }
  });
});

