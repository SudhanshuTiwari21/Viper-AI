import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Patch } from "../../pipeline/implementation.types";
import { readFile } from "../file-manager/read-file";
import type { BackupSnapshot } from "./backup.types";

const BACKUP_DIR = ".viper/backups";

export function createBackupSnapshot(
  patch: Patch,
  workspacePath: string,
  previouslyStagedFiles: string[],
  logs: string[],
): string {
  const id = `rb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const backupRoot = resolve(workspacePath, BACKUP_DIR);
  if (!existsSync(backupRoot)) {
    mkdirSync(backupRoot, { recursive: true });
  }

  const snapshot: BackupSnapshot = {
    id,
    createdAt: new Date().toISOString(),
    workspacePath,
    files: [...new Set([
      ...patch.changes.map((c) => c.file),
      ...patch.operations.map((o) => o.file),
    ])].map((file) => {
      const current = readFile(workspacePath, file);
      return {
        file,
        existed: current !== null,
        content: current ?? "",
      };
    }),
    previouslyStagedFiles,
  };

  const outPath = resolve(backupRoot, `${id}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf-8");
  logs.push(`[Viper] Backup created: ${id}`);
  return id;
}

export function getBackupFilePath(
  workspacePath: string,
  rollbackId: string,
): string {
  return resolve(workspacePath, BACKUP_DIR, `${rollbackId}.json`);
}
