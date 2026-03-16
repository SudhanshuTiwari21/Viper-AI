import type { RepoMetadataStoreAdapter } from "../services/repo-metadata-store.service";
import type { ScannedFileEntry } from "../types/repo-scanner.types";

/**
 * Minimal client for running SQL (e.g. pg Pool).
 * Use: new PostgresRepoMetadataAdapter(getPool()) from @repo/database.
 */
export interface PgQueryClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

const BATCH_SIZE = 2000;

/**
 * Postgres adapter for RepoMetadataStoreService.
 * Persists to repositories and repository_files (see packages/database migrations).
 */
export class PostgresRepoMetadataAdapter implements RepoMetadataStoreAdapter {
  constructor(private readonly client: PgQueryClient) {}

  async saveRepository(params: {
    repo_id: string;
    workspacePath: string;
    branch?: string;
  }): Promise<string> {
    await this.client.query(
      `INSERT INTO repositories (id, path)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [params.repo_id, params.workspacePath]
    );
    console.log("[Viper] repository persisted");
    return params.repo_id;
  }

  async insertRepositoryFiles(
    repoId: string,
    filesList: ScannedFileEntry[]
  ): Promise<void> {
    if (filesList.length === 0) return;

    for (let offset = 0; offset < filesList.length; offset += BATCH_SIZE) {
      const batch = filesList.slice(offset, offset + BATCH_SIZE);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const entry of batch) {
        placeholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`
        );
        values.push(repoId, entry.file, entry.language, entry.module);
        paramIndex += 4;
      }

      await this.client.query(
        `INSERT INTO repository_files (repo_id, file_path, language, module)
         VALUES ${placeholders.join(", ")}`,
        values
      );
    }
  }
}
