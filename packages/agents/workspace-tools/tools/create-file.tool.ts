import { writeFile, stat, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type { CreateFileResult } from "../workspace-tools.types.js";
import { isPrivacyAllowed } from "../privacy.js";

/**
 * Creates a new file in the workspace (or overwrites if it exists).
 * Automatically creates parent directories if they don't exist.
 *
 * Safety: path traversal guard.
 */
export async function createWorkspaceFile(
  workspacePath: string,
  relativePath: string,
  content: string,
): Promise<CreateFileResult> {
  const absPath = resolve(workspacePath, relativePath);
  if (!absPath.startsWith(resolve(workspacePath))) {
    return { success: false, error: "Path traversal denied" };
  }

  // G.40: privacy gate — block creation of files at sensitive paths
  const privacy = await isPrivacyAllowed(workspacePath, relativePath);
  if (!privacy.allowed) {
    return { success: false, error: "Privacy policy denied access to this file" };
  }

  let existed = false;
  try {
    const info = await stat(absPath);
    existed = info.isFile();
  } catch {
    // File doesn't exist — that's fine
  }

  const dir = dirname(absPath);
  await mkdir(dir, { recursive: true });
  await writeFile(absPath, content, "utf-8");

  const lines = content.split("\n").length;

  return {
    success: true,
    file: relativePath,
    lines,
    overwritten: existed,
  };
}
