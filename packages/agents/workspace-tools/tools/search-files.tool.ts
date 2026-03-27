import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { resolve, relative, join } from "node:path";
import type { SearchFilesResult } from "../workspace-tools.types.js";

const IGNORE_DIRS = new Set([
  ".git", "node_modules", "dist", ".next", "build", "coverage",
  "__pycache__", ".turbo", ".cache", "vendor", ".venv", "venv", "target",
]);

const DEFAULT_MAX_FILES = 100;

function matchesPattern(fileName: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    return fileName.endsWith(pattern.slice(1));
  }
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
    );
    return regex.test(fileName);
  }
  return fileName.includes(pattern);
}

export async function searchWorkspaceFiles(
  workspacePath: string,
  pattern: string,
  maxFiles = DEFAULT_MAX_FILES,
): Promise<SearchFilesResult> {
  const root = resolve(workspacePath);
  const files: string[] = [];
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (truncated) return;

    let items: Dirent[];
    try {
      items = await readdir(dir, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }

    for (const item of items) {
      if (truncated) return;
      const name = String(item.name);

      if (item.isDirectory()) {
        if (IGNORE_DIRS.has(name) || name.startsWith(".")) continue;
        await walk(join(dir, name));
      } else if (item.isFile()) {
        if (matchesPattern(name, pattern)) {
          files.push(relative(root, join(dir, name)).replace(/\\/g, "/"));
          if (files.length >= maxFiles) {
            truncated = true;
            return;
          }
        }
      }
    }
  }

  await walk(root);
  return { files, truncated };
}
