import { ipcMain } from "electron";
import { spawn } from "child_process";

function runGit(root: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: root });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err || `git exited ${code}`));
    });
    child.on("error", reject);
  });
}

export function setupGitService() {
  ipcMain.handle("git:branch", async (_e, root: string) => {
    try {
      return await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
    } catch {
      return "";
    }
  });

  ipcMain.handle("git:log", async (_e, root: string, relPath: string) => {
    try {
      const out = await runGit(root, ["log", "--oneline", "-20", "--", relPath]);
      return out ? out.split("\n").filter(Boolean) : [];
    } catch {
      return [];
    }
  });
}
