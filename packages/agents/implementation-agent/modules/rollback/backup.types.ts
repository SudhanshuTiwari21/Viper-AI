export interface BackupFileEntry {
  file: string;
  existed: boolean;
  content: string;
}

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  workspacePath: string;
  files: BackupFileEntry[];
  previouslyStagedFiles: string[];
}
