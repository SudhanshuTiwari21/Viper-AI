export interface ReadFileResult {
  content: string;
  lines: number;
  truncated: boolean;
  /** Byte size of the original file (before any truncation). */
  sizeBytes: number;
}

export interface DirectoryEntry {
  /** Path relative to the workspace root (forward-slash separated). */
  name: string;
  type: "file" | "directory";
  sizeBytes?: number;
}

export interface ListDirectoryResult {
  entries: DirectoryEntry[];
  truncated: boolean;
}

export interface ListDirectoryOptions {
  maxDepth?: number;
  maxEntries?: number;
  /** Extra directory names to ignore (merged with built-in list). */
  extraIgnore?: string[];
}

export interface TextMatch {
  file: string;
  line: number;
  content: string;
}

export interface SearchTextResult {
  matches: TextMatch[];
  truncated: boolean;
  filesSearched: number;
}

export interface SearchTextOptions {
  /** Glob pattern to restrict which files are searched (e.g. "*.ts"). */
  glob?: string;
  maxMatches?: number;
  caseSensitive?: boolean;
}

export interface SearchFilesResult {
  files: string[];
  truncated: boolean;
}

export interface EditFileResult {
  success: boolean;
  error?: string;
  file?: string;
  linesChanged?: number;
  contextSnippet?: string;
}

export interface CreateFileResult {
  success: boolean;
  error?: string;
  file?: string;
  lines?: number;
  overwritten?: boolean;
}

export interface RunCommandResult {
  success: boolean;
  exitCode: number;
  output: string;
  error?: string;
}
