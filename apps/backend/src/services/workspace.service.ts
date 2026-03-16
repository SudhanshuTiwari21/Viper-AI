import fs from "node:fs/promises";

export async function verifyWorkspaceExists(workspacePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(workspacePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export function getRepoId(workspacePath: string): string {
  const normalized = workspacePath.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? "workspace";
}
