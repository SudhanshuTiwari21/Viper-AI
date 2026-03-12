export interface PatchChange {
  /**
   * 1-based inclusive start line in the original file.
   */
  startLine: number;
  /**
   * 1-based inclusive end line in the original file.
   */
  endLine: number;
  /**
   * Replacement content for the given range.
   * May contain multiple lines separated by newlines.
   */
  newContent: string;
}

export interface CodePatch {
  /**
   * Workspace-relative path, e.g. "src/auth/login.ts".
   */
  file: string;
  /**
   * List of line range replacements to apply to the file.
   */
  changes: PatchChange[];
}

export interface MultiFilePatch {
  /**
   * Patches across one or more files.
   */
  patches: CodePatch[];
  /**
   * Optional natural-language summary of the change.
   */
  summary?: string;
}

