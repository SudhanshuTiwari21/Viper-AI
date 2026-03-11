export interface FileWalkerResult {
  /** Relative file paths (e.g. "src/auth/login.ts") */
  files: string[];
  /** Relative directory paths that were traversed */
  directories: string[];
}

export interface WalkOptions {
  /** Base path to resolve relative paths from (defaults to repoPath) */
  basePath?: string;
  /** Extra ignore patterns (e.g. "*.min.js"). Default list always applied. */
  ignorePatterns?: string[];
  /** If true, only include files (exclude directories from result) */
  filesOnly?: boolean;
}
