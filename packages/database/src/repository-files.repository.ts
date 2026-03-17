import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { RepositoryFileRow } from "./types";

/** Rows per INSERT. pg has ~65535 param limit; 6 params/row => max ~10k. Use 2k for safety and speed. */
const BATCH_SIZE = 2000;

const VALID_TYPES = new Set<string>([
  "source",
  "test",
  "config",
  "documentation",
  "generated",
  "other",
]);

/**
 * Bulk insert repository file metadata. One INSERT per batch with many rows:
 *
 *   INSERT INTO repository_files (...) VALUES
 *     ($1, $2, $3, $4, $5, $6),
 *     ($7, $8, $9, ...),
 *     ...
 *
 * Not one INSERT per file — keeps large repos (e.g. 20k files) fast.
 * created_at uses table default.
 */
export async function insertRepositoryFiles(
  client: Pool,
  repoId: string,
  filesList: RepositoryFileRow[]
): Promise<void> {
  if (filesList.length === 0) return;

  for (let offset = 0; offset < filesList.length; offset += BATCH_SIZE) {
    const batch = filesList.slice(offset, offset + BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const row of batch) {
      const type = VALID_TYPES.has(row.type) ? row.type : "other";
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
      );
      values.push(randomUUID(), repoId, row.file, row.language, row.module, type);
      paramIndex += 6;
    }

    const sql = `INSERT INTO repository_files (id, repo_id, file_path, language, module, type)
VALUES ${placeholders.join(", ")}`;

    await client.query(sql, values);
  }
}
