import { readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { resolve, relative, join } from "node:path";
import type { DirectoryEntry, ListDirectoryResult, ListDirectoryOptions } from "../workspace-tools.types.js";

const DEFAULT_IGNORE = new Set([
  ".git",
  "node_modules",
  "dist",
  ".next",
  "build",
  "coverage",
  "__pycache__",
  ".turbo",
  ".cache",
  ".parcel-cache",
  ".output",
  ".nuxt",
  ".svelte-kit",
  "vendor",
  ".venv",
  "venv",
  ".tox",
  "target",
]);

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_ENTRIES = 200;

export async function listWorkspaceDirectory(
  workspacePath: string,
  relativePath = ".",
  opts?: ListDirectoryOptions,
): Promise<ListDirectoryResult> {
  const maxDepth = opts?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const ignore = new Set([...DEFAULT_IGNORE, ...(opts?.extraIgnore ?? [])]);

  const root = resolve(workspacePath);
  const startDir = resolve(workspacePath, relativePath);
  if (!startDir.startsWith(root)) {
    return { entries: [], truncated: false };
  }

  const entries: DirectoryEntry[] = [];
  let truncated = false;

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || truncated) return;

    let items: Dirent[];
    try {
      items = await readdir(dir, { withFileTypes: true }) as Dirent[];
    } catch {
      return;
    }

    items.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    for (const item of items) {
      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }

      const name = String(item.name);
      if (ignore.has(name) || name.startsWith(".")) continue;

      const fullPath = join(dir, name);
      const rel = relative(root, fullPath).replace(/\\/g, "/");

      if (item.isDirectory()) {
        entries.push({ name: rel, type: "directory" });
        await walk(fullPath, depth + 1);
      } else if (item.isFile()) {
        let sizeBytes: number | undefined;
        try {
          const s = await stat(fullPath);
          sizeBytes = s.size;
        } catch {
          /* skip size */
        }
        entries.push({ name: rel, type: "file", sizeBytes });
      }
    }
  }

  await walk(startDir, 0);
  return { entries, truncated };
}
