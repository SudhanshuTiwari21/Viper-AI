export interface RepoFetchResult {
  repoPath: string;
  branch: string;
}

export interface RepoScanResult extends RepoFetchResult {
  /** Relative file paths from repo root (File System Walker output) */
  files: string[];
}

export interface RepoScanWithLanguagesResult extends RepoFetchResult {
  /** File paths with detected language (Language Detector output) */
  filesWithLanguage: Array<{ file: string; language: string }>;
}

export interface RepoScanWithModulesResult extends RepoFetchResult {
  /** File paths with detected logical module (Module/Service Detector output) */
  filesWithModule: Array<{ file: string; module: string }>;
}

export interface RepoScanWithClassificationResult extends RepoFetchResult {
  /** File paths with classification type (File Classification output; source → AST, generated → ignore) */
  filesWithType: Array<{ file: string; type: string }>;
}

/** Single file entry from the full pipeline (language + module + type). */
export interface ScannedFileEntry {
  file: string;
  language: string;
  module: string;
  type: string;
}

/** Result of runRepoScanner: full pipeline output. Orchestrator pushes jobs to Redis if needed. */
export interface RepoScanPipelineResult extends RepoFetchResult {
  /** All scanned files with language, module, and classification. */
  files: ScannedFileEntry[];
  /** Source files only, ready for AST parsing. */
  sourceFiles: Array<{ file: string; language: string; module: string }>;
  /** Generated parse jobs (one per source file). Orchestrator sends to Redis queue. */
  jobs: ParseJob[];
}

/** One AST parse request job (pushed to Redis queue for workers). */
export interface ParseJob {
  repo: string;
  file: string;
  language: string;
  module: string;
}

/** Optional metadata persistence. Pipeline calls this after filterSource, before generateJobs. */
export interface PersistMetadataAdapter {
  saveRepository(params: {
    repoUrl: string;
    repoPath: string;
    branch: string;
  }): Promise<string>;
  insertRepositoryFiles(repoId: string, filesList: ScannedFileEntry[]): Promise<void>;
}

export interface RunRepoScannerOptions {
  persistMetadata?: PersistMetadataAdapter;
}
