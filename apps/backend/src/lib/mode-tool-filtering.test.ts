import { describe, it, expect } from "vitest";
import { buildWorkspaceTools } from "@repo/agentic-loop";
import { getAllowedToolNames } from "./mode-tool-policy.js";
import type { ChatMode } from "../validators/request.schemas.js";

function toolNames(mode: ChatMode): string[] {
  const allTools = buildWorkspaceTools("/tmp/fake-workspace");
  const allowed = getAllowedToolNames(mode);
  const filtered = mode === "agent"
    ? allTools
    : allTools.filter((t) => allowed.has(t.definition.function.name));
  return filtered.map((t) => t.definition.function.name);
}

describe("buildWorkspaceTools filtering by mode (C.12)", () => {
  it("agent mode returns all 7 workspace tools", () => {
    const names = toolNames("agent");
    expect(names).toContain("read_file");
    expect(names).toContain("edit_file");
    expect(names).toContain("create_file");
    expect(names).toContain("run_command");
    expect(names.length).toBe(7);
  });

  it("ask mode returns only read-only tools (no edits, no run_command)", () => {
    const names = toolNames("ask");
    expect(names).toContain("read_file");
    expect(names).toContain("list_directory");
    expect(names).toContain("search_text");
    expect(names).toContain("search_files");
    expect(names).not.toContain("edit_file");
    expect(names).not.toContain("create_file");
    expect(names).not.toContain("run_command");
  });

  it("plan mode matches ask (read-only)", () => {
    expect(toolNames("plan")).toEqual(toolNames("ask"));
  });

  it("debug mode includes run_command but not edits", () => {
    const names = toolNames("debug");
    expect(names).toContain("read_file");
    expect(names).toContain("run_command");
    expect(names).not.toContain("edit_file");
    expect(names).not.toContain("create_file");
  });
});
