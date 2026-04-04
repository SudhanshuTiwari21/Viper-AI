import type { ToolFn } from "./tool.types";
import { runContextTool } from "./context-engine.tool";
import { runImplementationTool } from "./implementation.tool";
import { runWorkspaceTool } from "./workspace.tool";

export const TOOL_REGISTRY: Record<string, ToolFn> = {
  SEARCH_SYMBOL: runContextTool,
  SEARCH_EMBEDDING: runContextTool,
  FETCH_DEPENDENCIES: runContextTool,
  GENERATE_PATCH: runImplementationTool,
  READ_FILE: runWorkspaceTool,
  LIST_DIRECTORY: runWorkspaceTool,
  SEARCH_TEXT: runWorkspaceTool,
};
