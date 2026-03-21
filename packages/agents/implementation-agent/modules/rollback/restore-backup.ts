import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { BackupSnapshot } from "./backup.types";
import { getBackupFilePath } from "./create-backup";
import { writeFile } from "../file-manager/write-file";
import { restoreGitStaging } from "../git/git-staging";

export function restoreBackupSnapshot(
  workspacePath: string,
  rollbackId: string,
  logs: string[],
): boolean {
  const backupFile = getBackupFilePath(workspacePath, rollbackId);
  if (!existsSync(backupFile)) {
    logs.push(`[Viper] Backup not found for rollback: ${rollbackId}`);
    return false;
  }

  const raw = readFileSync(backupFile, "utf-8");
  const snapshot = JSON.parse(raw) as BackupSnapshot;

  for (const entry of snapshot.files) {
    if (entry.existed) {
      writeFile(workspacePath, entry.file, entry.content);
      logs.push(`[Viper] Restored file: ${entry.file}`);
    } else {
      const abs = resolve(workspacePath, entry.file);
      rmSync(abs, { force: true });
      logs.push(`[Viper] Removed created file: ${entry.file}`);
    }
  }

  restoreGitStaging(
    workspacePath,
    snapshot.files.map((f) => f.file),
    snapshot.previouslyStagedFiles,
    logs,
  );

  logs.push(`[Viper] Rollback completed: ${rollbackId}`);
  return true;
}
