import path from "path";
import { FileType, type FileWithType } from "../types/file-classification.types";

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Folder path segments that indicate generated output (checked via path). */
const GENERATED_FOLDER_PATTERNS = [
  "dist/",
  "build/",
  "node_modules/",
  ".next/",
  ".nuxt/",
  ".output/",
  "out/",
  "target/", // Java/Maven
  "coverage/",
  ".turbo/",
  "__pycache__/",
  ".venv/",
  "venv/",
];

/** Extensions treated as source code. */
const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyw", ".pyi",
  ".go", ".rs", ".rb", ".java", ".kt", ".kts",
  ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp",
  ".cs", ".vb", ".swift", ".scala", ".sc", ".r",
  ".php", ".vue", ".svelte", ".sql",
]);

/** Extensions treated as documentation. */
const DOC_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst", ".adoc"]);

/** Config filenames (exact match, case-sensitive for common convention). */
const CONFIG_FILENAMES = new Set([
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "webpack.config.js",
  "next.config.js",
  "next.config.mjs",
  "tailwind.config.js",
  "dockerfile",
  "Dockerfile",
  ".env",
  ".env.example",
  ".env.local",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "requirements.txt",
  ".eslintrc",
  ".eslintrc.js",
  ".prettierrc",
  "jest.config.js",
  "vitest.config.ts",
]);

export class FileClassifierService {
  /**
   * Classify a single file using extension, folder location, and filename patterns.
   * Order: generated folders → test patterns → config → docs → source → other.
   */
  classifyFile(filePath: string): FileType {
    const normalized = normalizePath(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath);

    // 1. Generated folders (path location)
    for (const pattern of GENERATED_FOLDER_PATTERNS) {
      if (normalized.includes(pattern)) {
        return FileType.GENERATED;
      }
    }

    // 2. Test files (filename patterns)
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes(".test.") ||
      lowerName.includes(".spec.") ||
      lowerName.includes(".e2e.") ||
      lowerName.includes("_test.") ||
      /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java)$/.test(lowerName)
    ) {
      return FileType.TEST;
    }

    // 3. Config files (filename)
    if (CONFIG_FILENAMES.has(name) || name.endsWith(".config.js") || name.endsWith(".config.ts") || name.endsWith(".config.mjs")) {
      return FileType.CONFIG;
    }
    if (name.endsWith(".json") && (name.includes("config") || name.includes("tsconfig") || name.includes("jsconfig"))) {
      return FileType.CONFIG;
    }

    // 4. Documentation (extension)
    if (DOC_EXTENSIONS.has(ext)) {
      return FileType.DOCUMENTATION;
    }

    // 5. Source code (extension)
    if (SOURCE_EXTENSIONS.has(ext)) {
      return FileType.SOURCE;
    }

    return FileType.OTHER;
  }

  /**
   * Classify all files. Use filterByType() downstream to get e.g. source-only for AST parsing.
   */
  classifyAll(files: string[]): FileWithType[] {
    return files.map((file) => ({
      file,
      type: this.classifyFile(file),
    }));
  }

  /**
   * Return only files of the given type(s). Useful for e.g. source → AST, generated → ignore.
   */
  filterByType(classified: FileWithType[], ...types: FileType[]): FileWithType[] {
    const set = new Set(types);
    return classified.filter((entry) => set.has(entry.type));
  }
}
