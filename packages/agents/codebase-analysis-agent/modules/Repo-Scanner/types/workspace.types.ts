/**
 * Input for Repo Scanner. Workspace must already exist on disk (e.g. cloned by Git Tool).
 */
export interface WorkspaceInput {
  repo_id: string;
  workspacePath: string;
  branch?: string;
}

/**
 * Thrown when the workspace path does not exist on the filesystem.
 */
export class WorkspaceNotFoundError extends Error {
  constructor(public readonly workspacePath: string) {
    super(`Workspace not found: ${workspacePath}`);
    this.name = "WorkspaceNotFoundError";
    Object.setPrototypeOf(this, WorkspaceNotFoundError.prototype);
  }
}
