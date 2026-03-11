/** File classification type for repository_files.type (matches Repo Scanner FileType enum values). */
export type RepositoryFileType =
  | "source"
  | "test"
  | "config"
  | "documentation"
  | "generated"
  | "other";

/** Row shape for insert into repository_files. */
export interface RepositoryFileRow {
  file: string;
  language: string;
  module: string;
  type: RepositoryFileType;
}

export interface RepositoryRow {
  id: string;
  repo_url: string;
  repo_name: string;
  branch: string;
  local_path: string;
  last_scanned_at: Date;
}
