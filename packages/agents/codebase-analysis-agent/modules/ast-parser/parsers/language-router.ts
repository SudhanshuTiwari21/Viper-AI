/**
 * Maps job language to parser identifier and defines Tree-sitter–supported languages.
 * Viper AI v1: top 8 languages with real AST (tree-sitter). Others fall back to heuristic.
 */

/** Languages that have a tree-sitter grammar loaded (v1 supported set). */
export const SUPPORTED_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "cpp",
  "csharp",
] as const;

export type SupportedLanguageKey = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_TO_PARSER: Record<string, string> = {
  typescript: "tree-sitter-typescript",
  javascript: "tree-sitter-javascript",
  python: "tree-sitter-python",
  go: "tree-sitter-go",
  rust: "tree-sitter-rust",
  java: "tree-sitter-java",
  cpp: "tree-sitter-cpp",
  csharp: "tree-sitter-c-sharp",
  ruby: "tree-sitter-ruby",
  php: "tree-sitter-php",
  c: "tree-sitter-c",
  kotlin: "tree-sitter-kotlin",
  swift: "tree-sitter-swift",
  vue: "tree-sitter-vue",
  svelte: "tree-sitter-svelte",
  shell: "tree-sitter-bash",
  unknown: "generic",
};

export function getParserForLanguage(language: string): string {
  const normalized = language.toLowerCase().replace(/\s+/g, "");
  return LANGUAGE_TO_PARSER[normalized] ?? LANGUAGE_TO_PARSER.unknown ?? "generic";
}

/** True if we have a tree-sitter grammar for this language (use real parser). */
export function isTreeSitterSupported(language: string): boolean {
  const normalized = language.toLowerCase().replace(/\s+/g, "") as SupportedLanguageKey;
  return SUPPORTED_LANGUAGES.includes(normalized);
}
