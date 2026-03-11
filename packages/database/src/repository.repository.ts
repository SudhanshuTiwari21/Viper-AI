import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Pool } from "pg";

export interface SaveRepositoryParams {
  repoUrl: string;
  repoPath: string;
  branch: string;
}

/**
 * Insert repository metadata and return the new repository id (uuid).
 */
export async function saveRepository(
  client: Pool,
  params: SaveRepositoryParams
): Promise<string> {
  const id = randomUUID();
  const repoName = path.basename(params.repoPath);
  const now = new Date();

  await client.query(
    `INSERT INTO repositories (id, repo_url, repo_name, branch, local_path, last_scanned_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, params.repoUrl, repoName, params.branch, params.repoPath, now]
  );

  return id;
}
