import fs from "fs/promises";
import path from "path";
import type { FileWithLanguage, LanguageDetectorOptions } from "../types/language-detector.types";

/** File extension (lowercase, with dot) → language name */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".pyw": "Python",
  ".pyi": "Python",
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".go": "Go",
  ".rs": "Rust",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".vb": "VB.NET",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".c": "C",
  ".h": "C",
  ".hpp": "C++",
  ".swift": "Swift",
  ".scala": "Scala",
  ".sc": "Scala",
  ".r": "R",
  ".sql": "SQL",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".fish": "Shell",
  ".ps1": "PowerShell",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".md": "Markdown",
  ".mdx": "MDX",
  ".xml": "XML",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
};

/** Shebang interpreter → language name */
const SHEBANG_TO_LANGUAGE: Record<string, string> = {
  node: "JavaScript",
  "node.exe": "JavaScript",
  "ts-node": "TypeScript",
  "tsx": "TypeScript",
  python: "Python",
  python2: "Python",
  python3: "Python",
  "python3.11": "Python",
  "python3.12": "Python",
  ruby: "Ruby",
  perl: "Perl",
  bash: "Shell",
  sh: "Shell",
  zsh: "Shell",
  fish: "Shell",
  php: "PHP",
};

/** Project config file → primary language (for repo-level fallback) */
const PROJECT_CONFIG_LANGUAGE: Record<string, string> = {
  "package.json": "JavaScript",
  "go.mod": "Go",
  "go.sum": "Go",
  "pom.xml": "Java",
  "build.gradle": "Java",
  "build.gradle.kts": "Kotlin",
  "Cargo.toml": "Rust",
  "Cargo.lock": "Rust",
  "requirements.txt": "Python",
  "pyproject.toml": "Python",
  "setup.py": "Python",
  "setup.cfg": "Python",
  "*.csproj": "C#",
  "*.sln": "C#",
};

const DEFAULT_OPTIONS: Required<LanguageDetectorOptions> = {
  useShebang: true,
  useProjectConfig: true,
};

export class LanguageDetectorService {
  /**
   * Detect language from file extension only.
   */
  detectByExtension(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] ?? null;
  }

  /**
   * Detect language from shebang (first line #!...) when extension is missing or ambiguous.
   */
  async detectByShebang(repoPath: string, filePath: string): Promise<string | null> {
    const fullPath = path.join(repoPath, filePath);
    try {
      const fh = await fs.open(fullPath, "r");
      const { buffer } = await fh.read(Buffer.alloc(120), 0, 120, 0);
      await fh.close();
      const firstLine = buffer.toString("utf8", 0, 120).split("\n")[0];
      const shebangMatch = firstLine?.match(/^#!\s*(?:\/usr\/bin\/env\s+)?(\S+)/);
      const captured = shebangMatch?.[1];
      if (!captured) return null;
      const interpreter = path.basename(captured).toLowerCase();
      return SHEBANG_TO_LANGUAGE[interpreter] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Infer repo-level language from project config files (package.json, go.mod, pom.xml, etc.).
   */
  async detectByProjectConfig(repoPath: string): Promise<string | null> {
    const entries = await fs.readdir(repoPath).catch(() => []);
    const names = new Set(entries as string[]);
    for (const [config, lang] of Object.entries(PROJECT_CONFIG_LANGUAGE)) {
      if (config.startsWith("*")) {
        const suffix = config.slice(1);
        const found = (entries as string[]).find((e) => e.endsWith(suffix));
        if (found) return lang;
      } else if (names.has(config)) {
        return lang;
      }
    }
    return null;
  }

  /**
   * Detect language for a single file: extension → shebang → project config → "Unknown".
   */
  async detect(
    repoPath: string,
    filePath: string,
    options: LanguageDetectorOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const byExt = this.detectByExtension(filePath);
    if (byExt) return byExt;
    if (opts.useShebang) {
      const byShebang = await this.detectByShebang(repoPath, filePath);
      if (byShebang) return byShebang;
    }
    if (opts.useProjectConfig) {
      const byConfig = await this.detectByProjectConfig(repoPath);
      if (byConfig) return byConfig;
    }
    return "Unknown";
  }

  /**
   * Detect language for all files (e.g. from File System Walker output).
   */
  async detectAll(
    repoPath: string,
    files: string[],
    options: LanguageDetectorOptions = {}
  ): Promise<FileWithLanguage[]> {
    const projectLang = options.useProjectConfig
      ? await this.detectByProjectConfig(repoPath)
      : null;
    const results: FileWithLanguage[] = [];
    for (const file of files) {
      const byExt = this.detectByExtension(file);
      if (byExt) {
        results.push({ file, language: byExt });
        continue;
      }
      if (options.useShebang !== false) {
        const byShebang = await this.detectByShebang(repoPath, file);
        if (byShebang) {
          results.push({ file, language: byShebang });
          continue;
        }
      }
      results.push({
        file,
        language: projectLang ?? "Unknown",
      });
    }
    return results;
  }
}
