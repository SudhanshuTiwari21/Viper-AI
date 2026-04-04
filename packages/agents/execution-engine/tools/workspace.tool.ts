import {
  readWorkspaceFile,
  listWorkspaceDirectory,
  searchWorkspaceText,
  isPrivacyAllowed,
} from "@repo/workspace-tools";
import type { ToolInput, ToolOutput } from "./tool.types";
import type { ExecutionContext } from "../engine/execution.types";

export async function runWorkspaceTool(
  input: ToolInput,
  ctx: ExecutionContext,
): Promise<ToolOutput> {
  const workspace = ctx.workspacePath;
  if (!workspace) {
    ctx.logs.push(`[Viper] workspace tool ${input.type}: no workspacePath — skipped`);
    return {};
  }

  const entities = input.entities ?? [];

  switch (input.type) {
    case "READ_FILE": {
      const results: string[] = [];
      for (const filePath of entities) {
        // G.40: emit privacy:path:blocked log before readWorkspaceFile silently returns null
        const privacyCheck = await isPrivacyAllowed(workspace, filePath);
        if (!privacyCheck.allowed) {
          ctx.logs.push(
            `[Viper] READ_FILE: privacy:path:blocked hash=${privacyCheck.pathHash} rule=${privacyCheck.blockedBy ?? "unknown"}`,
          );
          continue;
        }
        const file = await readWorkspaceFile(workspace, filePath);
        if (file) {
          results.push(
            `--- ${filePath} (${file.lines} lines${file.truncated ? ", truncated" : ""}) ---\n${file.content}`,
          );
          ctx.onEvent?.({
            type: "tool:result",
            data: {
              tool: "read_file",
              summary: `Read ${filePath} (${file.lines} lines)`,
              durationMs: 0,
            },
          } as Parameters<NonNullable<typeof ctx.onEvent>>[0]);
        }
      }
      ctx.logs.push(`[Viper] READ_FILE: read ${results.length}/${entities.length} files`);
      return {};
    }

    case "LIST_DIRECTORY": {
      const dir = entities[0] ?? ".";
      const listing = await listWorkspaceDirectory(workspace, dir);
      const summary = listing.entries
        .map((e) => `${e.type === "directory" ? "📁" : "📄"} ${e.name}`)
        .join("\n");
      ctx.logs.push(
        `[Viper] LIST_DIRECTORY: ${listing.entries.length} entries${listing.truncated ? " (truncated)" : ""}`,
      );
      ctx.onEvent?.({
        type: "tool:result",
        data: {
          tool: "list_directory",
          summary: `Listed ${listing.entries.length} entries`,
          durationMs: 0,
        },
      } as Parameters<NonNullable<typeof ctx.onEvent>>[0]);
      return {};
    }

    case "SEARCH_TEXT": {
      const query = entities[0] ?? "";
      if (!query) return {};
      const result = await searchWorkspaceText(workspace, query);
      ctx.logs.push(
        `[Viper] SEARCH_TEXT: ${result.matches.length} matches in ${result.filesSearched} files`,
      );
      ctx.onEvent?.({
        type: "tool:result",
        data: {
          tool: "search_text",
          summary: `${result.matches.length} matches in ${result.filesSearched} files`,
          durationMs: 0,
        },
      } as Parameters<NonNullable<typeof ctx.onEvent>>[0]);
      return {};
    }

    default:
      ctx.logs.push(`[Viper] workspace tool: unknown type ${input.type}`);
      return {};
  }
}
