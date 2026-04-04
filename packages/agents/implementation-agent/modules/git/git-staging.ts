import { spawnSync } from "node:child_process";

function isGitRepo(workspacePath: string): boolean {
  const check = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: workspacePath,
    encoding: "utf-8",
  });
  return check.status === 0;
}

export function captureStagedFiles(workspacePath: string): string[] {
  if (!isGitRepo(workspacePath)) {
    return [];
  }

  const res = spawnSync("git", ["diff", "--name-only", "--cached"], {
    cwd: workspacePath,
    encoding: "utf-8",
  });
  if (res.status !== 0) {
    return [];
  }
  return res.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stageFiles(
  workspacePath: string,
  files: string[],
  logs: string[],
): void {
  if (files.length === 0) {
    return;
  }
  if (!isGitRepo(workspacePath)) {
    logs.push("[Viper] Git staging skipped: not a git repository");
    return;
  }

  const res = spawnSync("git", ["add", "--", ...files], {
    cwd: workspacePath,
    encoding: "utf-8",
  });
  if (res.status !== 0) {
    logs.push(`[Viper] Git add failed: ${res.stderr || "unknown error"}`);
    return;
  }
  logs.push(`[Viper] Git staged ${files.length} file(s)`);
}

export function restoreGitStaging(
  workspacePath: string,
  changedFiles: string[],
  previouslyStagedFiles: string[],
  logs: string[],
): void {
  if (!isGitRepo(workspacePath)) {
    logs.push("[Viper] Git staging restore skipped: not a git repository");
    return;
  }

  if (changedFiles.length > 0) {
    spawnSync("git", ["reset", "-q", "HEAD", "--", ...changedFiles], {
      cwd: workspacePath,
      encoding: "utf-8",
    });
  }

  if (previouslyStagedFiles.length > 0) {
    const reAdd = spawnSync("git", ["add", "--", ...previouslyStagedFiles], {
      cwd: workspacePath,
      encoding: "utf-8",
    });
    if (reAdd.status !== 0) {
      logs.push(
        `[Viper] Restoring previous git staging failed: ${reAdd.stderr || "unknown error"}`,
      );
      return;
    }
  }

  logs.push("[Viper] Git staging restored from backup snapshot");
}
