import type { ParseJob } from "../types/repo-scanner.types";

const LANGUAGE_TO_JOB_LANGUAGE: Record<string, string> = {
  TypeScript: "typescript",
  JavaScript: "javascript",
  Python: "python",
  Java: "java",
  Go: "go",
  Rust: "rust",
  Ruby: "ruby",
  PHP: "php",
  "C#": "csharp",
  "C++": "cpp",
  C: "c",
  Kotlin: "kotlin",
  Swift: "swift",
  Vue: "vue",
  Svelte: "svelte",
  Shell: "shell",
  Unknown: "unknown",
};

/**
 * Generates parse jobs from pipeline source files.
 * Each job corresponds to one AST parsing request for a worker.
 */
export class JobGeneratorService {
  /** Normalize language name to lowercase job format (e.g. "TypeScript" → "typescript"). */
  normalizeLanguage(language: string): string {
    return LANGUAGE_TO_JOB_LANGUAGE[language] ?? language.toLowerCase().replace(/\s+/g, "");
  }

  /**
   * Create one ParseJob per source file. Repo name is typically the repo identifier (e.g. "backend-service").
   */
  generateJobs(
    repoName: string,
    sourceFiles: Array<{ file: string; language: string; module: string }>
  ): ParseJob[] {
    return sourceFiles.map(({ file, language, module }) => ({
      repo: repoName,
      file,
      language: this.normalizeLanguage(language),
      module,
    }));
  }
}
