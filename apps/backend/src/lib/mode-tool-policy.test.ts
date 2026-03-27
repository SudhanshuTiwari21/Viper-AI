import { describe, it, expect } from "vitest";
import { getAllowedToolNames, isToolAllowedByMode } from "./mode-tool-policy.js";
import type { ChatMode } from "../validators/request.schemas.js";

const MODES: ChatMode[] = ["ask", "plan", "debug", "agent"];

const READ_ONLY = ["read_file", "list_directory", "search_text", "search_files"];
const MUTATIONS = ["edit_file", "create_file"];
const COMMAND = "run_command";

describe("mode-tool-policy", () => {
  describe("getAllowedToolNames", () => {
    it.each<[ChatMode, string[], string[]]>([
      ["ask", READ_ONLY, [...MUTATIONS, COMMAND]],
      ["plan", READ_ONLY, [...MUTATIONS, COMMAND]],
      ["debug", [...READ_ONLY, COMMAND], MUTATIONS],
      ["agent", [...READ_ONLY, COMMAND, ...MUTATIONS], []],
    ])("mode=%s allows %j and blocks %j", (mode, allowed, blocked) => {
      const set = getAllowedToolNames(mode);
      for (const t of allowed) expect(set.has(t)).toBe(true);
      for (const t of blocked) expect(set.has(t)).toBe(false);
    });
  });

  describe("isToolAllowedByMode", () => {
    it("returns true for read_file in all modes", () => {
      for (const m of MODES) expect(isToolAllowedByMode(m, "read_file")).toBe(true);
    });
    it("blocks edit_file in ask/plan/debug", () => {
      for (const m of ["ask", "plan", "debug"] as ChatMode[]) {
        expect(isToolAllowedByMode(m, "edit_file")).toBe(false);
      }
    });
    it("allows edit_file in agent", () => {
      expect(isToolAllowedByMode("agent", "edit_file")).toBe(true);
    });
    it("allows run_command in debug and agent only", () => {
      expect(isToolAllowedByMode("ask", "run_command")).toBe(false);
      expect(isToolAllowedByMode("plan", "run_command")).toBe(false);
      expect(isToolAllowedByMode("debug", "run_command")).toBe(true);
      expect(isToolAllowedByMode("agent", "run_command")).toBe(true);
    });
  });
});
