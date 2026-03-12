import path from "path";
import fs from "fs/promises";
import { app, dialog, ipcMain } from "electron";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".viper",
  ".next",
  ".cache",
  ".turbo",
  "out",
  ".nuxt",
  ".output",
  "coverage",
  ".parcel-cache",
  ".vite",
]);

export const WORKSPACES_ROOT = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? app.getPath("home"),
  ".viper",
  "workspaces"
);

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

async function readDirRecursive(root: string, dir: string): Promise<FileNode[]> {
  const full = path.join(root, dir);
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await fs.readdir(full, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

    const rel = path.join(dir, entry.name);
    const node: FileNode = {
      name: entry.name,
      path: rel,
      isDirectory: entry.isDirectory(),
    };
    if (entry.isDirectory()) {
      node.children = await readDirRecursive(root, rel);
    }
    nodes.push(node);
  }
  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function setupWorkspaceService() {
  ipcMain.handle("workspace:list", async (_e, root: string | null) => {
    if (!root) return { root: null, tree: [] };
    const tree = await readDirRecursive(root, ".");
    return { root, tree };
  });

  ipcMain.handle("workspace:select", async () => {
    const home = app.getPath("home");
    const res = await dialog.showOpenDialog({
      title: "Open Folder",
      defaultPath: home,
      properties: ["openDirectory"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const selected = res.filePaths[0];
    const tree = await readDirRecursive(selected, ".");
    return { root: selected, tree };
  });
}
