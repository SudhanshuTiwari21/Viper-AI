import type { ScannedFileEntry } from "../types/repo-scanner.types";
import type { PersistMetadataAdapter } from "../types/repo-scanner.types";

/**
 * Stores repo metadata + file metadata. Used by the Repo Scanner pipeline only.
 * Tables: repositories, repository_files.
 * Orchestrator does not touch this data; storage happens inside Repo Scanner.
 */
export interface RepoMetadataStoreAdapter {
  saveRepository(params: {
    repo_id: string;
    workspacePath: string;
    branch?: string;
  }): Promise<string>;
  insertRepositoryFiles(repoId: string, filesList: ScannedFileEntry[]): Promise<void>;
}

/**
 * Service that persists repo and file metadata (e.g. to Postgres).
 * Implements PersistMetadataAdapter so it can be passed as runRepoScanner options.persistMetadata.
 */
export class RepoMetadataStoreService implements PersistMetadataAdapter {
  private adapter: RepoMetadataStoreAdapter | null = null;

  setAdapter(adapter: RepoMetadataStoreAdapter): void {
    this.adapter = adapter;
  }

  async saveRepository(params: {
    repo_id: string;
    workspacePath: string;
    branch?: string;
  }): Promise<string> {
    if (!this.adapter) return `local-${params.workspacePath}`;
    return this.adapter.saveRepository(params);
  }

  async insertRepositoryFiles(repoId: string, filesList: ScannedFileEntry[]): Promise<void> {
    if (filesList.length === 0) return;
    if (this.adapter) await this.adapter.insertRepositoryFiles(repoId, filesList);
  }
}
