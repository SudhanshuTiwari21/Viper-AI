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

  ipcMain.handle("git:status", async (_e, root: string) => {
    try {
      const out = await runGit(root, ["status", "--porcelain=v1"]);
      if (!out) return [];
      return out.split("\n").filter(Boolean).map((line) => {
        const status = line.slice(0, 2);
        const file = line.slice(3);
        return { status: status.trim(), file };
      });
    } catch {
      return [];
    }
  });

  ipcMain.handle("git:diff", async (_e, root: string, filePath?: string) => {
    try {
      const args = ["diff"];
      if (filePath) args.push("--", filePath);
      return await runGit(root, args);
    } catch {
      return "";
    }
  });

  ipcMain.handle("git:stage", async (_e, root: string, filePath: string) => {
    try {
      await runGit(root, ["add", filePath]);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("git:unstage", async (_e, root: string, filePath: string) => {
    try {
      await runGit(root, ["reset", "HEAD", filePath]);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("git:commit", async (_e, root: string, message: string) => {
    try {
      await runGit(root, ["commit", "-m", message]);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("git:discard", async (_e, root: string, filePath: string) => {
    try {
      await runGit(root, ["checkout", "--", filePath]);
      return true;
    } catch {
      return false;
    }
  });

  // G.39: changed file names for the test assistant
  ipcMain.handle("git:diffNameOnly", async (_e, root: string) => {
    try {
      // Returns unstaged + staged changed files relative to HEAD
      const out = await runGit(root, ["diff", "--name-only", "HEAD"]);
      if (!out) return [];
      return out.split("\n").filter(Boolean);
    } catch {
      return [];
    }
  });

  // G.38: staged diff for the commit/PR assistant
  const MAX_DIFF_BYTES = 256 * 1024; // 256 KiB cap enforced in main process
  ipcMain.handle("git:diffStaged", async (_e, root: string) => {
    try {
      const out = await runGit(root, ["diff", "--cached"]);
      // Cap output to MAX_DIFF_BYTES before returning to renderer
      return out.length > MAX_DIFF_BYTES ? out.slice(0, MAX_DIFF_BYTES) : out;
    } catch {
      return "";
    }
  });
}
