import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const DEFAULT_WORKSPACES_DIR = "~/.viper/workspaces";

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    return path.join(home, p.slice(2));
  }
  return p;
}

/**
 * Clone a repository into the given workspace path.
 * Used by the Intent Agent; Repo Scanner does not clone.
 */
export async function cloneRepository(
  repoUrl: string,
  workspacePath: string
): Promise<string> {
  const resolved = path.isAbsolute(workspacePath)
    ? workspacePath
    : path.join(expandHome(DEFAULT_WORKSPACES_DIR), workspacePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await execAsync(`git clone ${repoUrl} ${resolved}`);
  return resolved;
}

/**
 * Pull latest changes for a repository at the given workspace path.
 */
export async function pullRepository(workspacePath: string): Promise<void> {
  const resolved = path.isAbsolute(workspacePath)
    ? workspacePath
    : path.join(expandHome(DEFAULT_WORKSPACES_DIR), workspacePath);
  await execAsync(`git -C ${resolved} pull`);
}

/**
 * Checkout a branch in the repository at the given workspace path.
 */
export async function checkoutBranch(
  workspacePath: string,
  branch: string
): Promise<void> {
  const resolved = path.isAbsolute(workspacePath)
    ? workspacePath
    : path.join(expandHome(DEFAULT_WORKSPACES_DIR), workspacePath);
  await execAsync(`git -C ${resolved} checkout ${branch}`);
}
