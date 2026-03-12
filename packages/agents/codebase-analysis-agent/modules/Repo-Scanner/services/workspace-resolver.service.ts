import fs from "fs/promises";
import path from "path";
import type { WorkspaceInput } from "../types/workspace.types";
import { WorkspaceNotFoundError } from "../types/workspace.types";

const DEFAULT_WORKSPACES_DIR = "~/.viper/workspaces";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    return path.join(home, p.slice(2));
  }
  return p;
}

/**
 * Resolve and validate workspace path. If workspacePath is not provided, resolves to ~/.viper/workspaces/<repo_id>.
 * Throws WorkspaceNotFoundError if the path does not exist.
 */
export async function resolveWorkspace(input: WorkspaceInput): Promise<{
  workspacePath: string;
  repo_id: string;
  branch?: string;
}> {
  const workspacePath = input.workspacePath
    ? path.isAbsolute(input.workspacePath)
      ? input.workspacePath
      : path.resolve(expandHome(DEFAULT_WORKSPACES_DIR), input.workspacePath)
    : path.join(expandHome(DEFAULT_WORKSPACES_DIR), input.repo_id);

  try {
    await fs.access(workspacePath);
  } catch {
    throw new WorkspaceNotFoundError(workspacePath);
  }

  return {
    workspacePath,
    repo_id: input.repo_id,
    branch: input.branch,
  };
}
