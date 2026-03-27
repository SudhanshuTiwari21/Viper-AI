import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { resolve, relative, join, extname } from "node:path";
import type { TextMatch, SearchTextResult, SearchTextOptions } from "../workspace-tools.types.js";

const IGNORE_DIRS = new Set([
  ".git", "node_modules", "dist", ".next", "build", "coverage",
  "__pycache__", ".turbo", ".cache", "vendor", ".venv", "venv", "target",
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".pdf", ".wasm", ".exe", ".dll", ".so", ".dylib",
  ".bin", ".dat", ".db", ".sqlite", ".pyc", ".class", ".o", ".lock",
]);

const MAX_FILE_SIZE = 256 * 1024; // skip files > 256KB
const DEFAULT_MAX_MATCHES = 50;

function matchesGlob(fileName: string, glob: string): boolean {
  if (glob.startsWith("*.")) {
    return fileName.endsWith(glob.slice(1));
  }
  return fileName.includes(glob);
}

export async function searchWorkspaceText(
  workspacePath: string,
  pattern: string,
  opts?: SearchTextOptions,
): Promise<SearchTextResult> {
  const maxMatches = opts?.maxMatches ?? DEFAULT_MAX_MATCHES;
  const caseSensitive = opts?.caseSensitive ?? false;
  const glob = opts?.glob;

  const root = resolve(workspacePath);
  const matches: TextMatch[] = [];
  let filesSearched = 0;
  let truncated = false;

  const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();

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
        const ext = extname(name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;
        if (glob && !matchesGlob(name, glob)) continue;

        const fullPath = join(dir, name);
        try {
          const info = await stat(fullPath);
          if (info.size > MAX_FILE_SIZE) continue;

          const content = await readFile(fullPath, "utf-8");
          filesSearched++;
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            const compare = caseSensitive ? line : line.toLowerCase();
            if (compare.includes(searchPattern)) {
              matches.push({
                file: relative(root, fullPath).replace(/\\/g, "/"),
                line: i + 1,
                content: line.trimEnd().slice(0, 200),
              });
              if (matches.length >= maxMatches) {
                truncated = true;
                return;
              }
            }
          }
        } catch {
          /* skip unreadable files */
        }
      }
    }
  }

  await walk(root);
  return { matches, truncated, filesSearched };
}
